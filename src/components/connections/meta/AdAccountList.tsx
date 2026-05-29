import type { MetaAdAccountOption } from '../types'
import { cn } from '@/lib/utils'

/**
 * Lista read-only das ad accounts ligadas à conexão Meta.
 *
 * Substitui o picker antigo (AdAccountPicker) após decisão de remover o
 * conceito de "ad account default" pra modelo agência (multi-cliente, sem
 * conta principal). Lista só exibe as contas; pra filtrar em /campanhas
 * usa-se o dropdown da barra de filtros.
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

interface AdAccountListProps {
  adAccounts: MetaAdAccountOption[]
}

export function AdAccountList({ adAccounts }: AdAccountListProps) {
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
          Contas de anúncio sincronizadas
        </h4>
        <span className="text-[10px] text-[var(--color-fg-subtle)]">
          {adAccounts.length} {adAccounts.length === 1 ? 'conta' : 'contas'} · escolha a conta em
          /campanhas via filtro
        </span>
      </header>

      <ul className="max-h-[320px] divide-y divide-[var(--color-border)] overflow-y-auto rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)]">
        {adAccounts.map((acc) => {
          const statusInfo =
            acc.accountStatus !== null
              ? (STATUS_LABELS[acc.accountStatus] ?? {
                  text: `Status ${acc.accountStatus}`,
                  tone: 'text-[var(--color-fg-subtle)]',
                })
              : null

          return (
            <li key={acc.adAccountId} className="flex items-center gap-3 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-[var(--color-fg)]">
                  {acc.adAccountName ?? `Ad Account ${acc.adAccountId}`}
                </p>
                <p className="font-tabular truncate text-[10px] text-[var(--color-fg-subtle)]">
                  ID {acc.adAccountId}
                  {acc.currency ? ` · ${acc.currency}` : ''}
                  {statusInfo ? ' · ' : ''}
                  {statusInfo && <span className={cn(statusInfo.tone)}>{statusInfo.text}</span>}
                </p>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
