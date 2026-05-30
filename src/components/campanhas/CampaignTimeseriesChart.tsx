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

import type { CampaignDailyPoint } from '@/lib/db/queries/campaign-detail'

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
const NUM = new Intl.NumberFormat('pt-BR')

function formatDate(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
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
            {p.dataKey === 'clicks' || p.dataKey === 'conversions'
              ? NUM.format(p.value ?? 0)
              : BRL_FULL.format(p.value ?? 0)}
          </span>
        </div>
      ))}
    </div>
  )
}

export function CampaignTimeseriesChart({ data }: { data: CampaignDailyPoint[] }) {
  const chartData = useMemo(
    () =>
      data.map((d) => ({
        date: d.date,
        spend: d.spendCents / 100,
        revenue: d.revenueCents / 100,
        clicks: d.clicks,
        conversions: d.conversions,
      })),
    [data]
  )

  const allZero = chartData.every(
    (d) => d.spend === 0 && d.revenue === 0 && d.clicks === 0 && d.conversions === 0
  )

  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-5">
      <header className="mb-4">
        <h3 className="text-sm font-semibold tracking-tight">Performance ao longo do tempo</h3>
        <p className="mt-0.5 text-[11px] text-[var(--color-fg-muted)]">
          Gasto vs receita por dia. Cliques e conversões no eixo secundário.
        </p>
      </header>

      {allZero ? (
        <div className="flex h-[260px] items-center justify-center rounded-md border border-dashed border-[var(--color-border)] bg-[var(--color-bg-subtle)] p-6 text-center">
          <p className="text-xs text-[var(--color-fg-muted)]">Sem dados no período selecionado.</p>
        </div>
      ) : (
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="campaignRevenueGradient" x1="0" y1="0" x2="0" y2="1">
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
                yAxisId="brl"
                tickFormatter={(v) => BRL_COMPACT.format(v)}
                tickLine={false}
                axisLine={false}
                tick={{ fill: 'var(--color-fg-subtle)', fontSize: 11 }}
                width={56}
              />
              <YAxis
                yAxisId="num"
                orientation="right"
                tickFormatter={(v) => NUM.format(v)}
                tickLine={false}
                axisLine={false}
                tick={{ fill: 'var(--color-fg-subtle)', fontSize: 11 }}
                width={40}
              />
              <Tooltip
                content={<CustomTooltip />}
                cursor={{ stroke: 'var(--color-border-strong)', strokeWidth: 1 }}
              />
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                formatter={(value) => (
                  <span style={{ color: 'var(--color-fg-muted)' }}>{value}</span>
                )}
              />
              <Area
                yAxisId="brl"
                type="monotone"
                dataKey="revenue"
                name="Receita"
                stroke="var(--color-success)"
                strokeWidth={2}
                fill="url(#campaignRevenueGradient)"
                isAnimationActive={false}
              />
              <Line
                yAxisId="brl"
                type="monotone"
                dataKey="spend"
                name="Gasto"
                stroke="var(--color-warning)"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
              <Line
                yAxisId="num"
                type="monotone"
                dataKey="clicks"
                name="Cliques"
                stroke="var(--color-accent)"
                strokeWidth={1.5}
                strokeDasharray="3 3"
                dot={false}
                isAnimationActive={false}
              />
              <Line
                yAxisId="num"
                type="monotone"
                dataKey="conversions"
                name="Conversões"
                stroke="var(--color-fg)"
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  )
}
