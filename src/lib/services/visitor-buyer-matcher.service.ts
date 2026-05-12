/**
 * Visitor↔Buyer Matcher (Sessao 1.4.B / ADR-014).
 *
 * Cascata de matching disparada apos webhook de gateway persistir um
 * gateway_event de compra:
 *
 *   1. deterministic_xcode (1.0) — cliente injetou xcode=visitor_id via
 *      criation-tracking.js link enrichment. Match exato.
 *   2. clickid (0.9) — fbclid/gclid no gateway bate com tracking_visitors em 7d.
 *      DORMENTE: nenhum adapter (Hotmart/Kiwify/Eduzz) extrai fbclid pra
 *      gateway_events.fbclid hoje. TD-105 documenta. Ate la, sempre cai.
 *   3. utm_recency (0.7) — visitor recente (24h) com mesma utm_campaign.
 *
 * Reverse matching (matchGatewayEventsForIdentifiedVisitor):
 *   4. reverse_email (0.85) — disparado quando criation('identify', email)
 *      chega no browser. Busca gateway_events recentes (30d) do mesmo email
 *      e cria o link retroativo. Sobrescreve gateway_events com strategy
 *      'unmatched' (audit A2 fix — antes pulava silenciosamente).
 *
 * Quando match resolve, atualiza 4 tabelas via persistVisitorMatch (transacional):
 *  - gateway_events: matched_visitor_id + strategy + confidence + visitor_matched_at
 *  - tracking_visitors.identified_buyer_email_hash (sticky)
 *  - tracking_events.matched_buyer_email_hash retroativo (todos eventos do visitor, 90d)
 *  - gateway_subscriptions.identified_visitor_id sticky quando subscriberCode presente
 *
 * Idempotencia: gateway_events.visitor_matched_at e checado antes de processar.
 * Re-run e seguro (no-op).
 *
 * Latencia alvo p95 < 500ms (3 SELECTs no pior caso + 4 UPDATEs em transaction).
 *
 * Stitcher 2.0 (utm-stitcher.service) consome o resultado: se matcher achou
 * visitor, stitcher usa first/last UTMs do visitor pra resolver campaign mesmo
 * quando gateway veio sem UTM ou com UTM literal.
 */
import { eq } from 'drizzle-orm'

import { db } from '@/lib/db'
import { gatewayEvents } from '@/lib/db/schema/gateway'
import {
  findGatewayEventsByBuyerEmail,
  findVisitorByClickId,
  findVisitorByUtmRecency,
  findVisitorByXcode,
  markVisitorMatchUnmatched,
  persistVisitorMatch,
  resetStitchIfWeakStrategy,
  type VisitorMatchStrategy,
} from '@/lib/db/queries/visitor-buyer-matching'
import { trackingLogger } from '@/lib/logger'

export interface VisitorMatchResult {
  ok: boolean
  strategy: VisitorMatchStrategy | 'unmatched' | 'already_matched' | 'event_not_found'
  visitorId: string | null
  confidence: number | null
  reason?: string
}

const STRATEGY_CONFIDENCE: Record<VisitorMatchStrategy, number> = {
  deterministic_xcode: 1.0,
  clickid: 0.9,
  utm_recency: 0.7,
  reverse_email: 0.85,
}

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Resolve match e persiste resultado. Usado pela task stitch-gateway-event
 * ANTES do stitcher (assim stitcher pode usar visitor encontrado).
 *
 * Retorna o estado final (incluindo unmatched) pro caller decidir proximo passo.
 */
export async function matchVisitorForGatewayEvent(
  gatewayEventId: string
): Promise<VisitorMatchResult> {
  const event = await db.query.gatewayEvents.findFirst({
    where: eq(gatewayEvents.id, gatewayEventId),
  })

  if (!event) {
    return {
      ok: false,
      strategy: 'event_not_found',
      visitorId: null,
      confidence: null,
    }
  }

  // Idempotencia: matcher ja rodou
  if (event.visitorMatchedAt) {
    return {
      ok: true,
      strategy: (event.visitorMatchStrategy as VisitorMatchStrategy | 'unmatched') ?? 'unmatched',
      visitorId: event.matchedVisitorId,
      confidence: event.visitorMatchConfidence ? Number(event.visitorMatchConfidence) : null,
      reason: 'already_matched',
    }
  }

  const matchedAt = new Date()

  // ---- 1. Deterministic xcode -----------------------------------------------
  if (event.externalCode) {
    const visitor = await findVisitorByXcode(event.workspaceId, event.externalCode)
    if (visitor) {
      await persistVisitorMatch({
        gatewayEventId,
        workspaceId: event.workspaceId,
        visitorId: visitor.visitorId,
        strategy: 'deterministic_xcode',
        confidence: STRATEGY_CONFIDENCE.deterministic_xcode,
        buyerEmailHash: event.customerEmailHash,
        subscriberCode: event.subscriberCode,
        matchedAt,
      })
      trackingLogger.info(
        {
          gatewayEventId,
          visitorId: visitor.visitorId,
          strategy: 'deterministic_xcode',
        },
        'visitor matched: deterministic xcode'
      )
      return {
        ok: true,
        strategy: 'deterministic_xcode',
        visitorId: visitor.visitorId,
        confidence: STRATEGY_CONFIDENCE.deterministic_xcode,
      }
    } else if (UUID_V4_RE.test(event.externalCode)) {
      // Audit C7: externalCode parece UUID v4 mas nao acha visitor — sinal forte
      // de configuracao cruzada (cliente colou snippet de outro workspace).
      trackingLogger.warn(
        {
          gatewayEventId,
          workspaceId: event.workspaceId,
          externalCode: event.externalCode,
        },
        'externalCode parece UUID v4 mas nao acha visitor — possivel cross-workspace config'
      )
    }
  }

  // ---- 2. Click ID ----------------------------------------------------------
  if (event.fbclid || event.gclid || event.ttclid) {
    const visitor = await findVisitorByClickId(event.workspaceId, {
      fbclid: event.fbclid,
      gclid: event.gclid,
      ttclid: event.ttclid,
    })
    if (visitor) {
      await persistVisitorMatch({
        gatewayEventId,
        workspaceId: event.workspaceId,
        visitorId: visitor.visitorId,
        strategy: 'clickid',
        confidence: STRATEGY_CONFIDENCE.clickid,
        buyerEmailHash: event.customerEmailHash,
        subscriberCode: event.subscriberCode,
        matchedAt,
      })
      trackingLogger.info(
        { gatewayEventId, visitorId: visitor.visitorId, strategy: 'clickid' },
        'visitor matched: clickid'
      )
      return {
        ok: true,
        strategy: 'clickid',
        visitorId: visitor.visitorId,
        confidence: STRATEGY_CONFIDENCE.clickid,
      }
    }
  }

  // ---- 3. UTM + recencia ----------------------------------------------------
  if (event.utmCampaign) {
    const { visitor, conflict } = await findVisitorByUtmRecency(
      event.workspaceId,
      event.utmCampaign
    )
    if (visitor) {
      await persistVisitorMatch({
        gatewayEventId,
        workspaceId: event.workspaceId,
        visitorId: visitor.visitorId,
        strategy: 'utm_recency',
        confidence: STRATEGY_CONFIDENCE.utm_recency,
        buyerEmailHash: event.customerEmailHash,
        subscriberCode: event.subscriberCode,
        matchedAt,
      })
      trackingLogger.info(
        { gatewayEventId, visitorId: visitor.visitorId, strategy: 'utm_recency' },
        'visitor matched: utm_recency'
      )
      return {
        ok: true,
        strategy: 'utm_recency',
        visitorId: visitor.visitorId,
        confidence: STRATEGY_CONFIDENCE.utm_recency,
      }
    }
    if (conflict) {
      // Audit C3: log explicito quando 2+ visitors viram mesma campanha em 24h.
      // Operador pode medir taxa de perda por colisao.
      trackingLogger.info(
        {
          gatewayEventId,
          workspaceId: event.workspaceId,
          utmCampaign: event.utmCampaign,
        },
        'utm_recency conflict — 2+ candidatos, atribuicao pulada'
      )
    }
  }

  // ---- 4. Unmatched ---------------------------------------------------------
  await markVisitorMatchUnmatched(gatewayEventId, matchedAt)
  trackingLogger.info(
    { gatewayEventId, hadXcode: !!event.externalCode, hadClickId: !!(event.fbclid || event.gclid) },
    'visitor unmatched'
  )
  return {
    ok: true,
    strategy: 'unmatched',
    visitorId: null,
    confidence: null,
    reason: 'no_signals_matched',
  }
}

export interface ReverseMatchResult {
  matched: number
  checked: number
  /** IDs de gateway_events que tiveram stitch resetado (caller deve re-enfileirar). */
  needsRestitch: string[]
}

/**
 * Matching reverso: um tracking_event chegou com identify_email setado.
 * Procura gateway_events recentes do mesmo email hash. Audit A2: AGORA
 * sobrescreve eventos com strategy='unmatched' (antes pulava silenciosamente —
 * exatamente o caso de uso primario "compra primeiro, identify depois").
 *
 * Caso de uso: cliente fez compra via Hotmart (gateway_event matched antes
 * do visitor existir, marcou unmatched), depois acessou um site/lead magnet
 * do produtor onde criation('identify', email) disparou. Visitor agora e
 * ligado retroativamente a essa compra.
 *
 * Audit B3: quando reverse popula matched_visitor_id em evento ja stitched
 * com strategy fraca (unmatched/meta_literal), reseta stitched_at e marca
 * o gateway_event pra re-stitch (caller enfileira stitchGatewayEventTask).
 *
 * Retorna { matched, checked, needsRestitch } pro caller agir.
 */
export async function matchGatewayEventsForIdentifiedVisitor(input: {
  workspaceId: string
  visitorId: string
  buyerEmailHash: string
}): Promise<ReverseMatchResult> {
  const candidates = await findGatewayEventsByBuyerEmail(input.workspaceId, input.buyerEmailHash)
  if (candidates.length === 0) return { matched: 0, checked: 0, needsRestitch: [] }

  const matchedAt = new Date()
  let matched = 0
  const needsRestitch: string[] = []

  for (const ev of candidates) {
    // Pula eventos com strategy real ja resolvida (deterministic/clickid/utm).
    // Audit A2: SOBRESCREVE quando strategy='unmatched' (caso primario).
    if (ev.visitorMatchedAt && ev.visitorMatchStrategy && ev.visitorMatchStrategy !== 'unmatched') {
      continue
    }

    await persistVisitorMatch({
      gatewayEventId: ev.id,
      workspaceId: input.workspaceId,
      visitorId: input.visitorId,
      // Audit A3: strategy correta — match foi por email_hash, nao clickid.
      strategy: 'reverse_email',
      confidence: STRATEGY_CONFIDENCE.reverse_email,
      buyerEmailHash: input.buyerEmailHash,
      subscriberCode: ev.subscriberCode,
      matchedAt,
      overrideUnmatched: ev.visitorMatchStrategy === 'unmatched',
    })
    matched += 1

    // Audit B3: se evento ja foi stitched com strategy fraca, resetar pra
    // re-stitch poder usar visitor strategy (0.95) agora que matched_visitor_id
    // foi populado.
    if (ev.matchStrategy === 'unmatched' || ev.matchStrategy === 'meta_literal') {
      const wasReset = await resetStitchIfWeakStrategy(ev.id)
      if (wasReset) needsRestitch.push(ev.id)
    }
  }

  return { matched, checked: candidates.length, needsRestitch }
}
