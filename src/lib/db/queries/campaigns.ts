import { and, eq, sql } from 'drizzle-orm'

import { db } from '@/lib/db'
import { adInsights, adSets, ads, campaigns } from '@/lib/db/schema/campaigns'
import type { AdInsight, Campaign, NewCampaign } from '@/lib/db/schema'

/**
 * UPSERT idempotente de campaign. Conflito em
 * (workspace_id, provider, provider_id) atualiza nome/status/budgets.
 */
export async function upsertCampaign(input: NewCampaign): Promise<Campaign> {
  const [row] = await db
    .insert(campaigns)
    .values(input)
    .onConflictDoUpdate({
      target: [campaigns.workspaceId, campaigns.provider, campaigns.providerId],
      set: {
        name: input.name,
        status: input.status,
        objective: input.objective ?? null,
        dailyBudgetCents: input.dailyBudgetCents ?? null,
        lifetimeBudgetCents: input.lifetimeBudgetCents ?? null,
        startTime: input.startTime ?? null,
        endTime: input.endTime ?? null,
        providerData: input.providerData ?? null,
        metaAdAccountId: input.metaAdAccountId ?? null,
        lastSyncedAt: new Date(),
        updatedAt: new Date(),
      },
    })
    .returning()
  if (!row) throw new Error('upsertCampaign nao retornou row')
  return row
}

export async function upsertAdSet(input: typeof adSets.$inferInsert) {
  const [row] = await db
    .insert(adSets)
    .values(input)
    .onConflictDoUpdate({
      target: [adSets.workspaceId, adSets.campaignId, adSets.providerId],
      set: {
        name: input.name,
        status: input.status,
        targeting: input.targeting ?? null,
        providerData: input.providerData ?? null,
        metaAdAccountId: input.metaAdAccountId ?? null,
        lastSyncedAt: new Date(),
        updatedAt: new Date(),
      },
    })
    .returning()
  if (!row) throw new Error('upsertAdSet nao retornou row')
  return row
}

export async function upsertAd(input: typeof ads.$inferInsert) {
  const [row] = await db
    .insert(ads)
    .values(input)
    .onConflictDoUpdate({
      target: [ads.workspaceId, ads.adSetId, ads.providerId],
      set: {
        name: input.name,
        status: input.status,
        creativeId: input.creativeId ?? null,
        providerData: input.providerData ?? null,
        metaAdAccountId: input.metaAdAccountId ?? null,
        lastSyncedAt: new Date(),
        updatedAt: new Date(),
      },
    })
    .returning()
  if (!row) throw new Error('upsertAd nao retornou row')
  return row
}

export async function upsertAdInsight(input: typeof adInsights.$inferInsert): Promise<AdInsight> {
  const [row] = await db
    .insert(adInsights)
    .values(input)
    .onConflictDoUpdate({
      target: [adInsights.workspaceId, adInsights.adId, adInsights.date],
      set: {
        impressions: input.impressions ?? 0,
        clicks: input.clicks ?? 0,
        spendCents: input.spendCents ?? 0,
        reach: input.reach ?? 0,
        frequency: input.frequency ?? null,
        ctr: input.ctr ?? null,
        cpcCents: input.cpcCents ?? null,
        cpmCents: input.cpmCents ?? null,
        hookRate: input.hookRate ?? null,
        holdRate15s: input.holdRate15s ?? null,
        holdRate30s: input.holdRate30s ?? null,
        videoViews: input.videoViews ?? 0,
        providerData: input.providerData ?? null,
        updatedAt: new Date(),
      },
    })
    .returning()
  if (!row) throw new Error('upsertAdInsight nao retornou row')
  return row
}

/**
 * Marca como ARCHIVED toda campaign/ad_set/ad de um ad_account especifico que
 * NAO foi tocada apos `syncStartedAt` — ou seja, sumiu da resposta Meta API
 * (foi deletada na conta ou nao pertence mais a essa conta).
 *
 * Chamado pelo sync apos upsert completo de uma ad_account, com timestamp do
 * inicio do sync. CASCADE manual via JOIN porque archived flag e por nivel.
 */
export async function archiveStaleByAdAccount(input: {
  workspaceId: string
  metaAdAccountId: string
  syncStartedAt: Date
}): Promise<{ campaignsArchived: number; adSetsArchived: number; adsArchived: number }> {
  const { workspaceId, metaAdAccountId, syncStartedAt } = input

  const ar = await db
    .update(campaigns)
    .set({ status: 'ARCHIVED', updatedAt: new Date() })
    .where(
      and(
        eq(campaigns.workspaceId, workspaceId),
        eq(campaigns.metaAdAccountId, metaAdAccountId),
        sql`(${campaigns.lastSyncedAt} IS NULL OR ${campaigns.lastSyncedAt} < ${syncStartedAt.toISOString()})`,
        sql`${campaigns.status} != 'ARCHIVED'`
      )
    )
    .returning({ id: campaigns.id })

  const asr = await db
    .update(adSets)
    .set({ status: 'ARCHIVED', updatedAt: new Date() })
    .where(
      and(
        eq(adSets.workspaceId, workspaceId),
        eq(adSets.metaAdAccountId, metaAdAccountId),
        sql`(${adSets.lastSyncedAt} IS NULL OR ${adSets.lastSyncedAt} < ${syncStartedAt.toISOString()})`,
        sql`${adSets.status} != 'ARCHIVED'`
      )
    )
    .returning({ id: adSets.id })

  const adr = await db
    .update(ads)
    .set({ status: 'ARCHIVED', updatedAt: new Date() })
    .where(
      and(
        eq(ads.workspaceId, workspaceId),
        eq(ads.metaAdAccountId, metaAdAccountId),
        sql`(${ads.lastSyncedAt} IS NULL OR ${ads.lastSyncedAt} < ${syncStartedAt.toISOString()})`,
        sql`${ads.status} != 'ARCHIVED'`
      )
    )
    .returning({ id: ads.id })

  return {
    campaignsArchived: ar.length,
    adSetsArchived: asr.length,
    adsArchived: adr.length,
  }
}

/**
 * Lookup helpers — usados pelo sync pra mapear provider_id -> uuid local.
 */
export async function findCampaignByProviderId(input: {
  workspaceId: string
  provider: string
  providerId: string
}): Promise<Campaign | null> {
  const row = await db.query.campaigns.findFirst({
    where: and(
      eq(campaigns.workspaceId, input.workspaceId),
      eq(campaigns.provider, input.provider),
      eq(campaigns.providerId, input.providerId)
    ),
  })
  return row ?? null
}

export async function findAdByProviderId(input: { workspaceId: string; providerId: string }) {
  const row = await db.query.ads.findFirst({
    where: and(eq(ads.workspaceId, input.workspaceId), eq(ads.providerId, input.providerId)),
  })
  return row ?? null
}

export interface CampaignListRow {
  id: string
  provider: string
  provider_id: string
  name: string
  status: string
  objective: string | null
  last_synced_at: Date | null
  spend_period_cents: number
  impressions_period: number
  clicks_period: number
  ctr_period_pct: string | null
  conversions_period: number
  revenue_period_cents: number
  roas_period: string | null
}

export interface ListCampaignsInput {
  workspaceId: string
  start: Date
  end: Date
  status?: string | undefined
  provider?: string | undefined
  q?: string | undefined
  limit?: number
  offset?: number
}

/**
 * Lista campanhas filtradas + paginadas com agregados do periodo.
 * Conversoes/receita via gateway_events.matched_campaign_id (last-click
 * UTM Stitcher 1.4.8/1.4.B). Retorna {rows, total} para paginacao.
 */
export async function listCampaignsWithMetrics(input: ListCampaignsInput): Promise<{
  rows: CampaignListRow[]
  total: number
}> {
  const { workspaceId, start, end, status, provider, q, limit = 25, offset = 0 } = input

  const startDate = start.toISOString().slice(0, 10)
  const endDate = end.toISOString().slice(0, 10)

  const statusFilter = status ? sql`AND c.status = ${status}` : sql``
  const providerFilter = provider ? sql`AND c.provider = ${provider}` : sql``
  const qFilter = q ? sql`AND c.name ILIKE ${'%' + q + '%'}` : sql``

  const rows = await db.execute(sql`
    WITH insight_agg AS (
      SELECT
        s.campaign_id,
        SUM(i.spend_cents)::bigint AS spend_cents,
        SUM(i.impressions)::bigint AS impressions,
        SUM(i.clicks)::bigint AS clicks
      FROM ad_insights i
      JOIN ads a ON a.id = i.ad_id
      JOIN ad_sets s ON s.id = a.ad_set_id
      WHERE i.workspace_id = ${workspaceId}
        AND i.date >= ${startDate}
        AND i.date <= ${endDate}
      GROUP BY s.campaign_id
    ),
    revenue_agg AS (
      SELECT
        ge.matched_campaign_id AS campaign_id,
        COUNT(*)::int AS orders,
        SUM(ge.amount_cents)::bigint AS revenue_cents
      FROM gateway_events ge
      WHERE ge.workspace_id = ${workspaceId}
        AND ge.event_type = 'PURCHASE_APPROVED'
        AND ge.matched_campaign_id IS NOT NULL
        AND ge.created_at >= ${start.toISOString()}
        AND ge.created_at <= ${end.toISOString()}
      GROUP BY ge.matched_campaign_id
    )
    SELECT
      c.id,
      c.provider,
      c.provider_id,
      c.name,
      c.status,
      c.objective,
      c.last_synced_at,
      COALESCE(ia.spend_cents, 0) AS spend_period_cents,
      COALESCE(ia.impressions, 0) AS impressions_period,
      COALESCE(ia.clicks, 0) AS clicks_period,
      CASE
        WHEN COALESCE(ia.impressions, 0) > 0
        THEN ROUND((ia.clicks::numeric / ia.impressions) * 100, 4)
        ELSE NULL
      END AS ctr_period_pct,
      COALESCE(ra.orders, 0)::int AS conversions_period,
      COALESCE(ra.revenue_cents, 0) AS revenue_period_cents,
      CASE
        WHEN COALESCE(ia.spend_cents, 0) > 0
        THEN ROUND(COALESCE(ra.revenue_cents, 0)::numeric / ia.spend_cents, 4)
        ELSE NULL
      END AS roas_period,
      COUNT(*) OVER () AS total_count
    FROM campaigns c
    LEFT JOIN insight_agg ia ON ia.campaign_id = c.id
    LEFT JOIN revenue_agg ra ON ra.campaign_id = c.id
    WHERE c.workspace_id = ${workspaceId}
      ${statusFilter}
      ${providerFilter}
      ${qFilter}
    ORDER BY spend_period_cents DESC, c.last_synced_at DESC NULLS LAST
    LIMIT ${limit}
    OFFSET ${offset}
  `)

  const arr = rows as unknown as Array<{
    id: string
    provider: string
    provider_id: string
    name: string
    status: string
    objective: string | null
    last_synced_at: Date | null
    spend_period_cents: string | number
    impressions_period: string | number
    clicks_period: string | number
    ctr_period_pct: string | null
    conversions_period: number
    revenue_period_cents: string | number
    roas_period: string | null
    total_count: string
  }>

  const total = arr.length > 0 && arr[0] ? Number(arr[0].total_count) : 0

  return {
    rows: arr.map((r) => ({
      id: r.id,
      provider: r.provider,
      provider_id: r.provider_id,
      name: r.name,
      status: r.status,
      objective: r.objective,
      last_synced_at: r.last_synced_at,
      spend_period_cents: Number(r.spend_period_cents),
      impressions_period: Number(r.impressions_period),
      clicks_period: Number(r.clicks_period),
      ctr_period_pct: r.ctr_period_pct,
      conversions_period: Number(r.conversions_period),
      revenue_period_cents: Number(r.revenue_period_cents),
      roas_period: r.roas_period,
    })),
    total,
  }
}
