'use client'

import { useId, useMemo } from 'react'
import { ArrowDownRight, ArrowUpRight, HelpCircle, Minus } from 'lucide-react'
import { Area, AreaChart, ResponsiveContainer } from 'recharts'

import { cn } from '@/lib/utils'

type KpiFormat = 'brl' | 'number' | 'percent' | 'roas' | 'multiplier'

interface KpiCardProps {
  label: string
  value: number
  format: KpiFormat
  /** Mudança percentual vs período anterior (-100 a +inf). */
  deltaPercent: number
  sparkData: number[]
  tooltip?: string
  isExample?: boolean
  /** Se true, sentido positivo é diminuir (ex: CAC). Inverte cor do delta. */
  invertDeltaPolarity?: boolean
  onClick?: () => void
}

const NUMBER_FORMATTER = new Intl.NumberFormat('pt-BR')
const BRL_FORMATTER = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
})
const BRL_DECIMAL_FORMATTER = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

function formatValue(value: number, format: KpiFormat): string {
  switch (format) {
    case 'brl':
      // Acima de 10k usa sem decimais pra economizar espaço; abaixo mostra 2 casas
      return value >= 10_000 ? BRL_FORMATTER.format(value) : BRL_DECIMAL_FORMATTER.format(value)
    case 'percent':
      return `${value.toFixed(1)}%`
    case 'roas':
    case 'multiplier':
      return `${value.toFixed(2)}×`
    case 'number':
    default:
      return NUMBER_FORMATTER.format(Math.round(value))
  }
}

function deltaTrend(deltaPercent: number, invert: boolean): 'up' | 'down' | 'flat' {
  if (Math.abs(deltaPercent) < 0.05) return 'flat'
  const positive = deltaPercent > 0
  // invert: pra CAC, delta negativo é bom (CAC caiu = bom)
  if (invert) return positive ? 'down' : 'up'
  return positive ? 'up' : 'down'
}

export function KpiCard({
  label,
  value,
  format,
  deltaPercent,
  sparkData,
  tooltip,
  isExample = false,
  invertDeltaPolarity = false,
  onClick,
}: KpiCardProps) {
  const trend = deltaTrend(deltaPercent, invertDeltaPolarity)
  const data = useMemo(() => sparkData.map((v, i) => ({ i, v })), [sparkData])

  const deltaColor =
    trend === 'up'
      ? 'text-[var(--color-success)]'
      : trend === 'down'
        ? 'text-[var(--color-danger)]'
        : 'text-[var(--color-fg-muted)]'

  const sparkColor =
    trend === 'up'
      ? 'var(--color-success)'
      : trend === 'down'
        ? 'var(--color-danger)'
        : 'var(--color-fg-muted)'

  // useId garante stable id SSR/client + único por instância — sem Math.random
  // (que viola react-hooks/purity).
  const reactId = useId()
  const gradientId = `spark-${reactId.replace(/[:]/g, '')}`

  return (
    <div
      onClick={onClick}
      className={cn(
        'group relative flex flex-col gap-3 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-4 transition-colors',
        onClick && 'cursor-pointer hover:border-[var(--color-border-strong)]'
      )}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {isExample && (
        <span className="absolute top-2 right-2 rounded-full bg-[var(--color-warning-bg)] px-2 py-0.5 text-[10px] font-medium tracking-wider text-[var(--color-warning)] uppercase">
          exemplo
        </span>
      )}

      <div className="flex items-center gap-1.5">
        <span className="text-[11px] font-medium tracking-wider text-[var(--color-fg-muted)] uppercase">
          {label}
        </span>
        {tooltip && (
          <HelpCircle
            className="h-3 w-3 text-[var(--color-fg-subtle)] opacity-0 transition-opacity group-hover:opacity-100"
            aria-label={tooltip}
          />
        )}
      </div>

      <div className="space-y-1">
        <div className="font-tabular text-2xl font-semibold tracking-tight text-[var(--color-fg)]">
          {formatValue(value, format)}
        </div>

        <div className={cn('flex items-center gap-1 text-xs font-medium', deltaColor)}>
          {trend === 'up' && <ArrowUpRight className="h-3.5 w-3.5" />}
          {trend === 'down' && <ArrowDownRight className="h-3.5 w-3.5" />}
          {trend === 'flat' && <Minus className="h-3 w-3" />}
          <span className="font-tabular">
            {deltaPercent > 0 ? '+' : ''}
            {deltaPercent.toFixed(1)}%
          </span>
          <span className="text-[var(--color-fg-subtle)]">vs. período anterior</span>
        </div>
      </div>

      <div className="-mx-1 -mb-1 h-10">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={sparkColor} stopOpacity={0.4} />
                <stop offset="100%" stopColor={sparkColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="v"
              stroke={sparkColor}
              strokeWidth={1.5}
              fill={`url(#${gradientId})`}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
