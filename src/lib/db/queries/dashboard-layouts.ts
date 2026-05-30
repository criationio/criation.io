import { and, desc, eq, isNull, or, sql } from 'drizzle-orm'

import { db } from '@/lib/db'
import type { DashboardLayoutRow, NewDashboardLayoutRow } from '@/lib/db/schema'
import {
  dashboardLayouts,
  type DashboardFiltersData,
  type DashboardLayoutData,
} from '@/lib/db/schema/dashboard'

/**
 * Queries pra dashboard_layouts (Sessao 1.6).
 *
 * Cada row = uma view salva. Lista retorna shared workspace + privadas do
 * user (filtro feito em SQL via OR — RLS no banco ja garante seguranca).
 */

/**
 * Lista views acessiveis ao user no workspace (shared + suas privadas).
 * Ordena: shared primeiro, depois mais recentes.
 */
export async function listDashboardLayouts(input: {
  workspaceId: string
  userId: string
}): Promise<DashboardLayoutRow[]> {
  return db
    .select()
    .from(dashboardLayouts)
    .where(
      and(
        eq(dashboardLayouts.workspaceId, input.workspaceId),
        or(isNull(dashboardLayouts.userId), eq(dashboardLayouts.userId, input.userId)),
        isNull(dashboardLayouts.deletedAt)
      )
    )
    .orderBy(sql`${dashboardLayouts.userId} IS NULL DESC`, desc(dashboardLayouts.updatedAt))
}

/**
 * Pega a view default do user (privada primeiro, depois shared). Retorna null
 * se nenhuma view existe ainda — caller pode criar uma "Geral" default.
 */
export async function getDefaultDashboardLayout(input: {
  workspaceId: string
  userId: string
}): Promise<DashboardLayoutRow | null> {
  // Prefere default privado do user; fallback pra default shared.
  const privateDefault = await db.query.dashboardLayouts.findFirst({
    where: and(
      eq(dashboardLayouts.workspaceId, input.workspaceId),
      eq(dashboardLayouts.userId, input.userId),
      eq(dashboardLayouts.isDefault, true),
      isNull(dashboardLayouts.deletedAt)
    ),
  })
  if (privateDefault) return privateDefault

  const sharedDefault = await db.query.dashboardLayouts.findFirst({
    where: and(
      eq(dashboardLayouts.workspaceId, input.workspaceId),
      isNull(dashboardLayouts.userId),
      eq(dashboardLayouts.isDefault, true),
      isNull(dashboardLayouts.deletedAt)
    ),
  })
  return sharedDefault ?? null
}

/**
 * Pega view por id, validando workspace + accessivel pelo user.
 */
export async function getDashboardLayoutById(input: {
  id: string
  workspaceId: string
  userId: string
}): Promise<DashboardLayoutRow | null> {
  const row = await db.query.dashboardLayouts.findFirst({
    where: and(
      eq(dashboardLayouts.id, input.id),
      eq(dashboardLayouts.workspaceId, input.workspaceId),
      or(isNull(dashboardLayouts.userId), eq(dashboardLayouts.userId, input.userId)),
      isNull(dashboardLayouts.deletedAt)
    ),
  })
  return row ?? null
}

/**
 * Cria nova view. Pra view privada, passa userId; pra shared workspace, omit.
 */
export async function createDashboardLayout(input: {
  workspaceId: string
  userId: string | null
  name: string
  layout: DashboardLayoutData
  filters: DashboardFiltersData
  isDefault?: boolean
}): Promise<DashboardLayoutRow> {
  const payload: NewDashboardLayoutRow = {
    workspaceId: input.workspaceId,
    userId: input.userId,
    name: input.name,
    layout: input.layout,
    filters: input.filters,
    isDefault: input.isDefault ?? false,
  }
  const [row] = await db.insert(dashboardLayouts).values(payload).returning()
  if (!row) throw new Error('dashboardLayouts insert returned no row')
  return row
}

/**
 * Atualiza layout/filters/name de uma view.
 */
export async function updateDashboardLayout(input: {
  id: string
  workspaceId: string
  userId: string
  patch: Partial<{
    name: string
    layout: DashboardLayoutData
    filters: DashboardFiltersData
  }>
}): Promise<void> {
  await db
    .update(dashboardLayouts)
    .set(input.patch)
    .where(
      and(
        eq(dashboardLayouts.id, input.id),
        eq(dashboardLayouts.workspaceId, input.workspaceId),
        or(isNull(dashboardLayouts.userId), eq(dashboardLayouts.userId, input.userId)),
        isNull(dashboardLayouts.deletedAt)
      )
    )
}

/**
 * Marca view como default. Atomico: desmarca outros defaults do user antes
 * (unique index parcial enforced em SQL nao deixaria 2 simultaneos).
 */
export async function setDashboardLayoutAsDefault(input: {
  id: string
  workspaceId: string
  userId: string
}): Promise<void> {
  await db.transaction(async (tx) => {
    // Desmarca todos os outros defaults do mesmo (workspace, user).
    await tx
      .update(dashboardLayouts)
      .set({ isDefault: false })
      .where(
        and(
          eq(dashboardLayouts.workspaceId, input.workspaceId),
          eq(dashboardLayouts.userId, input.userId),
          eq(dashboardLayouts.isDefault, true),
          isNull(dashboardLayouts.deletedAt)
        )
      )
    // Marca o alvo como default. RLS garante que user so atinge views proprias.
    await tx
      .update(dashboardLayouts)
      .set({ isDefault: true })
      .where(
        and(
          eq(dashboardLayouts.id, input.id),
          eq(dashboardLayouts.workspaceId, input.workspaceId),
          or(isNull(dashboardLayouts.userId), eq(dashboardLayouts.userId, input.userId)),
          isNull(dashboardLayouts.deletedAt)
        )
      )
  })
}

/**
 * Soft delete. View some da lista mas mantida no DB pra audit.
 */
export async function softDeleteDashboardLayout(input: {
  id: string
  workspaceId: string
  userId: string
}): Promise<void> {
  await db
    .update(dashboardLayouts)
    .set({ deletedAt: new Date() })
    .where(
      and(
        eq(dashboardLayouts.id, input.id),
        eq(dashboardLayouts.workspaceId, input.workspaceId),
        or(isNull(dashboardLayouts.userId), eq(dashboardLayouts.userId, input.userId)),
        isNull(dashboardLayouts.deletedAt)
      )
    )
}
