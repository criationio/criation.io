import Link from 'next/link'
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'

import type { CampaignDetailHeader, CampaignKpiSnapshot } from '@/lib/db/queries/campaign-detail'
import { formatMetricValue, type MetricFormat } from '@/lib/campanhas/comparison'
import { cn } from '@/lib/utils'

interface Side {
  header: CampaignDetailHeader
  kpis: CampaignKpiSnapshot
}

interface ComparativoTableProps {
  a: Side
  b: Side
}

interface MetricRow {
  label: string
  format: MetricFormat
  aValue: number
  bValue: number
  /** Para CPA: menor é melhor. */
  lowerIsBetter?: boolean
}

export function ComparativoTable({ a, b }: ComparativoTableProps) {
  const metrics: MetricRow[] = [
    { label: 'Gasto', format: 'brl', aValue: a.kpis.spendCents, bValue: b.kpis.spendCents },
    {
      label: 'Receita',
      format: 'brl',
      aValue: a.kpis.revenueCents,
      bValue: b.kpis.revenueCents,
    },
    {
      label: 'Impressões',
      format: 'number',
      aValue: a.kpis.impressions,
      bValue: b.kpis.impressions,
    },
    { label: 'Cliques', format: 'number', aValue: a.kpis.clicks, bValue: b.kpis.clicks },
    {
      label: 'CTR',
      format: 'percent',
      aValue: a.kpis.ctrPct ?? 0,
      bValue: b.kpis.ctrPct ?? 0,
    },
    {
      label: 'Conversões',
      format: 'number',
      aValue: a.kpis.conversions,
      bValue: b.kpis.conversions,
    },
    {
      label: 'CPA',
      format: 'brl',
      aValue: a.kpis.cpaCents ?? 0,
      bValue: b.kpis.cpaCents ?? 0,
      lowerIsBetter: true,
    },
    {
      label: 'CPC',
      format: 'brl',
      aValue: a.kpis.cpcCents ?? 0,
      bValue: b.kpis.cpcCents ?? 0,
      lowerIsBetter: true,
    },
    {
      label: 'CPM',
      format: 'brl',
      aValue: a.kpis.cpmCents ?? 0,
      bValue: b.kpis.cpmCents ?? 0,
      lowerIsBetter: true,
    },
    { label: 'ROAS', format: 'roas', aValue: a.kpis.roas ?? 0, bValue: b.kpis.roas ?? 0 },
  ]

  return (
    <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)]">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--color-border)] text-left text-[10px] font-medium tracking-wider text-[var(--color-fg-muted)] uppercase">
            <th className="px-4 py-3">Métrica</th>
            <th className="px-4 py-3">
              <Link
                href={`/campanhas/${a.header.id}`}
                className="font-semibold text-[var(--color-fg)] hover:text-[var(--color-accent)] hover:underline"
              >
                A: {a.header.name}
              </Link>
            </th>
            <th className="px-4 py-3">
              <Link
                href={`/campanhas/${b.header.id}`}
                className="font-semibold text-[var(--color-fg)] hover:text-[var(--color-accent)] hover:underline"
              >
                B: {b.header.name}
              </Link>
            </th>
            <th className="px-4 py-3 text-right">Δ B vs A</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border)]">
          {metrics.map((m) => (
            <MetricCompareRow key={m.label} metric={m} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function MetricCompareRow({ metric }: { metric: MetricRow }) {
  const delta = metric.aValue === 0 ? 0 : ((metric.bValue - metric.aValue) / metric.aValue) * 100
  const flat = Math.abs(delta) < 0.05
  const bIsHigher = metric.bValue > metric.aValue
  // Side that "wins": for revenue/clicks/ROAS — higher is better. For CPA/CPC/CPM — lower.
  const bWins = metric.lowerIsBetter ? metric.bValue < metric.aValue : metric.bValue > metric.aValue
  const trend = flat ? 'flat' : bIsHigher ? 'up' : 'down'
  const winner = flat ? null : bWins ? 'b' : 'a'

  const deltaColor = flat
    ? 'text-[var(--color-fg-muted)]'
    : bWins
      ? 'text-[var(--color-success)]'
      : 'text-[var(--color-danger)]'

  return (
    <tr>
      <td className="px-4 py-3 text-xs font-medium tracking-wider text-[var(--color-fg-muted)] uppercase">
        {metric.label}
      </td>
      <td
        className={cn(
          'font-tabular px-4 py-3 text-base',
          winner === 'a' ? 'font-semibold text-[var(--color-success)]' : 'text-[var(--color-fg)]'
        )}
      >
        {formatMetricValue(metric.aValue, metric.format)}
      </td>
      <td
        className={cn(
          'font-tabular px-4 py-3 text-base',
          winner === 'b' ? 'font-semibold text-[var(--color-success)]' : 'text-[var(--color-fg)]'
        )}
      >
        {formatMetricValue(metric.bValue, metric.format)}
      </td>
      <td className="px-4 py-3 text-right">
        <span
          className={cn(
            'font-tabular inline-flex items-center gap-1 text-xs font-medium',
            deltaColor
          )}
        >
          {trend === 'up' && <ArrowUpRight className="h-3.5 w-3.5" />}
          {trend === 'down' && <ArrowDownRight className="h-3.5 w-3.5" />}
          {trend === 'flat' && <Minus className="h-3 w-3" />}
          {delta > 0 ? '+' : ''}
          {delta.toFixed(1)}%
        </span>
      </td>
    </tr>
  )
}
