'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'

import {
  deleteGoogleConversionActionMapping,
  setDefaultGoogleAdsAccount,
  toggleGoogleTestMode,
  upsertGoogleConversionActionMapping,
} from '@/lib/actions/google-conversoes'

// Lista canonica de event names Criation que podem ser mapeados.
// Mantida alinhada com src/lib/services/capi/meta.adapter.ts (event-name mapping).
const CRIATION_EVENT_NAMES = [
  'page_view',
  'view_content',
  'add_to_cart',
  'initiate_checkout',
  'add_payment_info',
  'purchase',
  'lead',
  'complete_registration',
  'search',
  'subscribe',
  'contact',
] as const

interface ConversionAction {
  id: string
  name: string
  type?: string | null
  category?: string | null
}

interface Account {
  id: string
  customerId: string
  customerDescriptiveName: string | null
  managerCustomerId: string | null
  currencyCode: string | null
  timeZone: string | null
  isTestAccount: boolean
  isManager: boolean
  isDefault: boolean
  conversionActions: ConversionAction[]
}

interface Mapping {
  id: string
  googleAdsAccountId: string
  internalEventName: string
  productDestinationId: string
  conversionActionName: string | null
  conversionActionType: string | null
  isPrimary: boolean
  isEnabled: boolean
}

interface Props {
  connected: boolean
  testMode: boolean
  googleUserEmail: string | null
  googleUserName: string | null
  grantedDataManagerScope: boolean
  grantedAdsScope: boolean
  accounts: Account[]
  mappings: Mapping[]
}

export function GoogleConversoesClient(props: Props) {
  return (
    <main className="flex flex-1 flex-col px-6 py-8">
      <header className="mb-8 max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight">Conversões Google Ads</h1>
        <p className="mt-2 text-sm text-[var(--color-fg-muted)]">
          Envio server-side via Data Manager API (ADR-015). Selecione a conta Google Ads default,
          mapeie eventos Criation para conversion actions, e use modo teste pra validar payload
          antes de produção. Match rate baseline disponível após validação shadow.
        </p>
      </header>

      {!props.connected ? (
        <NotConnectedFallback />
      ) : (
        <section className="space-y-10">
          <StatusBlock
            googleUserEmail={props.googleUserEmail}
            googleUserName={props.googleUserName}
            grantedDataManagerScope={props.grantedDataManagerScope}
            grantedAdsScope={props.grantedAdsScope}
            testMode={props.testMode}
            accountsCount={props.accounts.length}
            mappingsCount={props.mappings.filter((m) => m.isEnabled).length}
          />
          <AccountPicker accounts={props.accounts} />
          <MappingsBlock accounts={props.accounts} mappings={props.mappings} />
          <TestModeBlock enabled={props.testMode} />
        </section>
      )}
    </main>
  )
}

// ---------------------------------------------------------------------------

function NotConnectedFallback() {
  return (
    <div className="max-w-2xl rounded-[var(--radius-lg)] border border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] p-6">
      <h2 className="text-base font-semibold text-[var(--color-warning)]">Google não conectado</h2>
      <p className="mt-2 text-sm text-[var(--color-fg-muted)]">
        Conecte sua conta Google pra começar o envio de conversões server-side via Data Manager API.
      </p>
      <Link
        href="/configuracoes/conexoes"
        className="mt-4 inline-flex items-center rounded-[var(--radius-md)] bg-[var(--color-fg)] px-4 py-2 text-sm font-medium text-[var(--color-bg)] hover:opacity-90"
      >
        Conectar Google
      </Link>
    </div>
  )
}

function StatusBlock(props: {
  googleUserEmail: string | null
  googleUserName: string | null
  grantedDataManagerScope: boolean
  grantedAdsScope: boolean
  testMode: boolean
  accountsCount: number
  mappingsCount: number
}) {
  const scopesOk = props.grantedDataManagerScope && props.grantedAdsScope
  const statusLabel = !scopesOk
    ? 'Scopes incompletos'
    : props.testMode
      ? 'Modo teste'
      : props.accountsCount === 0
        ? 'Sem contas'
        : props.mappingsCount === 0
          ? 'Sem mappings'
          : 'Pronto'
  const statusTone =
    !scopesOk || props.accountsCount === 0 || props.mappingsCount === 0
      ? 'bg-[var(--color-warning-bg)] text-[var(--color-warning)] border-[var(--color-warning-border)]'
      : props.testMode
        ? 'bg-[var(--color-warning-bg)] text-[var(--color-warning)] border-[var(--color-warning-border)]'
        : 'bg-[var(--color-success-bg)] text-[var(--color-success)] border-[var(--color-success-border)]'

  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-4">
      <header className="mb-3 flex flex-wrap items-center gap-4">
        <div>
          <p className="text-[10px] font-medium tracking-wider text-[var(--color-fg-muted)] uppercase">
            Status
          </p>
          <span
            className={`mt-1 inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusTone}`}
          >
            {statusLabel}
          </span>
        </div>
        {props.googleUserEmail && (
          <div>
            <p className="text-[10px] font-medium tracking-wider text-[var(--color-fg-muted)] uppercase">
              Conta Google
            </p>
            <p className="mt-1 text-sm">
              {props.googleUserName}{' '}
              <span className="text-[var(--color-fg-muted)]">({props.googleUserEmail})</span>
            </p>
          </div>
        )}
        <div>
          <p className="text-[10px] font-medium tracking-wider text-[var(--color-fg-muted)] uppercase">
            Scopes
          </p>
          <p className="mt-1 text-sm">
            <ScopeBadge ok={props.grantedAdsScope} label="adwords" />{' '}
            <ScopeBadge ok={props.grantedDataManagerScope} label="datamanager" />
          </p>
        </div>
      </header>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Contas Google Ads" value={props.accountsCount} />
        <Stat label="Mappings ativos" value={props.mappingsCount} />
        <Stat label="Modo teste" value={props.testMode ? 'ON' : 'OFF'} />
      </dl>
    </section>
  )
}

function ScopeBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-1.5 py-0.5 font-mono text-[10px] ${
        ok
          ? 'border-[var(--color-success-border)] bg-[var(--color-success-bg)] text-[var(--color-success)]'
          : 'border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] text-[var(--color-danger)]'
      }`}
    >
      {ok ? '✓' : '×'} {label}
    </span>
  )
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-[var(--radius-md)] bg-[var(--color-bg)] p-3">
      <dt className="text-[10px] font-medium tracking-wider text-[var(--color-fg-muted)] uppercase">
        {label}
      </dt>
      <dd className="mt-1 text-xl font-semibold tabular-nums">{value}</dd>
    </div>
  )
}

// ---------------------------------------------------------------------------

function AccountPicker({ accounts }: { accounts: Account[] }) {
  const [pending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; msg: string } | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)

  function handleSetDefault(accountId: string) {
    setFeedback(null)
    setActiveId(accountId)
    startTransition(async () => {
      const result = await setDefaultGoogleAdsAccount({ accountId })
      if (result.ok) {
        setFeedback({ kind: 'success', msg: 'Conta default atualizada' })
      } else {
        setFeedback({ kind: 'error', msg: result.error.message })
      }
      setActiveId(null)
    })
  }

  return (
    <section>
      <header className="mb-3">
        <h2 className="text-base font-semibold">Conta Google Ads default</h2>
        <p className="mt-1 max-w-2xl text-sm text-[var(--color-fg-muted)]">
          Quando o mapping não especifica account, fanout usa a default. Multi-customer (Agency)
          aparece quando MCC tem várias contas filhas — selecione qual receber conversões.
        </p>
      </header>

      {accounts.length === 0 ? (
        <p className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-6 text-sm text-[var(--color-fg-muted)]">
          Nenhuma conta Google Ads disponível. Re-conecte se autorizou recentemente uma nova
          MCC/customer.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-border)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--color-bg-elevated)] text-left text-[10px] font-medium tracking-wider text-[var(--color-fg-muted)] uppercase">
              <tr>
                <th scope="col" className="px-4 py-2">
                  Customer ID
                </th>
                <th scope="col" className="px-4 py-2">
                  Nome
                </th>
                <th scope="col" className="px-4 py-2">
                  Moeda
                </th>
                <th scope="col" className="px-4 py-2">
                  Tags
                </th>
                <th scope="col" className="px-4 py-2 text-right">
                  Ação
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {accounts.map((a) => (
                <tr key={a.id}>
                  <td className="px-4 py-2 font-mono">{a.customerId}</td>
                  <td className="px-4 py-2">{a.customerDescriptiveName ?? '—'}</td>
                  <td className="px-4 py-2 font-mono text-xs">{a.currencyCode ?? '—'}</td>
                  <td className="px-4 py-2 text-xs">
                    {a.isManager && <Tag>MCC</Tag>} {a.isTestAccount && <Tag>TESTE</Tag>}{' '}
                    {a.isDefault && <Tag tone="success">DEFAULT</Tag>}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {a.isDefault ? (
                      <span className="text-xs text-[var(--color-fg-muted)]">selecionada</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSetDefault(a.id)}
                        disabled={pending}
                        className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1 text-xs font-medium hover:bg-[var(--color-bg-elevated)] disabled:opacity-50"
                      >
                        {pending && activeId === a.id ? 'Salvando…' : 'Tornar default'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {feedback && (
        <p
          role="status"
          aria-live="polite"
          className={`mt-3 text-xs ${
            feedback.kind === 'success'
              ? 'text-[var(--color-success)]'
              : 'text-[var(--color-danger)]'
          }`}
        >
          {feedback.msg}
        </p>
      )}
    </section>
  )
}

function Tag({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode
  tone?: 'success' | 'neutral'
}) {
  const toneClass =
    tone === 'success'
      ? 'border-[var(--color-success-border)] bg-[var(--color-success-bg)] text-[var(--color-success)]'
      : 'border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-fg-muted)]'
  return (
    <span
      className={`inline-flex items-center rounded-full border px-1.5 py-0.5 font-mono text-[10px] ${toneClass}`}
    >
      {children}
    </span>
  )
}

// ---------------------------------------------------------------------------

function MappingsBlock({ accounts, mappings }: { accounts: Account[]; mappings: Mapping[] }) {
  const defaultAccount = accounts.find((a) => a.isDefault) ?? accounts[0] ?? null

  return (
    <section>
      <header className="mb-3">
        <h2 className="text-base font-semibold">Mapping de eventos → conversion actions</h2>
        <p className="mt-1 max-w-2xl text-sm text-[var(--color-fg-muted)]">
          Para cada evento Criation que você quer enviar pro Google, escolha qual conversion action
          ele dispara. Sem mapping ativo, fanout pula esse evento.{' '}
          <code className="font-mono text-xs">productDestinationId</code> = conversion_action_id
          Google (ADR-015 vocabulário Data Manager API).
        </p>
      </header>

      {!defaultAccount ? (
        <p className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-6 text-sm text-[var(--color-fg-muted)]">
          Selecione uma conta default primeiro.
        </p>
      ) : defaultAccount.conversionActions.length === 0 ? (
        <p className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] px-4 py-6 text-sm text-[var(--color-warning)]">
          A conta default ({defaultAccount.customerId}) não tem conversion actions cadastradas. Crie
          em Google Ads → Tools → Conversions e depois re-conecte pra atualizar a lista aqui.
        </p>
      ) : (
        <div className="space-y-2">
          {CRIATION_EVENT_NAMES.map((eventName) => (
            <MappingRow
              key={eventName}
              eventName={eventName}
              account={defaultAccount}
              mapping={
                mappings.find(
                  (m) =>
                    m.internalEventName === eventName && m.googleAdsAccountId === defaultAccount.id
                ) ?? null
              }
            />
          ))}
        </div>
      )}
    </section>
  )
}

function MappingRow({
  eventName,
  account,
  mapping,
}: {
  eventName: string
  account: Account
  mapping: Mapping | null
}) {
  const [pending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string>(mapping?.productDestinationId ?? '')
  const [isEnabled, setIsEnabled] = useState<boolean>(mapping?.isEnabled ?? true)

  function handleSave() {
    if (!selectedId) return
    setFeedback(null)
    const selected = account.conversionActions.find((c) => c.id === selectedId)
    startTransition(async () => {
      const result = await upsertGoogleConversionActionMapping({
        googleAdsAccountId: account.id,
        internalEventName: eventName,
        productDestinationId: selectedId,
        conversionActionName: selected?.name ?? null,
        conversionActionType: selected?.type ?? null,
        isEnabled,
      })
      setFeedback(result.ok ? 'salvo' : `erro: ${result.error.message}`)
    })
  }

  function handleDelete() {
    if (!mapping) return
    setFeedback(null)
    startTransition(async () => {
      const result = await deleteGoogleConversionActionMapping({ mappingId: mapping.id })
      setFeedback(result.ok ? 'removido' : `erro: ${result.error.message}`)
      if (result.ok) {
        setSelectedId('')
        setIsEnabled(true)
      }
    })
  }

  const dirty =
    selectedId !== (mapping?.productDestinationId ?? '') ||
    isEnabled !== (mapping?.isEnabled ?? true)

  return (
    <div className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-3 sm:flex-row sm:items-center">
      <div className="min-w-[140px] font-mono text-xs">{eventName}</div>

      <select
        value={selectedId}
        onChange={(e) => setSelectedId(e.target.value)}
        disabled={pending}
        className="flex-1 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-sm focus:border-[var(--color-fg)] focus:outline-none"
      >
        <option value="">— não mapeado —</option>
        {account.conversionActions.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name} {c.type ? `(${c.type})` : ''}
          </option>
        ))}
      </select>

      {mapping && (
        <label className="flex items-center gap-1 text-xs text-[var(--color-fg-muted)]">
          <input
            type="checkbox"
            checked={isEnabled}
            onChange={(e) => setIsEnabled(e.target.checked)}
            disabled={pending}
          />
          Ativo
        </label>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={pending || !selectedId || !dirty}
          className="rounded-[var(--radius-md)] bg-[var(--color-fg)] px-3 py-1.5 text-xs font-medium text-[var(--color-bg)] hover:opacity-90 disabled:opacity-30"
        >
          {pending ? '…' : mapping ? 'Atualizar' : 'Salvar'}
        </button>
        {mapping && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={pending}
            className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-xs font-medium text-[var(--color-fg-muted)] hover:bg-[var(--color-bg-elevated)] disabled:opacity-30"
          >
            Remover
          </button>
        )}
      </div>

      {feedback && (
        <span role="status" aria-live="polite" className="text-[10px] text-[var(--color-fg-muted)]">
          {feedback}
        </span>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------

function TestModeBlock({ enabled }: { enabled: boolean }) {
  const [pending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; msg: string } | null>(null)

  function handleToggle(next: boolean) {
    setFeedback(null)
    startTransition(async () => {
      const result = await toggleGoogleTestMode({ enabled: next })
      if (result.ok) {
        setFeedback({
          kind: 'success',
          msg: next ? 'Modo teste ativado (validateOnly)' : 'Modo teste desativado',
        })
      } else {
        setFeedback({ kind: 'error', msg: result.error.message })
      }
    })
  }

  return (
    <section>
      <header className="mb-3">
        <h2 className="text-base font-semibold">Modo teste</h2>
        <p className="mt-1 max-w-2xl text-sm text-[var(--color-fg-muted)]">
          Quando ativo, eventos vão com{' '}
          <code className="font-mono text-xs">validateOnly: true</code> no payload pra Data Manager
          API — Google valida estrutura mas <strong>não conta como conversão</strong>. Equivalente
          ao <code className="font-mono text-xs">test_event_code</code> do Meta.
        </p>
      </header>

      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                enabled
                  ? 'border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] text-[var(--color-warning)]'
                  : 'border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-fg-muted)]'
              }`}
            >
              {enabled ? 'TESTE ATIVO' : 'Produção'}
            </span>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleToggle(!enabled)}
              disabled={pending}
              className={
                enabled
                  ? 'rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2 text-sm font-medium hover:bg-[var(--color-bg-elevated)] disabled:opacity-50'
                  : 'rounded-[var(--radius-md)] bg-[var(--color-fg)] px-4 py-2 text-sm font-medium text-[var(--color-bg)] hover:opacity-90 disabled:opacity-50'
              }
            >
              {pending ? 'Salvando…' : enabled ? 'Desativar teste' : 'Ativar teste'}
            </button>
          </div>
        </div>

        {feedback && (
          <p
            role="status"
            aria-live="polite"
            className={`mt-3 text-xs ${
              feedback.kind === 'success'
                ? 'text-[var(--color-success)]'
                : 'text-[var(--color-danger)]'
            }`}
          >
            {feedback.msg}
          </p>
        )}
      </div>
    </section>
  )
}
