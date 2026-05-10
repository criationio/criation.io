import { redirect } from 'next/navigation'
import Link from 'next/link'
import { eq } from 'drizzle-orm'

import { db } from '@/lib/db'
import { getActiveConnection } from '@/lib/db/queries/gateway-connections'
import { users, workspaceMembers } from '@/lib/db/schema/auth'
import { getUser } from '@/lib/supabase/server'

import { ConnectWizard } from './connect-wizard'

export default async function KiwifyConnectPage() {
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

  const existing = await getActiveConnection(workspaceId, 'kiwify')
  if (existing) redirect('/configuracoes/gateways/kiwify')

  return (
    <main className="flex flex-1 flex-col px-6 py-8">
      <header className="mb-8">
        <Link
          href="/configuracoes/gateways/kiwify"
          className="text-xs text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)]"
        >
          ← Kiwify
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Conectar Kiwify</h1>
        <p className="mt-2 text-sm text-[var(--color-fg-muted)]">
          Geramos um token único, você cola no painel Kiwify junto com a URL. ~30 segundos.
        </p>
      </header>

      <ConnectWizard />
    </main>
  )
}
