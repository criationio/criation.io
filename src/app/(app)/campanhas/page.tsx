import Link from 'next/link'
import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { Megaphone, Plus } from 'lucide-react'

import { db } from '@/lib/db'
import { users, workspaceMembers } from '@/lib/db/schema/auth'
import { listCampaignsWithMetrics } from '@/lib/db/queries/campaigns'
import { getActiveConnectionByWorkspace } from '@/lib/db/queries/meta-connections'
import { getUser } from '@/lib/supabase/server'

import { SyncCampaignsButton } from './sync-button'

const STATUS_VARIANTS: Record<string, string> = {
  ACTIVE: 'bg-[var(--color-success-bg)] text-[var(--color-success)]',
  PAUSED: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]',
  DELETED: 'bg-[var(--color-bg-elevated)] text-[var(--color-fg-subtle)]',
  ARCHIVED: 'bg-[var(--color-bg-elevated)] text-[var(--color-fg-subtle)]',
}

const PROVIDER_LABEL: Record<string, string> = {
  meta: 'Meta',
  google: 'Google',
}

function formatBRL(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100)
}

function formatPct(decimal: string | null): string {
  if (!decimal) return '—'
  const n = Number.parseFloat(decimal)
  if (!Number.isFinite(n)) return '—'
  return `${n.toFixed(2)}%`
}

function relativeTime(date: Date | string | null): string {
  if (!date) return '—'
  const d = typeof date === 'string' ? new Date(date) : date
  const diffMs = Date.now() - d.getTime()
  const diffMin = Math.round(diffMs / 60_000)
  if (diffMin < 1) return 'agora'
  if (diffMin < 60) return `${diffMin}m atrás`
  const diffH = Math.round(diffMin / 60)
  if (diffH < 24) return `${diffH}h atrás`
  const diffD = Math.round(diffH / 24)
  return `${diffD}d atrás`
}

export default async function CampanhasPage() {
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

  const [connection, campaigns] = await Promise.all([
    getActiveConnectionByWorkspace(workspaceId),
    listCampaignsWithMetrics(workspaceId, 50),
  ])

  return (
    <main className="flex flex-1 flex-col px-6 py-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Campanhas</h1>
          <p className="mt-2 text-sm text-[var(--color-fg-muted)]">
            Sincronizadas a cada 4h via Trigger.dev. Versão básica nesta sessão; filtros e detalhe
            completos chegam na Sessão 1.7.
          </p>
        </div>
        {connection && <SyncCampaignsButton />}
      </header>

      {!connection && (
        <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-8 text-center">
          <Megaphone className="mx-auto h-6 w-6 text-[var(--color-fg-subtle)]" />
          <p className="mt-3 text-sm text-[var(--color-fg-muted)]">
            Conecte sua conta Meta Ads para começar a ver campanhas.
          </p>
          <Link
            href="/configuracoes/conexoes"
            className="mt-4 inline-flex h-10 items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-accent)] px-4 text-sm font-medium text-[var(--color-fg-on-accent)] transition hover:bg-[var(--color-accent-hover)]"
          >
            <Plus className="h-4 w-4" />
            Ir para Conexões
          </Link>
        </div>
      )}

      {connection && campaigns.length === 0 && (
        <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-8 text-center">
          <Megaphone className="mx-auto h-6 w-6 text-[var(--color-fg-subtle)]" />
          <p className="mt-3 text-sm text-[var(--color-fg-muted)]">
            Nenhuma campanha sincronizada ainda. Clique em &ldquo;Sincronizar agora&rdquo; pra puxar
            do Meta.
          </p>
          {connection.lastSyncAt && (
            <p className="mt-2 text-[10px] text-[var(--color-fg-subtle)]">
              Última tentativa: {relativeTime(connection.lastSyncAt)}
            </p>
          )}
        </div>
      )}

      {campaigns.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-left text-[10px] font-medium tracking-wider text-[var(--color-fg-muted)] uppercase">
                  <th className="px-4 py-2.5">Nome</th>
                  <th className="px-3 py-2.5">Plataforma</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5 text-right">Gasto 7d</th>
                  <th className="px-3 py-2.5 text-right">Impressões</th>
                  <th className="px-3 py-2.5 text-right">CTR</th>
                  <th className="px-3 py-2.5 text-right">Última sync</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {campaigns.map((c) => (
                  <tr
                    key={c.id}
                    className="text-[var(--color-fg)] transition hover:bg-[var(--color-bg-muted)]"
                  >
                    <td className="px-4 py-2.5">
                      <span className="line-clamp-1">{c.name}</span>
                      {c.objective && (
                        <span className="text-[10px] text-[var(--color-fg-subtle)]">
                          {c.objective}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-[var(--color-fg-muted)]">
                      {PROVIDER_LABEL[c.provider] ?? c.provider}
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_VARIANTS[c.status] ?? 'bg-[var(--color-bg-muted)] text-[var(--color-fg-muted)]'}`}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right font-medium" data-tabular>
                      {formatBRL(c.spend_7d_cents)}
                    </td>
                    <td
                      className="px-3 py-2.5 text-right text-[var(--color-fg-muted)]"
                      data-tabular
                    >
                      {c.impressions_7d.toLocaleString('pt-BR')}
                    </td>
                    <td
                      className="px-3 py-2.5 text-right text-[var(--color-fg-muted)]"
                      data-tabular
                    >
                      {formatPct(c.ctr_7d_pct)}
                    </td>
                    <td className="px-3 py-2.5 text-right text-[10px] text-[var(--color-fg-subtle)]">
                      {relativeTime(c.last_synced_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[10px] text-[var(--color-fg-subtle)]">
            Mostrando {campaigns.length} campanhas, ordenadas por gasto dos últimos 7 dias. Filtros,
            detalhe da campanha e comparativo A×B chegam na Sessão 1.7.
          </p>
        </>
      )}
    </main>
  )
}
