import { logger, schedules, task } from '@trigger.dev/sdk/v3'

import { listPendingMetaFanout } from '@/lib/db/queries/capi'
import { processMetaCapiFanout } from '@/lib/services/capi/capi.service'

/**
 * Trigger.dev v3 task — fanout Meta CAPI (Sessao 1.4.9).
 *
 * Single-event processor: recebe `(trackingEventId, trackingEventTs)` +
 * opcionalmente `gatewayEventId` (re-fanout retroativo da 1.4.B), delega
 * pra `processMetaCapiFanout` (service que faz load + decrypt + build +
 * POST + persist).
 *
 * Retry strategy:
 *  - Service classifica resultado em sent/skipped/failed(retry|noretry).
 *  - Quando `failed + retry=true`: task LANCA erro pro Trigger.dev re-triggar
 *    com backoff exponencial nativo (config abaixo).
 *  - Quando `failed + retry=false`: task RETORNA normalmente (sucesso da
 *    task), o service ja persistiu status='failed' em tracking_events +
 *    capi_events pra dashboard mostrar.
 *  - Outros resultados (sent, skipped, not_found, no_connection): retorna
 *    normal — fluxo natural.
 *
 * Idempotente via:
 *  - Service short-circuit se `fanout_meta_status='sent'` ja
 *  - `capi_events` UNIQUE (workspace, provider, event_id, event_time) +
 *    upsert preserva audit chain via `capi_event_log` append-only
 *
 * Wiring inicial pendente (step 9): `process-tracking-event` vai enfileirar
 * essa task apos persistir tracking_event. Por enquanto so o cron pickup
 * (sweep defensivo) chama.
 *
 * Latencia alvo p95 < 2s (1 fetch Meta + 2 INSERTs).
 */

interface Payload {
  trackingEventId: string
  /** ISO 8601 — usado pra partition pruning em tracking_events. */
  trackingEventTs: string
  /** Opcional — preenchido pelo re-fanout retroativo (step 9). */
  gatewayEventId?: string
}

export const fanoutMetaCapiTask = task({
  id: 'fanout-meta-capi',
  maxDuration: 30,
  // 5 retries cobre transient network + Meta 5xx temporario. Backoff
  // exponencial: 1s, 2s, 4s, 8s, 16s. Total wait <= ~30s.
  retry: { maxAttempts: 5, factor: 2, minTimeoutInMs: 1000, maxTimeoutInMs: 16_000 },
  run: async (payload: Payload) => {
    const eventTs = new Date(payload.trackingEventTs)

    logger.info('fanout-meta-capi start', {
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
    const result = await processMetaCapiFanout(input)

    if (result.kind === 'failed' && result.retry) {
      // Lanca erro pra Trigger.dev acionar retry com backoff.
      logger.warn('fanout-meta-capi retry-eligible failure', {
        trackingEventId: payload.trackingEventId,
        error: result.error,
        httpStatus: result.httpStatus,
      })
      throw new Error(`fanout-meta-capi retry: ${result.error}`)
    }

    logger.info('fanout-meta-capi done', {
      trackingEventId: payload.trackingEventId,
      kind: result.kind,
    })
    return result
  },
})

/**
 * Cron defensivo — sweep de tracking_events `fanout_meta_status='pending'`
 * parados ha > 5min. Cobre scenarios onde:
 *  - process-tracking-event falhou em enqueue (rede caiu na hora)
 *  - enqueue retorno success mas task nunca rodou (worker stale)
 *  - Re-fanout retroativo nao foi enfileirado (TD futuro)
 *
 * Janela 5min < event_ts < 7d:
 *  - 5min: dar tempo pro enqueue normal rodar primeiro
 *  - 7d: bound do catch-up; eventos > 7d ficam pending pra sempre (manual fix)
 *
 * Batch 100 events por run — cron roda a cada 10min, processa max 600/h.
 * Suficiente pra catch-up apos ~1h downtime sem overload.
 */
export const fanoutMetaCapiPickupCron = schedules.task({
  id: 'fanout-meta-capi-pickup-cron',
  cron: '*/10 * * * *',
  maxDuration: 60,
  run: async () => {
    const pending = await listPendingMetaFanout(100)

    logger.info('fanout-meta-capi-pickup found', { count: pending.length })

    if (pending.length === 0) {
      return { triggered: 0 }
    }

    // Enqueue em paralelo (batch send). Trigger.dev v3 trigger nao bloqueia
    // ate o run; so reserva slot na queue.
    const handles = await Promise.allSettled(
      pending.map((evt) =>
        fanoutMetaCapiTask.trigger({
          trackingEventId: evt.id,
          trackingEventTs: evt.eventTs.toISOString(),
        })
      )
    )

    const triggered = handles.filter((h) => h.status === 'fulfilled').length
    const failed = handles.length - triggered

    if (failed > 0) {
      logger.warn('fanout-meta-capi-pickup: alguns enqueues falharam', { triggered, failed })
    }

    return { triggered, failed }
  },
})
