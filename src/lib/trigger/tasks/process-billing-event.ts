import { logger, task } from '@trigger.dev/sdk/v3'

import { generateCorrelationId, withCorrelation } from '@/lib/correlation'
import { applyBillingEvent } from '@/lib/services/billing/apply-event'
import type { BillingEvent } from '@/lib/services/billing/types'

export interface ProcessBillingEventPayload {
  event: BillingEvent
  correlationId?: string
}

/**
 * Processa um BillingEvent já validado+deduplicado pelo webhook route (1.12).
 * Delega a `applyBillingEvent` (lógica testável); aqui só envelopa correlation.
 */
export const processBillingEventTask = task({
  id: 'process-billing-event',
  maxDuration: 120,
  run: async (payload: ProcessBillingEventPayload) => {
    const cid = payload.correlationId ?? generateCorrelationId()
    return withCorrelation(cid, async () => {
      const e = payload.event
      logger.info('process-billing-event', {
        type: e.type,
        provider: e.provider,
        eventId: e.externalEventId,
      })
      const result = await applyBillingEvent(e)
      if (!result.ok) logger.error('billing event falhou', { eventId: e.externalEventId, result })
      return result
    })
  },
})
