import { logger, schedules, task } from '@trigger.dev/sdk/v3'

import { generateCorrelationId, withCorrelation } from '@/lib/correlation'
import { listActiveGoogleConnections } from '@/lib/db/queries/google-connections'
import { refreshGoogleAndValidate } from '@/lib/services/token-refresh.service'

/**
 * Refresh + validacao diaria dos google_connections (1.4.9.B step 12, ADR-015).
 *
 * Diferente do Meta:
 *  - access_token Google expira em 1h, mas refresh inline em
 *    `processGoogleDataManagerFanout` cuida disso durante o fanout (buffer 5min).
 *  - refresh_token nao expira por tempo, MAS pode virar `invalid_grant` se
 *    usuario revogou OAuth grant, mudou senha, ou ficou >6 meses sem usar.
 *
 * Esta task chama refresh DIARIAMENTE pra detectar invalid_grant cedo. Sem
 * isso, so descobriria quando o proximo fanout rodar — atraso de horas/dias.
 *
 * Quando detecta invalid_grant ou >3 failures consecutivas, marca connection
 * como `status='expired'`. UI mostra "reconecte Google" baseado nisso.
 *
 * TD futuro: enviar email "sua conexao Google expirou" quando flip pra expired.
 */
export const googleTokenRefreshTask = task({
  id: 'google-token-refresh',
  maxDuration: 300,
  run: async (payload: { correlationId?: string } = {}) => {
    const cid = payload.correlationId ?? generateCorrelationId()
    return withCorrelation(cid, async () => {
      const start = Date.now()
      const connections = await listActiveGoogleConnections()

      if (connections.length === 0) {
        logger.info('google-token-refresh: nenhuma conexao Google ativa', { correlationId: cid })
        return {
          processed: 0,
          refreshed: 0,
          expired: 0,
          failed: 0,
          durationMs: Date.now() - start,
        }
      }

      let refreshed = 0
      let expired = 0
      let failed = 0
      let invalidGrant = 0

      for (const conn of connections) {
        try {
          const outcome = await refreshGoogleAndValidate(conn)
          if (outcome.refreshed) {
            refreshed += 1
            logger.info('google token refreshed', { connectionId: conn.id })
          } else if (outcome.reason === 'invalid_grant') {
            invalidGrant += 1
            expired += 1
            logger.warn('google refresh_token invalid — connection expired', {
              connectionId: conn.id,
              workspaceId: conn.workspaceId,
            })
          } else if (outcome.reason === 'expired') {
            expired += 1
            logger.warn('google connection expired apos 3+ falhas', {
              connectionId: conn.id,
              workspaceId: conn.workspaceId,
              failureCount: outcome.failureCount,
            })
          } else if (outcome.reason === 'failed' || outcome.reason === 'decrypt_failed') {
            failed += 1
          }
        } catch (err) {
          failed += 1
          logger.error('google refresh falhou (inesperado)', {
            connectionId: conn.id,
            err: err instanceof Error ? err.message : String(err),
          })
        }
      }

      const summary = {
        correlationId: cid,
        processed: connections.length,
        refreshed,
        expired,
        invalidGrant,
        failed,
        durationMs: Date.now() - start,
      }
      logger.info('google-token-refresh concluido', summary)
      return summary
    })
  },
})

/**
 * Cron diario 03:30 UTC (00:30 BRT). Offset de 30min vs meta-token-refresh-cron
 * (03:00 UTC) pra nao todos os tokens refreshing simultaneamente — espalha a
 * carga no upstream + DB.
 */
export const googleTokenRefreshCron = schedules.task({
  id: 'google-token-refresh-cron',
  cron: '30 3 * * *',
  maxDuration: 300,
  run: async () => {
    const cid = generateCorrelationId()
    return withCorrelation(cid, async () => {
      logger.info('google-token-refresh-cron disparou', {
        correlationId: cid,
        ts: new Date().toISOString(),
      })
      const handle = await googleTokenRefreshTask.trigger({ correlationId: cid })
      return { runId: handle.id }
    })
  },
})
