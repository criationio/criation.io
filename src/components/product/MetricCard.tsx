import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'

interface MetricCardProps {
  label: string
  value: string | number
  unit?: string
  delta?: { value: number; label?: string }
  trend?: 'up' | 'down' | 'flat'
  sparkline?: number[]
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}

export function MetricCard({
  label,
  value,
  unit,
  delta,
  trend,
  sparkline,
  size = 'md',
  loading = false,
}: MetricCardProps) {
  if (loading) {
    return (
      <div className="space-y-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-5">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-3 w-24" />
      </div>
    )
  }

  const valueSize = { sm: 'text-xl', md: 'text-2xl', lg: 'text-3xl' }[size]
  const deltaTrend =
    trend ?? (delta ? (delta.value > 0 ? 'up' : delta.value < 0 ? 'down' : 'flat') : undefined)
  const trendColor =
    deltaTrend === 'up'
      ? 'var(--color-success)'
      : deltaTrend === 'down'
        ? 'var(--color-danger)'
        : 'var(--color-fg-muted)'
  const TrendIcon =
    deltaTrend === 'up' ? ArrowUpRight : deltaTrend === 'down' ? ArrowDownRight : Minus

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-5 transition-colors hover:border-[var(--color-border-strong)]">
      <div className="text-label mb-2">{label}</div>
      <div
        className={`${valueSize} font-tabular flex items-baseline gap-1 font-semibold text-[var(--color-fg)]`}
      >
        {unit === 'R$' && (
          <span className="text-base font-normal text-[var(--color-fg-muted)]">R$</span>
        )}
        <span>{value}</span>
        {unit && unit !== 'R$' && (
          <span className="text-sm font-normal text-[var(--color-fg-muted)]">{unit}</span>
        )}
      </div>
      {delta && (
        <div
          className="font-tabular mt-2 flex items-center gap-1 text-xs"
          style={{ color: trendColor }}
        >
          <TrendIcon size={12} />
          <span>
            {delta.value > 0 ? '+' : ''}
            {delta.value.toFixed(1)}%
          </span>
          {delta.label && <span className="ml-1 text-[var(--color-fg-subtle)]">{delta.label}</span>}
        </div>
      )}
      {sparkline && sparkline.length > 0 && (
        <Sparkline data={sparkline} color={trendColor} className="mt-3" />
      )}
    </div>
  )
}

function Sparkline({
  data,
  color,
  className,
}: {
  data: number[]
  color: string
  className?: string
}) {
  const width = 120
  const height = 32
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const step = width / (data.length - 1)
  const points = data
    .map((v, i) => `${i * step},${height - ((v - min) / range) * height}`)
    .join(' ')
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={`h-8 w-full ${className ?? ''}`}
      preserveAspectRatio="none"
    >
      <polyline fill="none" stroke={color} strokeWidth="1.5" points={points} />
    </svg>
  )
}
