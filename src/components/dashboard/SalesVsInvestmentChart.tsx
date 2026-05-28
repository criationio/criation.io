'use client'

import { useMemo } from 'react'
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import type { DailyMetric } from '@/lib/dashboard/mock-data'

/**
 * Vendas × Investimento × Lucro ao longo do tempo (PR-6).
 *
 * Visualização preferida pra dono ver "estou ganhando dinheiro?" rapido:
 *  - Area: Faturamento (verde subtil)
 *  - Line: Investimento (laranja sólido)
 *  - Line: Lucro (azul accent)
 *
 * Eixos:
 *  - X: data dia a dia (ultimo 14d ou 30d depending de filtro)
 *  - Y: BRL com formatacao compact (R$ 4,5k em vez de R$ 4.500)
 */

const BRL_COMPACT = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  maximumFractionDigits: 1,
})

const BRL_FULL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
})

interface SalesVsInvestmentChartProps {
  data: DailyMetric[]
  isExample?: boolean
}

interface TooltipPayload {
  name?: string
  value?: number
  color?: string
  dataKey?: string
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: TooltipPayload[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 text-xs shadow-lg backdrop-blur">
      <div className="mb-1.5 font-medium text-[var(--color-fg)]">{formatDate(label)}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-[var(--color-fg-muted)]">
            <span
              aria-hidden
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: p.color }}
            />
            {p.name}
          </span>
          <span className="font-tabular font-medium text-[var(--color-fg)]">
            {BRL_FULL.format(p.value ?? 0)}
          </span>
        </div>
      ))}
    </div>
  )
}

function formatDate(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

export function SalesVsInvestmentChart({ data, isExample = false }: SalesVsInvestmentChartProps) {
  const chartData = useMemo(
    () =>
      data.map((d) => ({
        date: d.date,
        revenue: d.revenue,
        spend: d.spend,
        profit: d.profit,
      })),
    [data]
  )

  return (
    <section
      aria-label="Vendas × Investimento × Lucro"
      className="relative flex h-full flex-col rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-5"
    >
      {isExample && (
        <span className="absolute top-3 right-3 rounded-full bg-[var(--color-warning-bg)] px-2 py-0.5 text-[10px] font-medium tracking-wider text-[var(--color-warning)] uppercase">
          exemplo
        </span>
      )}

      <header className="mb-4">
        <h3 className="text-sm font-semibold tracking-tight">Vendas × Investimento × Lucro</h3>
        <p className="mt-0.5 text-[11px] text-[var(--color-fg-muted)]">
          Diferença entre vendas e investimento = lucro bruto.
        </p>
      </header>

      <div className="min-h-[260px] flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-success)" stopOpacity={0.25} />
                <stop offset="100%" stopColor="var(--color-success)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={formatDate}
              tickLine={false}
              axisLine={false}
              tick={{ fill: 'var(--color-fg-subtle)', fontSize: 11 }}
              minTickGap={32}
            />
            <YAxis
              tickFormatter={(v) => BRL_COMPACT.format(v)}
              tickLine={false}
              axisLine={false}
              tick={{ fill: 'var(--color-fg-subtle)', fontSize: 11 }}
              width={56}
            />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{ stroke: 'var(--color-border-strong)', strokeWidth: 1 }}
            />
            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
              formatter={(value) => <span style={{ color: 'var(--color-fg-muted)' }}>{value}</span>}
            />
            <Area
              type="monotone"
              dataKey="revenue"
              name="Faturamento"
              stroke="var(--color-success)"
              strokeWidth={2}
              fill="url(#revenueGradient)"
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="spend"
              name="Investimento"
              stroke="var(--color-warning)"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="profit"
              name="Lucro"
              stroke="var(--color-accent)"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}
