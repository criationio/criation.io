import { decrypt } from '@/lib/encryption'
import {
  countCapiEventLogAttempts,
  getActiveMetaConnection,
  getGatewayEventById,
  getTrackingEventById,
  insertCapiEventLog,
  updateFanoutMetaStatus,
  upsertCapiEvent,
} from '@/lib/db/queries/capi'
import type { GatewayEvent, NewCapiEvent } from '@/lib/db/schema'
import { capiLogger } from '@/lib/logger'

import {
  buildCapiUrl,
  buildMetaCapiPayload,
  type CapiEvent as CapiEventPayload,
  type CapiPayload,
} from './meta.adapter'

/**
 * Orquestrador do fanout Meta CAPI — Sessao 1.4.9.
 *
 * Trigger.dev task chama com `(trackingEventId, trackingEventTs)`. Service:
 *  1. Carrega tracking_event fresh (idempotency: skip se ja `sent`)
 *  2. Carrega meta_connection active do workspace
 *  3. Carrega gateway_event opcional (apenas re-fanout retroativo passa)
 *  4. Decripta access_token (versionado, security/encryption)
 *  5. Chama buildMetaCapiPayload — pode retornar `skip` (consent, internal event)
 *  6. POST graph.facebook.com/{version}/{pixel_id}/events com timeout 10s
 *  7. Persiste capi_events (upsert por UNIQUE) + capi_event_log (append-only audit)
 *  8. Atualiza tracking_events.fanout_meta_status
 *
 * Retry strategy: erro de rede ou 5xx => return `retry: true` (Trigger.dev re-trigger).
 * 4xx config error (bad pixel/token) => return `retry: false`, status='failed'.
 * Consent denied / internal event => persiste status='skipped' (audit), nao retry.
 */

const META_CAPI_TIMEOUT_MS = 10_000

export interface ProcessFanoutInput {
  trackingEventId: string
  trackingEventTs: Date
  /** Opcional — preenchido por re-fanout retroativo (1.4.9 step 8) quando
   * tracking_event.matched_buyer_email_hash foi populado pela 1.4.B e
   * temos o gateway_event correspondente identificado. */
  gatewayEventId?: string
}

export type ProcessFanoutResult =
  | { kind: 'sent'; capiEventId: string; httpStatus: number }
  | { kind: 'skipped'; reason: string }
  | { kind: 'failed'; error: string; httpStatus?: number; retry: boolean }
  | { kind: 'not_found' }
  | { kind: 'no_connection' }

export async function processMetaCapiFanout(
  input: ProcessFanoutInput
): Promise<ProcessFanoutResult> {
  const trackingEvent = await getTrackingEventById(input.trackingEventId, input.trackingEventTs)
  if (!trackingEvent) {
    return { kind: 'not_found' }
  }

  // Idempotency: short-circuit se ja enviado com sucesso.
  if (trackingEvent.fanoutMetaStatus === 'sent') {
    return { kind: 'skipped', reason: 'already_sent' }
  }

  const connection = await getActiveMetaConnection(trackingEvent.workspaceId)
  if (!connection) {
    capiLogger.info(
      { workspaceId: trackingEvent.workspaceId, eventId: trackingEvent.eventId },
      'capi: no active meta_connection — skipping fanout'
    )
    return { kind: 'no_connection' }
  }

  let gatewayEvent: GatewayEvent | null = null
  if (input.gatewayEventId) {
    gatewayEvent = await getGatewayEventById(input.gatewayEventId)
  }

  // Decrypt access_token (failure here = config error, no retry)
  let accessToken: string
  try {
    accessToken = decrypt(connection.encryptedAccessToken)
  } catch (err) {
    capiLogger.error(
      { err, workspaceId: trackingEvent.workspaceId },
      'capi: decrypt access_token failed'
    )
    await updateFanoutMetaStatus({
      id: trackingEvent.id,
      eventTs: trackingEvent.eventTs,
      status: 'failed',
      errorMessage: 'decrypt_failed',
    })
    return { kind: 'failed', error: 'decrypt_failed', retry: false }
  }

  const buildResult = buildMetaCapiPayload({
    trackingEvent,
    gatewayEvent,
    connection: {
      pixelId: connection.pixelId ?? '',
      accessToken,
      marketingApiVersion: connection.marketingApiVersion,
      partnerAgent: connection.partnerAgent,
      testEventCode: connection.testEventCode,
    },
  })

  if (buildResult.kind === 'skip') {
    capiLogger.info(
      {
        workspaceId: trackingEvent.workspaceId,
        eventId: trackingEvent.eventId,
        reason: buildResult.reason,
      },
      'capi: build skipped'
    )
    await updateFanoutMetaStatus({
      id: trackingEvent.id,
      eventTs: trackingEvent.eventTs,
      status: 'skipped',
      errorMessage: buildResult.reason,
    })
    // Persiste capi_events com status=skipped pra auditoria.
    await persistSkippedCapiEvent(trackingEvent, gatewayEvent, buildResult.reason)
    return { kind: 'skipped', reason: buildResult.reason }
  }

  // POST pra Meta
  const url = buildCapiUrl(buildResult.pixelId, connection.marketingApiVersion, accessToken)
  const dispatchResult = await dispatchToMeta(url, buildResult.payload)

  // Persist capi_events (upsert) + capi_event_log (append) sempre — auditoria
  // funciona inclusive em failures.
  const capiEventId = await persistCapiEvent({
    trackingEvent,
    gatewayEvent,
    payload: buildResult.payload,
    payloadEvent: buildResult.payload.data[0]!,
    pixelId: buildResult.pixelId,
    dispatchResult,
    buildMeta: buildResult.meta,
    connection,
  })

  if (dispatchResult.kind === 'success') {
    await updateFanoutMetaStatus({
      id: trackingEvent.id,
      eventTs: trackingEvent.eventTs,
      status: 'sent',
      errorMessage: null,
    })
    return { kind: 'sent', capiEventId, httpStatus: dispatchResult.status }
  }

  // failure path
  const retry = dispatchResult.kind === 'network_error' || dispatchResult.status >= 500
  await updateFanoutMetaStatus({
    id: trackingEvent.id,
    eventTs: trackingEvent.eventTs,
    status: retry ? 'pending' : 'failed',
    errorMessage: dispatchResult.error,
  })
  const failed: ProcessFanoutResult = { kind: 'failed', error: dispatchResult.error, retry }
  if (dispatchResult.kind === 'http_error') {
    return { ...failed, httpStatus: dispatchResult.status }
  }
  return failed
}

// ---------------------------------------------------------------------------
// HTTP dispatch
// ---------------------------------------------------------------------------

type DispatchResult =
  | { kind: 'success'; status: number; body: Record<string, unknown>; raw: string }
  | {
      kind: 'http_error'
      status: number
      body: Record<string, unknown>
      raw: string
      error: string
    }
  | { kind: 'network_error'; error: string }

async function dispatchToMeta(url: string, payload: CapiPayload): Promise<DispatchResult> {
  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(META_CAPI_TIMEOUT_MS),
    })
  } catch (err) {
    const error = err instanceof Error ? err.message : 'network_error'
    return { kind: 'network_error', error }
  }

  const raw = await response.text()
  let body: Record<string, unknown> = {}
  try {
    body = JSON.parse(raw) as Record<string, unknown>
  } catch {
    // Non-JSON response (HTML error page, etc) — preserva raw
  }

  if (response.status >= 200 && response.status < 300) {
    return { kind: 'success', status: response.status, body, raw }
  }
  return {
    kind: 'http_error',
    status: response.status,
    body,
    raw,
    error: `http_${response.status}`,
  }
}

// ---------------------------------------------------------------------------
// Persistence helpers
// ---------------------------------------------------------------------------

async function persistCapiEvent(args: {
  trackingEvent: NonNullable<Awaited<ReturnType<typeof getTrackingEventById>>>
  gatewayEvent: GatewayEvent | null
  payload: CapiPayload
  payloadEvent: CapiEventPayload
  pixelId: string
  dispatchResult: DispatchResult
  buildMeta: { eventId: string; lduActive: boolean; postMatch: boolean }
  connection: NonNullable<Awaited<ReturnType<typeof getActiveMetaConnection>>>
}): Promise<string> {
  const {
    trackingEvent,
    gatewayEvent,
    payload,
    payloadEvent,
    pixelId,
    dispatchResult,
    buildMeta,
    connection,
  } = args

  const status: NewCapiEvent['status'] = dispatchResult.kind === 'success' ? 'sent' : 'failed'

  const row: NewCapiEvent = {
    workspaceId: trackingEvent.workspaceId,
    gatewayEventId: gatewayEvent?.id ?? null,
    provider: 'meta',
    eventName: payloadEvent.event_name,
    eventId: buildMeta.eventId,
    eventTime: trackingEvent.eventTs,
    userData: payloadEvent.user_data as Record<string, unknown>,
    customData: (payloadEvent.custom_data ?? null) as Record<string, unknown> | null,
    status,
    responseData:
      dispatchResult.kind === 'success' || dispatchResult.kind === 'http_error'
        ? dispatchResult.body
        : null,
    sentAt: dispatchResult.kind === 'success' ? new Date() : null,
    // Meta P1 fields
    eventSourceUrl: payloadEvent.event_source_url ?? null,
    actionSource: payloadEvent.action_source,
    clientIpAddress: payloadEvent.user_data.client_ip_address ?? null,
    clientUserAgent: payloadEvent.user_data.client_user_agent ?? null,
    fbc: payloadEvent.user_data.fbc ?? null,
    fbp: payloadEvent.user_data.fbp ?? null,
    externalIdHash: payloadEvent.user_data.external_id?.[0] ?? null,
    dataProcessingOptions: payloadEvent.data_processing_options ?? null,
    dataProcessingOptionsCountry: payloadEvent.data_processing_options_country ?? null,
    dataProcessingOptionsState: payloadEvent.data_processing_options_state ?? null,
    optOut: payloadEvent.opt_out ?? false,
    pixelId,
    partnerAgent: connection.partnerAgent,
    testEventCode: connection.testEventCode,
    messagingChannel: payloadEvent.messaging_channel ?? null,
    ctwaClid: trackingEvent.ctwaClid,
  }

  const capiEventId = await upsertCapiEvent(row)

  // Append-only log entry (attempt = count anteriores + 1)
  const previousAttempts = await countCapiEventLogAttempts(capiEventId)
  await insertCapiEventLog({
    capiEventId,
    attempt: previousAttempts + 1,
    requestPayload: payload as unknown as Record<string, unknown>,
    responsePayload:
      dispatchResult.kind === 'success' || dispatchResult.kind === 'http_error'
        ? dispatchResult.body
        : null,
    httpStatus:
      dispatchResult.kind === 'success' || dispatchResult.kind === 'http_error'
        ? dispatchResult.status
        : null,
    errorMessage: dispatchResult.kind !== 'success' ? dispatchResult.error : null,
  })

  return capiEventId
}

/**
 * Quando adapter retorna skip (consent denied, internal event), ainda
 * persistimos uma row em capi_events com status='skipped' pra auditoria.
 * Util pra dashboard de fanout mostrar "% skipped por consent".
 */
async function persistSkippedCapiEvent(
  trackingEvent: NonNullable<Awaited<ReturnType<typeof getTrackingEventById>>>,
  gatewayEvent: GatewayEvent | null,
  reason: string
): Promise<void> {
  const row: NewCapiEvent = {
    workspaceId: trackingEvent.workspaceId,
    gatewayEventId: gatewayEvent?.id ?? null,
    provider: 'meta',
    eventName: trackingEvent.eventName,
    eventId: trackingEvent.eventId,
    eventTime: trackingEvent.eventTs,
    status: 'skipped',
    responseData: { skip_reason: reason },
  }
  await upsertCapiEvent(row)
}
