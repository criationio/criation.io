'use client'

import { useRouter, useSearchParams, useParams } from 'next/navigation'
import { useTransition } from 'react'
import { Calendar, ChevronDown } from 'lucide-react'

const PERIOD_OPTIONS = [
  { value: 'today', label: 'Hoje' },
  { value: 'yesterday', label: 'Ontem' },
  { value: 'last_7d', label: 'Últimos 7 dias' },
  { value: 'last_30d', label: 'Últimos 30 dias' },
  { value: 'last_90d', label: 'Últimos 90 dias' },
  { value: 'mtd', label: 'Mês até hoje' },
  { value: 'qtd', label: 'Trimestre até hoje' },
  { value: 'ytd', label: 'Ano até hoje' },
  { value: 'last_month', label: 'Mês passado' },
  { value: 'last_quarter', label: 'Trimestre passado' },
]

export function CampaignDetailFiltersBar() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const params = useParams<{ id: string }>()
  const [, startTransition] = useTransition()

  const period = searchParams.get('period') ?? 'last_30d'
  const periodLabel = PERIOD_OPTIONS.find((p) => p.value === period)?.label ?? 'Período'

  function changePeriod(value: string) {
    const newParams = new URLSearchParams(searchParams.toString())
    if (value === 'last_30d') newParams.delete('period')
    else newParams.set('period', value)
    startTransition(() => router.push(`/campanhas/${params.id}?${newParams.toString()}`))
  }

  return (
    <div className="relative">
      <button
        type="button"
        className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 text-xs text-[var(--color-fg)] transition-colors hover:bg-[var(--color-bg-subtle)]"
      >
        <Calendar className="h-3.5 w-3.5" />
        <span>{periodLabel}</span>
        <ChevronDown className="h-3 w-3 text-[var(--color-fg-subtle)]" />
      </button>
      <select
        value={period}
        onChange={(e) => changePeriod(e.target.value)}
        className="absolute inset-0 cursor-pointer opacity-0"
        aria-label="Período"
      >
        {PERIOD_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}
