'use server'

import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '@/lib/db'
import { users, workspaceMembers, workspaces } from '@/lib/db/schema/auth'
import { getUser } from '@/lib/supabase/server'

export interface UtmConvention {
  usesCampaignNamePlaceholder: boolean
  usesAdSetNameAsTerm: boolean
  usesAdNameAsContent: boolean
}

const DEFAULT_CONVENTION: UtmConvention = {
  usesCampaignNamePlaceholder: true,
  usesAdSetNameAsTerm: false,
  usesAdNameAsContent: false,
}

const conventionSchema = z.object({
  usesCampaignNamePlaceholder: z.boolean(),
  usesAdSetNameAsTerm: z.boolean(),
  usesAdNameAsContent: z.boolean(),
})

interface Ok<T> {
  ok: true
  data: T
}
interface Err {
  ok: false
  error: { code: string; message: string }
}
type Result<T> = Ok<T> | Err

async function resolveWorkspaceId(): Promise<Result<string>> {
  const user = await getUser()
  if (!user) return { ok: false, error: { code: 'UNAUTHORIZED', message: 'Login necessário' } }

  const userRow = await db.query.users.findFirst({ where: eq(users.id, user.id) })
  let workspaceId = userRow?.defaultWorkspaceId ?? null
  if (!workspaceId) {
    const membership = await db.query.workspaceMembers.findFirst({
      where: eq(workspaceMembers.userId, user.id),
    })
    workspaceId = membership?.workspaceId ?? null
  }
  if (!workspaceId) {
    return { ok: false, error: { code: 'NO_WORKSPACE', message: 'Workspace não encontrado' } }
  }
  return { ok: true, data: workspaceId }
}

export async function getUtmConvention(): Promise<Result<UtmConvention>> {
  const ws = await resolveWorkspaceId()
  if (!ws.ok) return ws

  const row = await db.query.workspaces.findFirst({
    where: eq(workspaces.id, ws.data),
  })
  if (!row) return { ok: false, error: { code: 'NOT_FOUND', message: 'Workspace inválido' } }

  const parsed = conventionSchema.safeParse(row.utmConvention)
  return { ok: true, data: parsed.success ? parsed.data : DEFAULT_CONVENTION }
}

export async function updateUtmConvention(input: UtmConvention): Promise<Result<UtmConvention>> {
  const ws = await resolveWorkspaceId()
  if (!ws.ok) return ws

  const parsed = conventionSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: { code: 'INVALID_INPUT', message: 'Convenção inválida' } }
  }

  await db.update(workspaces).set({ utmConvention: parsed.data }).where(eq(workspaces.id, ws.data))

  revalidatePath('/configuracoes/utm-mappings')
  return { ok: true, data: parsed.data }
}
