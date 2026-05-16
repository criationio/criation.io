/**
 * UTM Stitcher service (Sessao 1.4.8 / ADR-020) — v2 com visitor matching (Sessao 1.4.B)
 * + v2.1 com affiliate fallback (Fase B / TD-087).
 *
 * Cascata atual:
 *   1. Manual mapping (override admin) — confidence do mapping
 *   2. Visitor (UTM via tracking_visitors quando matcher achou) — 0.95
 *   3. Meta literal (UTM nao-resolvida pelo cliente) — sem confidence
 *   4. Perfect match (nome exato normalizado via UTM gateway) — 1.0
 *   5. Affiliate (origin.src bate mapping quando UTMs ausentes) — 0.95
 *   6. Unmatched
 *
 * Por que Manual antes de Visitor: override admin tem precedencia explicita.
 * Por que Visitor antes de Meta literal: se gateway veio com `{{ad.name}}` mas
 * o visitor capturou UTMs reais no browser, conseguimos resolver — fix automatico
 * pra TD-083 (cliente esquece de configurar URL parameters no Meta Ads).
 * Por que Visitor antes de Perfect: visitor usa last-touch UTMs do tracking
 * (mais preciso que UTM passada pelo gateway, que pode ter sido stripada).
 * Por que Affiliate depois de Perfect: UTM-based match e mais preciso quando
 * disponivel. Affiliate so dispara como fallback quando UTMs falharam. Cenario
 * primario: Hotmart Sparkle — venda chega com origin.src='codigo_afiliado' e
 * sem UTMs (TD-087, 30-60% das vendas via afiliado).
 *
 * Visitor strategy SO roda se o matcher (visitor-buyer-matcher.service) populou
 * `gateway_events.matched_visitor_id` ANTES desta funcao. A task stitch-gateway-event
 * orquestra essa ordem.
 *
 * Refund/Chargeback (TD-086): stitch normal, mas o wrapper `stitchAndAggregate`
 * DECREMENTA aggregates em vez de incrementar quando event_type e negativo.
 *
 * Stitcher e independente do billing — falha aqui nao bloqueia allocate.
 *
 * Latencia alvo p95 < 1s. Volume alvo 10k eventos/min (TD-081 quando atingir).
 */
import { eq } from 'drizzle-orm'

import { db } from '@/lib/db'
import { gatewayEvents } from '@/lib/db/schema/gateway'
import {
  decrementCampaignAggregates,
  findAffiliateMappingByOriginSrc,
  findCampaignByNormalizedName,
  findManualMapping,
  incrementCampaignAggregates,
  persistStitchResult,
  type MatchStrategy,
} from '@/lib/db/queries/utm-matching'
import { ads, adSets } from '@/lib/db/schema/campaigns'
import { trackingVisitors } from '@/lib/db/schema/tracking'
import { isMetaLiteral } from './utm-normalizer'

export interface StitchResult {
  strategy: MatchStrategy
  matchedCampaignId: string | null
  matchedAdSetId: string | null
  matchedAdId: string | null
  confidence: number | null
  reason?: string
}

const VISITOR_STRATEGY_CONFIDENCE = 0.95

interface GatewayOriginPayload {
  src?: string
  sck?: string
  xcode?: string
}

function extractOriginSrc(origin: unknown): string | null {
  if (!origin || typeof origin !== 'object') return null
  const src = (origin as GatewayOriginPayload).src
  if (!src || typeof src !== 'string') return null
  const trimmed = src.trim()
  return trimmed.length > 0 ? trimmed : null
}

/**
 * Resolve match e persiste resultado em gateway_events. Retorna o resultado pro
 * caller (Trigger.dev task) decidir se incrementa aggregates.
 */
export async function stitchGatewayEvent(eventId: string): Promise<StitchResult> {
  const event = await db.query.gatewayEvents.findFirst({
    where: eq(gatewayEvents.id, eventId),
  })

  if (!event) {
    return {
      strategy: 'unmatched',
      matchedCampaignId: null,
      matchedAdSetId: null,
      matchedAdId: null,
      confidence: null,
      reason: 'event_not_found',
    }
  }

  // Idempotencia: se ja foi stitched, retorna estado atual sem reprocessar
  if (event.stitchedAt) {
    return {
      strategy: event.matchStrategy as MatchStrategy,
      matchedCampaignId: event.matchedCampaignId,
      matchedAdSetId: event.matchedAdSetId,
      matchedAdId: event.matchedAdId,
      confidence: event.matchConfidence ? Number(event.matchConfidence) : null,
      reason: 'already_stitched',
    }
  }

  const utmSet = {
    source: event.utmSource,
    medium: event.utmMedium,
    campaign: event.utmCampaign,
    content: event.utmContent,
    term: event.utmTerm,
  }

  // ---- 1. Manual mapping (override explicito) ----
  const manual = await findManualMapping(event.workspaceId, utmSet)
  if (manual) {
    // Manual mapping aponta pra ad_id. Hidratar campaign/adset via JOIN.
    const adRow = await db.query.ads.findFirst({
      where: eq(ads.id, manual.adId),
    })
    let campaignId: string | null = null
    let adSetId: string | null = null
    if (adRow) {
      adSetId = adRow.adSetId
      const adSetRow = await db.query.adSets.findFirst({
        where: eq(adSets.id, adRow.adSetId),
      })
      campaignId = adSetRow?.campaignId ?? null
    }
    const result: StitchResult = {
      strategy: 'manual',
      matchedCampaignId: campaignId,
      matchedAdSetId: adSetId,
      matchedAdId: manual.adId,
      confidence: manual.confidence,
    }
    await persistStitchResult({ eventId, ...result })
    return result
  }

  // ---- 2. Visitor (UTMs do browser via tracking_visitors) ----
  // Roda apenas se o matcher (visitor-buyer-matcher.service) ja resolveu visitor.
  // Pula se gateway nao tem visitor matched (campo nullable).
  if (event.matchedVisitorId) {
    const visitor = await db.query.trackingVisitors.findFirst({
      where: eq(trackingVisitors.visitorId, event.matchedVisitorId),
    })
    if (visitor) {
      // Last-touch e o default do dashboard. Falha pro first-touch se last
      // estiver vazio (acontece se visitor so teve 1 sessao).
      const visitorCampaign = visitor.lastUtmCampaign ?? visitor.firstUtmCampaign
      const visitorContent = visitor.lastUtmContent ?? visitor.firstUtmContent
      const visitorTerm = visitor.lastUtmTerm ?? visitor.firstUtmTerm

      if (visitorCampaign && !isMetaLiteral(visitorCampaign)) {
        const visitorMatch = await findCampaignByNormalizedName(
          event.workspaceId,
          visitorCampaign,
          visitorContent,
          visitorTerm
        )
        if (visitorMatch) {
          const result: StitchResult = {
            strategy: 'visitor',
            matchedCampaignId: visitorMatch.campaignId,
            matchedAdSetId: visitorMatch.matchedAdSetId,
            matchedAdId: visitorMatch.matchedAdId,
            confidence: VISITOR_STRATEGY_CONFIDENCE,
          }
          await persistStitchResult({ eventId, ...result })
          return result
        }
      }
    }
  }

  // ---- 3. Meta literal — UTM nao-resolvida pelo cliente ----
  if (
    isMetaLiteral(event.utmSource) ||
    isMetaLiteral(event.utmMedium) ||
    isMetaLiteral(event.utmCampaign) ||
    isMetaLiteral(event.utmContent) ||
    isMetaLiteral(event.utmTerm)
  ) {
    const result: StitchResult = {
      strategy: 'meta_literal',
      matchedCampaignId: null,
      matchedAdSetId: null,
      matchedAdId: null,
      confidence: null,
      reason: 'utm_contains_unresolved_meta_placeholder',
    }
    await persistStitchResult({ eventId, ...result })
    return result
  }

  // ---- 4. Perfect match (nome exato normalizado) ----
  if (event.utmCampaign) {
    const campaignMatch = await findCampaignByNormalizedName(
      event.workspaceId,
      event.utmCampaign,
      event.utmContent,
      event.utmTerm
    )
    if (campaignMatch) {
      const result: StitchResult = {
        strategy: 'perfect',
        matchedCampaignId: campaignMatch.campaignId,
        matchedAdSetId: campaignMatch.matchedAdSetId,
        matchedAdId: campaignMatch.matchedAdId,
        confidence: 1.0,
      }
      await persistStitchResult({ eventId, ...result })
      return result
    }
  }

  // ---- 5. Affiliate (origin.src — TD-087) ----
  // So roda quando UTMs nao resolveram. Cenario primario: Hotmart Sparkle
  // venda sem utm_campaign mas com purchase.origin.src='codigo_afiliado'.
  // Admin precisa ter criado utm_mapping com origin_src preenchido apontando
  // pro ad/campaign correspondente.
  const originSrc = extractOriginSrc(event.origin)
  if (originSrc) {
    const affiliate = await findAffiliateMappingByOriginSrc(event.workspaceId, originSrc)
    if (affiliate) {
      const adRow = await db.query.ads.findFirst({
        where: eq(ads.id, affiliate.adId),
      })
      let campaignId: string | null = null
      let adSetId: string | null = null
      if (adRow) {
        adSetId = adRow.adSetId
        const adSetRow = await db.query.adSets.findFirst({
          where: eq(adSets.id, adRow.adSetId),
        })
        campaignId = adSetRow?.campaignId ?? null
      }
      const result: StitchResult = {
        strategy: 'affiliate',
        matchedCampaignId: campaignId,
        matchedAdSetId: adSetId,
        matchedAdId: affiliate.adId,
        confidence: affiliate.confidence,
      }
      await persistStitchResult({ eventId, ...result })
      return result
    }
  }

  // ---- 6. Unmatched ----
  const result: StitchResult = {
    strategy: 'unmatched',
    matchedCampaignId: null,
    matchedAdSetId: null,
    matchedAdId: null,
    confidence: null,
    reason: event.utmCampaign ? 'no_campaign_name_match' : 'no_utm_campaign_provided',
  }
  await persistStitchResult({ eventId, ...result })
  return result
}

/**
 * Wrapper que stitchea + ajusta aggregates em uma operacao. Usado pelo
 * Trigger task.
 *
 * Aggregates:
 * - Eventos de receita real (PURCHASE_APPROVED, SUBSCRIPTION_RENEWED, ...) com
 *   amount > 0 → INCREMENT.
 * - Eventos de reversao (PURCHASE_REFUNDED, PURCHASE_CHARGEBACK) com amount > 0
 *   E matched_campaign_id → DECREMENT (TD-086). Refund unmatched nao mexe em
 *   aggregates (admin precisa decidir manualmente).
 *
 * Strategies que disparam aggregate: perfect, manual, visitor, affiliate. Todas
 * apontam pra matched_campaign_id real (meta_literal e unmatched nao).
 *
 * Idempotencia: persistStitchResult e gated por `isNull(stitchedAt)`, entao
 * re-execucao da task nao re-stitch e portanto nao re-incrementa/decrementa.
 * Exposicao residual: crash da task entre persistStitchResult e o aggregate
 * call resulta em aggregate perdido (under-count). Documentado como TD-aberto
 * pra resolver com `aggregate_applied_at` em sessao futura — impacto pequeno
 * em volume MVP.
 */
export async function stitchAndAggregate(eventId: string): Promise<StitchResult> {
  const result = await stitchGatewayEvent(eventId)

  const isAggregable =
    result.matchedCampaignId !== null &&
    (result.strategy === 'perfect' ||
      result.strategy === 'manual' ||
      result.strategy === 'visitor' ||
      result.strategy === 'affiliate')

  if (!isAggregable || !result.matchedCampaignId) {
    return result
  }

  const event = await db.query.gatewayEvents.findFirst({
    where: eq(gatewayEvents.id, eventId),
  })
  if (!event || !event.amountCents || event.amountCents <= 0) {
    return result
  }

  const occurredAt = event.creationDateMs ? new Date(event.creationDateMs) : event.createdAt

  if (isRevenueEvent(event.eventType)) {
    await incrementCampaignAggregates(result.matchedCampaignId, event.amountCents, occurredAt)
  } else if (isReversalEvent(event.eventType)) {
    await decrementCampaignAggregates(result.matchedCampaignId, event.amountCents, occurredAt)
  }

  return result
}

const REVENUE_EVENT_TYPES = new Set([
  'PURCHASE_APPROVED',
  'PURCHASE_COMPLETE',
  'SUBSCRIPTION_RENEWED',
])

/**
 * Eventos negativos que revertem aggregates (TD-086). Aplicam-se a:
 * - Hotmart: PURCHASE_REFUNDED, PURCHASE_CHARGEBACK
 * - Kiwify/Eduzz: enviam mesmos NormalizedEventType apos mapping nos adapters.
 *
 * PURCHASE_CANCELED nao entra aqui porque e cancelamento PRE-pagamento (nao
 * ha receita a reverter). PURCHASE_REFUND_REQUESTED tambem nao — admin ainda
 * pode negar o pedido. Apenas eventos de reversao CONFIRMADA disparam.
 */
const REVERSAL_EVENT_TYPES = new Set(['PURCHASE_REFUNDED', 'PURCHASE_CHARGEBACK'])

function isRevenueEvent(eventType: string): boolean {
  return REVENUE_EVENT_TYPES.has(eventType)
}

function isReversalEvent(eventType: string): boolean {
  return REVERSAL_EVENT_TYPES.has(eventType)
}
