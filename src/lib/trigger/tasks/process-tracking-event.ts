import { logger, task } from '@trigger.dev/sdk/v3'

import { getTrackingEventByIdAndTs, upsertTrackingVisitor } from '@/lib/db/queries/tracking'
import { pickPrimaryClickIdFromEvent } from '@/lib/services/tracking.service'
import type { NewTrackingVisitor } from '@/lib/db/schema'

interface Payload {
  eventDbId: string
  /** ISO 8601 — usado pra partition pruning em tracking_events. */
  eventTs: string
  workspaceId: string
  visitorId: string
  eventName: string
}

/**
 * Trigger.dev v3 task — enriquecimento async dos browser events (Sessao 1.4.A).
 *
 * Hot path do endpoint /api/v1/track persiste apenas o evento. Esta task:
 *  1. Le evento por (id, event_ts) — partition pruning eficiente.
 *  2. Upsert do visitor (first/last UTMs + click_id + identify) em ON CONFLICT.
 *  3. Hooks futuros (TODO):
 *     - 1.4.B: matching com `gateway_events` (correlaciona visitor → buyer_email).
 *     - 1.4.9: fanout pra Meta CAPI + Google Enhanced Conversions.
 *
 * Idempotente: upsert do visitor usa COALESCE pra preservar valores anteriores;
 * total_events incrementa monotonico. Retries do Trigger.dev sao seguros.
 *
 * Falha aqui NAO afeta evento (que ja persistiu sync) — visitor metadata e
 * derivado, recoverable via re-run.
 *
 * Latencia alvo p95 < 1s. Volume MVP: ~1k events/dia/cliente.
 */
export const processTrackingEventTask = task({
  id: 'process-tracking-event',
  maxDuration: 30,
  retry: { maxAttempts: 3, factor: 2, minTimeoutInMs: 1000, maxTimeoutInMs: 10_000 },
  run: async (payload: Payload) => {
    const { eventDbId, eventTs, workspaceId, visitorId, eventName } = payload
    logger.info('process-tracking-event start', {
      eventDbId,
      workspaceId,
      visitorId,
      eventName,
    })

    const event = await getTrackingEventByIdAndTs(eventDbId, new Date(eventTs))
    if (!event) {
      // Evento sumiu entre o enqueue e o run — improvavel mas possivel se
      // retention/TTL apagar a particao do mes. Sem-op + log warn.
      logger.warn('process-tracking-event: event not found', { eventDbId, eventTs })
      return { ok: false, reason: 'event_not_found' }
    }

    // Visitor upsert -----------------------------------------------------------
    // first_* sao seteados no INSERT inicial; subsequentes preservam via query
    // (queries/tracking.ts.upsertTrackingVisitor). last_* atualizados quando
    // chega nao-null. identify e sticky.
    const utms = (event.utms as Record<string, string | null | undefined>) ?? {}
    const clickId = pickPrimaryClickIdFromEvent(event)

    const visitorRow: NewTrackingVisitor = {
      visitorId: event.visitorId,
      workspaceId: event.workspaceId,
      firstSeenAt: event.eventTs,
      lastSeenAt: event.eventTs,
      firstUtmSource: utms.utm_source ?? null,
      firstUtmMedium: utms.utm_medium ?? null,
      firstUtmCampaign: utms.utm_campaign ?? null,
      firstUtmContent: utms.utm_content ?? null,
      firstUtmTerm: utms.utm_term ?? null,
      lastUtmSource: utms.utm_source ?? null,
      lastUtmMedium: utms.utm_medium ?? null,
      lastUtmCampaign: utms.utm_campaign ?? null,
      lastUtmContent: utms.utm_content ?? null,
      lastUtmTerm: utms.utm_term ?? null,
      firstClickId: clickId?.id ?? null,
      firstClickIdType: clickId?.type ?? null,
      lastClickId: clickId?.id ?? null,
      lastClickIdType: clickId?.type ?? null,
      firstReferrer: event.referrer ?? null,
      identifiedBuyerEmailHash: event.matchedBuyerEmailHash,
      identifiedAt: event.matchedAt,
      totalEvents: 1,
    }

    await upsertTrackingVisitor(visitorRow)

    logger.info('process-tracking-event done', {
      eventDbId,
      visitorId,
      hasClickId: !!clickId,
      hasIdentify: !!event.matchedBuyerEmailHash,
    })

    // TODO 1.4.B: matching com gateway_events
    // TODO 1.4.9: fanout Meta CAPI + Google Enhanced Conversions

    return { ok: true, eventDbId }
  },
})
