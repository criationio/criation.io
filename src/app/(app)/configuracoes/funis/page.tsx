import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'

import { db } from '@/lib/db'
import { listDashboardFunnels } from '@/lib/db/queries/dashboard-funnels'
import { listWorkspaceProducts } from '@/lib/db/queries/gateway-products'
import { users, workspaceMembers } from '@/lib/db/schema/auth'
import { getUser } from '@/lib/supabase/server'

import { FunnelsAdminClient } from './funnels-admin-client'

export const revalidate = 60

/**
 * Admin de funis nomeados (PR-13c).
 *
 * Server Component lista funis + produtos do workspace, delega CRUD pro
 * client component. Cada funil = bundle de criterios (UTM pattern + landing
 * pattern + lista de produtos). Dashboard usa funil pra filtrar dado.
 */
export default async function FunnelsAdminPage() {
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

  const [funnels, products] = await Promise.all([
    listDashboardFunnels(workspaceId),
    listWorkspaceProducts(workspaceId),
  ])

  return (
    <main className="flex flex-1 flex-col gap-6 p-6">
      <header className="max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight">Funis nomeados</h1>
        <p className="mt-2 text-sm text-[var(--color-fg-muted)]">
          Crie funis nomeados pra agrupar UTM patterns + landing pages + produtos. Vira filtro de 1
          clique no dashboard. Cada funil pode representar uma jornada distinta (VSL, Webinar,
          Trial) ou um produto específico vendido por vários caminhos.
        </p>
      </header>

      <FunnelsAdminClient
        funnels={funnels.map((f) => ({
          id: f.id,
          name: f.name,
          description: f.description,
          landingUrlPattern: f.landingUrlPattern,
          utmCampaignPattern: f.utmCampaignPattern,
          productIds: Array.isArray(f.productIds) ? (f.productIds as string[]) : [],
          isDefault: f.isDefault,
        }))}
        products={products.map((p) => ({ id: p.id, name: p.name }))}
      />
    </main>
  )
}
