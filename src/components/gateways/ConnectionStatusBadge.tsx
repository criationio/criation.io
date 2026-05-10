'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Clock, AlertTriangle } from 'lucide-react'

import type { ConnectionHealth } from './connection-health'

export interface ConnectionStatusBadgeProps {
  health: ConnectionHealth
  /** Auto-refresh enquanto pending — para quando vira active. */
  autoRefreshWhilePending?: boolean
}

const VARIANTS: Record<ConnectionHealth, { label: string; className: string; Icon: typeof Clock }> =
  {
    pending: {
      label: 'Aguardando webhook',
      className:
        'border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] text-[var(--color-warning)]',
      Icon: Clock,
    },
    active: {
      label: 'Ativa',
      className:
        'border-[var(--color-success-border)] bg-[var(--color-success-bg)] text-[var(--color-success)]',
      Icon: CheckCircle2,
    },
    failing: {
      label: 'Falhas detectadas',
      className:
        'border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] text-[var(--color-danger)]',
      Icon: AlertTriangle,
    },
    stale: {
      label: 'Sem atividade recente',
      className: 'border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-fg-muted)]',
      Icon: Clock,
    },
  }

/**
 * Badge + auto-refresh enquanto a connection esta `pending` (aguardando
 * primeiro webhook). Quando vira `active` ou `failing`, para de refrescar.
 *
 * Polling: a cada 5s via `router.refresh()` (server-side re-render) por ate
 * 5 minutos. Depois disso para — usuario pode recarregar manual.
 */
export function ConnectionStatusBadge({
  health,
  autoRefreshWhilePending = true,
}: ConnectionStatusBadgeProps) {
  const router = useRouter()
  const v = VARIANTS[health]

  useEffect(() => {
    if (!autoRefreshWhilePending || health !== 'pending') return
    const intervalMs = 5_000
    const maxDurationMs = 5 * 60 * 1000
    const start = Date.now()

    const id = window.setInterval(() => {
      if (Date.now() - start > maxDurationMs) {
        window.clearInterval(id)
        return
      }
      router.refresh()
    }, intervalMs)

    return () => window.clearInterval(id)
  }, [health, autoRefreshWhilePending, router])

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${v.className}`}
    >
      <v.Icon className="h-2.5 w-2.5" />
      {v.label}
    </span>
  )
}
