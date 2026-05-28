'use client'

import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown, ImageIcon } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { CreativeRow } from '@/lib/dashboard/mock-data'

/**
 * Top criativos por performance (PR-7).
 *
 * Tabela sortable por ROAS / CTR / Receita / Spend. Toggle clicando no
 * header. Status pill (scaling/mature/fatigued/testing) com cor.
 *
 * Click em row futuramente vai pra /campanhas/[adId] — por enquanto noop
 * (page de campanhas detail entra em Sessao 1.7).
 */

type SortKey = 'revenue' | 'spend' | 'roas' | 'ctr' | 'conversions'
type SortDir = 'asc' | 'desc'

const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
})
const PERCENT = new Intl.NumberFormat('pt-BR', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})
const NUM = new Intl.NumberFormat('pt-BR')

const STATUS_LABELS: Record<CreativeRow['status'], { text: string; tone: string }> = {
  scaling: { text: 'Escalando', tone: 'bg-[var(--color-success-bg)] text-[var(--color-success)]' },
  mature: { text: 'Maduro', tone: 'bg-[var(--color-accent-subtle)] text-[var(--color-accent)]' },
  fatigued: { text: 'Fadigado', tone: 'bg-[var(--color-danger-bg)] text-[var(--color-danger)]' },
  testing: { text: 'Testando', tone: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]' },
}

interface TopCreativesTableProps {
  data: CreativeRow[]
  isExample?: boolean
}

export function TopCreativesTable({ data, isExample = false }: TopCreativesTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('revenue')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const sorted = useMemo(() => {
    const arr = [...data]
    arr.sort((a, b) => {
      const av = a[sortKey] as number
      const bv = b[sortKey] as number
      return sortDir === 'desc' ? bv - av : av - bv
    })
    return arr.slice(0, 10)
  }, [data, sortKey, sortDir])

  const onSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  return (
    <section
      aria-label="Top criativos"
      className="relative flex h-full flex-col rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-5"
    >
      {isExample && (
        <span className="absolute top-3 right-3 rounded-full bg-[var(--color-warning-bg)] px-2 py-0.5 text-[10px] font-medium tracking-wider text-[var(--color-warning)] uppercase">
          exemplo
        </span>
      )}

      <header className="mb-4">
        <h3 className="text-sm font-semibold tracking-tight">Top criativos</h3>
        <p className="mt-0.5 text-[11px] text-[var(--color-fg-muted)]">
          Performance dos seus anúncios. Clique nos headers pra ordenar.
        </p>
      </header>

      <div className="flex-1 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-[10px] font-medium tracking-wider text-[var(--color-fg-subtle)] uppercase">
              <th className="pr-2 pb-3">Criativo</th>
              <SortableHeader
                label="Spend"
                k="spend"
                active={sortKey}
                dir={sortDir}
                onSort={onSort}
              />
              <SortableHeader
                label="Receita"
                k="revenue"
                active={sortKey}
                dir={sortDir}
                onSort={onSort}
              />
              <SortableHeader
                label="ROAS"
                k="roas"
                active={sortKey}
                dir={sortDir}
                onSort={onSort}
              />
              <SortableHeader label="CTR" k="ctr" active={sortKey} dir={sortDir} onSort={onSort} />
              <SortableHeader
                label="Conv"
                k="conversions"
                active={sortKey}
                dir={sortDir}
                onSort={onSort}
              />
              <th className="pr-1 pb-3 pl-2 text-right">Status</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr
                key={row.id}
                className="cursor-pointer border-t border-[var(--color-border)] transition-colors hover:bg-[var(--color-bg-subtle)]"
              >
                <td className="py-2 pr-2">
                  <div className="flex max-w-[280px] items-center gap-2.5">
                    <Thumbnail url={row.thumbnailUrl} />
                    <span className="truncate text-[12px] text-[var(--color-fg)]" title={row.name}>
                      {row.name}
                    </span>
                  </div>
                </td>
                <td className="font-tabular py-2 text-[var(--color-fg-muted)]">
                  {BRL.format(row.spend)}
                </td>
                <td className="font-tabular py-2 text-[var(--color-fg)]">
                  {BRL.format(row.revenue)}
                </td>
                <td className="font-tabular py-2 font-medium text-[var(--color-fg)]">
                  {row.roas.toFixed(2)}×
                </td>
                <td className="font-tabular py-2 text-[var(--color-fg-muted)]">
                  {PERCENT.format(row.ctr)}
                </td>
                <td className="font-tabular py-2 text-[var(--color-fg-muted)]">
                  {NUM.format(row.conversions)}
                </td>
                <td className="py-2 pl-2 text-right">
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wide whitespace-nowrap',
                      STATUS_LABELS[row.status].tone
                    )}
                  >
                    {STATUS_LABELS[row.status].text}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function SortableHeader({
  label,
  k,
  active,
  dir,
  onSort,
}: {
  label: string
  k: SortKey
  active: SortKey
  dir: SortDir
  onSort: (k: SortKey) => void
}) {
  const isActive = active === k
  const Icon = !isActive ? ArrowUpDown : dir === 'desc' ? ArrowDown : ArrowUp
  return (
    <th className="pr-2 pb-3">
      <button
        type="button"
        onClick={() => onSort(k)}
        className={cn(
          'inline-flex items-center gap-1 transition-colors',
          isActive ? 'text-[var(--color-fg)]' : 'hover:text-[var(--color-fg-muted)]'
        )}
      >
        {label}
        <Icon className={cn('h-3 w-3', !isActive && 'opacity-40')} />
      </button>
    </th>
  )
}

function Thumbnail({ url }: { url: string | null }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" className="h-8 w-8 rounded-md object-cover" />
  }
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[var(--color-bg-subtle)] text-[var(--color-fg-subtle)]">
      <ImageIcon className="h-3.5 w-3.5" />
    </div>
  )
}
