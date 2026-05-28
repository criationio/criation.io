'use client'

import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { UtmSourceRow } from '@/lib/dashboard/mock-data'

/**
 * Top UTM sources por receita (PR-9).
 *
 * Tabela com source/medium agrupados. Sortable. Highlight ROAS verde/vermelho
 * baseado em threshold (>2× verde, <1× vermelho).
 *
 * Click numa row filtraria dashboard inteiro pra essa source (PR-10 quando
 * filters store estiver pronto).
 */

type SortKey = 'revenue' | 'orders' | 'spend' | 'roas'
type SortDir = 'asc' | 'desc'

const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
})
const NUM = new Intl.NumberFormat('pt-BR')

interface UtmSourceTableProps {
  data: UtmSourceRow[]
  isExample?: boolean
}

export function UtmSourceTable({ data, isExample = false }: UtmSourceTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('revenue')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const sorted = useMemo(() => {
    const arr = [...data]
    arr.sort((a, b) => {
      const av = a[sortKey]
      const bv = b[sortKey]
      return sortDir === 'desc' ? bv - av : av - bv
    })
    return arr
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
      aria-label="UTM sources"
      className="relative flex h-full flex-col rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-5"
    >
      {isExample && (
        <span className="absolute top-3 right-3 rounded-full bg-[var(--color-warning-bg)] px-2 py-0.5 text-[10px] font-medium tracking-wider text-[var(--color-warning)] uppercase">
          exemplo
        </span>
      )}

      <header className="mb-4">
        <h3 className="text-sm font-semibold tracking-tight">UTM source ranking</h3>
        <p className="mt-0.5 text-[11px] text-[var(--color-fg-muted)]">
          Origem das vendas atribuídas. ROAS verde &gt; 2× · vermelho &lt; 1×.
        </p>
      </header>

      {sorted.length === 0 ? (
        <div className="flex flex-1 items-center justify-center rounded-md border border-dashed border-[var(--color-border)] bg-[var(--color-bg-subtle)] p-6 text-center">
          <div>
            <p className="text-sm font-medium text-[var(--color-fg)]">Nenhum UTM rastreado ainda</p>
            <p className="mt-1 text-xs text-[var(--color-fg-muted)]">
              Conecte gateway de vendas + instale o tracking script pra registrar UTMs das suas
              campanhas.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[10px] font-medium tracking-wider text-[var(--color-fg-subtle)] uppercase">
                <th className="pr-2 pb-3">Source / Medium</th>
                <SortableHeader
                  label="Receita"
                  k="revenue"
                  active={sortKey}
                  dir={sortDir}
                  onSort={onSort}
                />
                <SortableHeader
                  label="Pedidos"
                  k="orders"
                  active={sortKey}
                  dir={sortDir}
                  onSort={onSort}
                />
                <SortableHeader
                  label="Spend"
                  k="spend"
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
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => (
                <tr
                  key={`${row.source}-${row.medium}`}
                  className="border-t border-[var(--color-border)] transition-colors hover:bg-[var(--color-bg-subtle)]"
                >
                  <td className="py-2 pr-2">
                    <div className="flex flex-col">
                      <span className="font-tabular text-[12px] text-[var(--color-fg)]">
                        {row.source}
                      </span>
                      <span className="font-tabular text-[10px] text-[var(--color-fg-subtle)]">
                        {row.medium}
                      </span>
                    </div>
                  </td>
                  <td className="font-tabular py-2 text-[var(--color-fg)]">
                    {BRL.format(row.revenue)}
                  </td>
                  <td className="font-tabular py-2 text-[var(--color-fg-muted)]">
                    {NUM.format(row.orders)}
                  </td>
                  <td className="font-tabular py-2 text-[var(--color-fg-muted)]">
                    {row.spend > 0 ? BRL.format(row.spend) : '—'}
                  </td>
                  <td className="font-tabular py-2 font-medium">
                    {row.spend > 0 ? (
                      <RoasBadge value={row.roas} />
                    ) : (
                      <span className="text-[var(--color-fg-subtle)]">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function RoasBadge({ value }: { value: number }) {
  const color =
    value >= 2
      ? 'text-[var(--color-success)]'
      : value < 1
        ? 'text-[var(--color-danger)]'
        : 'text-[var(--color-warning)]'
  return <span className={color}>{value.toFixed(2)}×</span>
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
