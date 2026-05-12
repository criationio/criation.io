import { logger, task } from '@trigger.dev/sdk/v3'

import { stitchAndAggregate } from '@/lib/services/utm-stitcher.service'
import { matchVisitorForGatewayEvent } from '@/lib/services/visitor-buyer-matcher.service'

interface Payload {
  eventId: string
  workspaceId: string
}

/**
 * Trigger.dev v3 task que roda Visitor matching (1.4.B) + UTM Stitcher (1.4.8).
 *
 * Pipeline (ordem importa):
 *  1. Visitor matcher — popula gateway_events.matched_visitor_id
 *  2. UTM Stitcher 2.0 — usa visitor encontrado pra resolver campaign via
 *     UTMs do browser (estrategia 'visitor', confidence 0.95) quando UTMs
 *     do gateway estao vazias/literais.
 *
 * Enfileirada PARALELA ao `process-gateway-event` no webhook handler. Nao
 * bloqueia billing. Falha aqui nao impede allocate de creditos.
 *
 * Idempotente: ambos services checam timestamp (visitor_matched_at / stitched_at)
 * antes de reprocessar.
 *
 * Latencia alvo p95 < 1.5s (matcher <500ms + stitcher <1s).
 */
export const stitchGatewayEventTask = task({
  id: 'stitch-gateway-event',
  maxDuration: 30,
  retry: { maxAttempts: 3, factor: 2, minTimeoutInMs: 1000, maxTimeoutInMs: 10_000 },
  run: async (payload: Payload) => {
    const { eventId, workspaceId } = payload
    logger.info('stitch-gateway-event start', { eventId, workspaceId })

    try {
      // 1. Visitor matching primeiro — popula matched_visitor_id pro stitcher usar
      const matchResult = await matchVisitorForGatewayEvent(eventId)
      logger.info('visitor match done', {
        eventId,
        visitorStrategy: matchResult.strategy,
        visitorId: matchResult.visitorId,
      })

      // 2. UTM Stitcher 2.0 — agora pode usar visitor encontrado
      const result = await stitchAndAggregate(eventId)
      logger.info('stitch-gateway-event done', {
        eventId,
        stitcherStrategy: result.strategy,
        visitorStrategy: matchResult.strategy,
        matchedCampaignId: result.matchedCampaignId,
        confidence: result.confidence,
      })
      return { ok: true, visitorMatch: matchResult, stitch: result }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      logger.error('stitch-gateway-event failed', { eventId, err: errorMessage })
      throw err
    }
  },
})
