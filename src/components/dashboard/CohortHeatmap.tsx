'use client'

import { useMemo, useState } from 'react'

import { cn } from '@/lib/utils'
import type { CohortRow } from '@/lib/dashboard/mock-data'

/**
 * Cohort retention heatmap (PR-9).
 *
 * Cada linha = cohort (mes de aquisicao). Cada coluna = "Month +N" (meses
 * desde primeira compra). Cor proporcional ao LTV daquela celula.
 *
 * Implementado com CSS grid puro (sem D3/Visx) — viz e simples e mais reliable
 * lazy-render. Cor: gradient do design system (accent-subtle → accent).
 */

const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
})

const MONTH_PT = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
]

function formatCohortLabel(cohort: string): string {
  const [, m] = cohort.split('-')
  const monthIdx = Number(m) - 1
  return MONTH_PT[monthIdx] ?? cohort
}

interface CohortHeatmapProps {
  data: CohortRow[]
  isExample?: boolean
}

export function CohortHeatmap({ data, isExample = false }: CohortHeatmapProps) {
  const [hover, setHover] = useState<{ row: number; col: number } | null>(null)

  const max = useMemo(() => {
    let m = 0
    for (const row of data) for (const cell of row.cells) if (cell !== null && cell > m) m = cell
    return m || 1
  }, [data])

  const monthsCount = data[0]?.cells.length ?? 0
  const hoveredCell = hover ? data[hover.row]?.cells[hover.col] : null
  const hoveredValue: number | null = typeof hoveredCell === 'number' ? hoveredCell : null

  return (
    <section
      aria-label="Cohort retention"
      className="relative flex h-full flex-col rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-5"
    >
      {isExample && (
        <span className="absolute top-3 right-3 rounded-full bg-[var(--color-warning-bg)] px-2 py-0.5 text-[10px] font-medium tracking-wider text-[var(--color-warning)] uppercase">
          exemplo
        </span>
      )}

      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold tracking-tight">Cohort retention — LTV acumulado</h3>
          <p className="mt-0.5 text-[11px] text-[var(--color-fg-muted)]">
            Quanto cada cohort gera ao longo do tempo (R$ por customer).
          </p>
        </div>
        {hoveredValue !== null && hover && (
          <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2.5 py-1 text-[11px]">
            <span className="text-[var(--color-fg-subtle)]">
              {formatCohortLabel(data[hover.row]!.cohort)} · M+{hover.col}:
            </span>{' '}
            <strong className="font-tabular text-[var(--color-fg)]">
              {BRL.format(hoveredValue)}
            </strong>
          </div>
        )}
      </header>

      <div className="flex-1 overflow-x-auto">
        <div
          className="grid gap-0.5"
          style={{
            gridTemplateColumns: `minmax(70px, auto) repeat(${monthsCount}, minmax(48px, 1fr))`,
          }}
        >
          {/* Header row: M+0, M+1, ... */}
          <div />
          {Array.from({ length: monthsCount }).map((_, c) => (
            <div
              key={c}
              className="pb-1 text-center text-[10px] font-medium tracking-wider text-[var(--color-fg-subtle)] uppercase"
            >
              M+{c}
            </div>
          ))}

          {data.map((row, r) => (
            <RowFragment key={row.cohort} row={row} rowIdx={r} max={max} onHover={setHover} />
          ))}
        </div>
      </div>

      <footer className="mt-4 flex items-center justify-between gap-3 text-[10px] text-[var(--color-fg-subtle)]">
        <span>Cor = LTV. Mais escuro = mais alto.</span>
        <div className="flex items-center gap-1.5">
          <span>0</span>
          <div className="flex h-2 w-32 overflow-hidden rounded-full border border-[var(--color-border)]">
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                className="flex-1"
                style={{ backgroundColor: cellColor((i + 1) / 10) }}
              />
            ))}
          </div>
          <span className="font-tabular">{BRL.format(max)}</span>
        </div>
      </footer>
    </section>
  )
}

function RowFragment({
  row,
  rowIdx,
  max,
  onHover,
}: {
  row: CohortRow
  rowIdx: number
  max: number
  onHover: (h: { row: number; col: number } | null) => void
}) {
  return (
    <>
      <div className="flex flex-col justify-center pr-2">
        <span className="text-[11px] font-medium text-[var(--color-fg)] capitalize">
          {formatCohortLabel(row.cohort)}
        </span>
        <span className="text-[9px] text-[var(--color-fg-subtle)]">{row.customers} users</span>
      </div>
      {row.cells.map((cell, c) => (
        <Cell
          key={c}
          value={cell}
          max={max}
          onEnter={() => onHover({ row: rowIdx, col: c })}
          onLeave={() => onHover(null)}
        />
      ))}
    </>
  )
}

function Cell({
  value,
  max,
  onEnter,
  onLeave,
}: {
  value: number | null
  max: number
  onEnter: () => void
  onLeave: () => void
}) {
  if (value === null) {
    return (
      <div className="aspect-[2/1] min-h-[36px] rounded-sm border border-dashed border-[var(--color-border)] bg-transparent" />
    )
  }
  const intensity = max > 0 ? value / max : 0
  return (
    <div
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      className={cn(
        'flex aspect-[2/1] min-h-[36px] cursor-pointer items-center justify-center rounded-sm transition-transform hover:scale-105'
      )}
      style={{ backgroundColor: cellColor(intensity) }}
    >
      <span
        className={cn(
          'font-tabular text-[10px] font-medium',
          intensity > 0.55 ? 'text-white' : 'text-[var(--color-fg)]'
        )}
      >
        {value >= 10 ? value : ''}
      </span>
    </div>
  )
}

/**
 * Cor da celula: gradient do accent. Intensidade 0 = quase transparente,
 * 1 = accent pleno. Mantem theme-aware via var(--color-accent).
 */
function cellColor(intensity: number): string {
  // Opacidade vai de 0.06 (quase invisivel) ate 0.95.
  const alpha = 0.06 + intensity * 0.89
  return `color-mix(in srgb, var(--color-accent) ${Math.round(alpha * 100)}%, transparent)`
}
