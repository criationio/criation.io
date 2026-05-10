import { logger, task } from '@trigger.dev/sdk/v3'

import { stitchAndAggregate } from '@/lib/services/utm-stitcher.service'

interface Payload {
  eventId: string
  workspaceId: string
}

/**
 * Trigger.dev v3 task que roda o UTM Stitcher (Sessao 1.4.8 / ADR-020).
 *
 * Enfileirada PARALELA ao `process-gateway-event` no webhook handler. Nao
 * bloqueia billing. Falha aqui nao impede allocate de creditos.
 *
 * Idempotente: stitcher service ja checa `stitched_at` antes de reprocessar.
 *
 * Latencia alvo p95 < 1s. Volume alvo MVP ~100-1000 events/dia/cliente.
 */
export const stitchGatewayEventTask = task({
  id: 'stitch-gateway-event',
  maxDuration: 30,
  retry: { maxAttempts: 3, factor: 2, minTimeoutInMs: 1000, maxTimeoutInMs: 10_000 },
  run: async (payload: Payload) => {
    const { eventId, workspaceId } = payload
    logger.info('stitch-gateway-event start', { eventId, workspaceId })

    try {
      const result = await stitchAndAggregate(eventId)
      logger.info('stitch-gateway-event done', {
        eventId,
        strategy: result.strategy,
        matchedCampaignId: result.matchedCampaignId,
        confidence: result.confidence,
      })
      return { ok: true, ...result }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      logger.error('stitch-gateway-event failed', { eventId, err: errorMessage })
      throw err
    }
  },
})
