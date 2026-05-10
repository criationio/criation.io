import { type NextRequest, NextResponse } from 'next/server'

import { decrypt } from '@/lib/encryption'
import { billingLogger } from '@/lib/logger'
import {
  enqueueDlq,
  insertEventIdempotent,
  recordProcessedWebhook,
} from '@/lib/db/queries/gateway-events'
import {
  getConnectionById,
  incrementWebhookFailures,
  recordWebhookEvent,
} from '@/lib/db/queries/connections'
import { eduzzAdapter } from '@/lib/services/gateways/eduzz'
import { hotmartAdapter } from '@/lib/services/gateways/hotmart'
import { kiwifyAdapter } from '@/lib/services/gateways/kiwify'
import type { GatewayAdapter, GatewayProvider } from '@/lib/services/gateways/types'
import { triggerProcessGatewayEvent } from '@/lib/trigger/client'

/**
 * Endpoint unico de webhook para todos os gateways.
 *
 * URL pattern: `/api/webhooks/gateway/{provider}/{connection_id}`
 *
 * Contrato:
 * 1. Le RAW body (necessario para HMAC)
 * 2. Carrega connection + webhook secret
 * 3. Valida assinatura via adapter — fail closed
 * 4. Dedup via `processed_webhook_events` UNIQUE (provider, event_id)
 * 5. INSERT em `gateway_events` (idempotente via UNIQUE workspace+provider+event)
 * 6. Enqueue Trigger.dev `processGatewayEvent`
 * 7. Retorna 200 em < 5s SEMPRE — Hotmart abandona apos 5x retry
 *
 * Em qualquer falha pos-validacao: INSERT em DLQ + retorna 200 (re-enviar
 * nao ajuda se nosso parser quebrou). Logger sempre captura para alerta.
 */

const ADAPTERS: Partial<Record<GatewayProvider, GatewayAdapter>> = {
  hotmart: hotmartAdapter,
  kiwify: kiwifyAdapter,
  eduzz: eduzzAdapter,
}

interface RouteContext {
  params: Promise<{ provider: string; connection_id: string }>
}

export async function POST(req: NextRequest, ctx: RouteContext) {
  const { provider: rawProvider, connection_id: connectionId } = await ctx.params
  const provider = rawProvider as GatewayProvider
  const adapter = ADAPTERS[provider]

  // Provider nao suportado — devolve 404 sem tocar em DB
  if (!adapter) {
    billingLogger.warn({ provider, connectionId }, 'gateway webhook: unsupported provider')
    return NextResponse.json({ ok: false, error: 'unsupported_provider' }, { status: 404 })
  }

  const rawBody = await req.text()

  // 1. Carrega connection
  const connection = await getConnectionById(connectionId).catch(() => null)
  if (!connection) {
    billingLogger.warn({ provider, connectionId }, 'gateway webhook: connection not found')
    // 404 evita que retries Hotmart fiquem batendo eternamente em endpoint que nao existe
    return NextResponse.json({ ok: false, error: 'connection_not_found' }, { status: 404 })
  }

  if (connection.provider !== provider) {
    billingLogger.warn(
      { provider, connectionProvider: connection.provider, connectionId },
      'gateway webhook: provider mismatch'
    )
    return NextResponse.json({ ok: false, error: 'provider_mismatch' }, { status: 400 })
  }

  // 2. Decrypt webhook secret
  if (!connection.webhookSecret) {
    billingLogger.error(
      { connectionId },
      'gateway webhook: missing webhook_secret on connection (run setup wizard again)'
    )
    return NextResponse.json({ ok: false, error: 'webhook_secret_missing' }, { status: 500 })
  }

  let webhookSecret: string
  try {
    webhookSecret = decrypt(connection.webhookSecret)
  } catch (err) {
    billingLogger.error(
      { connectionId, err: (err as Error).message },
      'gateway webhook: decrypt webhook_secret failed'
    )
    return NextResponse.json({ ok: false, error: 'decrypt_failed' }, { status: 500 })
  }

  // 3. Valida assinatura
  const sigCheck = adapter.validateSignature(
    rawBody,
    req.headers,
    { webhookSecret },
    { url: req.nextUrl }
  )
  if (!sigCheck.valid) {
    billingLogger.warn(
      { provider, connectionId, reason: sigCheck.reason },
      'gateway webhook: signature invalid'
    )
    await incrementWebhookFailures(connectionId).catch(() => {})
    // 401 explicito pra cliente debugar — mas Hotmart vai retentar
    return NextResponse.json({ ok: false, error: 'invalid_signature' }, { status: 401 })
  }

  // 4-6. Parse + dedup + INSERT + enqueue. Tudo dentro de try-catch porque
  // a partir daqui assinatura ja esta validada — qualquer falha vai pra DLQ
  // e devolvemos 200 (Hotmart nao deve retentar).
  try {
    const parsed = adapter.parseWebhook(rawBody, req.headers)
    const normalized = adapter.normalizeEvent(parsed)

    // Captura metadata de request para debug + defesa em camadas (rate limit
    // por IP, IP allowlist, descoberta de mecanismos de auth do provider).
    // Whitelist de headers — evita persistir cookies/authorization de borda.
    const requestMeta = buildRequestMeta(req)
    const rawPayloadWithMeta = {
      ...(normalized.rawPayload as Record<string, unknown>),
      _request_meta: requestMeta,
    }

    // 4. Dedup global via processed_webhook_events
    const dedup = await recordProcessedWebhook(
      provider,
      normalized.providerEventId,
      normalized.eventType
    )
    if (dedup.alreadyProcessed) {
      billingLogger.info(
        { provider, connectionId, providerEventId: normalized.providerEventId },
        'gateway webhook: duplicate event ignored'
      )
      return NextResponse.json({ ok: true, deduplicated: true })
    }

    // 5. INSERT em gateway_events
    const { event, created } = await insertEventIdempotent({
      workspaceId: connection.workspaceId,
      connectionId: connection.id,
      provider,
      eventType: normalized.eventType,
      providerEventId: normalized.providerEventId,
      providerEventVersion: normalized.providerEventVersion,
      productId: normalized.productId || null,
      amountCents: normalized.amountCents,
      currency: normalized.currency,
      recurrenceNumber: normalized.recurrenceNumber,
      subscriberCode: normalized.subscriberCode,
      subscriptionStatus: normalized.subscriptionStatus,
      planId: normalized.planId,
      paymentMethod: normalized.paymentMethod,
      installmentsNumber: normalized.installmentsNumber,
      feeCents: normalized.feeCents,
      producerNetCents: normalized.producerNetCents,
      commissionAffiliateCents: normalized.commissionAffiliateCents,
      affiliateEmailHash: normalized.affiliateEmailHash,
      affiliateSource: normalized.affiliateSource,
      origin: normalized.attribution.origin,
      externalCode: normalized.attribution.externalCode,
      buyerCountry: normalized.buyerCountry,
      customerEmailHash: normalized.buyerEmailHash,
      customerPhoneHash: normalized.buyerPhoneHash,
      buyerDocumentHash: normalized.buyerDocumentHash,
      utmSource: normalized.attribution.utms?.source,
      utmMedium: normalized.attribution.utms?.medium,
      utmCampaign: normalized.attribution.utms?.campaign,
      utmContent: normalized.attribution.utms?.content,
      utmTerm: normalized.attribution.utms?.term,
      fbclid: normalized.attribution.fbclid,
      gclid: normalized.attribution.gclid,
      ttclid: normalized.attribution.ttclid,
      creationDateMs: normalized.occurredAtMs,
      allocationStatus: 'pending',
      allocationIdempotencyKey: normalized.allocationIdempotencyKey,
      rawPayload: rawPayloadWithMeta,
    })

    await recordWebhookEvent(connection.id, normalized.providerEventId).catch(() => {})

    // 6. Enqueue Trigger.dev (apenas se foi insert novo — duplicates ja
    // processadas nao precisam re-trigger)
    if (created) {
      await triggerProcessGatewayEvent({
        eventId: event.id,
        workspaceId: connection.workspaceId,
        connectionId: connection.id,
      }).catch((err: unknown) => {
        // Trigger.dev down nao deve quebrar o ack para Hotmart — task fica
        // pendente e proximo cron de catch-up vai pegar via processedAt IS NULL
        billingLogger.error(
          { eventId: event.id, err: (err as Error).message },
          'gateway webhook: trigger.dev enqueue failed (will retry via cron)'
        )
      })
    }

    return NextResponse.json({ ok: true, eventId: event.id, deduplicated: !created })
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    billingLogger.error(
      { provider, connectionId, err: errorMessage },
      'gateway webhook: parse/process failed — going to DLQ'
    )
    await enqueueDlq({
      workspaceId: connection.workspaceId,
      provider,
      rawPayload: { rawBody, headers: Object.fromEntries(req.headers.entries()) },
      errorMessage,
    }).catch(() => {})
    // Devolve 200 — Hotmart re-enviar nao ajuda se nosso parser quebrou
    return NextResponse.json({ ok: true, dlq: true })
  }
}

/**
 * Whitelist de headers seguros para persistir em `_request_meta`.
 * Evita capturar cookies/authorization/secrets que possam vazar via
 * query/dump. Inclui todos os `x-*` (specifico de provider) e infra basica.
 */
const SAFE_HEADER_PREFIXES = ['x-']
const SAFE_HEADER_NAMES = new Set([
  'host',
  'user-agent',
  'content-type',
  'content-length',
  'accept',
  'accept-encoding',
  'cf-connecting-ip',
  'cf-ipcountry',
  'cf-ray',
])

function buildRequestMeta(req: NextRequest): Record<string, unknown> {
  const headers: Record<string, string> = {}
  for (const [name, value] of req.headers.entries()) {
    const lower = name.toLowerCase()
    if (SAFE_HEADER_NAMES.has(lower) || SAFE_HEADER_PREFIXES.some((p) => lower.startsWith(p))) {
      headers[lower] = value
    }
  }
  return {
    url: req.nextUrl.toString(),
    pathname: req.nextUrl.pathname,
    search_params: Object.fromEntries(req.nextUrl.searchParams.entries()),
    method: req.method,
    headers,
    received_at: new Date().toISOString(),
  }
}
