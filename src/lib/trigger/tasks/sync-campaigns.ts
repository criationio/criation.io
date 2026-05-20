import { logger, schedules, task } from '@trigger.dev/sdk/v3'

import { generateCorrelationId, withCorrelation } from '@/lib/correlation'
import { listAllActiveConnections } from '@/lib/db/queries/meta-connections'
import { getActiveConnectionByWorkspace } from '@/lib/db/queries/meta-connections'
import { syncConnection } from '@/lib/services/campaign-sync.service'

interface SyncCampaignsPayload {
  /** Se fornecido, sincroniza apenas a conexao deste workspace. Senao, todos. */
  workspaceId?: string
  correlationId?: string
}

/**
 * On-demand sync (disparado via tasks.trigger() de Server Action).
 * Pode receber workspaceId pra sync direcionado.
 */
export const syncCampaignsTask = task({
  id: 'sync-campaigns',
  maxDuration: 600, // 10min
  run: async (payload: SyncCampaignsPayload) => {
    const cid = payload.correlationId ?? generateCorrelationId()
    return withCorrelation(cid, async () => {
      const start = Date.now()
      logger.info('sync-campaigns iniciado', {
        correlationId: cid,
        workspaceId: payload.workspaceId,
      })

      const connections = payload.workspaceId
        ? [await getActiveConnectionByWorkspace(payload.workspaceId)].filter(
            (c): c is NonNullable<typeof c> => c !== null
          )
        : await listAllActiveConnections()

      if (connections.length === 0) {
        logger.warn('sync-campaigns: nenhuma conexao ativa', { workspaceId: payload.workspaceId })
        return { connectionsProcessed: 0, durationMs: Date.now() - start }
      }

      // Sequencial por conexao pra nao estourar rate limit Meta
      // (TD-038: rate limiter por workspace ainda nao implementado)
      const outcomes = []
      for (const conn of connections) {
        try {
          const outcome = await syncConnection(conn)
          outcomes.push(outcome)
        } catch (err) {
          logger.error('sync-campaigns: falha em conexao', {
            connectionId: conn.id,
            workspaceId: conn.workspaceId,
            err: err instanceof Error ? err.message : String(err),
          })
          outcomes.push({
            workspaceId: conn.workspaceId,
            connectionId: conn.id,
            status: 'failed' as const,
            campaignsUpserted: 0,
            adSetsUpserted: 0,
            adsUpserted: 0,
            insightsUpserted: 0,
            errors: [err instanceof Error ? err.message : String(err)],
            durationMs: 0,
          })
        }
      }

      const summary = {
        correlationId: cid,
        connectionsProcessed: outcomes.length,
        successful: outcomes.filter((o) => o.status === 'success').length,
        partial: outcomes.filter((o) => o.status === 'partial').length,
        tokenExpired: outcomes.filter((o) => o.status === 'token_expired').length,
        failed: outcomes.filter((o) => o.status === 'failed').length,
        totalCampaigns: outcomes.reduce((s, o) => s + o.campaignsUpserted, 0),
        totalAds: outcomes.reduce((s, o) => s + o.adsUpserted, 0),
        totalInsights: outcomes.reduce((s, o) => s + o.insightsUpserted, 0),
        durationMs: Date.now() - start,
      }

      logger.info('sync-campaigns concluido', summary)
      return summary
    })
  },
})

/**
 * Cron a cada 4h. Dispara sync-campaigns sem payload (todas as conexoes).
 */
export const syncCampaignsCron = schedules.task({
  id: 'sync-campaigns-cron',
  cron: '0 */4 * * *', // a cada 4h, no minuto 0
  maxDuration: 600,
  run: async () => {
    const cid = generateCorrelationId()
    return withCorrelation(cid, async () => {
      logger.info('sync-campaigns-cron disparou', {
        correlationId: cid,
        ts: new Date().toISOString(),
      })
      const handle = await syncCampaignsTask.trigger({ correlationId: cid })
      return { runId: handle.id }
    })
  },
})
