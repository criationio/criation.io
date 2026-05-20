import { logger, schedules, task } from '@trigger.dev/sdk/v3'

import { generateCorrelationId, withCorrelation } from '@/lib/correlation'
import { purgePlainPii } from '@/lib/services/retention.service'

/**
 * TD-108 — LGPD retention 30d pra plain IP/UA em tracking_events +
 * gateway_events.
 *
 * Daily cron 03:30 UTC (00:30 BRT), logo apos `create-tracking-partition`
 * (03:00 UTC) — low traffic, evita conflito de lock.
 *
 * Idempotente: WHERE clause inclui `IS NOT NULL`, re-runs no-op. Service
 * `purgePlainPii` faz UPDATE single-shot por tabela + audit log entry.
 *
 * Sem retry agressivo: se cron falhar 1 dia, no dia seguinte processa
 * a janela acumulada (30d retention vira 31d no pior caso — aceitavel).
 */
export const purgePlainPiiTask = task({
  id: 'purge-plain-pii',
  maxDuration: 300,
  retry: { maxAttempts: 2, minTimeoutInMs: 5000, maxTimeoutInMs: 30_000, factor: 2 },
  run: async (payload: { correlationId?: string } = {}) => {
    const cid = payload.correlationId ?? generateCorrelationId()
    return withCorrelation(cid, async () => {
      const result = await purgePlainPii()
      logger.info('purge-plain-pii: done', {
        correlationId: cid,
        trackingEventsPurged: result.trackingEventsPurged,
        gatewayEventsPurged: result.gatewayEventsPurged,
        retentionDays: result.retentionDays,
      })
      return result
    })
  },
})

/**
 * Cron diario 03:30 UTC (00:30 BRT, low-traffic).
 *
 * Ordem importa: create-tracking-partition (03:00 UTC) cria particoes M+3
 * primeiro; purge-plain-pii (03:30 UTC) limpa PII nas particoes antigas.
 */
export const purgePlainPiiCron = schedules.task({
  id: 'purge-plain-pii-cron',
  cron: '30 3 * * *',
  maxDuration: 60,
  run: async () => {
    const cid = generateCorrelationId()
    return withCorrelation(cid, async () => {
      logger.info('purge-plain-pii-cron disparou', {
        correlationId: cid,
        ts: new Date().toISOString(),
      })
      const handle = await purgePlainPiiTask.trigger({ correlationId: cid })
      return { runId: handle.id }
    })
  },
})
