import { and, desc, eq, isNull } from 'drizzle-orm'

import { db } from '@/lib/db'
import type { DashboardFunnelRow, NewDashboardFunnelRow } from '@/lib/db/schema'
import { dashboardFunnels } from '@/lib/db/schema/dashboard'

/**
 * Queries pra dashboard_funnels (PR-13c).
 */

export async function listDashboardFunnels(workspaceId: string): Promise<DashboardFunnelRow[]> {
  return db
    .select()
    .from(dashboardFunnels)
    .where(and(eq(dashboardFunnels.workspaceId, workspaceId), isNull(dashboardFunnels.deletedAt)))
    .orderBy(desc(dashboardFunnels.isDefault), desc(dashboardFunnels.updatedAt))
}

export async function getDashboardFunnelById(input: {
  id: string
  workspaceId: string
}): Promise<DashboardFunnelRow | null> {
  const row = await db.query.dashboardFunnels.findFirst({
    where: and(
      eq(dashboardFunnels.id, input.id),
      eq(dashboardFunnels.workspaceId, input.workspaceId),
      isNull(dashboardFunnels.deletedAt)
    ),
  })
  return row ?? null
}

export async function getDefaultDashboardFunnel(
  workspaceId: string
): Promise<DashboardFunnelRow | null> {
  const row = await db.query.dashboardFunnels.findFirst({
    where: and(
      eq(dashboardFunnels.workspaceId, workspaceId),
      eq(dashboardFunnels.isDefault, true),
      isNull(dashboardFunnels.deletedAt)
    ),
  })
  return row ?? null
}

export async function createDashboardFunnel(
  input: NewDashboardFunnelRow
): Promise<DashboardFunnelRow> {
  const [row] = await db.insert(dashboardFunnels).values(input).returning()
  if (!row) throw new Error('dashboardFunnels insert returned no row')
  return row
}

export async function updateDashboardFunnel(input: {
  id: string
  workspaceId: string
  patch: Partial<{
    name: string
    description: string | null
    landingUrlPattern: string | null
    utmCampaignPattern: string | null
    productIds: string[]
  }>
}): Promise<void> {
  await db
    .update(dashboardFunnels)
    .set(input.patch)
    .where(
      and(
        eq(dashboardFunnels.id, input.id),
        eq(dashboardFunnels.workspaceId, input.workspaceId),
        isNull(dashboardFunnels.deletedAt)
      )
    )
}

export async function setDashboardFunnelAsDefault(input: {
  id: string
  workspaceId: string
}): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(dashboardFunnels)
      .set({ isDefault: false })
      .where(
        and(
          eq(dashboardFunnels.workspaceId, input.workspaceId),
          eq(dashboardFunnels.isDefault, true),
          isNull(dashboardFunnels.deletedAt)
        )
      )
    await tx
      .update(dashboardFunnels)
      .set({ isDefault: true })
      .where(
        and(
          eq(dashboardFunnels.id, input.id),
          eq(dashboardFunnels.workspaceId, input.workspaceId),
          isNull(dashboardFunnels.deletedAt)
        )
      )
  })
}

export async function softDeleteDashboardFunnel(input: {
  id: string
  workspaceId: string
}): Promise<void> {
  await db
    .update(dashboardFunnels)
    .set({ deletedAt: new Date() })
    .where(
      and(
        eq(dashboardFunnels.id, input.id),
        eq(dashboardFunnels.workspaceId, input.workspaceId),
        isNull(dashboardFunnels.deletedAt)
      )
    )
}
