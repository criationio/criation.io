'use client'

import { Check, Copy, Trash2 } from 'lucide-react'
import { useState, useTransition } from 'react'

import { addAllowedOrigin, removeAllowedOrigin } from '@/lib/actions/tracking'

interface RecentEvent {
  id: string
  eventName: string
  eventTs: string
  visitorId: string
  pageUrl: string | null
  utmSource: string | null
}

interface Status {
  installed: boolean
  lastEventAt: string | null
  totalEvents24h: number
}

interface Props {
  snippet: string
  scriptUrl: string
  workspaceId: string
  status: Status
  originAllowlist: string[]
  recentEvents: RecentEvent[]
}

export function TrackingScriptClient(props: Props) {
  return (
    <main className="flex flex-1 flex-col px-6 py-8">
      <header className="mb-8 max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight">Script de rastreamento</h1>
        <p className="mt-2 text-sm text-[var(--color-fg-muted)]">
          Cole este script no <code className="font-mono">&lt;head&gt;</code> da landing. Captura
          visitor_id first-party, UTMs, click IDs, page_view automático, scroll, formulários e
          enriquece links de checkout. Substitui Pixel + GTM + Stape com 1 tag.
        </p>
      </header>

      <section className="space-y-10">
        <StatusBlock status={props.status} />
        <SnippetBlock snippet={props.snippet} />
        <OriginAllowlistBlock initial={props.originAllowlist} />
        <CustomEventsBlock />
        <RecentEventsBlock events={props.recentEvents} />
      </section>
    </main>
  )
}

// ---------------------------------------------------------------------------

function StatusBlock({ status }: { status: Status }) {
  const label = status.installed ? 'Recebendo eventos' : 'Aguardando 1º evento'
  const color = status.installed
    ? 'bg-[var(--color-success-bg)] text-[var(--color-success)] border-[var(--color-success-border)]'
    : 'bg-[var(--color-warning-bg)] text-[var(--color-warning)] border-[var(--color-warning-border)]'

  return (
    <div className="flex flex-wrap items-center gap-6 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-4">
      <div>
        <p className="text-[10px] font-medium tracking-wider text-[var(--color-fg-muted)] uppercase">
          Status
        </p>
        <span
          className={`mt-1 inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${color}`}
        >
          {label}
        </span>
      </div>
      <Divider />
      <div>
        <p className="text-[10px] font-medium tracking-wider text-[var(--color-fg-muted)] uppercase">
          Eventos (24h)
        </p>
        <p className="mt-1 text-lg font-semibold tabular-nums">
          {status.totalEvents24h.toLocaleString('pt-BR')}
        </p>
      </div>
      <Divider />
      <div>
        <p className="text-[10px] font-medium tracking-wider text-[var(--color-fg-muted)] uppercase">
          Último evento
        </p>
        <p className="mt-1 text-sm text-[var(--color-fg)]">
          {status.lastEventAt ? new Date(status.lastEventAt).toLocaleString('pt-BR') : '—'}
        </p>
      </div>
    </div>
  )
}

function Divider() {
  return <div className="hidden h-10 w-px bg-[var(--color-border)] sm:block" />
}

// ---------------------------------------------------------------------------

function SnippetBlock({ snippet }: { snippet: string }) {
  const [copied, setCopied] = useState(false)
  async function handleCopy() {
    await navigator.clipboard.writeText(snippet)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <div>
      <h2 className="mb-3 text-base font-medium">Snippet</h2>
      <p className="mb-3 text-xs text-[var(--color-fg-muted)]">
        Workspace_id já embutido. Cole no <code className="font-mono">&lt;head&gt;</code> de cada
        página de origem (landing, blog, qualquer página que leve a checkout).
      </p>
      <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-3">
        <code className="flex-1 font-mono text-xs break-all">{snippet}</code>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex h-8 items-center gap-1 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] px-2 text-xs transition hover:border-[var(--color-border-strong)]"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? 'Copiado' : 'Copiar'}
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------

function OriginAllowlistBlock({ initial }: { initial: string[] }) {
  const [list, setList] = useState(initial)
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleAdd() {
    const v = value.trim()
    if (!v) return
    setError(null)
    startTransition(async () => {
      const res = await addAllowedOrigin(v)
      if (!res.ok) {
        setError(res.error.message)
        return
      }
      setList(res.data.originAllowlist)
      setValue('')
    })
  }

  function handleRemove(origin: string) {
    startTransition(async () => {
      const res = await removeAllowedOrigin(origin)
      if (res.ok) setList(res.data.originAllowlist)
    })
  }

  return (
    <div>
      <h2 className="mb-2 text-base font-medium">Origens permitidas</h2>
      <p className="mb-4 text-xs text-[var(--color-fg-muted)]">
        Lista de domínios que podem postar eventos. Deixe vazio durante onboarding (aceita qualquer
        origem). Quando configurar, só estes vão passar. Suporta{' '}
        <code className="font-mono">cliente.com</code> (inclui subdomínios) e{' '}
        <code className="font-mono">*.cliente.com</code> (só subdomínios).
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="app.cliente.com ou *.cliente.com"
          className="flex-1 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 font-mono text-xs focus:border-[var(--color-border-strong)] focus:outline-none"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={pending}
          className="inline-flex h-9 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-4 text-xs font-medium transition hover:border-[var(--color-border-strong)] disabled:opacity-50"
        >
          Adicionar
        </button>
      </div>
      <p
        className="mt-2 min-h-[1rem] text-xs text-[var(--color-danger)]"
        role="status"
        aria-live="polite"
      >
        {error}
      </p>
      {list.length > 0 && (
        <ul className="mt-4 flex flex-col gap-1.5">
          {list.map((origin) => (
            <li
              key={origin}
              className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2"
            >
              <code className="font-mono text-xs">{origin}</code>
              <button
                type="button"
                onClick={() => handleRemove(origin)}
                disabled={pending}
                className="text-[var(--color-fg-muted)] transition hover:text-[var(--color-danger)] disabled:opacity-50"
                aria-label={`Remover ${origin}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {list.length === 0 && (
        <p className="mt-3 text-xs text-[var(--color-fg-subtle)]">
          Nenhuma origem configurada — qualquer domínio pode postar (modo onboarding).
        </p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------

function CustomEventsBlock() {
  return (
    <div>
      <h2 className="mb-2 text-base font-medium">Eventos custom</h2>
      <p className="mb-3 text-xs text-[var(--color-fg-muted)]">
        Page_view, scroll, form_submit já são capturados automaticamente. Pra eventos custom no
        código:
      </p>
      <pre className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-3 font-mono text-[11px]">
        {`// Em qualquer ponto da sua landing
window.criation('track', 'video_play', { video_id: 'vsl_v3' })
window.criation('track', 'initiate_checkout', { value: 497, currency: 'BRL' })

// Identifica o visitor quando email é capturado (form, lead-magnet, etc)
window.criation('identify', 'comprador@example.com')`}
      </pre>
      <p className="mt-3 text-xs text-[var(--color-fg-muted)]">
        Ou via atributo HTML (sem código):
      </p>
      <pre className="mt-2 overflow-x-auto rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-3 font-mono text-[11px]">
        {`<button data-criation-event="cta_clicked" data-criation-position="hero">
  Quero começar
</button>`}
      </pre>
    </div>
  )
}

// ---------------------------------------------------------------------------

function RecentEventsBlock({ events }: { events: RecentEvent[] }) {
  if (events.length === 0) {
    return (
      <div>
        <h2 className="mb-2 text-base font-medium">Eventos recentes</h2>
        <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-6 text-center text-xs text-[var(--color-fg-muted)]">
          Nenhum evento ainda. Quando o script disparar o primeiro page_view, ele aparece aqui em
          segundos.
        </div>
      </div>
    )
  }
  return (
    <div>
      <h2 className="mb-2 text-base font-medium">
        Eventos recentes <span className="text-xs text-[var(--color-fg-muted)]">(últimos 20)</span>
      </h2>
      <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)]">
        <table className="w-full text-xs">
          <caption className="sr-only">
            Últimos 20 eventos recebidos pelo endpoint /api/v1/track
          </caption>
          <thead className="border-b border-[var(--color-border)] bg-[var(--color-bg-elevated)] text-[10px] font-medium tracking-wider text-[var(--color-fg-muted)] uppercase">
            <tr>
              <th scope="col" className="px-3 py-2 text-left">
                Quando
              </th>
              <th scope="col" className="px-3 py-2 text-left">
                Evento
              </th>
              <th scope="col" className="px-3 py-2 text-left">
                Visitor
              </th>
              <th scope="col" className="px-3 py-2 text-left">
                UTM source
              </th>
              <th scope="col" className="px-3 py-2 text-left">
                Página
              </th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id} className="border-b border-[var(--color-border)] last:border-0">
                <td className="px-3 py-2 whitespace-nowrap text-[var(--color-fg-muted)]">
                  {new Date(e.eventTs).toLocaleTimeString('pt-BR')}
                </td>
                <td className="px-3 py-2 font-mono">{e.eventName}</td>
                <td className="px-3 py-2 font-mono text-[var(--color-fg-muted)]">
                  {e.visitorId.slice(0, 8)}…
                </td>
                <td className="px-3 py-2 font-mono">{e.utmSource ?? '—'}</td>
                <td className="truncate px-3 py-2 text-[var(--color-fg-muted)]">
                  <span className="block max-w-[280px] truncate">{e.pageUrl ?? '—'}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
