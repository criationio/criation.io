'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

import type { AdSetWithAds } from '@/lib/db/queries/campaign-detail'
import { cn } from '@/lib/utils'

const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
})
const NUM = new Intl.NumberFormat('pt-BR')

const STATUS_VARIANTS: Record<string, string> = {
  ACTIVE: 'bg-[var(--color-success-bg)] text-[var(--color-success)]',
  PAUSED: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]',
  DELETED: 'bg-[var(--color-bg-elevated)] text-[var(--color-fg-subtle)]',
  ARCHIVED: 'bg-[var(--color-bg-elevated)] text-[var(--color-fg-subtle)]',
}

export function AdSetsTreeTable({ adSets }: { adSets: AdSetWithAds[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)]">
      <header className="border-b border-[var(--color-border)] p-5">
        <h3 className="text-sm font-semibold tracking-tight">Conjuntos de anúncios</h3>
        <p className="mt-0.5 text-[11px] text-[var(--color-fg-muted)]">
          Clique numa linha pra expandir e ver os anúncios desse conjunto.
        </p>
      </header>

      {adSets.length === 0 ? (
        <div className="p-8 text-center">
          <p className="text-xs text-[var(--color-fg-muted)]">
            Nenhum conjunto de anúncios sincronizado.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-left text-[10px] font-medium tracking-wider text-[var(--color-fg-muted)] uppercase">
                <th className="px-4 py-2.5"></th>
                <th className="px-3 py-2.5">Nome</th>
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5 text-right">Gasto</th>
                <th className="px-3 py-2.5 text-right">Impressões</th>
                <th className="px-3 py-2.5 text-right">Cliques</th>
                <th className="px-3 py-2.5 text-right">CTR</th>
                <th className="px-3 py-2.5 text-right">Conv.</th>
                <th className="px-3 py-2.5 text-right">Receita</th>
              </tr>
            </thead>
            <tbody>
              {adSets.map((s) => {
                const isExpanded = expanded.has(s.id)
                return (
                  <>
                    <tr
                      key={s.id}
                      onClick={() => toggle(s.id)}
                      className="cursor-pointer border-b border-[var(--color-border)] transition hover:bg-[var(--color-bg-muted)]"
                    >
                      <td className="px-4 py-2.5">
                        {isExpanded ? (
                          <ChevronDown className="h-3.5 w-3.5 text-[var(--color-fg-muted)]" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5 text-[var(--color-fg-muted)]" />
                        )}
                      </td>
                      <td className="px-3 py-2.5 font-medium text-[var(--color-fg)]">
                        <span className="line-clamp-1">{s.name}</span>
                        <span className="text-[10px] text-[var(--color-fg-subtle)]">
                          {s.ads.length} anúncios
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={cn(
                            'inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium',
                            STATUS_VARIANTS[s.status] ??
                              'bg-[var(--color-bg-muted)] text-[var(--color-fg-muted)]'
                          )}
                        >
                          {s.status}
                        </span>
                      </td>
                      <td className="font-tabular px-3 py-2.5 text-right text-[var(--color-fg)]">
                        {BRL.format(s.spendCents / 100)}
                      </td>
                      <td className="font-tabular px-3 py-2.5 text-right text-[var(--color-fg-muted)]">
                        {NUM.format(s.impressions)}
                      </td>
                      <td className="font-tabular px-3 py-2.5 text-right text-[var(--color-fg-muted)]">
                        {NUM.format(s.clicks)}
                      </td>
                      <td className="font-tabular px-3 py-2.5 text-right text-[var(--color-fg-muted)]">
                        {s.ctrPct !== null ? `${s.ctrPct.toFixed(2)}%` : '—'}
                      </td>
                      <td className="font-tabular px-3 py-2.5 text-right text-[var(--color-fg-muted)]">
                        {s.conversions}
                      </td>
                      <td className="font-tabular px-3 py-2.5 text-right font-medium text-[var(--color-fg)]">
                        {s.revenueCents > 0 ? BRL.format(s.revenueCents / 100) : '—'}
                      </td>
                    </tr>
                    {isExpanded &&
                      s.ads.map((a) => (
                        <tr
                          key={a.id}
                          className="border-b border-[var(--color-border)] bg-[var(--color-bg-subtle)] text-xs"
                        >
                          <td></td>
                          <td className="px-3 py-2 pl-6">
                            <span className="line-clamp-1 text-[var(--color-fg-muted)]">
                              ↳ {a.name}
                            </span>
                            {a.creativeId && (
                              <span className="text-[10px] text-[var(--color-fg-subtle)]">
                                creative {a.creativeId}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={cn(
                                'inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium',
                                STATUS_VARIANTS[a.status] ??
                                  'bg-[var(--color-bg-muted)] text-[var(--color-fg-muted)]'
                              )}
                            >
                              {a.status}
                            </span>
                          </td>
                          <td className="font-tabular px-3 py-2 text-right text-[var(--color-fg-muted)]">
                            {BRL.format(a.spendCents / 100)}
                          </td>
                          <td className="font-tabular px-3 py-2 text-right text-[var(--color-fg-subtle)]">
                            {NUM.format(a.impressions)}
                          </td>
                          <td className="font-tabular px-3 py-2 text-right text-[var(--color-fg-subtle)]">
                            {NUM.format(a.clicks)}
                          </td>
                          <td className="font-tabular px-3 py-2 text-right text-[var(--color-fg-subtle)]">
                            {a.ctrPct !== null ? `${a.ctrPct.toFixed(2)}%` : '—'}
                          </td>
                          <td className="px-3 py-2 text-right text-[var(--color-fg-subtle)]">—</td>
                          <td className="px-3 py-2 text-right text-[var(--color-fg-subtle)]">—</td>
                        </tr>
                      ))}
                  </>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
