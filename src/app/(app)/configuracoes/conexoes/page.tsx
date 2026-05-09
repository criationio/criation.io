import Link from 'next/link'
import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { Plus, ShieldAlert, ShieldCheck } from 'lucide-react'

import { db } from '@/lib/db'
import { users, workspaceMembers } from '@/lib/db/schema/auth'
import { getConnectionWithAdAccounts } from '@/lib/db/queries/meta-connections'
import { getUser } from '@/lib/supabase/server'

import { AdAccountsList } from './ad-accounts-list'
import { ConexoesActions } from './conexoes-actions'

// Helper extraido do componente: Date.now() em Server Component eh fine
// (renderiza 1x por request), mas a regra react-hooks/purity nao distingue.
function calcDaysUntil(expiresAt: Date | null): number | null {
  if (!expiresAt) return null
  const ms = new Date(expiresAt).getTime() - Date.now()
  return Math.max(0, Math.ceil(ms / 86_400_000))
}

const STATUS_VARIANTS: Record<string, { label: string; className: string }> = {
  active: {
    label: 'Ativa',
    className:
      'bg-[var(--color-success-bg)] text-[var(--color-success)] border-[var(--color-success-border)]',
  },
  expired: {
    label: 'Expirada',
    className:
      'bg-[var(--color-danger-bg)] text-[var(--color-danger)] border-[var(--color-danger-border)]',
  },
  disconnected: {
    label: 'Desconectada',
    className:
      'bg-[var(--color-bg-elevated)] text-[var(--color-fg-muted)] border-[var(--color-border)]',
  },
}

const VERIFICATION_LABELS: Record<string, string> = {
  not_started: 'Não iniciada',
  pending: 'Pendente',
  verified: 'Verificado',
  rejected: 'Rejeitado',
}

export default async function ConexoesPage() {
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

  const data = await getConnectionWithAdAccounts(workspaceId)

  return (
    <main className="flex flex-1 flex-col px-6 py-8">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Conexões</h1>
        <p className="mt-2 text-sm text-[var(--color-fg-muted)]">
          Gerencie as integrações com plataformas de anúncios. Cada conexão libera leitura de
          campanhas e envio de conversões via API.
        </p>
      </header>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-medium">Meta Ads</h2>
          {data && (
            <Link
              href="/bem-vindo/meta?returnTo=/configuracoes/conexoes"
              className="inline-flex h-8 items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 text-xs text-[var(--color-fg-muted)] transition hover:border-[var(--color-border-strong)] hover:text-[var(--color-fg)]"
            >
              <Plus className="h-3 w-3" />
              Reconectar
            </Link>
          )}
        </div>

        {!data && (
          <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-8 text-center">
            <p className="text-sm text-[var(--color-fg-muted)]">
              Você ainda não conectou nenhuma conta Meta Ads.
            </p>
            <Link
              href="/bem-vindo/meta?returnTo=/configuracoes/conexoes"
              className="mt-4 inline-flex h-10 items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-accent)] px-4 text-sm font-medium text-[var(--color-fg-on-accent)] transition hover:bg-[var(--color-accent-hover)]"
            >
              <Plus className="h-4 w-4" />
              Conectar Meta Ads
            </Link>
          </div>
        )}

        {data && (
          <ConnectionCard
            connection={data.connection}
            tokenExpiresInDays={calcDaysUntil(data.connection.tokenExpiresAt)}
            adAccounts={data.adAccounts.map((a) => ({
              id: a.id,
              adAccountId: a.adAccountId,
              name: a.adAccountName,
              currency: a.currency,
              accountStatus: a.accountStatus,
              isDefault: a.isDefault,
              businessId: a.businessId,
            }))}
          />
        )}
      </section>

      <section className="mt-12">
        <h2 className="text-base font-medium">Google Ads</h2>
        <div className="mt-3 rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-8 text-center">
          <p className="text-sm text-[var(--color-fg-muted)]">
            Integração Google Ads chega na Sessão 2.10. Por enquanto, conecte só Meta para começar.
          </p>
        </div>
      </section>
    </main>
  )
}

interface ConnectionCardProps {
  connection: {
    metaUserName: string | null
    metaUserEmail: string | null
    metaUserId: string | null
    status: string
    isSystemUserToken: boolean
    grantedScopes: unknown
    businessVerificationStatus: string
    verifiedDomains: unknown
    pixelId: string | null
    marketingApiVersion: string
  }
  tokenExpiresInDays: number | null
  adAccounts: {
    id: string
    adAccountId: string
    name: string | null
    currency: string | null
    accountStatus: number | null
    isDefault: boolean
    businessId: string | null
  }[]
}

function ConnectionCard({ connection, adAccounts, tokenExpiresInDays }: ConnectionCardProps) {
  const statusVariant = STATUS_VARIANTS[connection.status] ?? STATUS_VARIANTS.disconnected!
  const grantedScopes = Array.isArray(connection.grantedScopes)
    ? (connection.grantedScopes as string[])
    : []
  const verifiedDomains = Array.isArray(connection.verifiedDomains)
    ? (connection.verifiedDomains as { domain: string; verified: boolean }[])
    : []

  return (
    <article className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">
              {connection.metaUserName ?? connection.metaUserEmail ?? 'Conta Meta'}
            </span>
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusVariant.className}`}
            >
              {statusVariant.label}
            </span>
            {connection.isSystemUserToken && (
              <span className="rounded-full border border-[var(--color-info-border)] bg-[var(--color-info-bg)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-info)]">
                System User Token
              </span>
            )}
          </div>
          {connection.metaUserEmail && connection.metaUserName && (
            <p className="mt-0.5 text-xs text-[var(--color-fg-muted)]">
              {connection.metaUserEmail}
            </p>
          )}
        </div>
        <ConexoesActions />
      </header>

      <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 text-xs sm:grid-cols-3">
        <Field label="Token expira em">
          {connection.isSystemUserToken
            ? 'Não expira (System User)'
            : tokenExpiresInDays !== null
              ? `${tokenExpiresInDays} dia${tokenExpiresInDays === 1 ? '' : 's'}`
              : '—'}
        </Field>
        <Field label="API version" mono>
          {connection.marketingApiVersion}
        </Field>
        <Field label="Pixel default" mono>
          {connection.pixelId ?? '—'}
        </Field>
        <Field label="Business Verification">
          <span className="inline-flex items-center gap-1">
            {connection.businessVerificationStatus === 'verified' ? (
              <ShieldCheck className="h-3 w-3 text-[var(--color-success)]" />
            ) : (
              <ShieldAlert className="h-3 w-3 text-[var(--color-warning)]" />
            )}
            {VERIFICATION_LABELS[connection.businessVerificationStatus] ??
              connection.businessVerificationStatus}
          </span>
        </Field>
        <Field label="Domínios verificados">
          {verifiedDomains.filter((d) => d.verified).length} de {verifiedDomains.length}
        </Field>
        <Field label="Scopes concedidos">{grantedScopes.length}</Field>
      </dl>

      <div className="mt-5">
        <div className="text-label mb-2 text-[10px]">Contas de anúncio ({adAccounts.length})</div>
        <AdAccountsList adAccounts={adAccounts} />
        {adAccounts.length > 1 && (
          <p className="mt-2 text-[10px] text-[var(--color-fg-subtle)]">
            Clique em &ldquo;Definir como principal&rdquo; pra trocar qual conta é o default.
          </p>
        )}
      </div>
    </article>
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
