'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'
import {
  Calendar,
  ChevronDown,
  Filter,
  GitCompare,
  Package,
  RefreshCw,
  Sparkles,
  Target,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import type {
  DashboardAttribution,
  DashboardComparison,
  DashboardPeriodPreset,
} from '@/lib/db/schema/dashboard'

/**
 * Barra de filtros sticky do dashboard (PR-10 + PR-13a).
 *
 * URL é fonte de verdade — `?period=last_30d&comparison=previous_period&attr=last_click&channels=meta,google`.
 * Cada mudança chama router.push pra atualizar URL; page.tsx Server Component
 * lê os search params e re-gera dados conforme. Permite shareable links +
 * back/forward navigation funcional + SSR consistente.
 *
 * Atribuição: PR-13a libera só `last_click`. Outros aparecem com "em breve".
 */

const PERIOD_OPTIONS: { value: DashboardPeriodPreset; label: string }[] = [
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

const COMPARISON_OPTIONS: { value: DashboardComparison; label: string }[] = [
  { value: 'previous_period', label: 'Período anterior' },
  { value: 'same_period_last_year', label: 'Mesmo período do ano passado' },
  { value: 'none', label: 'Sem comparação' },
]

const ATTRIBUTION_OPTIONS: {
  value: DashboardAttribution
  label: string
  disabled?: boolean
}[] = [
  { value: 'last_click', label: 'Last-click' },
  { value: 'first_click', label: 'First-click', disabled: true },
  { value: 'linear', label: 'Linear', disabled: true },
  { value: 'time_decay', label: 'Time-decay', disabled: true },
  { value: 'position_based', label: 'Position-based', disabled: true },
  { value: 'data_driven', label: 'Data-driven', disabled: true },
]

const CHANNEL_OPTIONS = [
  { value: 'meta', label: 'Meta' },
  { value: 'google', label: 'Google' },
  { value: 'organic', label: 'Orgânico' },
  { value: 'direct', label: 'Direct' },
  { value: 'email', label: 'Email' },
  { value: 'whatsapp', label: 'WhatsApp' },
]

export interface ProductOption {
  id: string
  name: string
}

export interface FunnelOption {
  id: string
  name: string
  isDefault?: boolean
}

interface DashboardFiltersBarProps {
  products?: ProductOption[]
  funnels?: FunnelOption[]
}

export function DashboardFiltersBar({ products = [], funnels = [] }: DashboardFiltersBarProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()

  const period = (searchParams.get('period') as DashboardPeriodPreset | null) ?? 'last_30d'
  const comparison =
    (searchParams.get('comparison') as DashboardComparison | null) ?? 'previous_period'
  const attribution = (searchParams.get('attr') as DashboardAttribution | null) ?? 'last_click'
  const channels = (searchParams.get('channels') ?? '')
    .split(',')
    .map((c) => c.trim())
    .filter((c) => c.length > 0)
  const selectedProducts = (searchParams.get('products') ?? '')
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
  const selectedFunnel = searchParams.get('funnel')

  const updateParam = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value === null || value === '') {
      params.delete(key)
    } else {
      params.set(key, value)
    }
    startTransition(() => {
      router.push(`?${params.toString()}`, { scroll: false })
    })
  }

  const toggleChannel = (c: string) => {
    const next = channels.includes(c) ? channels.filter((x) => x !== c) : [...channels, c]
    updateParam('channels', next.length > 0 ? next.join(',') : null)
  }

  const toggleProduct = (id: string) => {
    const next = selectedProducts.includes(id)
      ? selectedProducts.filter((x) => x !== id)
      : [...selectedProducts, id]
    updateParam('products', next.length > 0 ? next.join(',') : null)
  }

  const resetFilters = () => {
    const params = new URLSearchParams(searchParams.toString())
    // Preserva ?view (saved view atual); limpa os demais
    const view = params.get('view')
    const next = new URLSearchParams()
    if (view) next.set('view', view)
    startTransition(() => {
      router.push(`?${next.toString()}`, { scroll: false })
    })
  }

  const periodLabel = PERIOD_OPTIONS.find((p) => p.value === period)?.label ?? 'Custom'
  const comparisonLabel = COMPARISON_OPTIONS.find((c) => c.value === comparison)?.label ?? 'Sem'
  const attributionLabel =
    ATTRIBUTION_OPTIONS.find((a) => a.value === attribution)?.label ?? 'Last-click'

  return (
    <div className="sticky top-14 z-20 -mx-6 mb-2 flex flex-wrap items-center gap-2 border-b border-[var(--color-border)] bg-[var(--color-bg)]/85 px-6 py-3 backdrop-blur-md">
      <FilterDropdown icon={<Calendar className="h-3.5 w-3.5" />} label={periodLabel}>
        {PERIOD_OPTIONS.map((opt) => (
          <DropdownItem
            key={opt.value}
            active={period === opt.value}
            onClick={() => updateParam('period', opt.value)}
          >
            {opt.label}
          </DropdownItem>
        ))}
      </FilterDropdown>

      <FilterDropdown
        icon={<GitCompare className="h-3.5 w-3.5" />}
        label={`vs. ${comparisonLabel}`}
      >
        {COMPARISON_OPTIONS.map((opt) => (
          <DropdownItem
            key={opt.value}
            active={comparison === opt.value}
            onClick={() => updateParam('comparison', opt.value)}
          >
            {opt.label}
          </DropdownItem>
        ))}
      </FilterDropdown>

      <FilterDropdown icon={<Target className="h-3.5 w-3.5" />} label={attributionLabel}>
        {ATTRIBUTION_OPTIONS.map((opt) => {
          const props: {
            active: boolean
            onClick: () => void
            disabled?: boolean
            badge?: string
          } = {
            active: attribution === opt.value,
            onClick: () => !opt.disabled && updateParam('attr', opt.value),
          }
          if (opt.disabled) {
            props.disabled = true
            props.badge = 'em breve'
          }
          return (
            <DropdownItem key={opt.value} {...props}>
              {opt.label}
            </DropdownItem>
          )
        })}
      </FilterDropdown>

      <FilterDropdown
        icon={<Sparkles className="h-3.5 w-3.5" />}
        label={
          channels.length === 0
            ? 'Todos os canais'
            : channels.length === 1
              ? (CHANNEL_OPTIONS.find((c) => c.value === channels[0])?.label ?? channels[0]!)
              : `${channels.length} canais`
        }
        multi
      >
        {CHANNEL_OPTIONS.map((opt) => (
          <DropdownItem
            key={opt.value}
            active={channels.includes(opt.value)}
            onClick={() => toggleChannel(opt.value)}
            multi
          >
            {opt.label}
          </DropdownItem>
        ))}
      </FilterDropdown>

      <FilterDropdown
        icon={<Filter className="h-3.5 w-3.5" />}
        label={
          selectedFunnel
            ? (funnels.find((f) => f.id === selectedFunnel)?.name ?? 'Funil')
            : 'Todos os funis'
        }
      >
        <DropdownItem active={!selectedFunnel} onClick={() => updateParam('funnel', null)}>
          Todos os funis
        </DropdownItem>
        {funnels.length === 0 ? (
          <div className="px-3 py-2 text-[11px] text-[var(--color-fg-subtle)]">
            Nenhum funil criado.{' '}
            <a href="/configuracoes/funis" className="text-[var(--color-accent)] hover:underline">
              Criar agora
            </a>
          </div>
        ) : (
          funnels.map((f) => (
            <DropdownItem
              key={f.id}
              active={selectedFunnel === f.id}
              onClick={() => updateParam('funnel', f.id)}
            >
              {f.name}
              {f.isDefault && <span className="text-[var(--color-accent)]"> ★</span>}
            </DropdownItem>
          ))
        )}
        <div className="my-1 border-t border-[var(--color-border)]" />
        <a
          href="/configuracoes/funis"
          className="block px-3 py-1.5 text-[11px] text-[var(--color-fg-muted)] transition-colors hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-accent)]"
        >
          + Gerenciar funis
        </a>
      </FilterDropdown>

      <FilterDropdown
        icon={<Package className="h-3.5 w-3.5" />}
        label={
          selectedProducts.length === 0
            ? 'Todos os produtos'
            : selectedProducts.length === 1
              ? (products.find((p) => p.id === selectedProducts[0])?.name ?? '1 produto')
              : `${selectedProducts.length} produtos`
        }
        multi
      >
        {products.length === 0 ? (
          <div className="px-3 py-2 text-[11px] text-[var(--color-fg-subtle)]">
            Nenhum produto mapeado ainda. Conecte gateway pra popular.
          </div>
        ) : (
          products.map((p) => (
            <DropdownItem
              key={p.id}
              active={selectedProducts.includes(p.id)}
              onClick={() => toggleProduct(p.id)}
              multi
            >
              {p.name}
            </DropdownItem>
          ))
        )}
      </FilterDropdown>

      <div className="ml-auto flex items-center gap-2">
        {pending && <span className="text-[10px] text-[var(--color-fg-subtle)]">Atualizando…</span>}
        <button
          type="button"
          onClick={resetFilters}
          className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] px-2.5 py-1.5 text-[11px] text-[var(--color-fg-muted)] transition hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-fg)]"
        >
          <RefreshCw className="h-3 w-3" />
          Resetar
        </button>
      </div>
    </div>
  )
}

function FilterDropdown({
  icon,
  label,
  children,
  multi = false,
}: {
  icon?: React.ReactNode
  label: string
  children: React.ReactNode
  multi?: boolean
}) {
  return (
    <details className="group relative">
      <summary
        className={cn(
          'inline-flex cursor-pointer list-none items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-1.5 text-[12px] text-[var(--color-fg)] transition hover:border-[var(--color-border-strong)] [&::-webkit-details-marker]:hidden',
          'group-open:border-[var(--color-accent)] group-open:bg-[var(--color-accent-subtle)]'
        )}
      >
        {icon}
        <span className="font-medium">{label}</span>
        <ChevronDown className="h-3 w-3 transition-transform group-open:rotate-180" />
      </summary>
      <div
        className={cn(
          'absolute top-full left-0 z-30 mt-1 min-w-[220px] rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] py-1 shadow-lg',
          multi && 'max-h-[280px] overflow-y-auto'
        )}
      >
        {children}
      </div>
    </details>
  )
}

function DropdownItem({
  active,
  onClick,
  children,
  multi = false,
  disabled = false,
  badge,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  multi?: boolean
  disabled?: boolean
  badge?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] transition-colors',
        disabled
          ? 'cursor-not-allowed text-[var(--color-fg-subtle)] opacity-60'
          : active
            ? 'bg-[var(--color-accent-subtle)] text-[var(--color-accent)]'
            : 'text-[var(--color-fg)] hover:bg-[var(--color-bg-subtle)]'
      )}
    >
      {multi && (
        <span
          aria-hidden
          className={cn(
            'flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border',
            active
              ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-fg-on-accent)]'
              : 'border-[var(--color-border-strong)]'
          )}
        >
          {active && (
            <svg viewBox="0 0 12 12" className="h-2.5 w-2.5">
              <path d="M2 6l3 3 5-6" fill="none" stroke="currentColor" strokeWidth="2" />
            </svg>
          )}
        </span>
      )}
      <span className="flex-1">{children}</span>
      {badge && (
        <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] px-1.5 py-0.5 text-[9px] font-medium tracking-wider text-[var(--color-fg-subtle)] uppercase">
          {badge}
        </span>
      )}
    </button>
  )
}
