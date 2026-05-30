'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { GripVertical, Lock, Unlock } from 'lucide-react'
import { GridLayout, type Layout, type LayoutItem } from 'react-grid-layout'

import { cn } from '@/lib/utils'
import { updateDashboardLayoutAction } from '@/lib/actions/dashboard-layouts'

import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'

/**
 * Container drag-drop pros widgets do dashboard (PR-11 + PR-12).
 *
 * Usa react-grid-layout v2.x (React 19-ready, sem findDOMNode).
 *
 * Persistencia: PR-12 migrou de localStorage pra DB. Mudancas de layout
 * disparam debounce-save (1s) via Server Action `updateDashboardLayoutAction`.
 * `layoutId` identifica a view ativa.
 */

export type WidgetLayoutItem = LayoutItem

export interface DashboardGridProps {
  /** ID da view (dashboard_layouts.id) sendo editada. */
  layoutId: string
  /** Layout inicial vindo do DB. */
  initialLayout: WidgetLayoutItem[]
  children: React.ReactNode
  editable?: boolean
}

const DEBOUNCE_MS = 1000

export function DashboardGrid({
  layoutId,
  initialLayout,
  children,
  editable = true,
}: DashboardGridProps) {
  const [layout, setLayout] = useState<WidgetLayoutItem[]>(initialLayout)
  const [isLocked, setIsLocked] = useState(true)
  const [width, setWidth] = useState(1200)
  const [saving, setSaving] = useState(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedRef = useRef<string>(JSON.stringify(initialLayout))

  // Nota: pra resetar state quando user troca de view, page.tsx passa
  // `key={currentView.id}` no <DashboardGrid> — React remonta o componente
  // limpo (padrao React 19 vs setState-in-effect).

  // ResizeObserver observa o container — necessario porque sidebar collapse/
  // expand muda o width do container sem disparar window resize. (Antes so
  // escutava window resize → grid ficava com width antigo apos toggle.)
  useEffect(() => {
    const container = document.getElementById('dashboard-grid-container')
    if (!container) return

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) setWidth(entry.contentRect.width)
    })
    // ResizeObserver dispara callback inicial automaticamente apos observe(),
    // entao nao precisa setWidth sincrono aqui (evita set-state-in-effect lint).
    observer.observe(container)

    return () => observer.disconnect()
  }, [])

  const persistLayout = useCallback(
    async (next: WidgetLayoutItem[]) => {
      const serialized = JSON.stringify(next)
      if (serialized === lastSavedRef.current) return
      setSaving(true)
      try {
        const widgets = next.map((it) => ({
          id: it.i,
          type: it.i, // type igual ao id por ora; full type vem em PR-13
          gridArea: { x: it.x, y: it.y, w: it.w, h: it.h },
        }))
        const result = await updateDashboardLayoutAction({
          id: layoutId,
          layout: { widgets, gridCols: 12 },
        })
        if (result.ok) lastSavedRef.current = serialized
      } finally {
        setSaving(false)
      }
    },
    [layoutId]
  )

  const onLayoutChange = (newLayout: Layout) => {
    const next = Array.from(newLayout) as WidgetLayoutItem[]
    setLayout(next)
    // Debounce: agrupa cliques rapidos num save so depois do user parar.
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      void persistLayout(next)
    }, DEBOUNCE_MS)
  }

  const resetLayout = () => {
    // Reset = volta pro initialLayout (default que veio do DB).
    setLayout(initialLayout)
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    void persistLayout(initialLayout)
  }

  return (
    <div className="relative">
      {editable && (
        <div className="mb-3 flex items-center justify-end gap-2 text-xs">
          {saving && <span className="text-[10px] text-[var(--color-fg-subtle)]">Salvando…</span>}
          {!isLocked && (
            <button
              type="button"
              onClick={resetLayout}
              className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-2.5 py-1 text-[11px] text-[var(--color-fg-muted)] transition hover:border-[var(--color-border-strong)] hover:text-[var(--color-fg)]"
            >
              Resetar layout
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsLocked((l) => !l)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border px-2.5 py-1 text-[11px] transition',
              isLocked
                ? 'border-[var(--color-border)] bg-[var(--color-bg-elevated)] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]'
                : 'border-[var(--color-accent)] bg-[var(--color-accent-subtle)] text-[var(--color-accent)]'
            )}
          >
            {isLocked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
            {isLocked ? 'Editar layout' : 'Bloquear layout'}
          </button>
        </div>
      )}

      <div
        id="dashboard-grid-container"
        className={cn('dashboard-grid-container relative', !isLocked && 'is-editing')}
      >
        <GridLayout
          width={width}
          layout={layout}
          gridConfig={{
            cols: 12,
            rowHeight: 60,
            margin: [16, 16],
            containerPadding: [0, 0],
            maxRows: Infinity,
          }}
          dragConfig={{
            enabled: !isLocked,
            bounded: false,
            // cancel: elementos interativos NÃO disparam drag (botões/inputs continuam usáveis).
            cancel: "button, a, input, select, textarea, [role='button'], details, summary",
            threshold: 3,
          }}
          resizeConfig={{
            enabled: !isLocked,
            handles: ['se'],
          }}
          onLayoutChange={onLayoutChange}
        >
          {children}
        </GridLayout>
      </div>

      {!isLocked && (
        <p className="mt-3 text-center text-[11px] text-[var(--color-fg-subtle)]">
          Arraste qualquer widget pra reposicionar. Redimensione pelo canto inferior-direito. Botões
          e tabelas continuam interativos.
        </p>
      )}
    </div>
  )
}

/**
 * Wrapper de widget pra dashboard — adiciona drag handle visual quando em
 * edit mode. Visibilidade controlada por classe `.is-editing` no container
 * pai (via CSS global em globals.css).
 */
export function GridWidgetSlot({
  children,
  showHandle = true,
}: {
  children: React.ReactNode
  showHandle?: boolean
}) {
  return (
    <div className="relative h-full w-full overflow-hidden">
      {showHandle && (
        <div
          className="widget-drag-handle pointer-events-none absolute top-2 left-2 z-10 hidden h-6 w-6 items-center justify-center rounded-md bg-[var(--color-bg-elevated)]/85 text-[var(--color-fg-muted)] shadow-sm backdrop-blur"
          aria-hidden
        >
          <GripVertical className="h-3.5 w-3.5" />
        </div>
      )}
      {children}
    </div>
  )
}
