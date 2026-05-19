import { redirect } from 'next/navigation'
import Link from 'next/link'
import { eq } from 'drizzle-orm'

import { db } from '@/lib/db'
import { getActiveConnection } from '@/lib/db/queries/connections'
import { users, workspaceMembers } from '@/lib/db/schema/auth'
import { getUser } from '@/lib/supabase/server'

import { ConnectWizard } from './connect-wizard'

export default async function GenericConnectPage() {
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

  const existing = await getActiveConnection(workspaceId, 'generic')
  if (existing) redirect('/configuracoes/gateways/generic')

  return (
    <main className="flex flex-1 flex-col px-6 py-8">
      <header className="mb-8">
        <Link
          href="/configuracoes/gateways/generic"
          className="text-xs text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)]"
        >
          ← Outras plataformas
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Conectar via Make/n8n</h1>
        <p className="mt-2 text-sm text-[var(--color-fg-muted)]">
          Pra Monetizze, Ticto, Cakto e outras plataformas via flow de automação.
        </p>
      </header>

      <ConnectWizard />
    </main>
  )
}
