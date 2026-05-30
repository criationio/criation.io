import { eq } from 'drizzle-orm'

import { db } from '@/lib/db'
import { users, workspaceMembers } from '@/lib/db/schema/auth'
import { getUser } from '@/lib/supabase/server'

/**
 * Resolve o workspace ativo do usuário logado (default_workspace_id, com
 * fallback pra primeira membership). Retorna null se não autenticado ou sem
 * workspace. Uso em Server Components que precisam só do id.
 */
export async function resolveCurrentWorkspaceId(): Promise<string | null> {
  const user = await getUser()
  if (!user) return null

  const userRow = await db.query.users.findFirst({ where: eq(users.id, user.id) })
  let workspaceId = userRow?.defaultWorkspaceId ?? null
  if (!workspaceId) {
    const membership = await db.query.workspaceMembers.findFirst({
      where: eq(workspaceMembers.userId, user.id),
    })
    workspaceId = membership?.workspaceId ?? null
  }
  return workspaceId
}
