import Link from 'next/link'
import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { CheckCircle2, Plus } from 'lucide-react'

import { env } from '@/env'
import { db } from '@/lib/db'
import { getActiveConnection } from '@/lib/db/queries/gateway-connections'
import { users, workspaceMembers } from '@/lib/db/schema/auth'
import { getUser } from '@/lib/supabase/server'

import { ConnectionActions } from './_components/connection-actions'

export default async function GenericPage() {
  const user = await getUser()
  if (!user) redirect('/login')

  const userRow = await db.query.users.findFirst({ where: eq(users.id, user.id) })
  let workspaceId = userRow?.defaultWorkspaceId ?? null
  if (!workspaceId) {
    const m = await db.query.workspaceMembers.findFirst({
      where: eq(workspaceMembers.userId, user.id),
    })
    workspaceId = m?.workspaceId ?? null
  }
  if (!workspaceId) redirect('/bem-vindo')

  const connection = await getActiveConnection(workspaceId, 'generic')
  const webhookUrl = connection
    ? `${(env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '')}/api/webhooks/generic/${connection.id}`
    : null
  const sourceProvider =
    (connection?.apiCredentials as { sourceProvider?: string | null } | null)?.sourceProvider ??
    null

  return (
    <main className="flex flex-1 flex-col px-6 py-8">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <Link
            href="/configuracoes/gateways"
            className="text-xs text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)]"
          >
            ← Gateways
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            Outras plataformas (n8n / Make / Zapier)
          </h1>
          <p className="mt-2 text-sm text-[var(--color-fg-muted)]">
            Conecte qualquer gateway via flow Make/n8n/Zapier — Monetizze, Ticto, Cakto, Greenn,
            Yampi, Perfect Pay, Braip, Lastlink ou outro.
          </p>
        </div>
        {!connection && (
          <Link
            href="/configuracoes/gateways/generic/connect"
            className="inline-flex h-9 items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-accent)] px-3 text-sm font-medium text-[var(--color-fg-on-accent)] transition hover:bg-[var(--color-accent-hover)]"
          >
            <Plus className="h-4 w-4" />
            Conectar via Make/n8n
          </Link>
        )}
      </header>

      {!connection && (
        <section className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-8 text-center">
          <p className="text-sm text-[var(--color-fg-muted)]">
            Cliente avançado: gere URL+token, monte flow no Make/n8n com transform pra nosso shape
            canônico, conecte qualquer plataforma de pagamento.
          </p>
        </section>
      )}

      {connection && (
        <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-5">
          <header className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">
                {sourceProvider ? `Conectado (${sourceProvider})` : 'Conectado (genérico)'}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-[var(--color-success-border)] bg-[var(--color-success-bg)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-success)]">
                <CheckCircle2 className="h-2.5 w-2.5" />
                Ativa
              </span>
            </div>
            <ConnectionActions connectionId={connection.id} />
          </header>

          <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 text-xs sm:grid-cols-3">
            <Field label="Source provider">{sourceProvider ?? '—'}</Field>
            <Field label="Último webhook">
              {connection.lastWebhookEventAt
                ? new Date(connection.lastWebhookEventAt).toLocaleString('pt-BR')
                : '—'}
            </Field>
            <Field label="Falhas 24h">{connection.webhookFailures24h}</Field>
          </dl>

          <div className="mt-6 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
            <div className="text-label mb-2 text-[10px]">URL do webhook</div>
            <code className="font-mono text-xs break-all text-[var(--color-fg)]">{webhookUrl}</code>
            <p className="mt-2 text-[10px] text-[var(--color-fg-subtle)]">
              Auth: header{' '}
              <code className="font-mono">x-criation-token: {'<seu-token-secreto>'}</code> em todas
              as requests.
            </p>
          </div>
        </section>
      )}
    </main>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-label mb-1 text-[10px]">{label}</dt>
      <dd className="text-[var(--color-fg)]" data-tabular>
        {children}
      </dd>
    </div>
  )
}
