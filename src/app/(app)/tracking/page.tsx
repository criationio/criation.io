import Link from 'next/link'
import { redirect } from 'next/navigation'
import { and, eq, ne, sql } from 'drizzle-orm'
import { Activity, FileCode2, Plug2, Radio, Target } from 'lucide-react'

// Revalidate cache server-side 60s. Stats e recent events nao mudam por
// segundo; tradeoff entre frescor (workspace ve "Enviados 24h" levemente
// atrasado) e DB load (6 queries por request em workspace ativo).
export const revalidate = 60

import { db } from '@/lib/db'
import {
  getGoogleFanoutStats,
  getMetaFanoutStats,
  getRecentCapiEvents,
  getRecentGoogleCapiEvents,
} from '@/lib/db/queries/capi'
import { getActiveConnection, listActiveConnections } from '@/lib/db/queries/connections'
import { getInstallationStatus, getRecentEventsForWorkspace } from '@/lib/db/queries/tracking'
import { users, workspaceMembers } from '@/lib/db/schema/auth'
import { gatewayEvents, utmMappings } from '@/lib/db/schema/gateway'
import { getUser } from '@/lib/supabase/server'

export default async function TrackingOverviewPage() {
  const user = await getUser()
  if (!user) redirect('/login')

  const userRow = await db.query.users.findFirst({ where: eq(users.id, user.id) })
  let workspaceId = userRow?.defaultWorkspaceId ?? null
  if (!workspaceId) {
    const membership = await db.query.workspaceMembers.findFirst({
      where: eq(workspaceMembers.userId, user.id),
    })
    workspaceId = membership?.workspaceId ?? null
  }
  if (!workspaceId) redirect('/bem-vindo')

  const [
    status,
    cdpConnection,
    gatewayConnections,
    recentEvents,
    mappingsCount,
    matchedCount,
    fanoutStats,
    recentCapiEvents,
    googleFanoutStats,
    recentGoogleCapiEvents,
  ] = await Promise.all([
    getInstallationStatus(workspaceId),
    getActiveConnection(workspaceId, 'criation_cdp', 'analytics'),
    listActiveConnections({ workspaceId, type: 'gateway' }),
    getRecentEventsForWorkspace(workspaceId, 10),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(utmMappings)
      .where(eq(utmMappings.workspaceId, workspaceId))
      .then((r) => r[0]?.count ?? 0),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(gatewayEvents)
      .where(
        and(
          eq(gatewayEvents.workspaceId, workspaceId),
          ne(gatewayEvents.matchStrategy, 'unmatched')
        )
      )
      .then((r) => r[0]?.count ?? 0),
    getMetaFanoutStats(workspaceId),
    getRecentCapiEvents(workspaceId, 10),
    getGoogleFanoutStats(workspaceId),
    getRecentGoogleCapiEvents(workspaceId, 10),
  ])

  const scriptInstalled = status.installed
  const cdpConfigured = !!cdpConnection
  const gatewaysConnected = gatewayConnections.length
  const attributionWorking = matchedCount > 0 || mappingsCount > 0
  const fanoutActive = fanoutStats.totalSent24h > 0 || fanoutStats.lastSentAt !== null
  const googleFanoutActive =
    googleFanoutStats.totalSent24h > 0 || googleFanoutStats.lastSentAt !== null
  const lastEventLabel = status.lastEventAt
    ? new Date(status.lastEventAt).toLocaleString('pt-BR')
    : '—'

  return (
    <main className="flex flex-1 flex-col px-6 py-8">
      <header className="mb-8 max-w-3xl">
        <div className="mb-2 inline-flex items-center gap-2">
          <span className="rounded-full bg-[var(--color-accent-subtle)] px-2 py-0.5 text-[10px] font-semibold tracking-wider text-[var(--color-accent)] uppercase">
            CDP
          </span>
          <span className="text-xs text-[var(--color-fg-muted)]">Customer Data Platform</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Tracking</h1>
        <p className="mt-2 text-sm text-[var(--color-fg-muted)]">
          Visão consolidada da camada de captura, atribuição e fanout server-side da Criation.
          Substitui Pixel + GTM + Stape com 1 script.
        </p>
      </header>

      <section className="mb-10 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Status"
          value={scriptInstalled ? 'Recebendo eventos' : 'Aguardando'}
          tone={scriptInstalled ? 'success' : 'warning'}
        />
        <StatCard
          label="Eventos (24h)"
          value={status.totalEvents24h.toLocaleString('pt-BR')}
          tone="neutral"
        />
        <StatCard label="Último evento" value={lastEventLabel} tone="neutral" small />
        {gatewaysConnected > 0 ? (
          <StatCard label="Gateways conectados" value={String(gatewaysConnected)} tone="success" />
        ) : (
          <StatCard
            label="Gateways conectados"
            value="0"
            tone="danger"
            cta={{ href: '/configuracoes/conexoes', label: 'Conectar' }}
          />
        )}
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-base font-medium">Pipeline</h2>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
          <PipelineStep
            n={1}
            label="Captura"
            sub="Tracking script"
            href="/configuracoes/tracking-script"
            icon={FileCode2}
            done={cdpConfigured && scriptInstalled}
            ready={cdpConfigured}
          />
          <PipelineStep
            n={2}
            label="Atribuição"
            sub="UTM Stitcher"
            href="/configuracoes/atribuicao"
            icon={Target}
            done={attributionWorking}
            ready
            note={
              attributionWorking
                ? `${matchedCount} vendas atribuídas · ${mappingsCount} mappings`
                : 'Sem vendas atribuídas ainda'
            }
          />
          <PipelineStep
            n={3}
            label="Reconciliação"
            sub="Visitor ↔ Buyer"
            href="/configuracoes/conexoes"
            icon={Plug2}
            done={gatewaysConnected > 0}
            ready
            note="Sessão 1.4.B"
          />
          <PipelineStep
            n={4}
            label="Fanout"
            sub="Meta + Google server-side"
            href="/configuracoes/meta/eventos"
            icon={Radio}
            done={fanoutActive || googleFanoutActive}
            ready={cdpConfigured}
            note={
              fanoutActive || googleFanoutActive
                ? `Meta ${fanoutStats.totalSent24h.toLocaleString('pt-BR')} · Google ${googleFanoutStats.totalSent24h.toLocaleString('pt-BR')}`
                : 'Aguardando 1º envio'
            }
          />
        </div>
      </section>

      <FanoutSection stats={fanoutStats} recent={recentCapiEvents} />
      <GoogleFanoutSection stats={googleFanoutStats} recent={recentGoogleCapiEvents} />

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h2 className="mb-3 text-base font-medium">Eventos recentes</h2>
          {recentEvents.length === 0 ? (
            <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-6 text-center text-xs text-[var(--color-fg-muted)]">
              Nenhum evento ainda.{' '}
              <Link
                href="/configuracoes/tracking-script"
                className="text-[var(--color-accent)] hover:underline"
              >
                Instale o script
              </Link>{' '}
              pra começar a capturar.
            </div>
          ) : (
            <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)]">
              <table className="w-full text-xs">
                <caption className="sr-only">
                  Últimos 10 eventos browser capturados pelo CDP
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
                      UTM source
                    </th>
                    <th scope="col" className="px-3 py-2 text-left">
                      Visitor
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {recentEvents.map((e) => {
                    const utms = (e.utms as Record<string, string | null>) ?? {}
                    return (
                      <tr
                        key={e.id}
                        className="border-b border-[var(--color-border)] last:border-0"
                      >
                        <td className="px-3 py-2 whitespace-nowrap text-[var(--color-fg-muted)]">
                          {new Date(e.eventTs).toLocaleTimeString('pt-BR')}
                        </td>
                        <td className="px-3 py-2 font-mono">{e.eventName}</td>
                        <td className="px-3 py-2 font-mono">{utms.utm_source ?? '—'}</td>
                        <td className="px-3 py-2 font-mono text-[var(--color-fg-muted)]">
                          {e.visitorId.slice(0, 8)}…
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <aside>
          <h2 className="mb-3 text-base font-medium">Atalhos</h2>
          <ul className="space-y-1.5">
            <QuickLink
              href="/configuracoes/tracking-script"
              icon={FileCode2}
              label="Script de rastreio"
              hint="Snippet + status + allowlist"
            />
            <QuickLink
              href="/configuracoes/atribuicao"
              icon={Target}
              label="Atribuição UTM"
              hint="Mappings + convenção"
            />
            <QuickLink
              href="/utm-builder"
              icon={Activity}
              label="UTM Builder"
              hint="Gerador + Health Score"
            />
            <QuickLink
              href="/configuracoes/meta/eventos"
              icon={Radio}
              label="CAPI Meta"
              hint="Fanout Meta + modo teste"
            />
            <QuickLink
              href="/configuracoes/google/conversoes"
              icon={Radio}
              label="CAPI Google"
              hint="Fanout Google + Data Manager"
            />
            <QuickLink
              href="/configuracoes/conexoes"
              icon={Plug2}
              label="Conexões"
              hint="Gateways + Meta + CDP"
            />
          </ul>
        </aside>
      </section>
    </main>
  )
}

// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  tone,
  small,
  cta,
}: {
  label: string
  value: string
  tone: 'success' | 'warning' | 'danger' | 'neutral'
  small?: boolean
  cta?: { href: string; label: string }
}) {
  const toneClass =
    tone === 'success'
      ? 'text-[var(--color-success)]'
      : tone === 'warning'
        ? 'text-[var(--color-warning)]'
        : tone === 'danger'
          ? 'text-[var(--color-danger)]'
          : 'text-[var(--color-fg)]'

  const borderClass =
    tone === 'danger'
      ? 'border-[var(--color-danger-border)] bg-[var(--color-danger-bg)]'
      : 'border-[var(--color-border)] bg-[var(--color-bg-elevated)]'

  return (
    <dl className={`rounded-[var(--radius-lg)] border p-4 ${borderClass}`}>
      <dt className="text-[10px] font-medium tracking-wider text-[var(--color-fg-muted)] uppercase">
        {label}
      </dt>
      <dd
        className={`mt-1 font-semibold tabular-nums ${toneClass} ${small ? 'text-sm' : 'text-xl'}`}
      >
        {value}
      </dd>
      {cta && (
        <Link
          href={cta.href}
          className="mt-2 inline-flex items-center text-[10px] font-medium text-[var(--color-accent)] hover:underline"
        >
          {cta.label} →
        </Link>
      )}
    </dl>
  )
}

function PipelineStep({
  n,
  label,
  sub,
  href,
  icon: Icon,
  done,
  ready,
  note,
}: {
  n: number
  label: string
  sub: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  done: boolean
  ready: boolean
  note?: string
}) {
  const stateColor = done
    ? 'border-[var(--color-success-border)] bg-[var(--color-success-bg)]'
    : ready
      ? 'border-[var(--color-warning-border)] bg-[var(--color-warning-bg)]'
      : 'border-dashed border-[var(--color-border)] bg-[var(--color-bg-elevated)]'

  return (
    <Link
      href={href}
      className={`group flex items-start gap-3 rounded-[var(--radius-lg)] border p-4 transition hover:border-[var(--color-border-strong)] ${stateColor}`}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] font-mono text-[10px] text-[var(--color-fg-muted)]">
        {n}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Icon className="h-3.5 w-3.5 text-[var(--color-fg-muted)]" />
          <p className="text-sm font-medium">{label}</p>
        </div>
        <p className="mt-0.5 text-[11px] text-[var(--color-fg-muted)]">{sub}</p>
        {note && <p className="mt-1 text-[10px] text-[var(--color-fg-subtle)]">{note}</p>}
      </div>
    </Link>
  )
}

function FanoutSection({
  stats,
  recent,
}: {
  stats: {
    totalSent24h: number
    totalFailed24h: number
    totalSkipped24h: number
    totalPending: number
    lastSentAt: Date | null
    topEvents7d: Array<{ eventName: string; count: number }>
  }
  recent: Array<{
    id: string
    eventName: string
    eventTime: Date
    status: string
    pixelId: string | null
    actionSource: string | null
  }>
}) {
  const noActivity = stats.totalSent24h + stats.totalFailed24h + stats.totalSkipped24h === 0

  return (
    <section className="mb-10">
      <header className="mb-3 flex items-baseline justify-between gap-4">
        <div>
          <h2 className="text-base font-medium">Fanout Meta CAPI</h2>
          <p className="mt-0.5 text-xs text-[var(--color-fg-muted)]">
            Envio server-side dos eventos do tracking script. Sessão 1.4.9.
          </p>
        </div>
        <Link
          href="/configuracoes/meta/eventos"
          className="text-[11px] font-medium text-[var(--color-accent)] hover:underline"
        >
          Configurar →
        </Link>
      </header>

      {noActivity ? (
        <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-6 text-center text-xs text-[var(--color-fg-muted)]">
          Nenhum envio CAPI ainda. Conecte Meta em{' '}
          <Link
            href="/configuracoes/conexoes"
            className="text-[var(--color-accent)] hover:underline"
          >
            /configuracoes/conexoes
          </Link>{' '}
          e o fanout dispara automaticamente quando script estiver instalado.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <dl className="grid grid-cols-2 gap-2 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-3">
            <FanoutStat label="Enviados (24h)" value={stats.totalSent24h} tone="success" />
            <FanoutStat
              label="Falhas (24h)"
              value={stats.totalFailed24h}
              tone={stats.totalFailed24h > 0 ? 'danger' : 'neutral'}
            />
            <FanoutStat label="Skipped" value={stats.totalSkipped24h} tone="neutral" />
            <FanoutStat
              label="Pendentes"
              value={stats.totalPending}
              tone={stats.totalPending > 10 ? 'warning' : 'neutral'}
            />
          </dl>

          <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] lg:col-span-2">
            <table className="w-full text-xs">
              <caption className="sr-only">Últimos 10 envios CAPI</caption>
              <thead className="border-b border-[var(--color-border)] bg-[var(--color-bg-elevated)] text-[10px] font-medium tracking-wider text-[var(--color-fg-muted)] uppercase">
                <tr>
                  <th scope="col" className="px-3 py-2 text-left">
                    Quando
                  </th>
                  <th scope="col" className="px-3 py-2 text-left">
                    Evento Meta
                  </th>
                  <th scope="col" className="px-3 py-2 text-left">
                    Origem
                  </th>
                  <th scope="col" className="px-3 py-2 text-left">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {recent.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-[var(--color-fg-muted)]">
                      Aguardando envios…
                    </td>
                  </tr>
                ) : (
                  recent.map((e) => (
                    <tr key={e.id} className="border-b border-[var(--color-border)] last:border-0">
                      <td className="px-3 py-2 whitespace-nowrap text-[var(--color-fg-muted)]">
                        {new Date(e.eventTime).toLocaleTimeString('pt-BR')}
                      </td>
                      <td className="px-3 py-2 font-mono">{e.eventName}</td>
                      <td className="px-3 py-2 font-mono text-[var(--color-fg-muted)]">
                        {e.actionSource ?? '—'}
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge status={e.status} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  )
}

function GoogleFanoutSection({
  stats,
  recent,
}: {
  stats: {
    totalSent24h: number
    totalFailed24h: number
    totalSkipped24h: number
    totalPending: number
    lastSentAt: Date | null
    topEvents7d: Array<{ eventName: string; count: number }>
  }
  recent: Array<{
    id: string
    eventName: string
    eventTime: Date
    status: string
    googleCustomerId: string | null
    googleProductDestinationId: string | null
  }>
}) {
  const noActivity = stats.totalSent24h + stats.totalFailed24h + stats.totalSkipped24h === 0

  return (
    <section className="mb-10">
      <header className="mb-3 flex items-baseline justify-between gap-4">
        <div>
          <h2 className="text-base font-medium">Fanout Google Data Manager</h2>
          <p className="mt-0.5 text-xs text-[var(--color-fg-muted)]">
            Envio server-side via Data Manager API (ADR-015). Sessão 1.4.9.B.
          </p>
        </div>
        <Link
          href="/configuracoes/google/conversoes"
          className="text-[11px] font-medium text-[var(--color-accent)] hover:underline"
        >
          Configurar →
        </Link>
      </header>

      {noActivity ? (
        <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-6 text-center text-xs text-[var(--color-fg-muted)]">
          Nenhum envio Google ainda. Conecte Google em{' '}
          <Link
            href="/configuracoes/conexoes"
            className="text-[var(--color-accent)] hover:underline"
          >
            /configuracoes/conexoes
          </Link>
          , mapeie conversion actions em{' '}
          <Link
            href="/configuracoes/google/conversoes"
            className="text-[var(--color-accent)] hover:underline"
          >
            /configuracoes/google/conversoes
          </Link>{' '}
          e o fanout dispara automaticamente.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <dl className="grid grid-cols-2 gap-2 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-3">
            <FanoutStat label="Enviados (24h)" value={stats.totalSent24h} tone="success" />
            <FanoutStat
              label="Falhas (24h)"
              value={stats.totalFailed24h}
              tone={stats.totalFailed24h > 0 ? 'danger' : 'neutral'}
            />
            <FanoutStat label="Skipped" value={stats.totalSkipped24h} tone="neutral" />
            <FanoutStat
              label="Pendentes"
              value={stats.totalPending}
              tone={stats.totalPending > 10 ? 'warning' : 'neutral'}
            />
          </dl>

          <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] lg:col-span-2">
            <table className="w-full text-xs">
              <caption className="sr-only">Últimos 10 envios Google Data Manager</caption>
              <thead className="border-b border-[var(--color-border)] bg-[var(--color-bg-elevated)] text-[10px] font-medium tracking-wider text-[var(--color-fg-muted)] uppercase">
                <tr>
                  <th scope="col" className="px-3 py-2 text-left">
                    Quando
                  </th>
                  <th scope="col" className="px-3 py-2 text-left">
                    Evento
                  </th>
                  <th scope="col" className="px-3 py-2 text-left">
                    Customer
                  </th>
                  <th scope="col" className="px-3 py-2 text-left">
                    Conv. Action
                  </th>
                  <th scope="col" className="px-3 py-2 text-left">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {recent.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-[var(--color-fg-muted)]">
                      Aguardando envios…
                    </td>
                  </tr>
                ) : (
                  recent.map((e) => (
                    <tr key={e.id} className="border-b border-[var(--color-border)] last:border-0">
                      <td className="px-3 py-2 whitespace-nowrap text-[var(--color-fg-muted)]">
                        {new Date(e.eventTime).toLocaleTimeString('pt-BR')}
                      </td>
                      <td className="px-3 py-2 font-mono">{e.eventName}</td>
                      <td className="px-3 py-2 font-mono text-[var(--color-fg-muted)]">
                        {e.googleCustomerId ?? '—'}
                      </td>
                      <td className="px-3 py-2 font-mono text-[var(--color-fg-muted)]">
                        {e.googleProductDestinationId ?? '—'}
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge status={e.status} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  )
}

function FanoutStat({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: 'success' | 'danger' | 'warning' | 'neutral'
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
    <div>
      <dt className="text-[10px] font-medium tracking-wider text-[var(--color-fg-muted)] uppercase">
        {label}
      </dt>
      <dd className={`mt-0.5 text-lg font-semibold tabular-nums ${toneClass}`}>
        {value.toLocaleString('pt-BR')}
      </dd>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; tone: string }> = {
    sent: {
      label: 'Enviado',
      tone: 'border-[var(--color-success-border)] bg-[var(--color-success-bg)] text-[var(--color-success)]',
    },
    failed: {
      label: 'Falha',
      tone: 'border-[var(--color-danger-border)] bg-[var(--color-danger-bg)] text-[var(--color-danger)]',
    },
    skipped: {
      label: 'Skipped',
      tone: 'border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-fg-muted)]',
    },
    pending: {
      label: 'Pendente',
      tone: 'border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] text-[var(--color-warning)]',
    },
  }
  const config = map[status] ?? {
    label: status,
    tone: 'border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-fg-muted)]',
  }
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${config.tone}`}
    >
      {config.label}
    </span>
  )
}

function QuickLink({
  href,
  icon: Icon,
  label,
  hint,
}: {
  href: string
  icon: React.ComponentType<{ className?: string }>
  label: string
  hint: string
}) {
  return (
    <li>
      <Link
        href={href}
        className="group flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2 transition hover:border-[var(--color-border-strong)]"
      >
        <Icon className="h-4 w-4 shrink-0 text-[var(--color-fg-muted)] group-hover:text-[var(--color-accent)]" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium">{label}</p>
          <p className="truncate text-[10px] text-[var(--color-fg-muted)]">{hint}</p>
        </div>
      </Link>
    </li>
  )
}
