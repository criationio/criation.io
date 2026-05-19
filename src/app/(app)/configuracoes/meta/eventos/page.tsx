import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'

import { db } from '@/lib/db'
import { users, workspaceMembers } from '@/lib/db/schema/auth'
import { getActiveConnectionByWorkspace } from '@/lib/db/queries/meta-connections'
import { getMetaFanoutStats } from '@/lib/db/queries/capi'
import { getUser } from '@/lib/supabase/server'

import { MetaEventosClient } from './meta-eventos-client'

export default async function MetaEventosPage() {
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

  const [connection, stats] = await Promise.all([
    getActiveConnectionByWorkspace(workspaceId),
    getMetaFanoutStats(workspaceId),
  ])

  return (
    <MetaEventosClient
      connected={!!connection}
      pixelId={connection?.pixelId ?? null}
      testEventCode={connection?.testEventCode ?? null}
      stats={{
        totalSent24h: stats.totalSent24h,
        totalFailed24h: stats.totalFailed24h,
        totalSkipped24h: stats.totalSkipped24h,
        totalPending: stats.totalPending,
        lastSentAt: stats.lastSentAt ? stats.lastSentAt.toISOString() : null,
        topEvents7d: stats.topEvents7d,
      }}
    />
  )
}
