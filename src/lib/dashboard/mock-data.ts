/**
 * Mock data generator pro dashboard (Sessao 1.6).
 *
 * Gera 30 dias de dados realistas pra cliente novo que ainda nao tem vendas
 * — UI mostra dashboard renderizando completo com label "exemplo" pra dar
 * sensacao de produto pronto. Substitui por queries reais via toggle quando
 * workspace tem dados (>=5 vendas em 30d).
 *
 * Padroes:
 *  - Tendencia leve crescente (10% no periodo)
 *  - Sazonalidade fim de semana (dips sabado/domingo, picos quinta/sexta)
 *  - Ruido aleatorio determinístico via seed (data) pra mesmos numeros
 *    aparecerem em re-renders e SSR/CSR baterem
 *  - Numeros plausíveis pra infoprodutor brasileiro: faturamento R$50k-200k
 *    mensal, ROAS 2-4x, CAC R$30-80
 */

export interface DailyMetric {
  date: string // YYYY-MM-DD
  revenue: number // BRL
  spend: number // BRL
  profit: number // BRL
  orders: number
  customers: number
  impressions: number
  clicks: number
  pageViews: number
  leads: number
  initiateCheckout: number
  purchases: number
  refunds: number
  activeSubscriptions: number
}

export interface KpiSnapshot {
  revenue: number
  profit: number
  roas: number
  spend: number
  cac: number
  ticketMedio: number
  ltv: number
  marginPercent: number
}

export interface FunnelData {
  impressions: number
  clicks: number
  pageViews: number
  leads: number
  initiateCheckout: number
  purchasesApproved: number
  paymentConfirmed: number
  activeSubscriptions: number
}

export interface ChannelMixSlice {
  channel: 'meta' | 'google' | 'organic' | 'direct' | 'email' | 'whatsapp'
  revenue: number
  spend: number
  share: number
}

export interface CreativeRow {
  id: string
  name: string
  thumbnailUrl: string | null
  spend: number
  revenue: number
  impressions: number
  clicks: number
  conversions: number
  ctr: number
  roas: number
  frequency: number
  status: 'scaling' | 'mature' | 'fatigued' | 'testing'
}

export interface UtmSourceRow {
  source: string
  medium: string
  revenue: number
  orders: number
  spend: number
  roas: number
}

// ============================================================================
// Helpers deterministicos
// ============================================================================

/** Hash determinístico simples (PRNG mulberry32 com seed da data). */
function seededRandom(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function dateToSeed(dateIso: string): number {
  // Determinístico: same date string -> same seed
  let h = 0
  for (let i = 0; i < dateIso.length; i++) h = (h * 31 + dateIso.charCodeAt(i)) | 0
  return h
}

function daysAgo(n: number, refDate: Date): Date {
  const d = new Date(refDate)
  d.setUTCDate(d.getUTCDate() - n)
  d.setUTCHours(0, 0, 0, 0)
  return d
}

function isoDate(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// ============================================================================
// Daily series — 30d de metricas com tendencia + sazonalidade + ruido
// ============================================================================

const BASELINE = {
  revenue: 4500, // ~R$4.500/dia => ~R$135k/mes
  spend: 1400, // ROAS ~3.2
  impressions: 28_000,
  clicks: 680, // CTR ~2.4%
  pageViewsPerClick: 0.87,
  leadConversion: 0.34,
  checkoutInit: 0.18,
  approveRate: 0.67,
  refundRate: 0.04,
}

/** Multiplicador sazonal por dia da semana (0=Dom, 6=Sab). */
const DOW_MULTIPLIER = [0.78, 1.05, 1.08, 1.12, 1.15, 1.18, 0.82]

export function generateDailySeries(refDate: Date = new Date(), days = 30): DailyMetric[] {
  const series: DailyMetric[] = []
  for (let i = days - 1; i >= 0; i--) {
    const date = daysAgo(i, refDate)
    const iso = isoDate(date)
    const rand = seededRandom(dateToSeed(iso))
    const dow = date.getUTCDay()
    const dowMul = DOW_MULTIPLIER[dow] ?? 1
    // Tendencia: dia mais recente = 1.1x do dia mais antigo (crescimento 10% no periodo)
    const trend = 1 + ((days - 1 - i) / (days - 1)) * 0.1
    const noise = 0.85 + rand() * 0.3

    const factor = dowMul * trend * noise
    const revenue = Math.round(BASELINE.revenue * factor)
    const spend = Math.round(BASELINE.spend * factor * (0.95 + rand() * 0.1))
    const refunds = Math.round(revenue * BASELINE.refundRate * (0.7 + rand() * 0.6))
    const profit = revenue - spend - refunds - Math.round(revenue * 0.07) // 7% gateway fee
    const impressions = Math.round(BASELINE.impressions * factor)
    const clicks = Math.round(BASELINE.clicks * factor)
    const pageViews = Math.round(clicks * BASELINE.pageViewsPerClick)
    const leads = Math.round(pageViews * BASELINE.leadConversion * (0.9 + rand() * 0.2))
    const initiateCheckout = Math.round(leads * BASELINE.checkoutInit * (0.9 + rand() * 0.2))
    const purchases = Math.round(initiateCheckout * BASELINE.approveRate * (0.95 + rand() * 0.1))
    const orders = purchases
    const customers = Math.round(purchases * 0.88) // 12% repeat

    series.push({
      date: iso,
      revenue,
      spend,
      profit,
      orders,
      customers,
      impressions,
      clicks,
      pageViews,
      leads,
      initiateCheckout,
      purchases,
      refunds,
      activeSubscriptions: Math.round(120 + i * 4 + rand() * 8), // crescimento linear
    })
  }
  return series
}

// ============================================================================
// Aggregates derivados — KPIs, funil, channel mix, top criativos, UTM
// ============================================================================

export function summarizeKpis(series: DailyMetric[]): KpiSnapshot {
  const total = series.reduce(
    (acc, d) => ({
      revenue: acc.revenue + d.revenue,
      spend: acc.spend + d.spend,
      profit: acc.profit + d.profit,
      orders: acc.orders + d.orders,
      customers: acc.customers + d.customers,
    }),
    { revenue: 0, spend: 0, profit: 0, orders: 0, customers: 0 }
  )
  const roas = total.spend > 0 ? total.revenue / total.spend : 0
  const cac = total.customers > 0 ? total.spend / total.customers : 0
  const ticketMedio = total.orders > 0 ? total.revenue / total.orders : 0
  // LTV mockado: ticket * 1.6 (assumindo recompra média)
  const ltv = ticketMedio * 1.6
  const marginPercent = total.revenue > 0 ? (total.profit / total.revenue) * 100 : 0
  return {
    revenue: total.revenue,
    profit: total.profit,
    roas,
    spend: total.spend,
    cac,
    ticketMedio,
    ltv,
    marginPercent,
  }
}

export function summarizeFunnel(series: DailyMetric[]): FunnelData {
  const total = series.reduce(
    (acc, d) => ({
      impressions: acc.impressions + d.impressions,
      clicks: acc.clicks + d.clicks,
      pageViews: acc.pageViews + d.pageViews,
      leads: acc.leads + d.leads,
      initiateCheckout: acc.initiateCheckout + d.initiateCheckout,
      purchasesApproved: acc.purchasesApproved + d.purchases,
      paymentConfirmed: acc.paymentConfirmed + d.purchases - d.refunds,
      activeSubscriptions: Math.max(acc.activeSubscriptions, d.activeSubscriptions),
    }),
    {
      impressions: 0,
      clicks: 0,
      pageViews: 0,
      leads: 0,
      initiateCheckout: 0,
      purchasesApproved: 0,
      paymentConfirmed: 0,
      activeSubscriptions: 0,
    }
  )
  return total
}

const CHANNEL_DISTRIBUTION: { channel: ChannelMixSlice['channel']; weight: number }[] = [
  { channel: 'meta', weight: 0.62 },
  { channel: 'google', weight: 0.18 },
  { channel: 'organic', weight: 0.09 },
  { channel: 'direct', weight: 0.06 },
  { channel: 'email', weight: 0.03 },
  { channel: 'whatsapp', weight: 0.02 },
]

export function summarizeChannelMix(series: DailyMetric[]): ChannelMixSlice[] {
  const k = summarizeKpis(series)
  return CHANNEL_DISTRIBUTION.map((c) => ({
    channel: c.channel,
    revenue: Math.round(k.revenue * c.weight),
    // Spend só conta canais pagos (meta + google + whatsapp ads); demais = 0
    spend: c.channel === 'meta' || c.channel === 'google' ? Math.round(k.spend * c.weight) : 0,
    share: c.weight,
  }))
}

const CREATIVE_NAMES = [
  { id: 'ad-001', name: 'VSL Lancamento — Hook curiosidade v3', status: 'scaling' as const },
  { id: 'ad-002', name: 'Carrossel 7 erros do email marketing', status: 'mature' as const },
  { id: 'ad-003', name: 'Video depoimento Carla — antes/depois', status: 'mature' as const },
  { id: 'ad-004', name: 'Reel 30s — Promessa em 3 atos', status: 'scaling' as const },
  { id: 'ad-005', name: 'Imagem oferta R$ 97/mes', status: 'fatigued' as const },
  { id: 'ad-006', name: 'VSL clone v2 — Lucas headline', status: 'fatigued' as const },
  { id: 'ad-007', name: 'Video tutorial gratuito (lead magnet)', status: 'testing' as const },
  { id: 'ad-008', name: 'Stories swipe-up — review autoral', status: 'testing' as const },
  { id: 'ad-009', name: 'Static benefício 1 — economia tempo', status: 'mature' as const },
  { id: 'ad-010', name: 'Reel viral cliente real (UGC)', status: 'scaling' as const },
]

export function topCreatives(series: DailyMetric[]): CreativeRow[] {
  const totalSpend = series.reduce((s, d) => s + d.spend, 0)
  const totalRevenue = series.reduce((s, d) => s + d.revenue, 0)
  const totalImpressions = series.reduce((s, d) => s + d.impressions, 0)
  const totalClicks = series.reduce((s, d) => s + d.clicks, 0)
  const totalConversions = series.reduce((s, d) => s + d.purchases, 0)

  // Distribui spend entre criativos com long-tail Pareto-ish
  const weights = [0.28, 0.18, 0.13, 0.1, 0.08, 0.07, 0.06, 0.05, 0.03, 0.02]
  return CREATIVE_NAMES.map((c, i) => {
    const w = weights[i] ?? 0.01
    const spend = Math.round(totalSpend * w)
    const baseRevenue = totalRevenue * w
    // Variação por status: scaling/mature melhor ROAS, fatigued pior
    const performanceMul =
      c.status === 'scaling'
        ? 1.25
        : c.status === 'mature'
          ? 1.0
          : c.status === 'fatigued'
            ? 0.62
            : 0.85
    const revenue = Math.round(baseRevenue * performanceMul)
    const impressions = Math.round(totalImpressions * w)
    const clicks = Math.round(totalClicks * w * performanceMul)
    const conversions = Math.round(totalConversions * w * performanceMul)
    const ctr = impressions > 0 ? clicks / impressions : 0
    const roas = spend > 0 ? revenue / spend : 0
    const frequency =
      c.status === 'fatigued' ? 4.2 + (i % 3) * 0.3 : c.status === 'mature' ? 2.6 : 1.4
    return {
      ...c,
      thumbnailUrl: null,
      spend,
      revenue,
      impressions,
      clicks,
      conversions,
      ctr,
      roas,
      frequency,
    }
  }).sort((a, b) => b.revenue - a.revenue)
}

const UTM_SOURCES: { source: string; medium: string; weight: number }[] = [
  { source: 'fb', medium: 'cpc', weight: 0.42 },
  { source: 'ig', medium: 'cpc', weight: 0.2 },
  { source: 'google', medium: 'cpc', weight: 0.16 },
  { source: 'youtube', medium: 'cpc', weight: 0.05 },
  { source: 'organic', medium: 'social', weight: 0.04 },
  { source: 'direct', medium: '(none)', weight: 0.04 },
  { source: 'email', medium: 'newsletter', weight: 0.03 },
  { source: 'whatsapp', medium: 'cpc', weight: 0.02 },
  { source: 'tiktok', medium: 'cpc', weight: 0.02 },
  { source: 'afiliados', medium: 'affiliate', weight: 0.02 },
]

export function topUtmSources(series: DailyMetric[]): UtmSourceRow[] {
  const k = summarizeKpis(series)
  return UTM_SOURCES.map((s) => {
    const revenue = Math.round(k.revenue * s.weight)
    const orders = Math.round((k.revenue * s.weight) / Math.max(k.ticketMedio, 1))
    const paid = s.medium === 'cpc' || s.medium === 'affiliate'
    const spend = paid ? Math.round(k.spend * s.weight * (0.85 + s.weight * 0.5)) : 0
    const roas = spend > 0 ? revenue / spend : 0
    return { source: s.source, medium: s.medium, revenue, orders, spend, roas }
  }).sort((a, b) => b.revenue - a.revenue)
}

// ============================================================================
// Period comparison — gera Δ% calculando vs periodo anterior
// ============================================================================

export interface KpiWithDelta {
  current: number
  previous: number
  deltaPercent: number
  spark: number[] // 14 pontos para sparkline
}

export function kpiWithDelta(input: {
  series: DailyMetric[]
  previousSeries: DailyMetric[]
  pick: (d: DailyMetric) => number
}): KpiWithDelta {
  const current = input.series.reduce((s, d) => s + input.pick(d), 0)
  const previous = input.previousSeries.reduce((s, d) => s + input.pick(d), 0)
  const deltaPercent = previous > 0 ? ((current - previous) / previous) * 100 : 0
  const spark = input.series.slice(-14).map(input.pick)
  return { current, previous, deltaPercent, spark }
}

/**
 * Helper: gera serie + serie anterior. Period anterior tem mesma duracao.
 */
export function generateWithPrevious(refDate: Date = new Date(), days = 30) {
  const current = generateDailySeries(refDate, days)
  const previousRef = daysAgo(days, refDate)
  const previous = generateDailySeries(previousRef, days)
  return { current, previous }
}

/**
 * Mapeia preset de periodo pro numero de dias. Custom interpreta start/end.
 * Default: 30d.
 */
export function periodPresetToDays(preset: string | undefined): number {
  switch (preset) {
    case 'today':
      return 1
    case 'yesterday':
      return 1
    case 'last_7d':
      return 7
    case 'last_30d':
      return 30
    case 'last_90d':
      return 90
    case 'mtd': {
      const now = new Date()
      const firstOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
      return Math.max(1, Math.ceil((now.getTime() - firstOfMonth.getTime()) / 86_400_000))
    }
    case 'qtd': {
      const now = new Date()
      const q = Math.floor(now.getUTCMonth() / 3) * 3
      const firstOfQuarter = new Date(Date.UTC(now.getUTCFullYear(), q, 1))
      return Math.max(1, Math.ceil((now.getTime() - firstOfQuarter.getTime()) / 86_400_000))
    }
    case 'ytd': {
      const now = new Date()
      const firstOfYear = new Date(Date.UTC(now.getUTCFullYear(), 0, 1))
      return Math.max(1, Math.ceil((now.getTime() - firstOfYear.getTime()) / 86_400_000))
    }
    case 'last_month':
      return 30
    case 'last_quarter':
      return 90
    default:
      return 30
  }
}

/**
 * Filtra channel mix pra apenas canais selecionados. Se `channels` vazio,
 * retorna tudo. Recompute share pra refletir só os filtrados.
 */
export function filterChannelMix(mix: ChannelMixSlice[], channels: string[]): ChannelMixSlice[] {
  if (channels.length === 0) return mix
  const set = new Set(channels)
  const filtered = mix.filter((c) => set.has(c.channel))
  const totalRevenue = filtered.reduce((s, c) => s + c.revenue, 0)
  if (totalRevenue === 0) return filtered
  return filtered.map((c) => ({ ...c, share: c.revenue / totalRevenue }))
}

// ============================================================================
// Produtos (mock — PR-13b vai trazer da gateway_products real)
// ============================================================================

export interface MockProduct {
  id: string
  name: string
  ticket: number
}

const MOCK_PRODUCTS: MockProduct[] = [
  { id: 'prod-vsl-emag', name: 'VSL Emagrecimento 21d', ticket: 197 },
  { id: 'prod-curso-finance', name: 'Curso Domine suas Finanças', ticket: 497 },
  { id: 'prod-mentoria', name: 'Mentoria Premium 3 meses', ticket: 2997 },
  { id: 'prod-ebook-receitas', name: 'Ebook 50 Receitas Fit', ticket: 47 },
  { id: 'prod-assinatura-app', name: 'Assinatura mensal do App', ticket: 97 },
]

export function listMockProducts(): MockProduct[] {
  return MOCK_PRODUCTS
}

// ============================================================================
// Cohort retention — LTV acumulado por cohort de aquisicao
// ============================================================================

export interface CohortRow {
  /** "2026-01" — mes do cohort (quando customer fez primeira compra). */
  cohort: string
  /** Quantos customers no cohort (size). */
  customers: number
  /** LTV acumulado por mes-desde-aquisicao. cells[0] = month 0 (mes da
   *  compra), cells[1] = month 1 (mes seguinte), etc. null = futuro. */
  cells: (number | null)[]
}

const COHORT_BASE_LTV = 145 // R$ ticket medio
const COHORT_RETENTION_DECAY = [1, 0.42, 0.31, 0.26, 0.22, 0.19, 0.17, 0.15]

/**
 * Gera ultimo N cohorts (default 6) com decay realista de LTV.
 * Cohorts mais antigos tem mais cells preenchidas; mais novos tem cells null
 * pra meses futuros que ainda nao aconteceram.
 */
export function generateCohortMatrix(refDate: Date = new Date(), cohortCount = 6): CohortRow[] {
  const rows: CohortRow[] = []
  for (let i = cohortCount - 1; i >= 0; i--) {
    const date = new Date(refDate)
    date.setUTCMonth(date.getUTCMonth() - i)
    const cohortKey = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
    const seed = dateToSeed(cohortKey)
    const rand = seededRandom(seed)
    // Cohort size: 80-180 customers, com leve tendencia crescente nos recentes
    const customers = Math.round(80 + (cohortCount - i) * 12 + rand() * 30)
    // Quantos meses ja se passaram desde esse cohort = i (cohort mais antigo
    // tem mais meses preenchidos)
    const monthsPassed = i + 1
    const maxMonths = 8
    const cells: (number | null)[] = []
    for (let m = 0; m < maxMonths; m++) {
      if (m >= monthsPassed) {
        cells.push(null)
        continue
      }
      const decay = COHORT_RETENTION_DECAY[m] ?? 0.1
      const noise = 0.85 + rand() * 0.3
      cells.push(Math.round(COHORT_BASE_LTV * decay * noise))
    }
    rows.push({ cohort: cohortKey, customers, cells })
  }
  return rows
}
