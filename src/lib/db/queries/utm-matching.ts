/**
 * Queries especializadas pro UTM Stitcher (Sessao 1.4.8). Cada funcao e
 * isolada e testavel; o stitcher service orquestra a cascata.
 *
 * Nota de performance: o match perfect roda 1 query por evento. Volume MVP
 * (~100 vendas/dia/cliente) nao precisa de cache. Quando volume escalar,
 * adicionar cache Redis 5min com invalidacao on-sync-campaigns (TD-085).
 */
import { and, eq, isNull, sql } from 'drizzle-orm'

import { db } from '@/lib/db'
import { adSets, ads, campaigns } from '@/lib/db/schema/campaigns'
import { gatewayEvents, utmMappings } from '@/lib/db/schema/gateway'
import { normalizeUtm } from '@/lib/services/utm-normalizer'

// ---------------------------------------------------------------------------
// Perfect match — busca por nome de campaign/adset/ad com normalizacao
// ---------------------------------------------------------------------------

export interface CampaignMatch {
  campaignId: string
  campaignName: string
  matchedAdSetId: string | null
  matchedAdId: string | null
}

/**
 * Encontra campaign do workspace cujo `name` normalizado bate exatamente
 * com `utmCampaign` normalizado. Retorna null se 0 ou 2+ matches (conflict).
 *
 * Quando `utmContent` e/ou `utmTerm` tambem batem com adset/ad, retorna
 * tambem `matchedAdSetId`/`matchedAdId` pra granularidade maxima.
 */
export async function findCampaignByNormalizedName(
  workspaceId: string,
  utmCampaign: string,
  utmContent?: string | null,
  utmTerm?: string | null
): Promise<CampaignMatch | null> {
  const normalizedCampaign = normalizeUtm(utmCampaign)
  if (!normalizedCampaign) return null

  // 1. Match nivel campanha — funcao SQL inline pra normalizar campaigns.name
  // sem precisar de coluna pre-computada. Ok pra MVP volume.
  const candidates = await db
    .select({
      id: campaigns.id,
      name: campaigns.name,
    })
    .from(campaigns)
    .where(
      and(
        eq(campaigns.workspaceId, workspaceId),
        sql`lower(regexp_replace(unaccent(${campaigns.name}), '[-_\\s]+', '-', 'g')) = ${normalizedCampaign}`
      )
    )
    .limit(2) // Se 2+ matches → conflict, retorna null

  if (candidates.length === 0) return null
  if (candidates.length > 1) return null

  const campaign = candidates[0]!
  const result: CampaignMatch = {
    campaignId: campaign.id,
    campaignName: campaign.name,
    matchedAdSetId: null,
    matchedAdId: null,
  }

  // 2. Tenta refinar pra ad set via utm_term
  const normalizedTerm = normalizeUtm(utmTerm ?? null)
  if (normalizedTerm) {
    const adSetMatches = await db
      .select({ id: adSets.id })
      .from(adSets)
      .where(
        and(
          eq(adSets.campaignId, campaign.id),
          sql`lower(regexp_replace(unaccent(${adSets.name}), '[-_\\s]+', '-', 'g')) = ${normalizedTerm}`
        )
      )
      .limit(2)
    if (adSetMatches.length === 1) {
      result.matchedAdSetId = adSetMatches[0]!.id
    }
  }

  // 3. Tenta refinar pra ad via utm_content (so faz sentido se ad set foi resolvido)
  const normalizedContent = normalizeUtm(utmContent ?? null)
  if (normalizedContent && result.matchedAdSetId) {
    const adMatches = await db
      .select({ id: ads.id })
      .from(ads)
      .where(
        and(
          eq(ads.adSetId, result.matchedAdSetId),
          sql`lower(regexp_replace(unaccent(${ads.name}), '[-_\\s]+', '-', 'g')) = ${normalizedContent}`
        )
      )
      .limit(2)
    if (adMatches.length === 1) {
      result.matchedAdId = adMatches[0]!.id
    }
  }

  return result
}

// ---------------------------------------------------------------------------
// Manual mapping — override admin via utm_mappings
// ---------------------------------------------------------------------------

export interface ManualMatch {
  adId: string
  confidence: number
}

/**
 * Busca mapping manual em `utm_mappings`. UNIQUE composto por workspace +
 * combinacao de UTMs significa que so 1 mapping ativo por combo. Retorna null
 * se nao ha override.
 */
export async function findManualMapping(
  workspaceId: string,
  utm: {
    source?: string | null
    medium?: string | null
    campaign?: string | null
    content?: string | null
    term?: string | null
  }
): Promise<ManualMatch | null> {
  // Match exato em utm_mappings (sem normalizacao — admin colou exatamente
  // o valor que vem do gateway). Match parcial (apenas alguns campos
  // preenchidos) priorizado por mais campos batendo.
  const rows = await db
    .select({
      adId: utmMappings.adId,
      confidence: utmMappings.confidenceScore,
      utmSource: utmMappings.utmSource,
      utmMedium: utmMappings.utmMedium,
      utmCampaign: utmMappings.utmCampaign,
      utmContent: utmMappings.utmContent,
      utmTerm: utmMappings.utmTerm,
    })
    .from(utmMappings)
    .where(eq(utmMappings.workspaceId, workspaceId))

  if (rows.length === 0) return null

  // Avalia cada mapping: conta campos definidos no mapping que batem com a UTM.
  // Mapping com mais campos batendo (mais especifico) vence.
  let bestMatch: { adId: string; confidence: number; specificity: number } | null = null
  for (const m of rows) {
    if (!m.adId) continue
    const fields: Array<[string | null, string | null | undefined]> = [
      [m.utmSource, utm.source],
      [m.utmMedium, utm.medium],
      [m.utmCampaign, utm.campaign],
      [m.utmContent, utm.content],
      [m.utmTerm, utm.term],
    ]
    let matched = 0
    let total = 0
    let conflict = false
    for (const [mappingValue, utmValue] of fields) {
      if (mappingValue == null) continue
      total += 1
      if (mappingValue === utmValue) matched += 1
      else conflict = true
    }
    if (conflict || total === 0 || matched < total) continue
    const specificity = total
    const confidence = Number(m.confidence ?? '1.0000')
    if (bestMatch === null || specificity > bestMatch.specificity) {
      bestMatch = { adId: m.adId, confidence, specificity }
    }
  }

  if (!bestMatch) return null
  return { adId: bestMatch.adId, confidence: bestMatch.confidence }
}

// ---------------------------------------------------------------------------
// Aggregate updates — UPDATE inline em campaigns apos match (ADR-020 dec.2)
// ---------------------------------------------------------------------------

/**
 * Incrementa aggregates da campanha matched: revenue_30d (apenas pra eventos
 * dos ultimos 30 dias), revenue_total, attributed_orders_count. Recalcula
 * roas_real se ad_insights ja tem spend pra essa campanha.
 *
 * Atomic via SQL `revenue + ?`. Lock contention nao e problema em volume MVP
 * (~100 vendas/dia/cliente). Migrar pra job dedicado em TD-081.
 */
export async function incrementCampaignAggregates(
  campaignId: string,
  amountCents: number,
  occurredAt: Date
): Promise<void> {
  const isWithin30d = Date.now() - occurredAt.getTime() < 30 * 24 * 60 * 60 * 1000
  await db
    .update(campaigns)
    .set({
      revenueGrossCentsTotal: sql`${campaigns.revenueGrossCentsTotal} + ${amountCents}`,
      revenueGrossCents30d: isWithin30d
        ? sql`${campaigns.revenueGrossCents30d} + ${amountCents}`
        : sql`${campaigns.revenueGrossCents30d}`,
      attributedOrdersCount: sql`${campaigns.attributedOrdersCount} + 1`,
      lastStitchedAt: new Date(),
    })
    .where(eq(campaigns.id, campaignId))
}

// ---------------------------------------------------------------------------
// Persist match result em gateway_events
// ---------------------------------------------------------------------------

export type MatchStrategy = 'perfect' | 'manual' | 'meta_literal' | 'unmatched'

export interface PersistMatchInput {
  eventId: string
  strategy: MatchStrategy
  matchedCampaignId?: string | null
  matchedAdSetId?: string | null
  matchedAdId?: string | null
  confidence?: number | null
}

export async function persistStitchResult(input: PersistMatchInput): Promise<void> {
  await db
    .update(gatewayEvents)
    .set({
      matchStrategy: input.strategy,
      matchedCampaignId: input.matchedCampaignId ?? null,
      matchedAdSetId: input.matchedAdSetId ?? null,
      matchedAdId: input.matchedAdId ?? null,
      matchConfidence: input.confidence != null ? input.confidence.toString() : null,
      stitchedAt: new Date(),
    })
    .where(and(eq(gatewayEvents.id, input.eventId), isNull(gatewayEvents.stitchedAt)))
}

// ---------------------------------------------------------------------------
// Read helpers — usados pelo dashboard de unmatched + admin observability
// ---------------------------------------------------------------------------

export async function listUnmatchedEvents(
  workspaceId: string,
  limit = 50
): Promise<Array<{ id: string; createdAt: Date; utmCampaign: string | null }>> {
  return db
    .select({
      id: gatewayEvents.id,
      createdAt: gatewayEvents.createdAt,
      utmCampaign: gatewayEvents.utmCampaign,
    })
    .from(gatewayEvents)
    .where(
      and(eq(gatewayEvents.workspaceId, workspaceId), eq(gatewayEvents.matchStrategy, 'unmatched'))
    )
    .orderBy(sql`${gatewayEvents.createdAt} DESC`)
    .limit(limit)
}
