import { decrypt, encrypt } from '@/lib/encryption'
import { db } from '@/lib/db'
import {
  countCapiEventLogAttempts,
  getGatewayEventById,
  getTrackingEventById,
  insertCapiEventLog,
  updateFanoutGoogleStatus,
  upsertCapiEvent,
} from '@/lib/db/queries/capi'
import {
  getActiveGoogleConnectionByWorkspace,
  getMappingForEvent,
  listAdsAccountsByConnection,
} from '@/lib/db/queries/google-connections'
import { googleConnections } from '@/lib/db/schema/connections'
import type { GatewayEvent, NewCapiEvent } from '@/lib/db/schema'
import { capiLogger } from '@/lib/logger'
import { GoogleApiError, refreshAccessToken } from '@/lib/services/google.service'
import { eq } from 'drizzle-orm'

import {
  buildDataManagerUrl,
  buildGoogleDataManagerPayload,
  type DataManagerIngestPayload,
  type GoogleBuildMeta,
} from './google.adapter'

/**
 * Orquestrador do fanout Google Data Manager API — Sessao 1.4.9.B (ADR-015).
 *
 * Trigger.dev task chama com `(trackingEventId, trackingEventTs, gatewayEventId?)`.
 * Service:
 *  1. Carrega tracking_event fresh (idempotency: skip se ja `sent`)
 *  2. Carrega google_connection active do workspace
 *  3. Carrega mapping pra event_name -> productDestinationId
 *  4. Carrega google_ads_account default ou via mapping
 *  5. Decripta access_token (refresh inline se proximo do vencimento)
 *  6. Carrega gateway_event opcional
 *  7. buildGoogleDataManagerPayload — pode retornar `skip`
 *  8. POST datamanager.googleapis.com/v1/events:ingest com timeout 10s +
 *     Authorization Bearer
 *  9. Persiste capi_events (provider='google') + capi_event_log
 *  10. Atualiza tracking_events.fanout_google_status
 *
 * Retry strategy: erro de rede ou 5xx => retry. 4xx (config/validation) =>
 * sem retry. MAX_FANOUT_ATTEMPTS=10 corta loop cron→trigger→cron.
 */

const GOOGLE_DM_TIMEOUT_MS = 10_000
const MAX_FANOUT_ATTEMPTS = 10

/**
 * Refresh se access_token expira em menos de 5min — buffer pra evitar
 * race com chamada que demora a sair da fila.
 */
const TOKEN_EXPIRY_BUFFER_MS = 5 * 60 * 1000

export interface ProcessGoogleFanoutInput {
  trackingEventId: string
  trackingEventTs: Date
  gatewayEventId?: string
}

export type ProcessGoogleFanoutResult =
  | { kind: 'sent'; capiEventId: string; httpStatus: number; requestId: string | null }
  | { kind: 'skipped'; reason: string }
  | { kind: 'failed'; error: string; httpStatus?: number; retry: boolean }
  | { kind: 'not_found' }
  | { kind: 'no_connection' }
  | { kind: 'no_mapping' }
  | { kind: 'no_account' }

export async function processGoogleDataManagerFanout(
  input: ProcessGoogleFanoutInput
): Promise<ProcessGoogleFanoutResult> {
  const trackingEvent = await getTrackingEventById(input.trackingEventId, input.trackingEventTs)
  if (!trackingEvent) return { kind: 'not_found' }

  if (trackingEvent.fanoutGoogleStatus === 'sent') {
    return { kind: 'skipped', reason: 'already_sent' }
  }

  const connection = await getActiveGoogleConnectionByWorkspace(trackingEvent.workspaceId)
  if (!connection) {
    capiLogger.info(
      { workspaceId: trackingEvent.workspaceId, eventId: trackingEvent.eventId },
      'google fanout: no active google_connection — skipping'
    )
    return { kind: 'no_connection' }
  }

  if (!connection.grantedDataManagerScope) {
    capiLogger.warn(
      { workspaceId: trackingEvent.workspaceId, connectionId: connection.id },
      'google fanout: auth/datamanager scope nao concedido — skip'
    )
    await updateFanoutGoogleStatus({
      id: trackingEvent.id,
      eventTs: trackingEvent.eventTs,
      status: 'skipped',
      errorMessage: 'missing_data_manager_scope',
    })
    return { kind: 'skipped', reason: 'missing_data_manager_scope' }
  }

  // Mapping (event_name -> productDestinationId)
  const mapping = await getMappingForEvent(trackingEvent.workspaceId, trackingEvent.eventName)
  if (!mapping) {
    capiLogger.info(
      { workspaceId: trackingEvent.workspaceId, eventName: trackingEvent.eventName },
      'google fanout: sem mapping para event_name — skip'
    )
    await updateFanoutGoogleStatus({
      id: trackingEvent.id,
      eventTs: trackingEvent.eventTs,
      status: 'skipped',
      errorMessage: 'no_conversion_action_mapping',
    })
    return { kind: 'no_mapping' }
  }

  // Carrega google_ads_account via mapping
  const allAccounts = await listAdsAccountsByConnection(connection.id)
  const account = allAccounts.find((a) => a.id === mapping.googleAdsAccountId)
  if (!account) {
    capiLogger.warn(
      {
        workspaceId: trackingEvent.workspaceId,
        mappingId: mapping.id,
      },
      'google fanout: mapping aponta pra google_ads_account inexistente — skip'
    )
    await updateFanoutGoogleStatus({
      id: trackingEvent.id,
      eventTs: trackingEvent.eventTs,
      status: 'skipped',
      errorMessage: 'mapping_account_missing',
    })
    return { kind: 'no_account' }
  }

  // Decripta access_token + refresh se proximo do vencimento
  let accessToken: string
  try {
    accessToken = await ensureFreshAccessToken(connection)
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'token_refresh_failed'
    capiLogger.error(
      { err, workspaceId: trackingEvent.workspaceId },
      'google fanout: token refresh/decrypt falhou'
    )
    await updateFanoutGoogleStatus({
      id: trackingEvent.id,
      eventTs: trackingEvent.eventTs,
      status: 'failed',
      errorMessage: errMsg,
    })
    return { kind: 'failed', error: errMsg, retry: false }
  }

  let gatewayEvent: GatewayEvent | null = null
  if (input.gatewayEventId) {
    gatewayEvent = await getGatewayEventById(input.gatewayEventId)
  }

  const buildResult = buildGoogleDataManagerPayload({
    trackingEvent,
    gatewayEvent,
    connection: {
      accessToken,
      dataManagerApiVersion: connection.dataManagerApiVersion,
      testMode: connection.testMode,
    },
    account: {
      customerId: account.customerId,
      managerCustomerId: account.managerCustomerId,
      loginCustomerId: account.loginCustomerId,
      isManager: account.isManager,
    },
    mapping: {
      productDestinationId: mapping.productDestinationId,
      internalEventName: mapping.internalEventName,
      conversionActionType: mapping.conversionActionType,
    },
  })

  if (buildResult.kind === 'skip') {
    capiLogger.info(
      {
        workspaceId: trackingEvent.workspaceId,
        eventId: trackingEvent.eventId,
        reason: buildResult.reason,
      },
      'google fanout: build skipped'
    )
    await updateFanoutGoogleStatus({
      id: trackingEvent.id,
      eventTs: trackingEvent.eventTs,
      status: 'skipped',
      errorMessage: buildResult.reason,
    })
    await persistSkippedCapiEvent(trackingEvent, gatewayEvent, buildResult.reason)
    return { kind: 'skipped', reason: buildResult.reason }
  }

  // POST pra Data Manager API
  const url = buildDataManagerUrl(connection.dataManagerApiVersion)
  const dispatchResult = await dispatchToGoogle(url, accessToken, buildResult.payload)

  const capiEventId = await persistCapiEvent({
    trackingEvent,
    gatewayEvent,
    payload: buildResult.payload,
    pixelOrCustomerId: account.customerId,
    dispatchResult,
    buildMeta: buildResult.meta,
    testMode: connection.testMode,
  })

  if (dispatchResult.kind === 'success') {
    await updateFanoutGoogleStatus({
      id: trackingEvent.id,
      eventTs: trackingEvent.eventTs,
      status: 'sent',
      errorMessage: null,
    })
    return {
      kind: 'sent',
      capiEventId,
      httpStatus: dispatchResult.status,
      requestId: dispatchResult.requestId,
    }
  }

  // Failure path
  const retryEligible = dispatchResult.kind === 'network_error' || dispatchResult.status >= 500
  const attemptCount = await countCapiEventLogAttempts(capiEventId)
  const exhausted = attemptCount >= MAX_FANOUT_ATTEMPTS
  const retry = retryEligible && !exhausted

  if (exhausted && retryEligible) {
    capiLogger.warn(
      {
        workspaceId: trackingEvent.workspaceId,
        eventId: trackingEvent.eventId,
        attemptCount,
        error: dispatchResult.error,
      },
      'google fanout: max attempts exhausted — giving up retry'
    )
  }

  await updateFanoutGoogleStatus({
    id: trackingEvent.id,
    eventTs: trackingEvent.eventTs,
    status: retry ? 'pending' : 'failed',
    errorMessage: dispatchResult.error,
  })
  const failed: ProcessGoogleFanoutResult = { kind: 'failed', error: dispatchResult.error, retry }
  if (dispatchResult.kind === 'http_error') {
    return { ...failed, httpStatus: dispatchResult.status }
  }
  return failed
}

// ---------------------------------------------------------------------------
// Token refresh inline
// ---------------------------------------------------------------------------

async function ensureFreshAccessToken(
  connection: Awaited<ReturnType<typeof getActiveGoogleConnectionByWorkspace>>
): Promise<string> {
  if (!connection) throw new Error('no_connection')
  const expiresAt = connection.tokenExpiresAt?.getTime() ?? 0
  const needsRefresh = !expiresAt || expiresAt - Date.now() < TOKEN_EXPIRY_BUFFER_MS

  if (!needsRefresh) {
    return decrypt(connection.encryptedAccessToken)
  }

  if (!connection.encryptedRefreshToken) {
    // Sem refresh_token — so podemos tentar o access atual; se 401, fanout falha
    capiLogger.warn(
      { connectionId: connection.id },
      'google fanout: access expirou mas sem refresh_token — usando access atual'
    )
    return decrypt(connection.encryptedAccessToken)
  }

  const refreshToken = decrypt(connection.encryptedRefreshToken)
  let refreshed: Awaited<ReturnType<typeof refreshAccessToken>>
  try {
    refreshed = await refreshAccessToken({ refreshToken })
  } catch (err) {
    // Audit P1-2 fix: invalid_grant aqui significa refresh_token revogado
    // (user revogou OAuth grant, password change, etc). Sem marcar expired,
    // workspace queima 24h de retries ate cron `google-token-refresh-cron`
    // descobrir. Pesa connection.status='expired' + invalidated timestamp
    // imediato pra wizard mostrar "reconecte Google" e fanout pular.
    if (err instanceof GoogleApiError && err.errorCode === 'invalid_grant') {
      capiLogger.warn(
        { connectionId: connection.id, workspaceId: connection.workspaceId },
        'google fanout: refresh_token invalid_grant detected inline — marking expired'
      )
      await db
        .update(googleConnections)
        .set({
          status: 'expired',
          refreshTokenInvalidatedAt: new Date(),
          tokenRefreshFailures: connection.tokenRefreshFailures + 1,
        })
        .where(eq(googleConnections.id, connection.id))
    }
    throw err
  }

  // Persistir novo access (refresh_token nao vem em refresh response)
  const newEncrypted = encrypt(refreshed.accessToken)
  const newExpiresAt = new Date(Date.now() + refreshed.expiresInSeconds * 1000)
  await db
    .update(googleConnections)
    .set({
      encryptedAccessToken: newEncrypted,
      tokenExpiresAt: newExpiresAt,
      encryptionKeyVersion: newEncrypted.split(':')[0] ?? 'v1',
      lastTokenRefreshAt: new Date(),
      tokenRefreshFailures: 0,
    })
    .where(eq(googleConnections.id, connection.id))

  capiLogger.info({ connectionId: connection.id }, 'google fanout: access_token refreshed inline')
  return refreshed.accessToken
}

// ---------------------------------------------------------------------------
// HTTP dispatch
// ---------------------------------------------------------------------------

type GoogleDispatchResult =
  | {
      kind: 'success'
      status: number
      body: Record<string, unknown>
      raw: string
      requestId: string | null
    }
  | {
      kind: 'http_error'
      status: number
      body: Record<string, unknown>
      raw: string
      error: string
    }
  | { kind: 'network_error'; error: string }

async function dispatchToGoogle(
  url: string,
  accessToken: string,
  payload: DataManagerIngestPayload
): Promise<GoogleDispatchResult> {
  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(GOOGLE_DM_TIMEOUT_MS),
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
    // non-JSON
  }

  const requestId = typeof body.requestId === 'string' ? body.requestId : null

  if (response.status >= 200 && response.status < 300) {
    return { kind: 'success', status: response.status, body, raw, requestId }
  }

  // Data Manager API erros: { error: { code, message, errors[] } }
  const errMsg = extractErrorMessage(body) ?? `http_${response.status}`
  return {
    kind: 'http_error',
    status: response.status,
    body,
    raw,
    error: errMsg,
  }
}

function extractErrorMessage(body: Record<string, unknown>): string | null {
  const err = body.error
  if (err && typeof err === 'object') {
    const message = (err as Record<string, unknown>).message
    if (typeof message === 'string') return message
  }
  return null
}

// ---------------------------------------------------------------------------
// Persistence helpers
// ---------------------------------------------------------------------------

async function persistCapiEvent(args: {
  trackingEvent: NonNullable<Awaited<ReturnType<typeof getTrackingEventById>>>
  gatewayEvent: GatewayEvent | null
  payload: DataManagerIngestPayload
  pixelOrCustomerId: string
  dispatchResult: GoogleDispatchResult
  buildMeta: GoogleBuildMeta
  testMode: boolean
}): Promise<string> {
  const { trackingEvent, gatewayEvent, payload, dispatchResult, buildMeta, testMode } = args
  const status: NewCapiEvent['status'] = dispatchResult.kind === 'success' ? 'sent' : 'failed'
  const requestId = dispatchResult.kind === 'success' ? dispatchResult.requestId : null

  // P2-2 fix: single cast — UserData interface ja e shape-compatible com jsonb.
  // Aceito Record<string, unknown> via type assertion direto sem `as unknown as`.
  const userDataJson = (payload.events[0]?.userData ?? null) as Record<string, unknown> | null

  const row: NewCapiEvent = {
    workspaceId: trackingEvent.workspaceId,
    gatewayEventId: gatewayEvent?.id ?? null,
    provider: 'google',
    eventName: trackingEvent.eventName,
    eventId: buildMeta.eventId,
    eventTime: trackingEvent.eventTs,
    userData: userDataJson,
    customData: null,
    status,
    responseData:
      dispatchResult.kind === 'success' || dispatchResult.kind === 'http_error'
        ? dispatchResult.body
        : null,
    sentAt: dispatchResult.kind === 'success' ? new Date() : null,
    // Meta-only fields preservam quando aplicavel
    eventSourceUrl: trackingEvent.pageUrl,
    actionSource: 'website',
    // Google P1 fields
    googleCustomerId: buildMeta.customerId,
    googleProductDestinationId: buildMeta.productDestinationId,
    googleClickIdUsed: buildMeta.clickIdValue,
    googleClickIdType: buildMeta.clickIdType,
    googleUserIdentifiersCount: buildMeta.userIdentifiersCount,
    googleConsentAdUserData: buildMeta.consentAdUserData,
    googleConsentAdPersonalization: buildMeta.consentAdPersonalization,
    googleOrderId: buildMeta.orderId,
    googleRequestId: requestId,
    googleValidateOnly: testMode,
    googleLoginCustomerId: buildMeta.loginCustomerId,
  }

  const capiEventId = await upsertCapiEvent(row)

  const previousAttempts = await countCapiEventLogAttempts(capiEventId)
  await insertCapiEventLog({
    capiEventId,
    attempt: previousAttempts + 1,
    // P2-2 fix: single cast em vez de `as unknown as` — DataManagerIngestPayload
    // e shape-compatible com jsonb (todos campos serializaveis).
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

async function persistSkippedCapiEvent(
  trackingEvent: NonNullable<Awaited<ReturnType<typeof getTrackingEventById>>>,
  gatewayEvent: GatewayEvent | null,
  reason: string
): Promise<void> {
  const row: NewCapiEvent = {
    workspaceId: trackingEvent.workspaceId,
    gatewayEventId: gatewayEvent?.id ?? null,
    provider: 'google',
    eventName: trackingEvent.eventName,
    eventId: trackingEvent.eventId,
    eventTime: trackingEvent.eventTs,
    status: 'skipped',
    responseData: { skip_reason: reason },
  }
  await upsertCapiEvent(row)
}
