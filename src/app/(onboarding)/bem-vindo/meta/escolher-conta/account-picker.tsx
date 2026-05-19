'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { ArrowRight, Check } from 'lucide-react'

import { setDefaultAdAccount } from '@/lib/actions/meta-connections'
import { cn } from '@/lib/utils'

interface AdAccountOption {
  adAccountId: string
  name: string | null
  businessId: string | null
  currency: string | null
  accountStatus: number | null
}

interface AccountPickerProps {
  adAccounts: AdAccountOption[]
  initialDefault: string | null
  returnTo: string
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

export function AccountPicker({ adAccounts, initialDefault, returnTo }: AccountPickerProps) {
  const router = useRouter()
  const [selected, setSelected] = useState<string | null>(
    initialDefault ?? adAccounts[0]?.adAccountId ?? null
  )
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleConfirm() {
    if (!selected) {
      setError('Selecione uma conta')
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await setDefaultAdAccount(selected)
      if (!result.ok) {
        setError(result.error.message)
        return
      }
      router.push(returnTo)
      router.refresh()
    })
  }

  return (
    <>
      <ul className="mt-6 flex flex-col gap-2">
        {adAccounts.map((acc) => {
          const isSelected = selected === acc.adAccountId
          const statusLabel =
            acc.accountStatus !== null
              ? (ACCOUNT_STATUS_LABEL[acc.accountStatus] ?? `status ${acc.accountStatus}`)
              : null
          return (
            <li key={acc.adAccountId}>
              <button
                type="button"
                onClick={() => setSelected(acc.adAccountId)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-[var(--radius-lg)] border px-4 py-3 text-left transition',
                  isSelected
                    ? 'border-[var(--color-accent)] bg-[var(--color-accent-subtle)]'
                    : 'border-[var(--color-border)] bg-[var(--color-bg-elevated)] hover:border-[var(--color-border-strong)]'
                )}
              >
                <span
                  className={cn(
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border',
                    isSelected
                      ? 'border-[var(--color-accent)] bg-[var(--color-accent)]'
                      : 'border-[var(--color-border-strong)]'
                  )}
                  aria-hidden
                >
                  {isSelected && <Check className="h-3 w-3 text-[var(--color-fg-on-accent)]" />}
                </span>
                <span className="flex-1">
                  <span className="block text-sm font-medium text-[var(--color-fg)]">
                    {acc.name ?? `Conta ${acc.adAccountId}`}
                  </span>
                  <span className="mt-0.5 flex items-center gap-2 text-[10px] text-[var(--color-fg-subtle)]">
                    <span data-tabular>act_{acc.adAccountId}</span>
                    {acc.currency && <span>· {acc.currency}</span>}
                    {statusLabel && <span>· {statusLabel}</span>}
                    {acc.businessId && <span>· BM {acc.businessId}</span>}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      {error && (
        <p className="mt-3 text-xs text-[var(--color-danger)]" role="alert">
          {error}
        </p>
      )}

      <div className="mt-6 flex justify-end">
        <button
          type="button"
          onClick={handleConfirm}
          disabled={isPending || !selected}
          className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-accent)] px-4 text-sm font-medium text-[var(--color-fg-on-accent)] transition hover:bg-[var(--color-accent-hover)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? 'Salvando…' : 'Confirmar e continuar'}
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </>
  )
}
