'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useRef, useTransition } from 'react'
import { Calendar, ChevronDown, Filter, RefreshCw, Search } from 'lucide-react'

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

const STATUS_OPTIONS = [
  { value: '', label: 'Todos status' },
  { value: 'ACTIVE', label: 'Ativa' },
  { value: 'PAUSED', label: 'Pausada' },
  { value: 'ARCHIVED', label: 'Arquivada' },
  { value: 'DELETED', label: 'Excluída' },
]

const PROVIDER_OPTIONS = [
  { value: '', label: 'Todas plataformas' },
  { value: 'meta', label: 'Meta' },
  { value: 'google', label: 'Google' },
]

export function CampanhasFiltersBar() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()

  const period = searchParams.get('period') ?? 'last_30d'
  const status = searchParams.get('status') ?? ''
  const provider = searchParams.get('provider') ?? ''
  const qParam = searchParams.get('q') ?? ''
  const inputRef = useRef<HTMLInputElement>(null)

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(key, value)
    else params.delete(key)
    params.delete('page')
    startTransition(() => router.push(`/campanhas?${params.toString()}`))
  }

  function submitSearch() {
    updateParam('q', inputRef.current?.value.trim() ?? '')
  }

  function clearFilters() {
    startTransition(() => router.push('/campanhas'))
  }

  const periodLabel = PERIOD_OPTIONS.find((p) => p.value === period)?.label ?? 'Período'
  const statusLabel = STATUS_OPTIONS.find((s) => s.value === status)?.label ?? 'Status'
  const providerLabel = PROVIDER_OPTIONS.find((p) => p.value === provider)?.label ?? 'Plataforma'
  const hasFilters = status || provider || qParam || period !== 'last_30d'

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <FilterDropdown
        icon={<Calendar className="h-3.5 w-3.5" />}
        label={periodLabel}
        value={period}
        options={PERIOD_OPTIONS}
        onChange={(v) => updateParam('period', v)}
      />
      <FilterDropdown
        icon={<Filter className="h-3.5 w-3.5" />}
        label={statusLabel}
        value={status}
        options={STATUS_OPTIONS}
        onChange={(v) => updateParam('status', v)}
      />
      <FilterDropdown
        icon={<Filter className="h-3.5 w-3.5" />}
        label={providerLabel}
        value={provider}
        options={PROVIDER_OPTIONS}
        onChange={(v) => updateParam('provider', v)}
      />

      <div className="relative ml-auto flex items-center">
        <Search className="absolute left-2.5 h-3.5 w-3.5 text-[var(--color-fg-subtle)]" />
        <input
          key={qParam}
          ref={inputRef}
          type="text"
          defaultValue={qParam}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submitSearch()
          }}
          onBlur={submitSearch}
          placeholder="Buscar por nome..."
          className="h-9 w-[240px] rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] pr-3 pl-8 text-xs text-[var(--color-fg)] placeholder:text-[var(--color-fg-subtle)] focus:border-[var(--color-accent)] focus:outline-none"
        />
      </div>

      {hasFilters && (
        <button
          type="button"
          onClick={clearFilters}
          className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 text-xs text-[var(--color-fg-muted)] transition-colors hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-fg)]"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${pending ? 'animate-spin' : ''}`} />
          Limpar
        </button>
      )}
    </div>
  )
}

function FilterDropdown({
  icon,
  label,
  value,
  options,
  onChange,
}: {
  icon: React.ReactNode
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (v: string) => void
}) {
  return (
    <div className="relative">
      <button
        type="button"
        className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 text-xs text-[var(--color-fg)] transition-colors hover:bg-[var(--color-bg-subtle)]"
      >
        {icon}
        <span>{label}</span>
        <ChevronDown className="h-3 w-3 text-[var(--color-fg-subtle)]" />
      </button>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 cursor-pointer opacity-0"
        aria-label={label}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}
