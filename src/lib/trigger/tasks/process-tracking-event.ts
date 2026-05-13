import { logger, task } from '@trigger.dev/sdk/v3'

import { listRetroFanoutCandidates } from '@/lib/db/queries/capi'
import { getTrackingEventByIdAndTs, upsertTrackingVisitor } from '@/lib/db/queries/tracking'
import { pickPrimaryClickIdFromEvent } from '@/lib/services/tracking.service'
import {
  matchGatewayEventsForIdentifiedVisitor,
  type ReverseMatchResult,
} from '@/lib/services/visitor-buyer-matcher.service'
import { fanoutMetaCapiIdempotencyKey, fanoutMetaCapiTask } from './fanout-meta-capi'
import { stitchGatewayEventTask } from './stitch-gateway-event'
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

    // 1.4.B: reverse matching — quando identify chega no browser, busca
    // gateway_events recentes do mesmo email pra ligar visitor a compras
    // historicas (caso comum: cliente compra primeiro, depois acessa lead
    // magnet onde criation('identify') roda).
    //
    // Audit B3: quando reverse popula matched_visitor_id em evento ja stitched
    // com strategy fraca (unmatched/meta_literal), o service reseta stitched_at
    // e retorna `needsRestitch` — re-enfileiramos o stitchGatewayEventTask pra
    // o stitcher 2.0 conseguir usar visitor strategy (0.95).
    let reverseMatch: ReverseMatchResult | null = null
    if (event.matchedBuyerEmailHash) {
      try {
        reverseMatch = await matchGatewayEventsForIdentifiedVisitor({
          workspaceId: event.workspaceId,
          visitorId: event.visitorId,
          buyerEmailHash: event.matchedBuyerEmailHash,
        })
        if (reverseMatch.matched > 0) {
          logger.info('reverse visitor match found gateway events', {
            visitorId: event.visitorId,
            matched: reverseMatch.matched,
            checked: reverseMatch.checked,
            needsRestitch: reverseMatch.needsRestitch.length,
          })
        }
        // Re-enfileira stitchGatewayEvent pra cada evento que precisa re-stitch
        for (const eventId of reverseMatch.needsRestitch) {
          try {
            await stitchGatewayEventTask.trigger({
              eventId,
              workspaceId: event.workspaceId,
            })
          } catch (err) {
            logger.warn('failed to re-enqueue stitch after reverse match', {
              eventId,
              err: err instanceof Error ? err.message : String(err),
            })
          }
        }
      } catch (err) {
        // Reverse matching e best-effort — falha nao bloqueia visitor upsert
        logger.warn('reverse visitor match failed', {
          err: err instanceof Error ? err.message : String(err),
        })
      }
    }

    // Fanout Meta CAPI (Sessao 1.4.9) -----------------------------------------
    //
    // (a) Initial fanout: enfileira pro evento atual. Service short-circuita
    //     se status='sent' ja (idempotente). Falha aqui nao bloqueia
    //     visitor upsert — fanout sera capturado pelo cron pickup em ate 10min.
    //
    // (b) Retro re-fanout: quando reverse matching populou
    //     matched_buyer_email_hash em N eventos historicos do visitor,
    //     enfileira pra Meta com external_id pos-match (email-based) — EMQ alto.
    //     Apenas eventos NAO-sent (pending/skipped/failed); ja-sent foram
    //     dedupados pelo Meta event_id (48h window), retro pra eles e wasted.
    //
    // Promise.allSettled — falhas individuais nao bloqueiam (cron pickup
    // captura). Cap 50 eventos retro pra evitar runaway.
    let retroCount = 0
    try {
      await fanoutMetaCapiTask.trigger(
        { trackingEventId: eventDbId, trackingEventTs: eventTs },
        { idempotencyKey: fanoutMetaCapiIdempotencyKey(eventDbId) }
      )

      if (reverseMatch && reverseMatch.matched > 0) {
        const candidates = await listRetroFanoutCandidates({
          workspaceId: event.workspaceId,
          visitorId: event.visitorId,
          limit: 50,
        })
        // Filtra o evento atual (ja enfileirado acima como initial)
        const retroEvents = candidates.filter((c) => c.id !== eventDbId)
        const handles = await Promise.allSettled(
          retroEvents.map((c) =>
            fanoutMetaCapiTask.trigger(
              { trackingEventId: c.id, trackingEventTs: c.eventTs.toISOString() },
              { idempotencyKey: fanoutMetaCapiIdempotencyKey(c.id) }
            )
          )
        )
        retroCount = handles.filter((h) => h.status === 'fulfilled').length
        if (retroCount > 0) {
          logger.info('retro fanout enqueued', {
            visitorId: event.visitorId,
            retroCount,
            total: retroEvents.length,
          })
        }
      }
    } catch (err) {
      // Best-effort: falha aqui nao bloqueia processamento principal.
      // Cron pickup vai capturar pending em ate 10min.
      logger.warn('fanout enqueue failed (cron pickup will catch)', {
        eventDbId,
        err: err instanceof Error ? err.message : String(err),
      })
    }

    logger.info('process-tracking-event done', {
      eventDbId,
      visitorId,
      hasClickId: !!clickId,
      hasIdentify: !!event.matchedBuyerEmailHash,
      reverseMatch,
      retroFanoutCount: retroCount,
    })

    return { ok: true, eventDbId, reverseMatch, retroFanoutCount: retroCount }
  },
})
