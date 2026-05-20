'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

import { withCorrelatedAction } from '@/lib/correlation'
import { db } from '@/lib/db'
import { users, workspaceMembers } from '@/lib/db/schema/auth'
import { capiLogger } from '@/lib/logger'
import { triggerSyncCampaigns } from '@/lib/trigger/client'
import { getUser } from '@/lib/supabase/server'

export type CampaignSyncResult =
  | { ok: true; runId: string }
  | { ok: false; error: { code: 'UNAUTHORIZED' | 'NOT_FOUND' | 'INTERNAL'; message: string } }

async function getCurrentWorkspaceId(): Promise<string | null> {
  const user = await getUser()
  if (!user) return null
  const userRow = await db.query.users.findFirst({ where: eq(users.id, user.id) })
  if (userRow?.defaultWorkspaceId) return userRow.defaultWorkspaceId
  const membership = await db.query.workspaceMembers.findFirst({
    where: eq(workspaceMembers.userId, user.id),
  })
  return membership?.workspaceId ?? null
}

/**
 * Dispara sync-campaigns task para o workspace atual. Retorna runId
 * para UI poder pollar status (futuro). Por enquanto, basta dispara e
 * mostrar toast — task roda em background e atualiza o banco.
 */
export async function triggerCampaignSync(): Promise<CampaignSyncResult> {
  return withCorrelatedAction(async () => {
    const workspaceId = await getCurrentWorkspaceId()
    if (!workspaceId) {
      return { ok: false, error: { code: 'UNAUTHORIZED', message: 'sessao invalida' } }
    }

    try {
      const handle = await triggerSyncCampaigns({ workspaceId })
      capiLogger.info({ workspaceId, runId: handle.id }, 'campaign sync triggered')
      revalidatePath('/campanhas')
      return { ok: true, runId: handle.id }
    } catch (err) {
      capiLogger.error({ err, workspaceId }, 'failed to trigger campaign sync')
      return {
        ok: false,
        error: { code: 'INTERNAL', message: 'falha ao agendar sincronizacao' },
      }
    }
  })
}
