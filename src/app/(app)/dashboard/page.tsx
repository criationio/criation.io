import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'

import { ChannelMixDonut } from '@/components/dashboard/ChannelMixDonut'
import { CohortHeatmap } from '@/components/dashboard/CohortHeatmap'
import { DashboardFiltersBar } from '@/components/dashboard/DashboardFiltersBar'
import {
  DashboardGrid,
  GridWidgetSlot,
  type WidgetLayoutItem,
} from '@/components/dashboard/DashboardGrid'
import { FunnelPyramid } from '@/components/dashboard/FunnelPyramid'
import { KpiCard } from '@/components/dashboard/KpiCard'
import { SalesVsInvestmentChart } from '@/components/dashboard/SalesVsInvestmentChart'
import { SavedViewsBar, type SavedView } from '@/components/dashboard/SavedViewsBar'
import { TopCreativesTable } from '@/components/dashboard/TopCreativesTable'
import { UtmSourceTable } from '@/components/dashboard/UtmSourceTable'
import { db } from '@/lib/db'
import { listDashboardFunnels } from '@/lib/db/queries/dashboard-funnels'
import {
  createDashboardLayout,
  getDashboardLayoutById,
  listDashboardLayouts,
} from '@/lib/db/queries/dashboard-layouts'
import { getDashboardBundle, hasWorkspaceData } from '@/lib/db/queries/dashboard-metrics'
import { listWorkspaceProducts } from '@/lib/db/queries/gateway-products'
import { users, workspaceMembers } from '@/lib/db/schema/auth'
import type { DashboardLayoutRow } from '@/lib/db/schema'
import { type DashboardLayoutData } from '@/lib/db/schema/dashboard'
import {
  filterChannelMix,
  generateCohortMatrix,
  generateWithPrevious,
  kpiWithDelta,
  listMockProducts,
  periodPresetToDays,
  summarizeChannelMix,
  summarizeFunnel,
  summarizeKpis,
  topCreatives,
  topUtmSources,
  type ChannelMixSlice,
  type CreativeRow,
  type DailyMetric,
  type FunnelData,
  type KpiSnapshot,
  type UtmSourceRow,
} from '@/lib/dashboard/mock-data'
import { presetToRange } from '@/lib/dashboard/period-range'
import { getUser } from '@/lib/supabase/server'

/**
 * Dashboard — Sessao 1.6 (PRs 1-12).
 *
 * Server Component carrega mock data + saved views do user. Bootstrap: se
 * user nao tem nenhuma view, cria "Geral" default com layout padrao. Query
 * param `?view=<id>` seleciona qual view exibir; default = view marcada como
 * default do user (ou primeira da lista).
 *
 * Drag-drop + resize persistem em dashboard_layouts via Server Action
 * (debounced 1s). Real data wiring vem em PR-13.
 */

const DEFAULT_LAYOUT: WidgetLayoutItem[] = [
  { i: 'kpi-revenue', x: 0, y: 0, w: 2, h: 3, minW: 2, minH: 2 },
  { i: 'kpi-profit', x: 2, y: 0, w: 2, h: 3, minW: 2, minH: 2 },
  { i: 'kpi-roas', x: 4, y: 0, w: 2, h: 3, minW: 2, minH: 2 },
  { i: 'kpi-spend', x: 6, y: 0, w: 2, h: 3, minW: 2, minH: 2 },
  { i: 'kpi-cac', x: 8, y: 0, w: 2, h: 3, minW: 2, minH: 2 },
  { i: 'kpi-ticket', x: 10, y: 0, w: 2, h: 3, minW: 2, minH: 2 },
  { i: 'funnel', x: 0, y: 3, w: 6, h: 9, minW: 4, minH: 6 },
  { i: 'sales-chart', x: 6, y: 3, w: 6, h: 9, minW: 4, minH: 6 },
  { i: 'top-creatives', x: 0, y: 12, w: 8, h: 8, minW: 4, minH: 6 },
  { i: 'channel-mix', x: 8, y: 12, w: 4, h: 8, minW: 3, minH: 6 },
  { i: 'utm-sources', x: 0, y: 20, w: 6, h: 9, minW: 4, minH: 6 },
  { i: 'cohort', x: 6, y: 20, w: 6, h: 9, minW: 4, minH: 6 },
]

function layoutDataToItems(data: unknown): WidgetLayoutItem[] {
  if (!data || typeof data !== 'object') return DEFAULT_LAYOUT
  const obj = data as { widgets?: unknown }
  if (!Array.isArray(obj.widgets) || obj.widgets.length === 0) return DEFAULT_LAYOUT
  const items: WidgetLayoutItem[] = []
  for (const w of obj.widgets) {
    if (!w || typeof w !== 'object') continue
    const widget = w as {
      id?: unknown
      gridArea?: { x?: number; y?: number; w?: number; h?: number }
    }
    if (typeof widget.id !== 'string' || !widget.gridArea) continue
    const a = widget.gridArea
    if (
      typeof a.x !== 'number' ||
      typeof a.y !== 'number' ||
      typeof a.w !== 'number' ||
      typeof a.h !== 'number'
    )
      continue
    // Preserva minW/minH do DEFAULT_LAYOUT pra esse widget se existir.
    const defaultItem = DEFAULT_LAYOUT.find((d) => d.i === widget.id)
    const item: WidgetLayoutItem = {
      i: widget.id,
      x: a.x,
      y: a.y,
      w: a.w,
      h: a.h,
    }
    if (defaultItem?.minW !== undefined) item.minW = defaultItem.minW
    if (defaultItem?.minH !== undefined) item.minH = defaultItem.minH
    items.push(item)
  }
  return items.length > 0 ? items : DEFAULT_LAYOUT
}

function itemsToLayoutData(items: WidgetLayoutItem[]): DashboardLayoutData {
  return {
    widgets: items.map((it) => ({
      id: it.i,
      type: it.i,
      gridArea: { x: it.x, y: it.y, w: it.w, h: it.h },
    })),
    gridCols: 12,
  }
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{
    view?: string
    period?: string
    comparison?: string
    attr?: string
    channels?: string
    products?: string
  }>
}) {
  const authUser = await getUser()
  if (!authUser) redirect('/login')

  // Resolve workspace
  const userRow = await db.query.users.findFirst({ where: eq(users.id, authUser.id) })
  let workspaceId = userRow?.defaultWorkspaceId ?? null
  if (!workspaceId) {
    const membership = await db.query.workspaceMembers.findFirst({
      where: eq(workspaceMembers.userId, authUser.id),
    })
    workspaceId = membership?.workspaceId ?? null
  }
  if (!workspaceId) redirect('/bem-vindo')

  // Lista views existentes
  let views = await listDashboardLayouts({ workspaceId, userId: authUser.id })

  // Bootstrap: se user nao tem nenhuma view, cria "Geral" default
  if (views.length === 0) {
    await createDashboardLayout({
      workspaceId,
      userId: authUser.id,
      name: 'Geral',
      layout: itemsToLayoutData(DEFAULT_LAYOUT),
      filters: {},
      isDefault: true,
    })
    views = await listDashboardLayouts({ workspaceId, userId: authUser.id })
  }

  // Seleciona view atual: ?view=ID se valido, senao default, senao primeira
  const sp = await searchParams
  let currentView: DashboardLayoutRow | null = null
  if (sp.view) {
    currentView = await getDashboardLayoutById({
      id: sp.view,
      workspaceId,
      userId: authUser.id,
    })
  }
  if (!currentView) {
    currentView = views.find((v) => v.isDefault) ?? views[0] ?? null
  }
  if (!currentView) redirect('/bem-vindo') // edge case impossivel pos-bootstrap

  const initialLayout = layoutDataToItems(currentView.layout)

  // Lista produtos + funis do workspace pra dropdowns. Fallback pra mock
  // products quando workspace ainda nao tem gateway conectado (lista vazia).
  const [productsRows, funnelsRows] = await Promise.all([
    listWorkspaceProducts(workspaceId),
    listDashboardFunnels(workspaceId),
  ])
  const workspaceProducts =
    productsRows.length > 0
      ? productsRows.map((p) => ({ id: p.id, name: p.name }))
      : listMockProducts().map((p) => ({ id: p.id, name: p.name }))
  const workspaceFunnels = funnelsRows.map((f) => ({
    id: f.id,
    name: f.name,
    isDefault: f.isDefault,
  }))

  // Lê filtros da URL — fonte de verdade. Default = last_30d / previous_period / no channel filter.
  const days = periodPresetToDays(sp.period)
  const noComparison = sp.comparison === 'none'
  const channelFilter = (sp.channels ?? '')
    .split(',')
    .map((c) => c.trim())
    .filter((c) => c.length > 0)
  const productFilter = (sp.products ?? '')
    .split(',')
    .map((p: string) => p.trim())
    .filter((p: string) => p.length > 0)

  // Toggle real vs mock — workspace com >=5 gateway_events em 30d usa dados reais.
  const useRealData = await hasWorkspaceData(workspaceId)

  let current: DailyMetric[]
  let previous: DailyMetric[]
  let realFunnel: FunnelData | null = null
  let realChannelMix: ChannelMixSlice[] | null = null
  let realUtmSources: UtmSourceRow[] | null = null
  let realTopCreatives: CreativeRow[] | null = null
  let realKpisCurrent: KpiSnapshot | null = null
  let realKpisPrevious: KpiSnapshot | null = null

  if (useRealData) {
    const range = presetToRange(sp.period)
    const bundle = await getDashboardBundle({
      workspaceId,
      range,
      channels: channelFilter,
      products: productFilter,
    })
    current = bundle.dailyCurrent
    previous = bundle.dailyPrevious
    realFunnel = bundle.funnel
    realChannelMix = bundle.channelMix
    realUtmSources = bundle.utmSources
    realTopCreatives = bundle.topCreatives
    realKpisCurrent = bundle.kpisCurrent
    realKpisPrevious = bundle.kpisPrevious
  } else {
    const generated = generateWithPrevious(new Date(), days)
    current = generated.current
    previous = generated.previous
  }
  const isExample = !useRealData

  const kCurrent = realKpisCurrent ?? summarizeKpis(current)
  const kPrevious = realKpisPrevious ?? summarizeKpis(previous)
  // Pra usar "sem comparacao", zera deltas — UI esconde setas/Δ%
  const previousForDelta = noComparison ? current : previous
  const revenue = kpiWithDelta({
    series: current,
    previousSeries: previousForDelta,
    pick: (d) => d.revenue,
  })
  const profit = kpiWithDelta({
    series: current,
    previousSeries: previousForDelta,
    pick: (d) => d.profit,
  })
  const spend = kpiWithDelta({
    series: current,
    previousSeries: previousForDelta,
    pick: (d) => d.spend,
  })
  const roasSpark = current.map((d) => (d.spend > 0 ? d.revenue / d.spend : 0))
  const cacSpark = current.map((d) => (d.customers > 0 ? d.spend / d.customers : 0))
  const ticketSpark = current.map((d) => (d.orders > 0 ? d.revenue / d.orders : 0))
  const roasDelta = noComparison
    ? 0
    : kPrevious.roas > 0
      ? ((kCurrent.roas - kPrevious.roas) / kPrevious.roas) * 100
      : 0
  const cacDelta = noComparison
    ? 0
    : kPrevious.cac > 0
      ? ((kCurrent.cac - kPrevious.cac) / kPrevious.cac) * 100
      : 0
  const ticketDelta = noComparison
    ? 0
    : kPrevious.ticketMedio > 0
      ? ((kCurrent.ticketMedio - kPrevious.ticketMedio) / kPrevious.ticketMedio) * 100
      : 0

  const channelMix = realChannelMix ?? filterChannelMix(summarizeChannelMix(current), channelFilter)
  const funnelData = realFunnel ?? summarizeFunnel(current)
  const utmSourcesData = realUtmSources ?? topUtmSources(current)
  const creativesData = realTopCreatives ?? topCreatives(current)

  const viewsForUi: SavedView[] = views.map((v) => ({
    id: v.id,
    name: v.name,
    isShared: v.userId === null,
    isDefault: v.isDefault,
  }))

  return (
    <main className="flex flex-1 flex-col gap-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-[var(--color-fg-muted)]">
            Visão geral dos últimos 30 dias — receita, eficiência e funil.
          </p>
        </div>
        <SavedViewsBar
          views={viewsForUi}
          currentViewId={currentView.id}
          currentLayout={itemsToLayoutData(initialLayout)}
        />
      </header>

      <DashboardFiltersBar products={workspaceProducts} funnels={workspaceFunnels} />

      <DashboardGrid key={currentView.id} layoutId={currentView.id} initialLayout={initialLayout}>
        <div key="kpi-revenue">
          <GridWidgetSlot>
            <KpiCard
              label="Faturamento"
              value={revenue.current}
              format="brl"
              deltaPercent={revenue.deltaPercent}
              sparkData={revenue.spark}
              tooltip="Soma de vendas confirmadas no período."
              isExample={isExample}
            />
          </GridWidgetSlot>
        </div>
        <div key="kpi-profit">
          <GridWidgetSlot>
            <KpiCard
              label="Lucro líquido"
              value={profit.current}
              format="brl"
              deltaPercent={profit.deltaPercent}
              sparkData={profit.spark}
              tooltip="Receita − Investimento − Taxa gateway − Reembolsos."
              isExample={isExample}
            />
          </GridWidgetSlot>
        </div>
        <div key="kpi-roas">
          <GridWidgetSlot>
            <KpiCard
              label="ROAS"
              value={kCurrent.roas}
              format="roas"
              deltaPercent={roasDelta}
              sparkData={roasSpark.slice(-14)}
              tooltip="Faturamento ÷ Investimento."
              isExample={isExample}
            />
          </GridWidgetSlot>
        </div>
        <div key="kpi-spend">
          <GridWidgetSlot>
            <KpiCard
              label="Investimento"
              value={spend.current}
              format="brl"
              deltaPercent={spend.deltaPercent}
              sparkData={spend.spark}
              tooltip="Total gasto em Meta + Google + outros canais pagos."
              isExample={isExample}
            />
          </GridWidgetSlot>
        </div>
        <div key="kpi-cac">
          <GridWidgetSlot>
            <KpiCard
              label="CAC"
              value={kCurrent.cac}
              format="brl"
              deltaPercent={cacDelta}
              sparkData={cacSpark.slice(-14)}
              tooltip="Custo de Aquisição = Investimento ÷ Compradores únicos."
              isExample={isExample}
              invertDeltaPolarity
            />
          </GridWidgetSlot>
        </div>
        <div key="kpi-ticket">
          <GridWidgetSlot>
            <KpiCard
              label="Ticket médio"
              value={kCurrent.ticketMedio}
              format="brl"
              deltaPercent={ticketDelta}
              sparkData={ticketSpark.slice(-14)}
              tooltip="Faturamento ÷ Pedidos."
              isExample={isExample}
            />
          </GridWidgetSlot>
        </div>
        <div key="funnel">
          <GridWidgetSlot>
            <FunnelPyramid data={funnelData} isExample={isExample} />
          </GridWidgetSlot>
        </div>
        <div key="sales-chart">
          <GridWidgetSlot>
            <SalesVsInvestmentChart data={current} isExample={isExample} />
          </GridWidgetSlot>
        </div>
        <div key="top-creatives">
          <GridWidgetSlot>
            <TopCreativesTable data={creativesData} isExample={isExample} />
          </GridWidgetSlot>
        </div>
        <div key="channel-mix">
          <GridWidgetSlot>
            <ChannelMixDonut data={channelMix} isExample={isExample} />
          </GridWidgetSlot>
        </div>
        <div key="utm-sources">
          <GridWidgetSlot>
            <UtmSourceTable data={utmSourcesData} isExample={isExample} />
          </GridWidgetSlot>
        </div>
        <div key="cohort">
          <GridWidgetSlot>
            <CohortHeatmap data={generateCohortMatrix()} isExample={isExample} />
          </GridWidgetSlot>
        </div>
      </DashboardGrid>
    </main>
  )
}
