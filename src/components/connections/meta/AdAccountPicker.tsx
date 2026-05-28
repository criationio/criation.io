'use client'

import { useState, useTransition } from 'react'
import { Check, CircleAlert, Loader2 } from 'lucide-react'

import { setDefaultAdAccount } from '@/lib/actions/meta-connections'
import { cn } from '@/lib/utils'
import type { MetaAdAccountOption } from '../types'

/**
 * Picker de ad account default (Sessão 1.7 hot-fix).
 *
 * Lista todas as ad accounts ligadas à conexão Meta e permite escolher qual
 * vira default (usada por /campanhas, dashboard, sync, CAPI fanout).
 *
 * `account_status` codes Meta:
 *   1=ACTIVE, 2=DISABLED, 3=UNSETTLED, 7=PENDING_RISK_REVIEW,
 *   8=PENDING_SETTLEMENT, 9=IN_GRACE_PERIOD, 100=PENDING_CLOSURE,
 *   101=CLOSED, 201=ANY_ACTIVE, 202=ANY_CLOSED
 */

const STATUS_LABELS: Record<number, { text: string; tone: string }> = {
  1: { text: 'Ativa', tone: 'text-[var(--color-success)]' },
  2: { text: 'Desativada', tone: 'text-[var(--color-fg-subtle)]' },
  3: { text: 'Pendente', tone: 'text-[var(--color-warning)]' },
  7: { text: 'Em análise', tone: 'text-[var(--color-warning)]' },
  9: { text: 'Em atraso', tone: 'text-[var(--color-warning)]' },
  101: { text: 'Encerrada', tone: 'text-[var(--color-fg-subtle)]' },
}

interface AdAccountPickerProps {
  adAccounts: MetaAdAccountOption[]
}

export function AdAccountPicker({ adAccounts }: AdAccountPickerProps) {
  const [optimisticDefault, setOptimisticDefault] = useState<string | null>(
    adAccounts.find((a) => a.isDefault)?.adAccountId ?? null
  )
  const [error, setError] = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  function handleSelect(adAccountId: string) {
    if (adAccountId === optimisticDefault) return
    setError(null)
    setPendingId(adAccountId)
    const previous = optimisticDefault
    setOptimisticDefault(adAccountId)

    startTransition(async () => {
      const result = await setDefaultAdAccount(adAccountId)
      setPendingId(null)
      if (!result.ok) {
        setOptimisticDefault(previous)
        setError(result.error.message)
      }
    })
  }

  if (adAccounts.length === 0) {
    return (
      <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] bg-[var(--color-bg-subtle)] p-4 text-center text-xs text-[var(--color-fg-muted)]">
        Nenhuma conta de anúncio encontrada nessa conexão. Sincronize ou reconecte.
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <header className="flex items-center justify-between">
        <h4 className="text-[10px] font-medium tracking-wider text-[var(--color-fg-muted)] uppercase">
          Contas de anúncio
        </h4>
        <span className="text-[10px] text-[var(--color-fg-subtle)]">
          {adAccounts.length} {adAccounts.length === 1 ? 'conta' : 'contas'} · clique pra escolher a
          principal
        </span>
      </header>

      <ul className="divide-y divide-[var(--color-border)] overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)]">
        {adAccounts.map((acc) => {
          const isSelected = optimisticDefault === acc.adAccountId
          const isPending = pendingId === acc.adAccountId
          const statusInfo =
            acc.accountStatus !== null
              ? (STATUS_LABELS[acc.accountStatus] ?? {
                  text: `Status ${acc.accountStatus}`,
                  tone: 'text-[var(--color-fg-subtle)]',
                })
              : null

          return (
            <li key={acc.adAccountId}>
              <button
                type="button"
                onClick={() => handleSelect(acc.adAccountId)}
                disabled={isPending}
                className={cn(
                  'flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors',
                  isSelected
                    ? 'bg-[var(--color-accent-subtle)]'
                    : 'hover:bg-[var(--color-bg-subtle)]',
                  isPending && 'cursor-wait opacity-60'
                )}
              >
                <span
                  className={cn(
                    'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
                    isSelected
                      ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-fg-on-accent)]'
                      : 'border-[var(--color-border-strong)] bg-[var(--color-bg)]'
                  )}
                  aria-hidden
                >
                  {isPending ? (
                    <Loader2 className="h-2.5 w-2.5 animate-spin" />
                  ) : isSelected ? (
                    <Check className="h-2.5 w-2.5" strokeWidth={3} />
                  ) : null}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-[var(--color-fg)]">
                    {acc.adAccountName ?? `Ad Account ${acc.adAccountId}`}
                  </p>
                  <p className="font-tabular truncate text-[10px] text-[var(--color-fg-subtle)]">
                    ID {acc.adAccountId}
                    {acc.currency ? ` · ${acc.currency}` : ''}
                    {statusInfo ? ' · ' : ''}
                    {statusInfo && <span className={statusInfo.tone}>{statusInfo.text}</span>}
                  </p>
                </div>

                {isSelected && !isPending && (
                  <span className="rounded-full bg-[var(--color-accent)] px-2 py-0.5 text-[9px] font-medium tracking-wider text-[var(--color-fg-on-accent)] uppercase">
                    Principal
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ul>

      {error && (
        <div className="flex items-center gap-1.5 rounded-[var(--radius-sm)] bg-[var(--color-danger-bg)] px-2 py-1.5 text-[11px] text-[var(--color-danger)]">
          <CircleAlert className="h-3 w-3" />
          {error}
        </div>
      )}
    </div>
  )
}
