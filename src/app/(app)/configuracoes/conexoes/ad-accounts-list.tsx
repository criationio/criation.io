'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { setDefaultAdAccount } from '@/lib/actions/meta-connections'
import { cn } from '@/lib/utils'

interface AdAccount {
  id: string
  adAccountId: string
  name: string | null
  currency: string | null
  accountStatus: number | null
  isDefault: boolean
  businessId: string | null
}

const ACCOUNT_STATUS_LABEL: Record<number, string> = {
  1: 'Ativa',
  2: 'Desabilitada',
  3: 'Não verificada',
  7: 'Em revisão',
  8: 'Em aviso',
  9: 'Em rascunho',
  100: 'Pendente fechamento',
  101: 'Fechada',
}

export function AdAccountsList({ adAccounts }: { adAccounts: AdAccount[] }) {
  const router = useRouter()
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSetDefault(adAccountId: string) {
    setPendingId(adAccountId)
    startTransition(async () => {
      const result = await setDefaultAdAccount(adAccountId)
      setPendingId(null)
      if (!result.ok) {
        toast.error('Falha ao mudar conta principal', { description: result.error.message })
        return
      }
      toast.success('Conta principal alterada')
      router.refresh()
    })
  }

  return (
    <ul className="divide-y divide-[var(--color-border)] rounded-[var(--radius-md)] border border-[var(--color-border)]">
      {adAccounts.map((acc) => {
        const statusLabel =
          acc.accountStatus !== null
            ? (ACCOUNT_STATUS_LABEL[acc.accountStatus] ?? `status ${acc.accountStatus}`)
            : null
        const isThisPending = pendingId === acc.adAccountId

        return (
          <li
            key={acc.id}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 transition',
              acc.isDefault && 'bg-[var(--color-accent-muted)]'
            )}
          >
            {acc.isDefault ? (
              <CheckCircle2
                className="h-3.5 w-3.5 shrink-0 text-[var(--color-accent)]"
                aria-label="Conta principal"
              />
            ) : (
              <span
                className="h-3.5 w-3.5 shrink-0 rounded-full border border-[var(--color-border-strong)]"
                aria-hidden
              />
            )}

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm">{acc.name ?? `Conta ${acc.adAccountId}`}</span>
                {acc.isDefault && (
                  <span className="rounded-full bg-[var(--color-accent-subtle)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-accent)]">
                    principal
                  </span>
                )}
              </div>
              <div
                className="mt-0.5 flex items-center gap-2 text-[10px] text-[var(--color-fg-subtle)]"
                data-tabular
              >
                <span>act_{acc.adAccountId}</span>
                {acc.currency && <span>· {acc.currency}</span>}
                {statusLabel && <span>· {statusLabel}</span>}
                {acc.businessId && <span>· BM {acc.businessId}</span>}
              </div>
            </div>

            {!acc.isDefault && (
              <button
                type="button"
                onClick={() => handleSetDefault(acc.adAccountId)}
                disabled={isPending}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-2.5 py-1 text-[10px] font-medium text-[var(--color-fg-muted)] transition hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isThisPending && <Loader2 className="h-3 w-3 animate-spin" />}
                {isThisPending ? 'Salvando…' : 'Definir como principal'}
              </button>
            )}
          </li>
        )
      })}
    </ul>
  )
}
