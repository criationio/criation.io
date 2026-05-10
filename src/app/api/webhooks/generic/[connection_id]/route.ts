import crypto from 'node:crypto'

import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { decrypt } from '@/lib/encryption'
import { billingLogger } from '@/lib/logger'
import {
  getConnectionById,
  incrementWebhookFailures,
  recordWebhookEvent,
} from '@/lib/db/queries/connections'
import {
  enqueueDlq,
  insertEventIdempotent,
  recordProcessedWebhook,
} from '@/lib/db/queries/gateway-events'
import { hashDocument, hashEmail, hashPhone } from '@/lib/security/hash'
import { triggerProcessGatewayEvent, triggerStitchGatewayEvent } from '@/lib/trigger/client'

/**
 * Webhook generico para long-tail (Monetizze/Ticto/Cakto/etc) via n8n/Make/Zapier.
 *
 * Diferente do `/api/webhooks/gateway/[provider]/[connection_id]` (que usa
 * adapters dedicados), este endpoint aceita um shape **canonico** que o
 * cliente monta no flow Make/n8n.
 *
 * Auth (ADR-018 dec.4):
 * - Header `x-criation-token` (token plain — recomendado)
 * - OU `x-criation-signature: hmac_sha256(token, raw_body).hex()` (opcional avancado)
 *
 * Provider tag (ADR-018 dec.6): `generic:<sourceProvider>` quando declarado, senao `generic`.
 *
 * Schema esperado:
 * {
 *   "event_type": "PURCHASE_APPROVED",
 *   "amount_cents": 4990,
 *   "currency": "BRL",
 *   "buyer": { "email": "x@y.com", "phone": "+5511...", "document": "12345678910" },
 *   "tracking": { "external_code": "visitor-uuid", "utm_source": "fb", ... },
 *   "provider_event_id": "uuid-do-gateway-original",
 *   "occurred_at": "2026-05-10T...",
 *   "source_provider": "monetizze"  // opcional, override do connection
 * }
 */

const ostr = z.string().nullable().optional()
const onum = z.number().nullable().optional()

/** Eventos canonicos aceitos pelo webhook generico — bate com `NormalizedEventType`. */
const EVENT_TYPE_ENUM = z.enum([
  'PURCHASE_APPROVED',
  'PURCHASE_COMPLETE',
  'PURCHASE_REFUNDED',
  'PURCHASE_CHARGEBACK',
  'PURCHASE_CANCELED',
  'PURCHASE_REJECTED',
  'PURCHASE_BILLET_PRINTED',
  'PURCHASE_DELAYED',
  'PURCHASE_EXPIRED',
  'PURCHASE_OUT_OF_SHOPPING_CART',
  'PURCHASE_REFUND_REQUESTED',
  'PURCHASE_PROTEST',
  'PIX_GENERATED',
  'SUBSCRIPTION_CANCELLATION',
  'SUBSCRIPTION_REACTIVATED',
  'SUBSCRIPTION_RENEWED',
  'SUBSCRIPTION_LATE',
  'SWITCH_PLAN',
  'UPDATE_SUBSCRIPTION_CHARGE_DATE',
  'CLUB_FIRST_ACCESS',
  'CLUB_MODULE_COMPLETED',
  'UNKNOWN',
])

const genericPayloadSchema = z
  .object({
    event_type: EVENT_TYPE_ENUM,
    provider_event_id: z.string().min(1),
    occurred_at: z.string().optional(),
    amount_cents: onum,
    currency: ostr,
    product_id: ostr,
    product_name: ostr,
    payment_method: ostr,
    installments: onum,
    subscriber_code: ostr,
    source_provider: ostr,
    buyer: z
      .object({
        email: ostr,
        phone: ostr,
        document: ostr,
        country: ostr,
        name: ostr,
      })
      .partial()
      .passthrough()
      .optional(),
    tracking: z
      .object({
        external_code: ostr,
        utm_source: ostr,
        utm_medium: ostr,
        utm_campaign: ostr,
        utm_content: ostr,
        utm_term: ostr,
        src: ostr,
        sck: ostr,
        fbclid: ostr,
        gclid: ostr,
        ttclid: ostr,
      })
      .partial()
      .passthrough()
      .optional(),
    affiliate: z
      .object({ email: ostr, source: ostr, commission_cents: onum })
      .partial()
      .passthrough()
      .optional(),
  })
  .passthrough()

interface RouteContext {
  params: Promise<{ connection_id: string }>
}

export async function POST(req: NextRequest, ctx: RouteContext) {
  const { connection_id: connectionId } = await ctx.params
  const rawBody = await req.text()

  const connection = await getConnectionById(connectionId).catch(() => null)
  if (!connection) {
    billingLogger.warn({ connectionId }, 'generic webhook: connection not found')
    return NextResponse.json({ ok: false, error: 'connection_not_found' }, { status: 404 })
  }

  if (connection.provider !== 'generic') {
    return NextResponse.json({ ok: false, error: 'wrong_provider' }, { status: 400 })
  }

  if (!connection.webhookSecret) {
    return NextResponse.json({ ok: false, error: 'webhook_secret_missing' }, { status: 500 })
  }

  let webhookSecret: string
  try {
    webhookSecret = decrypt(connection.webhookSecret)
  } catch {
    return NextResponse.json({ ok: false, error: 'decrypt_failed' }, { status: 500 })
  }

  // Auth: token plain via header OU HMAC signature
  const tokenHeader = req.headers.get('x-criation-token')
  const sigHeader = req.headers.get('x-criation-signature')
  let valid = false

  if (tokenHeader && constantTimeEqual(tokenHeader.trim(), webhookSecret)) {
    valid = true
  } else if (sigHeader) {
    const expected = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex')
    if (constantTimeEqual(sigHeader.trim().toLowerCase(), expected.toLowerCase())) {
      valid = true
    }
  }

  if (!valid) {
    await incrementWebhookFailures(connectionId).catch(() => {})
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  // Parse + persist
  try {
    const json = JSON.parse(rawBody) as unknown
    const parsed = genericPayloadSchema.parse(json)

    // Source provider: prioriza payload, fallback pra connection.apiCredentials
    const apiCreds = connection.apiCredentials as
      | { sourceProvider?: string | null }
      | null
      | undefined
    const sourceProvider = parsed.source_provider ?? apiCreds?.sourceProvider ?? null
    const providerTag = sourceProvider ? `generic:${sourceProvider}` : 'generic'

    // Dedup global
    const dedup = await recordProcessedWebhook(
      providerTag,
      parsed.provider_event_id,
      parsed.event_type
    )
    if (dedup.alreadyProcessed) {
      return NextResponse.json({ ok: true, deduplicated: true })
    }

    // PII hashing inline
    const buyer = parsed.buyer ?? {}
    const tracking = parsed.tracking ?? {}
    const affiliate = parsed.affiliate ?? null

    const occurredAtMs = parsed.occurred_at
      ? Date.parse(parsed.occurred_at) || Date.now()
      : Date.now()

    const requestMeta = {
      url: req.nextUrl.toString(),
      method: req.method,
      headers: filterSafeHeaders(req.headers),
      received_at: new Date().toISOString(),
    }

    const { event, created } = await insertEventIdempotent({
      workspaceId: connection.workspaceId,
      connectionId: connection.id,
      provider: providerTag,
      // Zod ja valida event_type contra EVENT_TYPE_ENUM acima — cast seguro
      eventType: parsed.event_type,
      providerEventId: parsed.provider_event_id,
      providerEventVersion: '1.0.0',
      productId: parsed.product_id ?? null,
      amountCents: parsed.amount_cents ?? 0,
      currency: parsed.currency ?? 'BRL',
      subscriberCode: parsed.subscriber_code ?? undefined,
      paymentMethod: parsed.payment_method ?? undefined,
      installmentsNumber: parsed.installments ?? undefined,
      buyerCountry: buyer.country ?? undefined,
      customerEmailHash: buyer.email ? hashEmail(buyer.email) : undefined,
      customerPhoneHash: buyer.phone ? hashPhone(buyer.phone) : undefined,
      buyerDocumentHash: buyer.document ? hashDocument(buyer.document) : undefined,
      affiliateEmailHash: affiliate?.email ? hashEmail(affiliate.email) : undefined,
      affiliateSource: affiliate?.source ?? undefined,
      commissionAffiliateCents: affiliate?.commission_cents ?? undefined,
      origin: { src: tracking.src ?? undefined, sck: tracking.sck ?? undefined },
      externalCode: tracking.external_code ?? undefined,
      utmSource: tracking.utm_source ?? undefined,
      utmMedium: tracking.utm_medium ?? undefined,
      utmCampaign: tracking.utm_campaign ?? undefined,
      utmContent: tracking.utm_content ?? undefined,
      utmTerm: tracking.utm_term ?? undefined,
      fbclid: tracking.fbclid ?? undefined,
      gclid: tracking.gclid ?? undefined,
      ttclid: tracking.ttclid ?? undefined,
      creationDateMs: occurredAtMs,
      allocationStatus: 'pending',
      allocationIdempotencyKey: parsed.provider_event_id,
      rawPayload: redactPayload(parsed, requestMeta),
    })

    await recordWebhookEvent(connection.id, parsed.provider_event_id).catch(() => {})

    if (created) {
      await Promise.all([
        triggerProcessGatewayEvent({
          eventId: event.id,
          workspaceId: connection.workspaceId,
          connectionId: connection.id,
        }).catch((err: unknown) => {
          billingLogger.error(
            { eventId: event.id, err: (err as Error).message },
            'generic webhook: process trigger.dev enqueue failed'
          )
        }),
        triggerStitchGatewayEvent({
          eventId: event.id,
          workspaceId: connection.workspaceId,
        }).catch((err: unknown) => {
          billingLogger.error(
            { eventId: event.id, err: (err as Error).message },
            'generic webhook: stitch trigger.dev enqueue failed'
          )
        }),
      ])
    }

    return NextResponse.json({ ok: true, eventId: event.id, deduplicated: !created })
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    billingLogger.error(
      { connectionId, err: errorMessage },
      'generic webhook: parse failed — going to DLQ'
    )
    await enqueueDlq({
      workspaceId: connection.workspaceId,
      provider: 'generic',
      rawPayload: { rawBody, headers: Object.fromEntries(req.headers.entries()) },
      errorMessage,
    }).catch(() => {})
    return NextResponse.json({ ok: true, dlq: true })
  }
}

// ---------------------------------------------------------------------------

function constantTimeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8')
  const bufB = Buffer.from(b, 'utf8')
  if (bufA.length !== bufB.length) {
    crypto.timingSafeEqual(bufA, Buffer.alloc(bufA.length))
    return false
  }
  return crypto.timingSafeEqual(bufA, bufB)
}

const SAFE_HEADER_NAMES = new Set([
  'host',
  'user-agent',
  'content-type',
  'content-length',
  'cf-connecting-ip',
  'cf-ipcountry',
  'cf-ray',
])

function filterSafeHeaders(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [name, value] of headers.entries()) {
    const lower = name.toLowerCase()
    if (SAFE_HEADER_NAMES.has(lower) || lower.startsWith('x-')) {
      // Não persistimos x-criation-token (secret) por seguranca
      if (lower === 'x-criation-token' || lower === 'x-criation-signature') continue
      out[lower] = value
    }
  }
  return out
}

const REDACT_KEYS = new Set(['email', 'phone', 'document', 'name', 'cpf', 'cnpj'])

function redactPayload(
  parsed: z.infer<typeof genericPayloadSchema>,
  requestMeta: Record<string, unknown>
): Record<string, unknown> {
  const cloned = structuredClone(parsed) as unknown as Record<string, unknown>
  redactDeep(cloned)
  return { ...cloned, _request_meta: requestMeta }
}

function redactDeep(node: unknown): void {
  if (node == null || typeof node !== 'object') return
  if (Array.isArray(node)) {
    for (const item of node) redactDeep(item)
    return
  }
  const obj = node as Record<string, unknown>
  for (const key of Object.keys(obj)) {
    if (REDACT_KEYS.has(key) && obj[key] != null && typeof obj[key] !== 'object') {
      obj[key] = '[REDACTED]'
      continue
    }
    if (typeof obj[key] === 'object') redactDeep(obj[key])
  }
}
