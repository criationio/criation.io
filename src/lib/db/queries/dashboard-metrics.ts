import { and, desc, eq, gte, inArray, lte, ne, or, sql } from 'drizzle-orm'

import { db } from '@/lib/db'
import { adInsights, ads, adSets, campaigns } from '@/lib/db/schema/campaigns'
import { gatewayEvents, gatewaySubscriptions } from '@/lib/db/schema/gateway'
import { trackingEvents } from '@/lib/db/schema/tracking'
import {
  channelsToSqlFilter,
  utmSourceToChannel,
  type CanonicalChannel,
} from '@/lib/dashboard/channel-mapping'
import type {
  ChannelMixSlice,
  CreativeRow,
  DailyMetric,
  FunnelData,
  KpiSnapshot,
  UtmSourceRow,
} from '@/lib/dashboard/mock-data'
import { previousRange, type PeriodRange } from '@/lib/dashboard/period-range'

/**
 * Queries reais do dashboard (Sessao 1.6 PR-13b).
 *
 * Cada funcao retorna o MESMO shape que os mock generators em mock-data.ts —
 * permite trocar mock <-> real sem ajustar os widgets. Toggle em page.tsx
 * decide qual caminho usar via `hasWorkspaceData()`.
 *
 * Atribuicao last-click: usa direto os campos `matched_*` de gateway_events
 * (ja populados pelo UTM Stitcher em sessao 1.4.8). Outros modelos (first-
 * click, linear, etc) ficam para PRs futuros.
 *
 * Conversoes:
 *  - Valores em DB sao cents (integer); UI espera BRL units (number) — divide por 100
 *  - Datas no DB sao timestamptz / date; UI espera 'YYYY-MM-DD'
 */

const GATEWAY_FEE_RATE = 0.07 // 7% media Hotmart/Kiwify — TD futuro: ler por gateway

export interface DashboardFilters {
  workspaceId: string
  range: PeriodRange
  channels?: string[]
  products?: string[]
}

// ============================================================================
// Helper: has-data toggle
// ============================================================================

/**
 * Workspace tem volume suficiente pra mostrar dados reais? >=5 gateway_events
 * em 30d. Abaixo disso, page renderiza mock + badge "exemplo".
 */
export async function hasWorkspaceData(workspaceId: string): Promise<boolean> {
  const since = new Date(Date.now() - 30 * 86_400_000)
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(gatewayEvents)
    .where(and(eq(gatewayEvents.workspaceId, workspaceId), gte(gatewayEvents.createdAt, since)))
  return (row?.count ?? 0) >= 5
}

// ============================================================================
// KPI Aggregates
// ============================================================================

export async function getKpiAggregates(filters: DashboardFilters): Promise<KpiSnapshot> {
  const { workspaceId, range } = filters
  const productCondition = filters.products?.length
    ? inArray(gatewayEvents.productId, filters.products)
    : undefined
  const channelCondition = buildChannelCondition(filters.channels)

  // Revenue + orders + customers de gateway_events
  const [gwRow] = await db
    .select({
      revenueCents: sql<number>`COALESCE(SUM(${gatewayEvents.amountCents}) FILTER (WHERE ${gatewayEvents.eventType} = 'PURCHASE_APPROVED'), 0)::bigint`,
      refundsCents: sql<number>`COALESCE(SUM(${gatewayEvents.amountCents}) FILTER (WHERE ${gatewayEvents.eventType} IN ('REFUND', 'CHARGEBACK')), 0)::bigint`,
      orders: sql<number>`COUNT(*) FILTER (WHERE ${gatewayEvents.eventType} = 'PURCHASE_APPROVED')::int`,
      customers: sql<number>`COUNT(DISTINCT ${gatewayEvents.customerEmailHash}) FILTER (WHERE ${gatewayEvents.eventType} = 'PURCHASE_APPROVED' AND ${gatewayEvents.customerEmailHash} IS NOT NULL)::int`,
    })
    .from(gatewayEvents)
    .where(
      and(
        eq(gatewayEvents.workspaceId, workspaceId),
        gte(gatewayEvents.createdAt, range.start),
        lte(gatewayEvents.createdAt, range.end),
        productCondition,
        channelCondition
      )
    )

  // Spend de ad_insights (sem channel filter direto — ad_insights e sempre paid)
  // Channel filter pra spend: aplicado via campaigns.provider quando channels inclui meta/google
  const spendQuery = filters.channels?.length
    ? db
        .select({
          spendCents: sql<number>`COALESCE(SUM(${adInsights.spendCents}), 0)::bigint`,
          impressions: sql<number>`COALESCE(SUM(${adInsights.impressions}), 0)::bigint`,
          clicks: sql<number>`COALESCE(SUM(${adInsights.clicks}), 0)::bigint`,
        })
        .from(adInsights)
        .innerJoin(ads, eq(ads.id, adInsights.adId))
        .innerJoin(adSets, eq(adSets.id, ads.adSetId))
        .innerJoin(campaigns, eq(campaigns.id, adSets.campaignId))
        .where(
          and(
            eq(adInsights.workspaceId, workspaceId),
            gte(adInsights.date, range.start.toISOString().slice(0, 10)),
            lte(adInsights.date, range.end.toISOString().slice(0, 10)),
            buildSpendChannelCondition(filters.channels)
          )
        )
    : db
        .select({
          spendCents: sql<number>`COALESCE(SUM(${adInsights.spendCents}), 0)::bigint`,
          impressions: sql<number>`COALESCE(SUM(${adInsights.impressions}), 0)::bigint`,
          clicks: sql<number>`COALESCE(SUM(${adInsights.clicks}), 0)::bigint`,
        })
        .from(adInsights)
        .where(
          and(
            eq(adInsights.workspaceId, workspaceId),
            gte(adInsights.date, range.start.toISOString().slice(0, 10)),
            lte(adInsights.date, range.end.toISOString().slice(0, 10))
          )
        )
  const [spendRow] = await spendQuery

  const revenue = Number(gwRow?.revenueCents ?? 0) / 100
  const refunds = Number(gwRow?.refundsCents ?? 0) / 100
  const spend = Number(spendRow?.spendCents ?? 0) / 100
  const orders = gwRow?.orders ?? 0
  const customers = gwRow?.customers ?? 0
  const fees = revenue * GATEWAY_FEE_RATE
  const profit = revenue - spend - refunds - fees
  const roas = spend > 0 ? revenue / spend : 0
  const cac = customers > 0 ? spend / customers : 0
  const ticketMedio = orders > 0 ? revenue / orders : 0
  const ltv = ticketMedio * 1.6 // approximation; PR-13c real cohort-derived LTV
  const marginPercent = revenue > 0 ? (profit / revenue) * 100 : 0

  return { revenue, profit, roas, spend, cac, ticketMedio, ltv, marginPercent }
}

// ============================================================================
// Daily Series — pra sales chart + sparklines
// ============================================================================

export async function getDailySeries(filters: DashboardFilters): Promise<DailyMetric[]> {
  const { workspaceId, range } = filters
  const productCondition = filters.products?.length
    ? inArray(gatewayEvents.productId, filters.products)
    : undefined
  const channelCondition = buildChannelCondition(filters.channels)

  // Group gateway_events por dia
  const gatewayDaily = await db
    .select({
      date: sql<string>`TO_CHAR(${gatewayEvents.createdAt}, 'YYYY-MM-DD')`,
      revenueCents: sql<number>`COALESCE(SUM(${gatewayEvents.amountCents}) FILTER (WHERE ${gatewayEvents.eventType} = 'PURCHASE_APPROVED'), 0)::bigint`,
      refundsCents: sql<number>`COALESCE(SUM(${gatewayEvents.amountCents}) FILTER (WHERE ${gatewayEvents.eventType} IN ('REFUND', 'CHARGEBACK')), 0)::bigint`,
      orders: sql<number>`COUNT(*) FILTER (WHERE ${gatewayEvents.eventType} = 'PURCHASE_APPROVED')::int`,
      customers: sql<number>`COUNT(DISTINCT ${gatewayEvents.customerEmailHash}) FILTER (WHERE ${gatewayEvents.eventType} = 'PURCHASE_APPROVED' AND ${gatewayEvents.customerEmailHash} IS NOT NULL)::int`,
      initiateCheckout: sql<number>`COUNT(*) FILTER (WHERE ${gatewayEvents.eventType} = 'PURCHASE_INITIATED')::int`,
      purchases: sql<number>`COUNT(*) FILTER (WHERE ${gatewayEvents.eventType} = 'PURCHASE_APPROVED')::int`,
      refundsCount: sql<number>`COUNT(*) FILTER (WHERE ${gatewayEvents.eventType} IN ('REFUND', 'CHARGEBACK'))::int`,
    })
    .from(gatewayEvents)
    .where(
      and(
        eq(gatewayEvents.workspaceId, workspaceId),
        gte(gatewayEvents.createdAt, range.start),
        lte(gatewayEvents.createdAt, range.end),
        productCondition,
        channelCondition
      )
    )
    .groupBy(sql`TO_CHAR(${gatewayEvents.createdAt}, 'YYYY-MM-DD')`)

  // Group ad_insights por dia
  const insightsDaily = await db
    .select({
      date: sql<string>`TO_CHAR(${adInsights.date}, 'YYYY-MM-DD')`,
      spendCents: sql<number>`COALESCE(SUM(${adInsights.spendCents}), 0)::bigint`,
      impressions: sql<number>`COALESCE(SUM(${adInsights.impressions}), 0)::bigint`,
      clicks: sql<number>`COALESCE(SUM(${adInsights.clicks}), 0)::bigint`,
    })
    .from(adInsights)
    .where(
      and(
        eq(adInsights.workspaceId, workspaceId),
        gte(adInsights.date, range.start.toISOString().slice(0, 10)),
        lte(adInsights.date, range.end.toISOString().slice(0, 10))
      )
    )
    .groupBy(sql`TO_CHAR(${adInsights.date}, 'YYYY-MM-DD')`)

  // Tracking events (pageView + lead) por dia
  const trackingDaily = await db
    .select({
      date: sql<string>`TO_CHAR(${trackingEvents.eventTs}, 'YYYY-MM-DD')`,
      pageViews: sql<number>`COUNT(*) FILTER (WHERE ${trackingEvents.eventName} = 'page_view')::int`,
      leads: sql<number>`COUNT(*) FILTER (WHERE ${trackingEvents.eventName} = 'lead')::int`,
    })
    .from(trackingEvents)
    .where(
      and(
        eq(trackingEvents.workspaceId, workspaceId),
        gte(trackingEvents.eventTs, range.start),
        lte(trackingEvents.eventTs, range.end)
      )
    )
    .groupBy(sql`TO_CHAR(${trackingEvents.eventTs}, 'YYYY-MM-DD')`)

  // Active subscriptions (snapshot do dia — usa current count, n/a por dia historico)
  const [subsRow] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(gatewaySubscriptions)
    .where(
      and(
        eq(gatewaySubscriptions.workspaceId, workspaceId),
        eq(gatewaySubscriptions.status, 'ACTIVE')
      )
    )

  // Merge por data
  const byDate = new Map<string, DailyMetric>()
  const eachDay = enumerateDays(range)
  for (const date of eachDay) {
    byDate.set(date, {
      date,
      revenue: 0,
      spend: 0,
      profit: 0,
      orders: 0,
      customers: 0,
      impressions: 0,
      clicks: 0,
      pageViews: 0,
      leads: 0,
      initiateCheckout: 0,
      purchases: 0,
      refunds: 0,
      activeSubscriptions: subsRow?.count ?? 0,
    })
  }

  for (const row of gatewayDaily) {
    const day = byDate.get(row.date)
    if (!day) continue
    day.revenue = Number(row.revenueCents) / 100
    day.refunds = Number(row.refundsCents) / 100
    day.orders = row.orders
    day.customers = row.customers
    day.initiateCheckout = row.initiateCheckout
    day.purchases = row.purchases
  }

  for (const row of insightsDaily) {
    const day = byDate.get(row.date)
    if (!day) continue
    day.spend = Number(row.spendCents) / 100
    day.impressions = Number(row.impressions)
    day.clicks = Number(row.clicks)
  }

  for (const row of trackingDaily) {
    const day = byDate.get(row.date)
    if (!day) continue
    day.pageViews = row.pageViews
    day.leads = row.leads
  }

  // Profit per day
  for (const day of byDate.values()) {
    const fees = day.revenue * GATEWAY_FEE_RATE
    day.profit = day.revenue - day.spend - day.refunds - fees
  }

  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date))
}

// ============================================================================
// Funnel data
// ============================================================================

export async function getFunnelData(filters: DashboardFilters): Promise<FunnelData> {
  const { workspaceId, range } = filters
  const productCondition = filters.products?.length
    ? inArray(gatewayEvents.productId, filters.products)
    : undefined
  const channelCondition = buildChannelCondition(filters.channels)

  // ad_insights (impressions + clicks)
  const [insights] = await db
    .select({
      impressions: sql<number>`COALESCE(SUM(${adInsights.impressions}), 0)::bigint`,
      clicks: sql<number>`COALESCE(SUM(${adInsights.clicks}), 0)::bigint`,
    })
    .from(adInsights)
    .where(
      and(
        eq(adInsights.workspaceId, workspaceId),
        gte(adInsights.date, range.start.toISOString().slice(0, 10)),
        lte(adInsights.date, range.end.toISOString().slice(0, 10))
      )
    )

  // tracking_events (pageViews + leads)
  const [tracking] = await db
    .select({
      pageViews: sql<number>`COUNT(*) FILTER (WHERE ${trackingEvents.eventName} = 'page_view')::int`,
      leads: sql<number>`COUNT(*) FILTER (WHERE ${trackingEvents.eventName} = 'lead')::int`,
    })
    .from(trackingEvents)
    .where(
      and(
        eq(trackingEvents.workspaceId, workspaceId),
        gte(trackingEvents.eventTs, range.start),
        lte(trackingEvents.eventTs, range.end)
      )
    )

  // gateway_events (checkout + purchases + confirmed)
  const [gw] = await db
    .select({
      initiateCheckout: sql<number>`COUNT(*) FILTER (WHERE ${gatewayEvents.eventType} = 'PURCHASE_INITIATED')::int`,
      purchasesApproved: sql<number>`COUNT(*) FILTER (WHERE ${gatewayEvents.eventType} = 'PURCHASE_APPROVED')::int`,
      paymentConfirmed: sql<number>`COUNT(*) FILTER (WHERE ${gatewayEvents.eventType} = 'PAYMENT_CONFIRMED')::int`,
    })
    .from(gatewayEvents)
    .where(
      and(
        eq(gatewayEvents.workspaceId, workspaceId),
        gte(gatewayEvents.createdAt, range.start),
        lte(gatewayEvents.createdAt, range.end),
        productCondition,
        channelCondition
      )
    )

  // Active subscriptions
  const [subs] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(gatewaySubscriptions)
    .where(
      and(
        eq(gatewaySubscriptions.workspaceId, workspaceId),
        eq(gatewaySubscriptions.status, 'ACTIVE')
      )
    )

  // Fallback: se paymentConfirmed = 0 mas purchasesApproved > 0, usa
  // purchasesApproved como proxy (gateway nao gera PAYMENT_CONFIRMED separado).
  const paymentConfirmed = (gw?.paymentConfirmed ?? 0) || (gw?.purchasesApproved ?? 0)

  return {
    impressions: Number(insights?.impressions ?? 0),
    clicks: Number(insights?.clicks ?? 0),
    pageViews: tracking?.pageViews ?? 0,
    leads: tracking?.leads ?? 0,
    initiateCheckout: gw?.initiateCheckout ?? 0,
    purchasesApproved: gw?.purchasesApproved ?? 0,
    paymentConfirmed,
    activeSubscriptions: subs?.count ?? 0,
  }
}

// ============================================================================
// Channel mix
// ============================================================================

export async function getChannelMix(filters: DashboardFilters): Promise<ChannelMixSlice[]> {
  const { workspaceId, range } = filters
  const productCondition = filters.products?.length
    ? inArray(gatewayEvents.productId, filters.products)
    : undefined

  // Receita por utm_source (last-click via stitcher matched_*)
  const rows = await db
    .select({
      utmSource: gatewayEvents.utmSource,
      revenueCents: sql<number>`COALESCE(SUM(${gatewayEvents.amountCents}) FILTER (WHERE ${gatewayEvents.eventType} = 'PURCHASE_APPROVED'), 0)::bigint`,
    })
    .from(gatewayEvents)
    .where(
      and(
        eq(gatewayEvents.workspaceId, workspaceId),
        gte(gatewayEvents.createdAt, range.start),
        lte(gatewayEvents.createdAt, range.end),
        eq(gatewayEvents.eventType, 'PURCHASE_APPROVED'),
        productCondition
      )
    )
    .groupBy(gatewayEvents.utmSource)

  // Spend por channel via campaigns.provider
  const spendRows = await db
    .select({
      provider: campaigns.provider,
      spendCents: sql<number>`COALESCE(SUM(${adInsights.spendCents}), 0)::bigint`,
    })
    .from(adInsights)
    .innerJoin(ads, eq(ads.id, adInsights.adId))
    .innerJoin(adSets, eq(adSets.id, ads.adSetId))
    .innerJoin(campaigns, eq(campaigns.id, adSets.campaignId))
    .where(
      and(
        eq(adInsights.workspaceId, workspaceId),
        gte(adInsights.date, range.start.toISOString().slice(0, 10)),
        lte(adInsights.date, range.end.toISOString().slice(0, 10))
      )
    )
    .groupBy(campaigns.provider)

  // Agrega por channel canonico
  const channelTotals = new Map<CanonicalChannel, { revenue: number; spend: number }>()
  for (const r of rows) {
    const ch = utmSourceToChannel(r.utmSource)
    const cur = channelTotals.get(ch) ?? { revenue: 0, spend: 0 }
    cur.revenue += Number(r.revenueCents) / 100
    channelTotals.set(ch, cur)
  }
  for (const r of spendRows) {
    const ch = (r.provider as CanonicalChannel) ?? 'other'
    const cur = channelTotals.get(ch) ?? { revenue: 0, spend: 0 }
    cur.spend += Number(r.spendCents) / 100
    channelTotals.set(ch, cur)
  }

  const totalRevenue = Array.from(channelTotals.values()).reduce((s, c) => s + c.revenue, 0)
  return Array.from(channelTotals.entries())
    .map(([channel, totals]) => ({
      channel: channel as ChannelMixSlice['channel'],
      revenue: totals.revenue,
      spend: totals.spend,
      share: totalRevenue > 0 ? totals.revenue / totalRevenue : 0,
    }))
    .filter((c) => c.revenue > 0)
    .sort((a, b) => b.revenue - a.revenue)
}

// ============================================================================
// UTM source ranking
// ============================================================================

export async function getUtmSourceRanking(filters: DashboardFilters): Promise<UtmSourceRow[]> {
  const { workspaceId, range } = filters
  const productCondition = filters.products?.length
    ? inArray(gatewayEvents.productId, filters.products)
    : undefined
  const channelCondition = buildChannelCondition(filters.channels)

  const rows = await db
    .select({
      source: sql<string>`COALESCE(${gatewayEvents.utmSource}, '(direct)')`,
      medium: sql<string>`COALESCE(${gatewayEvents.utmMedium}, '(none)')`,
      revenueCents: sql<number>`COALESCE(SUM(${gatewayEvents.amountCents}), 0)::bigint`,
      orders: sql<number>`COUNT(*)::int`,
    })
    .from(gatewayEvents)
    .where(
      and(
        eq(gatewayEvents.workspaceId, workspaceId),
        gte(gatewayEvents.createdAt, range.start),
        lte(gatewayEvents.createdAt, range.end),
        eq(gatewayEvents.eventType, 'PURCHASE_APPROVED'),
        productCondition,
        channelCondition
      )
    )
    .groupBy(gatewayEvents.utmSource, gatewayEvents.utmMedium)
    .orderBy(desc(sql<number>`SUM(${gatewayEvents.amountCents})`))
    .limit(20)

  return rows.map((r) => ({
    source: r.source,
    medium: r.medium,
    revenue: Number(r.revenueCents) / 100,
    orders: r.orders,
    spend: 0, // Spend por UTM source nao e direto — TD futuro: join via campaigns
    roas: 0,
  }))
}

// ============================================================================
// Top criativos
// ============================================================================

export async function getTopCreatives(filters: DashboardFilters): Promise<CreativeRow[]> {
  const { workspaceId, range } = filters
  const productCondition = filters.products?.length
    ? inArray(gatewayEvents.productId, filters.products)
    : undefined

  // Top ads por receita atribuida (matched_ad_id)
  const rows = await db
    .select({
      adId: gatewayEvents.matchedAdId,
      adName: ads.name,
      adStatus: ads.status,
      revenueCents: sql<number>`COALESCE(SUM(${gatewayEvents.amountCents}) FILTER (WHERE ${gatewayEvents.eventType} = 'PURCHASE_APPROVED'), 0)::bigint`,
      conversions: sql<number>`COUNT(*) FILTER (WHERE ${gatewayEvents.eventType} = 'PURCHASE_APPROVED')::int`,
    })
    .from(gatewayEvents)
    .innerJoin(ads, eq(ads.id, gatewayEvents.matchedAdId))
    .where(
      and(
        eq(gatewayEvents.workspaceId, workspaceId),
        gte(gatewayEvents.createdAt, range.start),
        lte(gatewayEvents.createdAt, range.end),
        productCondition
      )
    )
    .groupBy(gatewayEvents.matchedAdId, ads.name, ads.status)
    .orderBy(desc(sql<number>`SUM(${gatewayEvents.amountCents})`))
    .limit(10)

  if (rows.length === 0) return []

  // Spend + impressions/clicks per ad via ad_insights
  const adIds = rows.map((r) => r.adId).filter((id): id is string => !!id)
  const insightsByAd = await db
    .select({
      adId: adInsights.adId,
      spendCents: sql<number>`COALESCE(SUM(${adInsights.spendCents}), 0)::bigint`,
      impressions: sql<number>`COALESCE(SUM(${adInsights.impressions}), 0)::bigint`,
      clicks: sql<number>`COALESCE(SUM(${adInsights.clicks}), 0)::bigint`,
    })
    .from(adInsights)
    .where(
      and(
        eq(adInsights.workspaceId, workspaceId),
        inArray(adInsights.adId, adIds),
        gte(adInsights.date, range.start.toISOString().slice(0, 10)),
        lte(adInsights.date, range.end.toISOString().slice(0, 10))
      )
    )
    .groupBy(adInsights.adId)

  const adMap = new Map(insightsByAd.map((i) => [i.adId, i]))

  return rows.map((r) => {
    const insight = adMap.get(r.adId ?? '')
    const spend = Number(insight?.spendCents ?? 0) / 100
    const impressions = Number(insight?.impressions ?? 0)
    const clicks = Number(insight?.clicks ?? 0)
    const revenue = Number(r.revenueCents) / 100
    const ctr = impressions > 0 ? clicks / impressions : 0
    const roas = spend > 0 ? revenue / spend : 0
    const status = mapAdStatusToLifecycle(r.adStatus, revenue, spend, impressions)
    return {
      id: r.adId ?? 'unknown',
      name: r.adName ?? 'Sem nome',
      thumbnailUrl: null,
      spend,
      revenue,
      impressions,
      clicks,
      conversions: r.conversions,
      ctr,
      roas,
      frequency: 0, // TD: ad_insights nao tem frequency aggregate ainda
      status,
    }
  })
}

// ============================================================================
// Helpers internos
// ============================================================================

function buildChannelCondition(channels: string[] | undefined) {
  if (!channels || channels.length === 0) return undefined
  const { sources, includeNull } = channelsToSqlFilter(channels)
  if (sources.length === 0 && !includeNull) return undefined
  const conditions = []
  if (sources.length > 0) {
    conditions.push(inArray(sql`LOWER(${gatewayEvents.utmSource})`, sources))
  }
  if (includeNull) {
    conditions.push(sql`(${gatewayEvents.utmSource} IS NULL OR ${gatewayEvents.utmSource} = '')`)
  }
  return or(...conditions)
}

function buildSpendChannelCondition(channels: string[] | undefined) {
  if (!channels || channels.length === 0) return undefined
  // Map channels canonicos -> campaigns.provider literais
  const providers: string[] = []
  if (channels.includes('meta')) providers.push('meta')
  if (channels.includes('google')) providers.push('google')
  if (providers.length === 0) return ne(campaigns.provider, '__none__') // sem match
  return inArray(campaigns.provider, providers)
}

function enumerateDays(range: PeriodRange): string[] {
  const days: string[] = []
  const cur = new Date(range.start)
  cur.setUTCHours(0, 0, 0, 0)
  const stop = new Date(range.end)
  stop.setUTCHours(0, 0, 0, 0)
  while (cur.getTime() <= stop.getTime()) {
    days.push(cur.toISOString().slice(0, 10))
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return days
}

function mapAdStatusToLifecycle(
  _adStatus: string | null,
  revenue: number,
  spend: number,
  impressions: number
): CreativeRow['status'] {
  if (impressions < 1000) return 'testing'
  const roas = spend > 0 ? revenue / spend : 0
  if (roas > 3) return 'scaling'
  if (roas < 1.2 && spend > 100) return 'fatigued'
  return 'mature'
}

// ============================================================================
// Bundle — para page.tsx pegar tudo com uma chamada
// ============================================================================

export async function getDashboardBundle(filters: DashboardFilters) {
  const previousFilters: DashboardFilters = {
    ...filters,
    range: previousRange(filters.range),
  }

  const [
    kpisCurrent,
    kpisPrevious,
    dailyCurrent,
    dailyPrevious,
    funnel,
    channelMix,
    utmSources,
    topCreatives,
  ] = await Promise.all([
    getKpiAggregates(filters),
    getKpiAggregates(previousFilters),
    getDailySeries(filters),
    getDailySeries(previousFilters),
    getFunnelData(filters),
    getChannelMix(filters),
    getUtmSourceRanking(filters),
    getTopCreatives(filters),
  ])

  return {
    kpisCurrent,
    kpisPrevious,
    dailyCurrent,
    dailyPrevious,
    funnel,
    channelMix,
    utmSources,
    topCreatives,
  }
}
