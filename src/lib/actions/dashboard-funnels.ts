'use server'

import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

import { withCorrelatedAction } from '@/lib/correlation'
import { db } from '@/lib/db'
import {
  createDashboardFunnel,
  getDashboardFunnelById,
  setDashboardFunnelAsDefault,
  softDeleteDashboardFunnel,
  updateDashboardFunnel,
} from '@/lib/db/queries/dashboard-funnels'
import { users, workspaceMembers } from '@/lib/db/schema/auth'
import { authLogger } from '@/lib/logger'
import { getUser } from '@/lib/supabase/server'

/**
 * Server Actions pra dashboard_funnels (PR-13c).
 */

export type DashboardFunnelActionResult =
  | { ok: true; id: string }
  | {
      ok: false
      error: {
        code: 'UNAUTHORIZED' | 'NOT_FOUND' | 'INVALID' | 'INTERNAL'
        message: string
      }
    }

async function resolveSession(): Promise<{ workspaceId: string; userId: string } | null> {
  const user = await getUser()
  if (!user) return null
  const userRow = await db.query.users.findFirst({ where: eq(users.id, user.id) })
  if (userRow?.defaultWorkspaceId) {
    return { workspaceId: userRow.defaultWorkspaceId, userId: user.id }
  }
  const membership = await db.query.workspaceMembers.findFirst({
    where: eq(workspaceMembers.userId, user.id),
  })
  if (!membership) return null
  return { workspaceId: membership.workspaceId, userId: user.id }
}

const funnelInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional().default(''),
  landingUrlPattern: z.string().trim().max(200).optional().default(''),
  utmCampaignPattern: z.string().trim().max(200).optional().default(''),
  productIds: z.array(z.string()).max(50).optional().default([]),
  makeDefault: z.boolean().optional().default(false),
})

export async function createDashboardFunnelAction(input: {
  name: string
  description?: string
  landingUrlPattern?: string
  utmCampaignPattern?: string
  productIds?: string[]
  makeDefault?: boolean
}): Promise<DashboardFunnelActionResult> {
  return withCorrelatedAction(async () => {
    const session = await resolveSession()
    if (!session) return { ok: false, error: { code: 'UNAUTHORIZED', message: 'Sessao expirou' } }

    const parsed = funnelInputSchema.safeParse(input)
    if (!parsed.success) {
      return {
        ok: false,
        error: { code: 'INVALID', message: parsed.error.issues[0]?.message ?? 'invalido' },
      }
    }

    try {
      const row = await createDashboardFunnel({
        workspaceId: session.workspaceId,
        name: parsed.data.name,
        description: parsed.data.description || null,
        landingUrlPattern: parsed.data.landingUrlPattern || null,
        utmCampaignPattern: parsed.data.utmCampaignPattern || null,
        productIds: parsed.data.productIds,
        isDefault: parsed.data.makeDefault,
      })

      if (parsed.data.makeDefault) {
        await setDashboardFunnelAsDefault({ id: row.id, workspaceId: session.workspaceId })
      }

      authLogger.info(
        { userId: session.userId, funnelId: row.id, event: 'dashboard_funnel_created' },
        'funil criado'
      )
      revalidatePath('/configuracoes/funis')
      revalidatePath('/dashboard')
      return { ok: true, id: row.id }
    } catch (err) {
      authLogger.error({ err }, 'failed to create dashboard funnel')
      return { ok: false, error: { code: 'INTERNAL', message: 'Erro ao salvar funil' } }
    }
  })
}

export async function updateDashboardFunnelAction(input: {
  id: string
  name?: string
  description?: string
  landingUrlPattern?: string
  utmCampaignPattern?: string
  productIds?: string[]
}): Promise<DashboardFunnelActionResult> {
  return withCorrelatedAction(async () => {
    const session = await resolveSession()
    if (!session) return { ok: false, error: { code: 'UNAUTHORIZED', message: 'Sessao expirou' } }

    const parsed = z
      .object({
        id: z.string().uuid(),
        name: z.string().trim().min(1).max(120).optional(),
        description: z.string().trim().max(500).optional(),
        landingUrlPattern: z.string().trim().max(200).optional(),
        utmCampaignPattern: z.string().trim().max(200).optional(),
        productIds: z.array(z.string()).max(50).optional(),
      })
      .safeParse(input)
    if (!parsed.success) {
      return { ok: false, error: { code: 'INVALID', message: 'dados invalidos' } }
    }

    const existing = await getDashboardFunnelById({
      id: parsed.data.id,
      workspaceId: session.workspaceId,
    })
    if (!existing) {
      return { ok: false, error: { code: 'NOT_FOUND', message: 'Funil nao encontrado' } }
    }

    const patch: Parameters<typeof updateDashboardFunnel>[0]['patch'] = {}
    if (parsed.data.name !== undefined) patch.name = parsed.data.name
    if (parsed.data.description !== undefined) patch.description = parsed.data.description || null
    if (parsed.data.landingUrlPattern !== undefined)
      patch.landingUrlPattern = parsed.data.landingUrlPattern || null
    if (parsed.data.utmCampaignPattern !== undefined)
      patch.utmCampaignPattern = parsed.data.utmCampaignPattern || null
    if (parsed.data.productIds !== undefined) patch.productIds = parsed.data.productIds

    try {
      await updateDashboardFunnel({
        id: parsed.data.id,
        workspaceId: session.workspaceId,
        patch,
      })
      revalidatePath('/configuracoes/funis')
      revalidatePath('/dashboard')
      return { ok: true, id: parsed.data.id }
    } catch (err) {
      authLogger.error({ err }, 'failed to update dashboard funnel')
      return { ok: false, error: { code: 'INTERNAL', message: 'Erro ao atualizar' } }
    }
  })
}

export async function setDefaultDashboardFunnelAction(input: {
  id: string
}): Promise<DashboardFunnelActionResult> {
  return withCorrelatedAction(async () => {
    const session = await resolveSession()
    if (!session) return { ok: false, error: { code: 'UNAUTHORIZED', message: 'Sessao expirou' } }

    const parsed = z.object({ id: z.string().uuid() }).safeParse(input)
    if (!parsed.success) {
      return { ok: false, error: { code: 'INVALID', message: 'id invalido' } }
    }

    const existing = await getDashboardFunnelById({
      id: parsed.data.id,
      workspaceId: session.workspaceId,
    })
    if (!existing) {
      return { ok: false, error: { code: 'NOT_FOUND', message: 'Funil nao encontrado' } }
    }

    try {
      await setDashboardFunnelAsDefault({
        id: parsed.data.id,
        workspaceId: session.workspaceId,
      })
      revalidatePath('/configuracoes/funis')
      revalidatePath('/dashboard')
      return { ok: true, id: parsed.data.id }
    } catch (err) {
      authLogger.error({ err }, 'failed to set default funnel')
      return { ok: false, error: { code: 'INTERNAL', message: 'Erro ao definir padrao' } }
    }
  })
}

export async function deleteDashboardFunnelAction(input: {
  id: string
}): Promise<DashboardFunnelActionResult> {
  return withCorrelatedAction(async () => {
    const session = await resolveSession()
    if (!session) return { ok: false, error: { code: 'UNAUTHORIZED', message: 'Sessao expirou' } }

    const parsed = z.object({ id: z.string().uuid() }).safeParse(input)
    if (!parsed.success) {
      return { ok: false, error: { code: 'INVALID', message: 'id invalido' } }
    }

    const existing = await getDashboardFunnelById({
      id: parsed.data.id,
      workspaceId: session.workspaceId,
    })
    if (!existing) {
      return { ok: false, error: { code: 'NOT_FOUND', message: 'Funil nao encontrado' } }
    }

    try {
      await softDeleteDashboardFunnel({
        id: parsed.data.id,
        workspaceId: session.workspaceId,
      })
      revalidatePath('/configuracoes/funis')
      revalidatePath('/dashboard')
      return { ok: true, id: parsed.data.id }
    } catch (err) {
      authLogger.error({ err }, 'failed to delete funnel')
      return { ok: false, error: { code: 'INTERNAL', message: 'Erro ao excluir' } }
    }
  })
}
