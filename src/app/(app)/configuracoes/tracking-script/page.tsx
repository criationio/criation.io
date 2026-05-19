import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'

import { db } from '@/lib/db'
import { users, workspaceMembers } from '@/lib/db/schema/auth'
import { getInstallationStatus, getRecentEventsForWorkspace } from '@/lib/db/queries/tracking'
import { ensureTrackingConnection, getTrackingConfig } from '@/lib/actions/tracking'
import { getUser } from '@/lib/supabase/server'
import { env } from '@/env'

import { TrackingScriptClient } from './tracking-script-client'

export default async function TrackingScriptPage() {
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

  // Idempotente — cria connections row na primeira visita pra habilitar
  // origin allowlist + status real do hub.
  await ensureTrackingConnection()

  const [status, configResult, recentEvents] = await Promise.all([
    getInstallationStatus(workspaceId),
    getTrackingConfig(),
    getRecentEventsForWorkspace(workspaceId, 20),
  ])

  const baseUrl = (env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '')
  const scriptUrl = `${baseUrl}/criation-tracking.js`
  const snippet = `<script async src="${scriptUrl}" data-workspace="${workspaceId}"></script>`
  const config = configResult.ok ? configResult.data : { originAllowlist: [], installedAt: null }

  return (
    <TrackingScriptClient
      snippet={snippet}
      scriptUrl={scriptUrl}
      workspaceId={workspaceId}
      status={{
        installed: status.installed,
        lastEventAt: status.lastEventAt ? status.lastEventAt.toISOString() : null,
        totalEvents24h: status.totalEvents24h,
      }}
      originAllowlist={config.originAllowlist}
      recentEvents={recentEvents.map((e) => ({
        id: e.id,
        eventName: e.eventName,
        eventTs: e.eventTs.toISOString(),
        visitorId: e.visitorId,
        pageUrl: e.pageUrl,
        utmSource: ((e.utms as Record<string, string | null>) ?? {}).utm_source ?? null,
      }))}
    />
  )
}
