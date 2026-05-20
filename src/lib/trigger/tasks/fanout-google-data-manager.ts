import { logger, schedules, task } from '@trigger.dev/sdk/v3'

import { generateCorrelationId, withCorrelation } from '@/lib/correlation'
import { listPendingGoogleFanout } from '@/lib/db/queries/capi'
import { processGoogleDataManagerFanout } from '@/lib/services/capi/google.service'

/**
 * Trigger.dev v3 task — fanout Google Data Manager API (Sessao 1.4.9.B, ADR-015).
 *
 * Espelha o pattern de fanout-meta-capi: single-event processor que delega
 * pra `processGoogleDataManagerFanout` (service orquestrador).
 *
 * Retry strategy:
 *  - Service classifica resultado em sent/skipped/failed(retry|noretry)/not_found/
 *    no_connection/no_mapping/no_account.
 *  - Quando `failed + retry=true`: task LANCA erro pro Trigger.dev re-triggar
 *    com backoff exponencial.
 *  - Quando `failed + retry=false`: task RETORNA normal (service ja persistiu
 *    status='failed' em tracking_events + capi_events).
 *  - Outros resultados (sent, skipped, not_found, no_connection, no_mapping,
 *    no_account): retorna normal — fluxo natural.
 *
 * Idempotencia:
 *  - Service short-circuit se `fanout_google_status='sent'` ja
 *  - MAX_FANOUT_ATTEMPTS=10 corta loop cron→trigger→cron (replicado do Meta).
 *  - idempotencyKey por trackingEventId (+ gatewayEventId quando retro re-fanout
 *    da 1.4.B). Trigger.dev v3 retorna handle do run existente em vez de criar
 *    duplicata quando key colide.
 *
 * Wiring inicial pendente (step 9): `process-tracking-event` vai enfileirar
 * essa task apos persistir tracking_event (paralelo ao Meta CAPI).
 *
 * Latencia alvo p95 < 2.5s (1 fetch Data Manager API com timeout 10s + 2 INSERTs +
 * eventual token refresh inline).
 */

interface Payload {
  trackingEventId: string
  /** ISO 8601 — usado pra partition pruning em tracking_events. */
  trackingEventTs: string
  /** Opcional — preenchido pelo re-fanout retroativo (step 9). */
  gatewayEventId?: string
  correlationId?: string
}

/**
 * Idempotency key pra dedup de triggers. Garante que initial enqueue
 * (process-tracking-event) + cron pickup + retro re-fanout NAO disparem runs
 * paralelos pro mesmo evento. Mesmo pattern do Meta (audit P3 #19).
 *
 * Inclui gatewayEventId pra distinguir retro re-fanout (com gateway link) de
 * initial fanout (sem) — sao 2 logical events distintos.
 */
export function fanoutGoogleDataManagerIdempotencyKey(
  trackingEventId: string,
  gatewayEventId?: string
): string {
  return gatewayEventId
    ? `google-fanout:${trackingEventId}:gw:${gatewayEventId}`
    : `google-fanout:${trackingEventId}`
}

export const fanoutGoogleDataManagerTask = task({
  id: 'fanout-google-data-manager',
  maxDuration: 30,
  // 5 retries cobre transient network + Google 5xx + RESOURCE_EXHAUSTED rate
  // limit. Backoff exponencial: 1s, 2s, 4s, 8s, 16s. Total wait <= ~30s.
  retry: { maxAttempts: 5, factor: 2, minTimeoutInMs: 1000, maxTimeoutInMs: 16_000 },
  run: async (payload: Payload) => {
    const cid = payload.correlationId ?? generateCorrelationId()
    return withCorrelation(cid, async () => {
      const eventTs = new Date(payload.trackingEventTs)

      logger.info('fanout-google-data-manager start', {
        correlationId: cid,
        trackingEventId: payload.trackingEventId,
        eventTs: payload.trackingEventTs,
        hasGatewayEvent: !!payload.gatewayEventId,
      })

      const input: { trackingEventId: string; trackingEventTs: Date; gatewayEventId?: string } = {
        trackingEventId: payload.trackingEventId,
        trackingEventTs: eventTs,
      }
      if (payload.gatewayEventId) {
        input.gatewayEventId = payload.gatewayEventId
      }
      const result = await processGoogleDataManagerFanout(input)

      if (result.kind === 'failed' && result.retry) {
        logger.warn('fanout-google-data-manager retry-eligible failure', {
          correlationId: cid,
          trackingEventId: payload.trackingEventId,
          error: result.error,
          httpStatus: result.httpStatus,
        })
        throw new Error(`fanout-google-data-manager retry: ${result.error}`)
      }

      logger.info('fanout-google-data-manager done', {
        correlationId: cid,
        trackingEventId: payload.trackingEventId,
        kind: result.kind,
      })
      return result
    })
  },
})

/**
 * Cron defensivo — sweep de tracking_events `fanout_google_status='pending'`
 * parados ha > 5min. Cobre scenarios onde:
 *  - process-tracking-event falhou em enqueue (rede caiu na hora)
 *  - enqueue retornou success mas task nunca rodou (worker stale)
 *  - Re-fanout retroativo nao foi enfileirado
 *
 * Janela 5min < event_ts < 7d: 5min pra dar tempo do enqueue normal rodar
 * primeiro; 7d como bound de catch-up.
 *
 * Batch 100 events por run, cap 20 per workspace (audit P1 #5 replicado pra
 * Google). Cron roda a cada 10min, processa max 600/h. Suficiente pra catch-up apos
 * ~1h downtime sem overload.
 */
export const fanoutGoogleDataManagerPickupCron = schedules.task({
  id: 'fanout-google-data-manager-pickup-cron',
  cron: '*/10 * * * *',
  maxDuration: 60,
  run: async () => {
    const cid = generateCorrelationId()
    return withCorrelation(cid, async () => {
      const pending = await listPendingGoogleFanout(100)

      logger.info('fanout-google-data-manager-pickup found', {
        correlationId: cid,
        count: pending.length,
      })

      if (pending.length === 0) {
        return { triggered: 0 }
      }

      // Cada pickup gera correlationId proprio (sweep defensivo).
      const handles = await Promise.allSettled(
        pending.map((evt) =>
          fanoutGoogleDataManagerTask.trigger(
            {
              trackingEventId: evt.id,
              trackingEventTs: evt.eventTs.toISOString(),
              correlationId: generateCorrelationId(),
            },
            { idempotencyKey: fanoutGoogleDataManagerIdempotencyKey(evt.id) }
          )
        )
      )

      const triggered = handles.filter((h) => h.status === 'fulfilled').length
      const failed = handles.length - triggered

      if (failed > 0) {
        logger.warn('fanout-google-data-manager-pickup: alguns enqueues falharam', {
          correlationId: cid,
          triggered,
          failed,
        })
      }

      return { triggered, failed }
    })
  },
})
