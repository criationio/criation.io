import Link from 'next/link'
import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { ExternalLink, Plus } from 'lucide-react'

import { ConnectionStatusBadge } from '@/components/gateways/ConnectionStatusBadge'
import {
  deriveConnectionHealth,
  getHealthDescription,
} from '@/components/gateways/connection-health'

import { env } from '@/env'
import { db } from '@/lib/db'
import { getActiveConnection } from '@/lib/db/queries/gateway-connections'
import { users, workspaceMembers } from '@/lib/db/schema/auth'
import { getUser } from '@/lib/supabase/server'

import { ConnectionActions } from './_components/connection-actions'

export default async function KiwifyPage() {
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

  const connection = await getActiveConnection(workspaceId, 'kiwify')

  // URL limpa — Kiwify valida via HMAC-SHA1, sem token na query string
  const webhookUrl = connection
    ? `${(env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '')}/api/webhooks/gateway/kiwify/${connection.id}`
    : null

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
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Kiwify</h1>
          <p className="mt-2 text-sm text-[var(--color-fg-muted)]">
            Webhook v1. Vendas, refunds, chargebacks, assinaturas e renovações.
          </p>
        </div>
        {!connection && (
          <Link
            href="/configuracoes/gateways/kiwify/connect"
            className="inline-flex h-9 items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-accent)] px-3 text-sm font-medium text-[var(--color-fg-on-accent)] transition hover:bg-[var(--color-accent-hover)]"
          >
            <Plus className="h-4 w-4" />
            Conectar Kiwify
          </Link>
        )}
      </header>

      {!connection && (
        <section className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-8 text-center">
          <p className="text-sm text-[var(--color-fg-muted)]">
            Você ainda não conectou Kiwify. Use o assistente para gerar a URL+token e cadastrar no
            painel em ~30 segundos.
          </p>
        </section>
      )}

      {connection &&
        (() => {
          const health = deriveConnectionHealth(connection)
          const description = getHealthDescription(health, connection.lastWebhookEventAt)
          return (
            <section className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-5">
              <header className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Conta conectada</span>
                    <ConnectionStatusBadge health={health} />
                  </div>
                  <p className="mt-2 text-xs text-[var(--color-fg-muted)]">{description}</p>
                </div>
                <ConnectionActions connectionId={connection.id} />
              </header>

              <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 text-xs sm:grid-cols-3">
                <Field label="Webhook version" mono>
                  {connection.webhookVersion ?? 'v1'}
                </Field>
                <Field label="Último webhook">
                  {connection.lastWebhookEventAt
                    ? new Date(connection.lastWebhookEventAt).toLocaleString('pt-BR')
                    : '—'}
                </Field>
                <Field label="Falhas 24h">{connection.webhookFailures24h}</Field>
                <Field label="Status">{connection.status}</Field>
                <Field label="Conectado em">
                  {new Date(connection.createdAt).toLocaleDateString('pt-BR')}
                </Field>
              </dl>

              <div className="mt-6 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
                <div className="text-label mb-2 text-[10px]">URL do webhook</div>
                <div className="flex items-center justify-between gap-2">
                  <code className="font-mono text-xs break-all text-[var(--color-fg)]">
                    {webhookUrl ?? '—'}
                  </code>
                  <a
                    href="https://dashboard.kiwify.com.br"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex shrink-0 items-center gap-1 text-xs text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
                  >
                    Painel <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            </section>
          )
        })()}
    </main>
  )
}

function Field({
  label,
  children,
  mono = false,
}: {
  label: string
  children: React.ReactNode
  mono?: boolean
}) {
  return (
    <div>
      <dt className="text-label mb-1 text-[10px]">{label}</dt>
      <dd className={`text-[var(--color-fg)] ${mono ? 'font-mono' : ''}`} data-tabular>
        {children}
      </dd>
    </div>
  )
}
