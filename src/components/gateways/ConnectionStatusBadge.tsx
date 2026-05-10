'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Clock, AlertTriangle } from 'lucide-react'

export type ConnectionHealth = 'pending' | 'active' | 'failing' | 'stale'

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

/**
 * Deriva estado de health a partir dos campos da connection.
 *
 * - `pending`: nunca recebeu webhook (lastWebhookEventAt IS NULL)
 * - `failing`: > 3 falhas em 24h E ultimo webhook ha mais de 1h (ou nunca)
 * - `stale`: ultimo webhook ha mais de 7 dias (sem falhas recentes)
 * - `active`: ultimo webhook recente, sem falhas significativas
 */
export function deriveConnectionHealth(connection: {
  lastWebhookEventAt: Date | null
  webhookFailures24h: number
}): ConnectionHealth {
  const last = connection.lastWebhookEventAt
  if (!last) return 'pending'

  const ageMs = Date.now() - new Date(last).getTime()
  const oneHour = 60 * 60 * 1000
  const sevenDays = 7 * 24 * 60 * 60 * 1000

  if (connection.webhookFailures24h > 3 && ageMs > oneHour) return 'failing'
  if (ageMs > sevenDays) return 'stale'
  return 'active'
}

/**
 * Mensagem explicativa para mostrar abaixo do badge — varia por health.
 */
export function getHealthDescription(
  health: ConnectionHealth,
  lastWebhookEventAt: Date | null
): string {
  switch (health) {
    case 'pending':
      return 'Configuração salva. Termine o cadastro do webhook no painel do gateway pra ativarmos. Esta página atualiza sozinha quando o primeiro webhook chegar.'
    case 'active': {
      if (!lastWebhookEventAt) return 'Conexão ativa.'
      const ageMs = Date.now() - new Date(lastWebhookEventAt).getTime()
      const minutes = Math.floor(ageMs / 60_000)
      if (minutes < 1) return 'Último webhook há menos de 1 minuto.'
      if (minutes < 60) return `Último webhook há ${minutes} minuto${minutes === 1 ? '' : 's'}.`
      const hours = Math.floor(minutes / 60)
      if (hours < 24) return `Último webhook há ${hours} hora${hours === 1 ? '' : 's'}.`
      const days = Math.floor(hours / 24)
      return `Último webhook há ${days} dia${days === 1 ? '' : 's'}.`
    }
    case 'failing':
      return 'Webhooks recentes estão falhando. Verifique se o token/key configurado no gateway bate com o que está aqui.'
    case 'stale':
      return 'Sem webhooks há mais de 7 dias. Pode ser que o gateway tenha desativado a integração ou não há vendas no período.'
  }
}
