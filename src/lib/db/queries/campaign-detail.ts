import { and, desc, eq, sql } from 'drizzle-orm'

import { db } from '@/lib/db'
import { adCreatives, ads, adSets, campaigns } from '@/lib/db/schema/campaigns'
import { toBrazilDateString } from '@/lib/dashboard/period-range'

export interface CampaignDetailHeader {
  id: string
  name: string
  provider: string
  status: string
  objective: string | null
  dailyBudgetCents: number | null
  lifetimeBudgetCents: number | null
  lastSyncedAt: Date | null
}

export interface CampaignKpiSnapshot {
  spendCents: number
  impressions: number
  clicks: number
  conversions: number
  revenueCents: number
  ctrPct: number | null
  cpmCents: number | null
  cpcCents: number | null
  cpaCents: number | null
  roas: number | null
}

export async function getCampaignHeader(input: {
  workspaceId: string
  campaignId: string
}): Promise<CampaignDetailHeader | null> {
  const row = await db.query.campaigns.findFirst({
    where: and(eq(campaigns.workspaceId, input.workspaceId), eq(campaigns.id, input.campaignId)),
  })
  if (!row) return null
  return {
    id: row.id,
    name: row.name,
    provider: row.provider,
    status: row.status,
    objective: row.objective,
    dailyBudgetCents: row.dailyBudgetCents,
    lifetimeBudgetCents: row.lifetimeBudgetCents,
    lastSyncedAt: row.lastSyncedAt,
  }
}

/**
 * KPI agregado da campanha num período. Junta ad_insights (paid) com
 * gateway_events (last-click attribution) pra revenue/orders.
 */
export async function getCampaignKpis(input: {
  workspaceId: string
  campaignId: string
  start: Date
  end: Date
}): Promise<CampaignKpiSnapshot> {
  const { workspaceId, campaignId, start, end } = input
  const startDate = toBrazilDateString(start)
  const endDate = toBrazilDateString(end)

  const result = await db.execute(sql`
    WITH ins AS (
      SELECT
        COALESCE(SUM(i.spend_cents), 0)::bigint AS spend_cents,
        COALESCE(SUM(i.impressions), 0)::bigint AS impressions,
        COALESCE(SUM(i.clicks), 0)::bigint AS clicks
      FROM ad_insights i
      JOIN ads a ON a.id = i.ad_id
      JOIN ad_sets s ON s.id = a.ad_set_id
      WHERE i.workspace_id = ${workspaceId}
        AND s.campaign_id = ${campaignId}
        AND i.date >= ${startDate}
        AND i.date <= ${endDate}
    ),
    rev AS (
      SELECT
        COALESCE(COUNT(*), 0)::int AS conversions,
        COALESCE(SUM(amount_cents), 0)::bigint AS revenue_cents
      FROM gateway_events
      WHERE workspace_id = ${workspaceId}
        AND matched_campaign_id = ${campaignId}
        AND event_type = 'PURCHASE_APPROVED'
        AND created_at >= ${start.toISOString()}
        AND created_at <= ${end.toISOString()}
    )
    SELECT
      ins.spend_cents,
      ins.impressions,
      ins.clicks,
      rev.conversions,
      rev.revenue_cents
    FROM ins, rev
  `)

  const arr = result as unknown as Array<{
    spend_cents: string | number
    impressions: string | number
    clicks: string | number
    conversions: number
    revenue_cents: string | number
  }>
  const r = arr[0] ?? {
    spend_cents: 0,
    impressions: 0,
    clicks: 0,
    conversions: 0,
    revenue_cents: 0,
  }

  const spend = Number(r.spend_cents)
  const impressions = Number(r.impressions)
  const clicks = Number(r.clicks)
  const conversions = Number(r.conversions)
  const revenue = Number(r.revenue_cents)

  return {
    spendCents: spend,
    impressions,
    clicks,
    conversions,
    revenueCents: revenue,
    ctrPct: impressions > 0 ? (clicks / impressions) * 100 : null,
    cpmCents: impressions > 0 ? Math.round((spend / impressions) * 1000) : null,
    cpcCents: clicks > 0 ? Math.round(spend / clicks) : null,
    cpaCents: conversions > 0 ? Math.round(spend / conversions) : null,
    roas: spend > 0 ? revenue / spend : null,
  }
}

export interface CampaignDailyPoint {
  date: string
  spendCents: number
  impressions: number
  clicks: number
  conversions: number
  revenueCents: number
}

/**
 * Série diária pra chart timeseries no /campanhas/[id].
 * Une spend (ad_insights) com revenue (gateway_events) por dia.
 */
export async function getCampaignDailySeries(input: {
  workspaceId: string
  campaignId: string
  start: Date
  end: Date
}): Promise<CampaignDailyPoint[]> {
  const { workspaceId, campaignId, start, end } = input
  const startDate = toBrazilDateString(start)
  const endDate = toBrazilDateString(end)

  const rows = await db.execute(sql`
    WITH days AS (
      SELECT generate_series(
        ${startDate}::date,
        ${endDate}::date,
        INTERVAL '1 day'
      )::date AS d
    ),
    ins AS (
      SELECT
        i.date AS d,
        SUM(i.spend_cents)::bigint AS spend_cents,
        SUM(i.impressions)::bigint AS impressions,
        SUM(i.clicks)::bigint AS clicks
      FROM ad_insights i
      JOIN ads a ON a.id = i.ad_id
      JOIN ad_sets s ON s.id = a.ad_set_id
      WHERE i.workspace_id = ${workspaceId}
        AND s.campaign_id = ${campaignId}
        AND i.date >= ${startDate}
        AND i.date <= ${endDate}
      GROUP BY i.date
    ),
    rev AS (
      SELECT
        DATE(created_at) AS d,
        COUNT(*)::int AS conversions,
        SUM(amount_cents)::bigint AS revenue_cents
      FROM gateway_events
      WHERE workspace_id = ${workspaceId}
        AND matched_campaign_id = ${campaignId}
        AND event_type = 'PURCHASE_APPROVED'
        AND created_at >= ${start.toISOString()}
        AND created_at <= ${end.toISOString()}
      GROUP BY DATE(created_at)
    )
    SELECT
      TO_CHAR(days.d, 'YYYY-MM-DD') AS date,
      COALESCE(ins.spend_cents, 0) AS spend_cents,
      COALESCE(ins.impressions, 0) AS impressions,
      COALESCE(ins.clicks, 0) AS clicks,
      COALESCE(rev.conversions, 0) AS conversions,
      COALESCE(rev.revenue_cents, 0) AS revenue_cents
    FROM days
    LEFT JOIN ins ON ins.d = days.d
    LEFT JOIN rev ON rev.d = days.d
    ORDER BY days.d
  `)

  const arr = rows as unknown as Array<{
    date: string
    spend_cents: string | number
    impressions: string | number
    clicks: string | number
    conversions: number
    revenue_cents: string | number
  }>

  return arr.map((r) => ({
    date: r.date,
    spendCents: Number(r.spend_cents),
    impressions: Number(r.impressions),
    clicks: Number(r.clicks),
    conversions: Number(r.conversions),
    revenueCents: Number(r.revenue_cents),
  }))
}

export interface AdSetWithAds {
  id: string
  name: string
  status: string
  spendCents: number
  impressions: number
  clicks: number
  ctrPct: number | null
  conversions: number
  revenueCents: number
  ads: AdRow[]
}

export interface AdRow {
  id: string
  name: string
  status: string
  creativeId: string | null
  spendCents: number
  impressions: number
  clicks: number
  ctrPct: number | null
}

/**
 * Tabela aninhada ad_sets → ads pra detail page.
 * Agregados por ad_set vêm de ad_insights + revenue de gateway_events
 * matched_ad_set_id (last-click).
 */
export async function getCampaignAdSetsWithAds(input: {
  workspaceId: string
  campaignId: string
  start: Date
  end: Date
}): Promise<AdSetWithAds[]> {
  const { workspaceId, campaignId, start, end } = input
  const startDate = toBrazilDateString(start)
  const endDate = toBrazilDateString(end)

  const adSetRows = await db.execute(sql`
    WITH ad_agg AS (
      SELECT
        a.ad_set_id,
        SUM(i.spend_cents)::bigint AS spend_cents,
        SUM(i.impressions)::bigint AS impressions,
        SUM(i.clicks)::bigint AS clicks
      FROM ad_insights i
      JOIN ads a ON a.id = i.ad_id
      WHERE i.workspace_id = ${workspaceId}
        AND i.date >= ${startDate}
        AND i.date <= ${endDate}
      GROUP BY a.ad_set_id
    ),
    rev AS (
      SELECT
        matched_ad_set_id AS ad_set_id,
        COUNT(*)::int AS conversions,
        SUM(amount_cents)::bigint AS revenue_cents
      FROM gateway_events
      WHERE workspace_id = ${workspaceId}
        AND matched_ad_set_id IS NOT NULL
        AND event_type = 'PURCHASE_APPROVED'
        AND created_at >= ${start.toISOString()}
        AND created_at <= ${end.toISOString()}
      GROUP BY matched_ad_set_id
    )
    SELECT
      s.id,
      s.name,
      s.status,
      COALESCE(aa.spend_cents, 0) AS spend_cents,
      COALESCE(aa.impressions, 0) AS impressions,
      COALESCE(aa.clicks, 0) AS clicks,
      COALESCE(rev.conversions, 0)::int AS conversions,
      COALESCE(rev.revenue_cents, 0) AS revenue_cents
    FROM ad_sets s
    LEFT JOIN ad_agg aa ON aa.ad_set_id = s.id
    LEFT JOIN rev ON rev.ad_set_id = s.id
    WHERE s.workspace_id = ${workspaceId}
      AND s.campaign_id = ${campaignId}
    ORDER BY spend_cents DESC, s.name
  `)

  const adSetArr = adSetRows as unknown as Array<{
    id: string
    name: string
    status: string
    spend_cents: string | number
    impressions: string | number
    clicks: string | number
    conversions: number
    revenue_cents: string | number
  }>

  if (adSetArr.length === 0) return []

  const adRows = await db.execute(sql`
    SELECT
      a.id,
      a.ad_set_id,
      a.name,
      a.status,
      a.creative_id,
      COALESCE(SUM(i.spend_cents), 0)::bigint AS spend_cents,
      COALESCE(SUM(i.impressions), 0)::bigint AS impressions,
      COALESCE(SUM(i.clicks), 0)::bigint AS clicks
    FROM ads a
    JOIN ad_sets s ON s.id = a.ad_set_id
    LEFT JOIN ad_insights i ON i.ad_id = a.id
      AND i.date >= ${startDate}
      AND i.date <= ${endDate}
    WHERE a.workspace_id = ${workspaceId}
      AND s.campaign_id = ${campaignId}
    GROUP BY a.id, a.ad_set_id
    ORDER BY spend_cents DESC, a.name
  `)

  const adArr = adRows as unknown as Array<{
    id: string
    ad_set_id: string
    name: string
    status: string
    creative_id: string | null
    spend_cents: string | number
    impressions: string | number
    clicks: string | number
  }>

  const adsByAdSet = new Map<string, AdRow[]>()
  for (const a of adArr) {
    const impressions = Number(a.impressions)
    const clicks = Number(a.clicks)
    const row: AdRow = {
      id: a.id,
      name: a.name,
      status: a.status,
      creativeId: a.creative_id,
      spendCents: Number(a.spend_cents),
      impressions,
      clicks,
      ctrPct: impressions > 0 ? (clicks / impressions) * 100 : null,
    }
    const arr = adsByAdSet.get(a.ad_set_id) ?? []
    arr.push(row)
    adsByAdSet.set(a.ad_set_id, arr)
  }

  return adSetArr.map((s) => {
    const impressions = Number(s.impressions)
    const clicks = Number(s.clicks)
    return {
      id: s.id,
      name: s.name,
      status: s.status,
      spendCents: Number(s.spend_cents),
      impressions,
      clicks,
      ctrPct: impressions > 0 ? (clicks / impressions) * 100 : null,
      conversions: Number(s.conversions),
      revenueCents: Number(s.revenue_cents),
      ads: adsByAdSet.get(s.id) ?? [],
    }
  })
}

export interface CampaignCreative {
  id: string
  adId: string | null
  adName: string | null
  type: string | null
  title: string | null
  thumbnailUrl: string | null
  videoUrl: string | null
  spendCents: number
  impressions: number
  clicks: number
  ctrPct: number | null
}

/**
 * Galeria de criativos da campanha. Junta ad_creatives com performance
 * agregada do ad pai. Ordena por spend desc.
 */
export async function getCampaignCreatives(input: {
  workspaceId: string
  campaignId: string
  start: Date
  end: Date
}): Promise<CampaignCreative[]> {
  const { workspaceId, campaignId, start, end } = input
  const startDate = toBrazilDateString(start)
  const endDate = toBrazilDateString(end)

  const rows = await db.execute(sql`
    SELECT
      cr.id,
      cr.ad_id,
      cr.type,
      cr.title,
      cr.thumbnail_url,
      cr.video_url,
      a.name AS ad_name,
      COALESCE(SUM(i.spend_cents), 0)::bigint AS spend_cents,
      COALESCE(SUM(i.impressions), 0)::bigint AS impressions,
      COALESCE(SUM(i.clicks), 0)::bigint AS clicks
    FROM ad_creatives cr
    LEFT JOIN ads a ON a.id = cr.ad_id
    LEFT JOIN ad_sets s ON s.id = a.ad_set_id
    LEFT JOIN ad_insights i ON i.ad_id = a.id
      AND i.date >= ${startDate}
      AND i.date <= ${endDate}
    WHERE cr.workspace_id = ${workspaceId}
      AND s.campaign_id = ${campaignId}
    GROUP BY cr.id, a.name
    ORDER BY spend_cents DESC, cr.created_at DESC
  `)

  const arr = rows as unknown as Array<{
    id: string
    ad_id: string | null
    type: string | null
    title: string | null
    thumbnail_url: string | null
    video_url: string | null
    ad_name: string | null
    spend_cents: string | number
    impressions: string | number
    clicks: string | number
  }>

  return arr.map((r) => {
    const impressions = Number(r.impressions)
    const clicks = Number(r.clicks)
    return {
      id: r.id,
      adId: r.ad_id,
      adName: r.ad_name,
      type: r.type,
      title: r.title,
      thumbnailUrl: r.thumbnail_url,
      videoUrl: r.video_url,
      spendCents: Number(r.spend_cents),
      impressions,
      clicks,
      ctrPct: impressions > 0 ? (clicks / impressions) * 100 : null,
    }
  })
}

/**
 * Lista compacta de TODAS as campanhas do workspace pra dropdown comparativo
 * A×B. Sem agregados, ordenado por nome.
 */
export async function listCampaignsForCompare(workspaceId: string) {
  return db
    .select({
      id: campaigns.id,
      name: campaigns.name,
      provider: campaigns.provider,
      status: campaigns.status,
    })
    .from(campaigns)
    .where(eq(campaigns.workspaceId, workspaceId))
    .orderBy(desc(campaigns.lastSyncedAt))
    .limit(500)
}

export interface CreativeForAnalysis {
  id: string
  type: string | null
  title: string | null
  body: string | null
  videoUrl: string | null
  thumbnailUrl: string | null
  durationSeconds: number | null
}

/**
 * Criativo único com copy (title + body) pra montar o BLOCO DE TRANSIÇÃO
 * (pipeline analisar.video_ad). Filtra por workspaceId pra isolamento.
 */
export async function getCreativeForAnalysis(input: {
  workspaceId: string
  creativeId: string
}): Promise<CreativeForAnalysis | null> {
  const row = await db.query.adCreatives.findFirst({
    where: and(
      eq(adCreatives.workspaceId, input.workspaceId),
      eq(adCreatives.id, input.creativeId)
    ),
    columns: {
      id: true,
      type: true,
      title: true,
      body: true,
      videoUrl: true,
      thumbnailUrl: true,
      durationSeconds: true,
    },
  })
  return row ?? null
}

// Re-exports usados internos
export { adCreatives, ads, adSets }
