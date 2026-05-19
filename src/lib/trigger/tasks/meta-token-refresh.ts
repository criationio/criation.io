import { logger, schedules, task } from '@trigger.dev/sdk/v3'

import { listConnectionsNeedingRefresh } from '@/lib/db/queries/meta-connections'
import { refreshIfNeeded } from '@/lib/services/token-refresh.service'

/**
 * On-demand refresh (raro — geralmente cron cobre).
 * Fecha TD-030.
 */
export const metaTokenRefreshTask = task({
  id: 'meta-token-refresh',
  maxDuration: 300,
  run: async () => {
    const start = Date.now()
    const connections = await listConnectionsNeedingRefresh(7)

    if (connections.length === 0) {
      logger.info('meta-token-refresh: nenhum token precisando refresh')
      return { processed: 0, refreshed: 0, expired: 0, durationMs: Date.now() - start }
    }

    let refreshed = 0
    let expired = 0
    let failed = 0

    for (const conn of connections) {
      try {
        const outcome = await refreshIfNeeded(conn)
        if (outcome.refreshed) {
          refreshed += 1
          logger.info('token refreshed', { connectionId: conn.id })
        } else if (outcome.reason === 'expired') {
          expired += 1
          logger.warn('token expirado apos 3+ falhas', {
            connectionId: conn.id,
            workspaceId: conn.workspaceId,
            failureCount: outcome.failureCount,
          })
          // TD-031: enviar email "sua conexao expirou" — futuro 2.12
        } else if (outcome.reason === 'failed') {
          failed += 1
        }
      } catch (err) {
        failed += 1
        logger.error('refresh falhou (inesperado)', {
          connectionId: conn.id,
          err: err instanceof Error ? err.message : String(err),
        })
      }
    }

    const summary = {
      processed: connections.length,
      refreshed,
      expired,
      failed,
      durationMs: Date.now() - start,
    }
    logger.info('meta-token-refresh concluido', summary)
    return summary
  },
})

/**
 * Cron diario 03:00 UTC (00:00 BRT).
 * Lista conexoes com expiracao < 7d e refresh.
 */
export const metaTokenRefreshCron = schedules.task({
  id: 'meta-token-refresh-cron',
  cron: '0 3 * * *',
  maxDuration: 300,
  run: async () => {
    logger.info('meta-token-refresh-cron disparou', { ts: new Date().toISOString() })
    const handle = await metaTokenRefreshTask.trigger()
    return { runId: handle.id }
  },
})
