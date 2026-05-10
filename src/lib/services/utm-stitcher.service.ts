/**
 * UTM Stitcher service (Sessao 1.4.8 / ADR-020).
 *
 * Cascata MVP: Manual → Perfect → Meta literal → Unmatched.
 *
 * Por que Manual antes de Perfect: override admin tem precedencia explicita
 * sobre match automatico. Cliente cria mapping pra "BF" → campanha X — esse
 * mapping deve sempre ganhar, mesmo que "BF" tambem bata com outra campanha
 * por nome.
 *
 * Stitcher e independente do billing (process-gateway-event task) — falha em
 * um nao bloqueia o outro. Trigger.dev v3 enfileira ambos em paralelo.
 *
 * Latencia alvo p95 < 1s. Volume alvo 10k eventos/min (TD-081 quando atingir).
 */
import { eq } from 'drizzle-orm'

import { db } from '@/lib/db'
import { gatewayEvents } from '@/lib/db/schema/gateway'
import {
  findCampaignByNormalizedName,
  findManualMapping,
  incrementCampaignAggregates,
  persistStitchResult,
  type MatchStrategy,
} from '@/lib/db/queries/utm-matching'
import { ads, adSets } from '@/lib/db/schema/campaigns'
import { isMetaLiteral } from './utm-normalizer'

export interface StitchResult {
  strategy: MatchStrategy
  matchedCampaignId: string | null
  matchedAdSetId: string | null
  matchedAdId: string | null
  confidence: number | null
  reason?: string
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

  // ---- 2. Meta literal — UTM nao-resolvida pelo cliente ----
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

  // ---- 3. Perfect match (nome exato normalizado) ----
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

  // ---- 4. Unmatched ----
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
 * Wrapper que stitchea + incrementa aggregates em uma operacao. Usado pelo
 * Trigger task. Aggregates so incrementam pra eventos de receita real
 * (PURCHASE_APPROVED, SUBSCRIPTION_RENEWED) com amount > 0.
 */
export async function stitchAndAggregate(eventId: string): Promise<StitchResult> {
  const result = await stitchGatewayEvent(eventId)

  if (result.matchedCampaignId && (result.strategy === 'perfect' || result.strategy === 'manual')) {
    const event = await db.query.gatewayEvents.findFirst({
      where: eq(gatewayEvents.id, eventId),
    })
    if (event && event.amountCents && event.amountCents > 0 && isRevenueEvent(event.eventType)) {
      await incrementCampaignAggregates(
        result.matchedCampaignId,
        event.amountCents,
        event.creationDateMs ? new Date(event.creationDateMs) : event.createdAt
      )
    }
  }

  return result
}

const REVENUE_EVENT_TYPES = new Set([
  'PURCHASE_APPROVED',
  'PURCHASE_COMPLETE',
  'SUBSCRIPTION_RENEWED',
])

function isRevenueEvent(eventType: string): boolean {
  return REVENUE_EVENT_TYPES.has(eventType)
}
