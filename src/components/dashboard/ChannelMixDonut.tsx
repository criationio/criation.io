'use client'

import { useMemo } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'

import type { ChannelMixSlice } from '@/lib/dashboard/mock-data'

/**
 * Mix de canais por receita (PR-8).
 *
 * Donut chart com slices por canal + legend customizada listando $ + %.
 * Hover destaca slice. Click filtra dashboard (PR-10 quando filters store
 * estiver pronto).
 */

const CHANNEL_LABELS: Record<ChannelMixSlice['channel'], string> = {
  meta: 'Meta Ads',
  google: 'Google Ads',
  organic: 'Orgânico',
  direct: 'Direct',
  email: 'Email',
  whatsapp: 'WhatsApp',
}

const CHANNEL_COLORS: Record<ChannelMixSlice['channel'], string> = {
  meta: '#8b5cf6', // accent purple
  google: '#34d399', // green
  organic: '#60a5fa', // blue
  direct: '#fbbf24', // amber
  email: '#f472b6', // pink
  whatsapp: '#10b981', // emerald
}

const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
})

interface ChannelMixDonutProps {
  data: ChannelMixSlice[]
  isExample?: boolean
}

export function ChannelMixDonut({ data, isExample = false }: ChannelMixDonutProps) {
  const chartData = useMemo(
    () =>
      data
        .filter((c) => c.revenue > 0)
        .map((c) => ({
          name: CHANNEL_LABELS[c.channel],
          channel: c.channel,
          value: c.revenue,
          spend: c.spend,
          share: c.share,
        })),
    [data]
  )

  const total = useMemo(() => chartData.reduce((s, c) => s + c.value, 0), [chartData])

  return (
    <section
      aria-label="Mix de canais"
      className="relative flex h-full flex-col rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-5"
    >
      {isExample && (
        <span className="absolute top-3 right-3 rounded-full bg-[var(--color-warning-bg)] px-2 py-0.5 text-[10px] font-medium tracking-wider text-[var(--color-warning)] uppercase">
          exemplo
        </span>
      )}

      <header className="mb-4">
        <h3 className="text-sm font-semibold tracking-tight">Mix de canais</h3>
        <p className="mt-0.5 text-[11px] text-[var(--color-fg-muted)]">
          Receita atribuída por origem.
        </p>
      </header>

      <div className="flex flex-1 items-center gap-6">
        <div className="relative h-[180px] w-[180px] shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                innerRadius={55}
                outerRadius={80}
                paddingAngle={2}
                stroke="var(--color-bg-elevated)"
                strokeWidth={2}
                isAnimationActive={false}
              >
                {chartData.map((entry) => (
                  <Cell key={entry.channel} fill={CHANNEL_COLORS[entry.channel]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: 'var(--color-bg-elevated)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 6,
                  fontSize: 12,
                  color: 'var(--color-fg)',
                }}
                formatter={(value) => BRL.format(typeof value === 'number' ? value : 0)}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[10px] tracking-wider text-[var(--color-fg-subtle)] uppercase">
              Total
            </span>
            <span className="font-tabular text-sm font-semibold text-[var(--color-fg)]">
              {BRL.format(total)}
            </span>
          </div>
        </div>

        <ul className="flex min-w-0 flex-1 flex-col gap-2 text-xs">
          {chartData.map((c) => (
            <li key={c.channel} className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <span
                  aria-hidden
                  className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
                  style={{ backgroundColor: CHANNEL_COLORS[c.channel] }}
                />
                <span className="truncate text-[var(--color-fg)]">{c.name}</span>
              </div>
              <div className="flex shrink-0 items-baseline gap-2">
                <span className="font-tabular text-[var(--color-fg-muted)]">
                  {(c.share * 100).toFixed(0)}%
                </span>
                <span className="font-tabular text-[11px] text-[var(--color-fg-subtle)]">
                  {BRL.format(c.value)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
