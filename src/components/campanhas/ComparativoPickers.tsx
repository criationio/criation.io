'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'
import { ArrowLeftRight, Calendar, ChevronDown } from 'lucide-react'

const PERIOD_OPTIONS = [
  { value: 'last_7d', label: 'Últimos 7 dias' },
  { value: 'last_30d', label: 'Últimos 30 dias' },
  { value: 'last_90d', label: 'Últimos 90 dias' },
  { value: 'mtd', label: 'Mês até hoje' },
  { value: 'last_month', label: 'Mês passado' },
]

interface CampaignOption {
  id: string
  name: string
  provider: string
  status: string
}

interface ComparativoPickersProps {
  campaigns: CampaignOption[]
  selectedA: string
  selectedB: string
  period: string
}

export function ComparativoPickers({
  campaigns,
  selectedA,
  selectedB,
  period,
}: ComparativoPickersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()

  function update(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(key, value)
    else params.delete(key)
    startTransition(() => router.push(`/campanhas/comparativo?${params.toString()}`))
  }

  function swap() {
    if (!selectedA || !selectedB) return
    const params = new URLSearchParams(searchParams.toString())
    params.set('a', selectedB)
    params.set('b', selectedA)
    startTransition(() => router.push(`/campanhas/comparativo?${params.toString()}`))
  }

  const periodLabel = PERIOD_OPTIONS.find((p) => p.value === period)?.label ?? 'Período'

  return (
    <div className="flex flex-wrap items-end gap-3">
      <CampaignPicker
        label="Campanha A"
        value={selectedA}
        excludeId={selectedB}
        campaigns={campaigns}
        onChange={(v) => update('a', v)}
      />

      <button
        type="button"
        onClick={swap}
        disabled={!selectedA || !selectedB}
        className="mb-0.5 inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 text-xs text-[var(--color-fg)] transition-colors hover:bg-[var(--color-bg-subtle)] disabled:cursor-not-allowed disabled:opacity-40"
        aria-label="Trocar A e B"
      >
        <ArrowLeftRight className="h-3.5 w-3.5" />
      </button>

      <CampaignPicker
        label="Campanha B"
        value={selectedB}
        excludeId={selectedA}
        campaigns={campaigns}
        onChange={(v) => update('b', v)}
      />

      <div className="ml-auto flex flex-col gap-1">
        <span className="text-[10px] font-medium tracking-wider text-[var(--color-fg-muted)] uppercase">
          Período
        </span>
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
            onChange={(e) => update('period', e.target.value)}
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
      </div>
    </div>
  )
}

function CampaignPicker({
  label,
  value,
  excludeId,
  campaigns,
  onChange,
}: {
  label: string
  value: string
  excludeId: string
  campaigns: CampaignOption[]
  onChange: (v: string) => void
}) {
  const available = campaigns.filter((c) => c.id !== excludeId)
  return (
    <div className="flex min-w-[240px] flex-col gap-1">
      <span className="text-[10px] font-medium tracking-wider text-[var(--color-fg-muted)] uppercase">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-2 text-xs text-[var(--color-fg)] focus:border-[var(--color-accent)] focus:outline-none"
      >
        <option value="">— selecione —</option>
        {available.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name} ({c.provider})
          </option>
        ))}
      </select>
    </div>
  )
}
