import Link from 'next/link'
import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { CreditCard, KeyRound, Plug2, Shield, UserPlus, Users } from 'lucide-react'

import { db } from '@/lib/db'
import { users, workspaceMembers, workspaces } from '@/lib/db/schema/auth'
import { getUser } from '@/lib/supabase/server'

const PLAN_LABELS: Record<string, string> = {
  free: 'Trial',
  trial: 'Trial',
  starter: 'Starter',
  pro: 'Pro',
  agency: 'Agency',
}

export default async function WorkspacePage() {
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

  const workspace = await db.query.workspaces.findFirst({ where: eq(workspaces.id, workspaceId) })
  if (!workspace) redirect('/bem-vindo')

  const planLabel = PLAN_LABELS[workspace.planId] ?? workspace.planId
  const memberCount = await db
    .select()
    .from(workspaceMembers)
    .where(eq(workspaceMembers.workspaceId, workspaceId))
    .then((rows) => rows.length)

  return (
    <main className="flex flex-1 flex-col px-6 py-8">
      <header className="mb-8 max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight">Workspace</h1>
        <p className="mt-2 text-sm text-[var(--color-fg-muted)]">
          Visão geral do workspace ativo. Use os atalhos abaixo para acessar configurações
          específicas.
        </p>
      </header>

      <section className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <InfoCard label="Nome" value={workspace.name} />
        <InfoCard label="Plano" value={planLabel} />
        <InfoCard label="Membros" value={String(memberCount)} />
      </section>

      <section>
        <h2 className="mb-3 text-base font-medium">Atalhos</h2>
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <QuickLink
            href="/configuracoes/equipe"
            icon={Users}
            label="Equipe"
            hint="Membros e permissões"
          />
          <QuickLink
            href="/configuracoes/faturamento"
            icon={CreditCard}
            label="Faturamento"
            hint="Plano, créditos, recibos"
          />
          <QuickLink
            href="/afiliados"
            icon={UserPlus}
            label="Afiliados"
            hint="Programa de revenue share"
          />
          <QuickLink
            href="/configuracoes/conexoes"
            icon={Plug2}
            label="Conexões"
            hint="Meta, gateways, CDP"
          />
          <QuickLink
            href="/configuracoes/api"
            icon={KeyRound}
            label="API & MCP"
            hint="Tokens e integrações dev"
          />
          <QuickLink
            href="/configuracoes/seguranca"
            icon={Shield}
            label="Segurança"
            hint="Sessões, 2FA, audit log"
          />
        </ul>
      </section>
    </main>
  )
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-4">
      <p className="text-[10px] font-medium tracking-wider text-[var(--color-fg-muted)] uppercase">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
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
        className="group flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 py-2.5 transition hover:border-[var(--color-border-strong)]"
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
