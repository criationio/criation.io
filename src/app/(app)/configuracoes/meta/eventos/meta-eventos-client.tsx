'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'

import { updateMetaTestEventCode } from '@/lib/actions/meta-capi'

interface TopEvent {
  eventName: string
  count: number
}

interface Stats {
  totalSent24h: number
  totalFailed24h: number
  totalSkipped24h: number
  totalPending: number
  lastSentAt: string | null
  topEvents7d: TopEvent[]
}

interface Props {
  connected: boolean
  pixelId: string | null
  testEventCode: string | null
  stats: Stats
}

export function MetaEventosClient(props: Props) {
  return (
    <main className="flex flex-1 flex-col px-6 py-8">
      <header className="mb-8 max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight">Eventos de conversão Meta</h1>
        <p className="mt-2 text-sm text-[var(--color-fg-muted)]">
          Envio server-side via Meta CAPI. Todos os eventos capturados pelo script Criation são
          enviados automaticamente com event_id deduplicado, fbp/fbc, IP/UA e external_id (eleva EMQ
          para ≥7). AEM ilimitado desde jun/2025 — sem cap de 8 eventos.
        </p>
      </header>

      {!props.connected ? (
        <NotConnectedFallback />
      ) : (
        <section className="space-y-10">
          <StatusBlock stats={props.stats} pixelId={props.pixelId} />
          <TestModeBlock initial={props.testEventCode} />
          <TopEventsBlock events={props.stats.topEvents7d} />
        </section>
      )}
    </main>
  )
}

// ---------------------------------------------------------------------------

function NotConnectedFallback() {
  return (
    <div className="max-w-2xl rounded-[var(--radius-lg)] border border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] p-6">
      <h2 className="text-base font-semibold text-[var(--color-warning)]">Meta não conectado</h2>
      <p className="mt-2 text-sm text-[var(--color-fg-muted)]">
        Conecte sua conta Meta pra começar o envio CAPI server-side.
      </p>
      <Link
        href="/configuracoes/conexoes"
        className="mt-4 inline-flex items-center rounded-[var(--radius-md)] bg-[var(--color-fg)] px-4 py-2 text-sm font-medium text-[var(--color-bg)] hover:opacity-90"
      >
        Conectar Meta
      </Link>
    </div>
  )
}

function StatusBlock({ stats, pixelId }: { stats: Stats; pixelId: string | null }) {
  const noEvents = stats.totalSent24h + stats.totalFailed24h + stats.totalSkipped24h === 0
  const statusLabel = noEvents ? 'Aguardando eventos' : 'Enviando'
  const statusTone = noEvents
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
        {pixelId && (
          <div>
            <p className="text-[10px] font-medium tracking-wider text-[var(--color-fg-muted)] uppercase">
              Pixel
            </p>
            <p className="mt-1 font-mono text-sm tabular-nums">{pixelId}</p>
          </div>
        )}
        {stats.lastSentAt && (
          <div>
            <p className="text-[10px] font-medium tracking-wider text-[var(--color-fg-muted)] uppercase">
              Último envio
            </p>
            <p className="mt-1 text-sm">{formatDateTime(stats.lastSentAt)}</p>
          </div>
        )}
      </header>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Enviados (24h)" value={stats.totalSent24h} tone="success" />
        <Stat
          label="Falhas (24h)"
          value={stats.totalFailed24h}
          tone={stats.totalFailed24h > 0 ? 'danger' : 'neutral'}
        />
        <Stat
          label="Skipped (24h)"
          value={stats.totalSkipped24h}
          tone="neutral"
          caption="consent denied"
        />
        <Stat
          label="Pendentes (7d)"
          value={stats.totalPending}
          tone={stats.totalPending > 10 ? 'warning' : 'neutral'}
        />
      </dl>
    </section>
  )
}

function Stat({
  label,
  value,
  tone,
  caption,
}: {
  label: string
  value: number
  tone: 'success' | 'danger' | 'warning' | 'neutral'
  caption?: string
}) {
  const toneClass =
    tone === 'success'
      ? 'text-[var(--color-success)]'
      : tone === 'danger'
        ? 'text-[var(--color-danger)]'
        : tone === 'warning'
          ? 'text-[var(--color-warning)]'
          : 'text-[var(--color-fg)]'
  return (
    <div className="rounded-[var(--radius-md)] bg-[var(--color-bg)] p-3">
      <dt className="text-[10px] font-medium tracking-wider text-[var(--color-fg-muted)] uppercase">
        {label}
      </dt>
      <dd className={`mt-1 text-xl font-semibold tabular-nums ${toneClass}`}>
        {value.toLocaleString('pt-BR')}
      </dd>
      {caption && <p className="mt-0.5 text-[10px] text-[var(--color-fg-muted)]">{caption}</p>}
    </div>
  )
}

function TestModeBlock({ initial }: { initial: string | null }) {
  const [code, setCode] = useState(initial ?? '')
  const [pending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; msg: string } | null>(null)

  const enabled = (initial ?? '').length > 0

  function handleSave(newCode: string | null) {
    setFeedback(null)
    startTransition(async () => {
      const result = await updateMetaTestEventCode({ testEventCode: newCode })
      if (result.ok) {
        setFeedback({
          kind: 'success',
          msg: newCode ? `Modo teste ativado (${newCode})` : 'Modo teste desativado',
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
          Quando ativo, eventos são marcados com{' '}
          <code className="font-mono text-xs">test_event_code</code> e aparecem em{' '}
          <strong>Events Manager → Test Events</strong> sem afetar atribuição de campanhas. Use pra
          validar payload antes de ir pra produção.
        </p>
      </header>

      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-4">
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
          {enabled && initial && (
            <code className="font-mono text-xs text-[var(--color-fg)]">{initial}</code>
          )}
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label
              htmlFor="test-event-code"
              className="text-xs font-medium text-[var(--color-fg-muted)]"
            >
              test_event_code (Events Manager → Test Events)
            </label>
            <input
              id="test-event-code"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="TEST12345"
              maxLength={64}
              disabled={pending}
              className="mt-1 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 font-mono text-sm focus:border-[var(--color-fg)] focus:outline-none"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleSave(code.trim() || null)}
              disabled={pending || code.trim() === (initial ?? '')}
              className="rounded-[var(--radius-md)] bg-[var(--color-fg)] px-4 py-2 text-sm font-medium text-[var(--color-bg)] hover:opacity-90 disabled:opacity-50"
            >
              {pending ? 'Salvando…' : enabled ? 'Atualizar' : 'Ativar teste'}
            </button>
            {enabled && (
              <button
                type="button"
                onClick={() => {
                  setCode('')
                  handleSave(null)
                }}
                disabled={pending}
                className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2 text-sm font-medium hover:bg-[var(--color-bg-elevated)] disabled:opacity-50"
              >
                Desativar
              </button>
            )}
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

function TopEventsBlock({ events }: { events: TopEvent[] }) {
  return (
    <section>
      <header className="mb-3">
        <h2 className="text-base font-semibold">Top eventos enviados (7 dias)</h2>
        <p className="mt-1 max-w-2xl text-sm text-[var(--color-fg-muted)]">
          Eventos do script Criation mapeados para nomes canônicos Meta (page_view → PageView,
          purchase → Purchase, etc). Eventos custom não mapeados passam through.
        </p>
      </header>

      {events.length === 0 ? (
        <p className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-6 text-sm text-[var(--color-fg-muted)]">
          Nenhum evento enviado nos últimos 7 dias. Confirme que o script Criation está instalado em{' '}
          <Link href="/configuracoes/tracking-script" className="underline">
            /configuracoes/tracking-script
          </Link>
          .
        </p>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-border)]">
          <table className="w-full text-sm">
            <caption className="sr-only">Top 10 eventos enviados nos últimos 7 dias</caption>
            <thead className="bg-[var(--color-bg-elevated)] text-left text-[10px] font-medium tracking-wider text-[var(--color-fg-muted)] uppercase">
              <tr>
                <th scope="col" className="px-4 py-2">
                  Evento
                </th>
                <th scope="col" className="px-4 py-2 text-right">
                  Contagem
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {events.map((e) => (
                <tr key={e.eventName}>
                  <td className="px-4 py-2 font-mono">{e.eventName}</td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {e.count.toLocaleString('pt-BR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function formatDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}
