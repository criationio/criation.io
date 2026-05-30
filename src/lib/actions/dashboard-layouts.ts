'use server'

import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

import { withCorrelatedAction } from '@/lib/correlation'
import { db } from '@/lib/db'
import {
  createDashboardLayout,
  getDashboardLayoutById,
  setDashboardLayoutAsDefault,
  softDeleteDashboardLayout,
  updateDashboardLayout,
} from '@/lib/db/queries/dashboard-layouts'
import { type DashboardFiltersData, type DashboardLayoutData } from '@/lib/db/schema/dashboard'
import { users, workspaceMembers } from '@/lib/db/schema/auth'
import { authLogger } from '@/lib/logger'
import { getUser } from '@/lib/supabase/server'

/**
 * Server Actions pra saved views do dashboard (Sessao 1.6 PR-12).
 *
 * Pattern thin controller: valida Zod, resolve session (user+workspace),
 * delega pra queries. RLS no banco e cinto-e-suspensorio com o ownership
 * check em userland aqui (RLS bloqueia cross-workspace).
 *
 * Visibility: passar `userId=null` na criacao cria view shared workspace
 * (vista por todos os membros). Caso contrario, fica privada do user.
 */

export type DashboardLayoutActionResult =
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

// ============================================================================
// Schemas
// ============================================================================

const widgetSchema = z.object({
  id: z.string().min(1).max(80),
  type: z.string().min(1).max(60),
  gridArea: z.object({
    x: z.number().int().min(0).max(60),
    y: z.number().int().min(0).max(500),
    w: z.number().int().min(1).max(12),
    h: z.number().int().min(1).max(30),
  }),
  config: z.record(z.string(), z.unknown()).optional(),
})

const layoutSchema = z.object({
  widgets: z.array(widgetSchema).max(60),
  gridCols: z.number().int().min(1).max(24),
})

const filtersSchema = z
  .object({
    period: z
      .object({
        preset: z.string().optional(),
        start: z.string().optional(),
        end: z.string().optional(),
      })
      .optional(),
    comparison: z.string().optional(),
    attribution: z.string().optional(),
    channels: z.array(z.string()).optional(),
    campaigns: z.array(z.string()).optional(),
    segments: z.array(z.string()).optional(),
  })
  .passthrough()

// ============================================================================
// Actions
// ============================================================================

const createInput = z.object({
  name: z.string().trim().min(1).max(80),
  layout: layoutSchema,
  filters: filtersSchema.optional().default({}),
  /** `true` -> shared workspace; `false` (default) -> privada do user. */
  shared: z.boolean().optional().default(false),
  makeDefault: z.boolean().optional().default(false),
})

export async function createDashboardLayoutAction(input: {
  name: string
  layout: DashboardLayoutData
  filters?: DashboardFiltersData
  shared?: boolean
  makeDefault?: boolean
}): Promise<DashboardLayoutActionResult> {
  return withCorrelatedAction(async () => {
    const session = await resolveSession()
    if (!session) return { ok: false, error: { code: 'UNAUTHORIZED', message: 'Sessao expirou' } }

    const parsed = createInput.safeParse(input)
    if (!parsed.success) {
      return {
        ok: false,
        error: { code: 'INVALID', message: parsed.error.issues[0]?.message ?? 'invalido' },
      }
    }

    try {
      const row = await createDashboardLayout({
        workspaceId: session.workspaceId,
        userId: parsed.data.shared ? null : session.userId,
        name: parsed.data.name,
        layout: parsed.data.layout as DashboardLayoutData,
        filters: (parsed.data.filters ?? {}) as DashboardFiltersData,
        isDefault: parsed.data.makeDefault,
      })

      // setAsDefault re-runs aqui pra desmarcar outros defaults atomicamente.
      if (parsed.data.makeDefault) {
        await setDashboardLayoutAsDefault({
          id: row.id,
          workspaceId: session.workspaceId,
          userId: session.userId,
        })
      }

      authLogger.info(
        { userId: session.userId, layoutId: row.id, event: 'dashboard_view_created' },
        'saved view criada'
      )
      revalidatePath('/dashboard')
      return { ok: true, id: row.id }
    } catch (err) {
      authLogger.error({ err }, 'failed to create dashboard layout')
      return { ok: false, error: { code: 'INTERNAL', message: 'Erro ao salvar view' } }
    }
  })
}

const updateInput = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(80).optional(),
  layout: layoutSchema.optional(),
  filters: filtersSchema.optional(),
})

export async function updateDashboardLayoutAction(input: {
  id: string
  name?: string
  layout?: DashboardLayoutData
  filters?: DashboardFiltersData
}): Promise<DashboardLayoutActionResult> {
  return withCorrelatedAction(async () => {
    const session = await resolveSession()
    if (!session) return { ok: false, error: { code: 'UNAUTHORIZED', message: 'Sessao expirou' } }

    const parsed = updateInput.safeParse(input)
    if (!parsed.success) {
      return { ok: false, error: { code: 'INVALID', message: 'dados invalidos' } }
    }

    // Ownership check — query bloqueia view nao acessivel.
    const existing = await getDashboardLayoutById({
      id: parsed.data.id,
      workspaceId: session.workspaceId,
      userId: session.userId,
    })
    if (!existing) {
      return { ok: false, error: { code: 'NOT_FOUND', message: 'View nao encontrada' } }
    }

    const patch: Parameters<typeof updateDashboardLayout>[0]['patch'] = {}
    if (parsed.data.name !== undefined) patch.name = parsed.data.name
    if (parsed.data.layout !== undefined) patch.layout = parsed.data.layout as DashboardLayoutData
    if (parsed.data.filters !== undefined)
      patch.filters = parsed.data.filters as DashboardFiltersData

    try {
      await updateDashboardLayout({
        id: parsed.data.id,
        workspaceId: session.workspaceId,
        userId: session.userId,
        patch,
      })
      revalidatePath('/dashboard')
      return { ok: true, id: parsed.data.id }
    } catch (err) {
      authLogger.error({ err, layoutId: parsed.data.id }, 'failed to update dashboard layout')
      return { ok: false, error: { code: 'INTERNAL', message: 'Erro ao atualizar' } }
    }
  })
}

export async function setDefaultDashboardLayoutAction(input: {
  id: string
}): Promise<DashboardLayoutActionResult> {
  return withCorrelatedAction(async () => {
    const session = await resolveSession()
    if (!session) return { ok: false, error: { code: 'UNAUTHORIZED', message: 'Sessao expirou' } }

    const parsed = z.object({ id: z.string().uuid() }).safeParse(input)
    if (!parsed.success) {
      return { ok: false, error: { code: 'INVALID', message: 'id invalido' } }
    }

    const existing = await getDashboardLayoutById({
      id: parsed.data.id,
      workspaceId: session.workspaceId,
      userId: session.userId,
    })
    if (!existing) {
      return { ok: false, error: { code: 'NOT_FOUND', message: 'View nao encontrada' } }
    }

    try {
      await setDashboardLayoutAsDefault({
        id: parsed.data.id,
        workspaceId: session.workspaceId,
        userId: session.userId,
      })
      revalidatePath('/dashboard')
      return { ok: true, id: parsed.data.id }
    } catch (err) {
      authLogger.error({ err }, 'failed to set default layout')
      return { ok: false, error: { code: 'INTERNAL', message: 'Erro ao definir padrao' } }
    }
  })
}

export async function deleteDashboardLayoutAction(input: {
  id: string
}): Promise<DashboardLayoutActionResult> {
  return withCorrelatedAction(async () => {
    const session = await resolveSession()
    if (!session) return { ok: false, error: { code: 'UNAUTHORIZED', message: 'Sessao expirou' } }

    const parsed = z.object({ id: z.string().uuid() }).safeParse(input)
    if (!parsed.success) {
      return { ok: false, error: { code: 'INVALID', message: 'id invalido' } }
    }

    const existing = await getDashboardLayoutById({
      id: parsed.data.id,
      workspaceId: session.workspaceId,
      userId: session.userId,
    })
    if (!existing) {
      return { ok: false, error: { code: 'NOT_FOUND', message: 'View nao encontrada' } }
    }

    try {
      await softDeleteDashboardLayout({
        id: parsed.data.id,
        workspaceId: session.workspaceId,
        userId: session.userId,
      })
      revalidatePath('/dashboard')
      return { ok: true, id: parsed.data.id }
    } catch (err) {
      authLogger.error({ err }, 'failed to delete dashboard layout')
      return { ok: false, error: { code: 'INTERNAL', message: 'Erro ao excluir' } }
    }
  })
}
