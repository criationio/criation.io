import { KpiCard } from '@/components/dashboard/KpiCard'
import { deltaPct } from '@/lib/campanhas/comparison'
import type { CampaignDailyPoint, CampaignKpiSnapshot } from '@/lib/db/queries/campaign-detail'

interface CampaignKpiGridProps {
  current: CampaignKpiSnapshot
  previous: CampaignKpiSnapshot
  dailySeries: CampaignDailyPoint[]
}

export function CampaignKpiGrid({ current, previous, dailySeries }: CampaignKpiGridProps) {
  const spend = current.spendCents / 100
  const spendPrev = previous.spendCents / 100
  const revenue = current.revenueCents / 100
  const revenuePrev = previous.revenueCents / 100

  const ctrCurrent = current.ctrPct ?? 0
  const ctrPrev = previous.ctrPct ?? 0

  const cpa = current.cpaCents !== null ? current.cpaCents / 100 : 0
  const cpaPrev = previous.cpaCents !== null ? previous.cpaCents / 100 : 0

  const roas = current.roas ?? 0
  const roasPrev = previous.roas ?? 0

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
      <KpiCard
        label="Gasto"
        value={spend}
        format="brl"
        deltaPercent={deltaPct(spend, spendPrev)}
        sparkData={dailySeries.map((d) => d.spendCents / 100)}
      />
      <KpiCard
        label="Receita"
        value={revenue}
        format="brl"
        deltaPercent={deltaPct(revenue, revenuePrev)}
        sparkData={dailySeries.map((d) => d.revenueCents / 100)}
      />
      <KpiCard
        label="Cliques"
        value={current.clicks}
        format="number"
        deltaPercent={deltaPct(current.clicks, previous.clicks)}
        sparkData={dailySeries.map((d) => d.clicks)}
      />
      <KpiCard
        label="CTR"
        value={ctrCurrent}
        format="percent"
        deltaPercent={deltaPct(ctrCurrent, ctrPrev)}
        sparkData={dailySeries.map((d) =>
          d.impressions > 0 ? (d.clicks / d.impressions) * 100 : 0
        )}
      />
      <KpiCard
        label="Conversões"
        value={current.conversions}
        format="number"
        deltaPercent={deltaPct(current.conversions, previous.conversions)}
        sparkData={dailySeries.map((d) => d.conversions)}
      />
      <KpiCard
        label="ROAS"
        value={roas}
        format="roas"
        deltaPercent={deltaPct(roas, roasPrev)}
        sparkData={dailySeries.map((d) => (d.spendCents > 0 ? d.revenueCents / d.spendCents : 0))}
      />
      <KpiCard
        label="Impressões"
        value={current.impressions}
        format="number"
        deltaPercent={deltaPct(current.impressions, previous.impressions)}
        sparkData={dailySeries.map((d) => d.impressions)}
      />
      <KpiCard
        label="CPA"
        value={cpa}
        format="brl"
        deltaPercent={deltaPct(cpa, cpaPrev)}
        sparkData={dailySeries.map((d) =>
          d.conversions > 0 ? d.spendCents / 100 / d.conversions : 0
        )}
        invertDeltaPolarity
      />
    </div>
  )
}
