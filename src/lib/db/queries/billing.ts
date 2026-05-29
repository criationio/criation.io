import { and, eq } from 'drizzle-orm'

import { db } from '@/lib/db'
import { creditBalances, creditPackages, subscriptions } from '@/lib/db/schema/billing'
import { workspaces } from '@/lib/db/schema/auth'

export type SubscriptionRow = typeof subscriptions.$inferSelect
export type NewSubscription = typeof subscriptions.$inferInsert

export async function getActiveSubscription(workspaceId: string) {
  const row = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.workspaceId, workspaceId),
  })
  return row ?? null
}

export async function getCreditBalance(workspaceId: string) {
  const row = await db.query.creditBalances.findFirst({
    where: eq(creditBalances.workspaceId, workspaceId),
  })
  return row ?? null
}

/** Assinatura por id do provider (resolve workspace no webhook). */
export async function getSubscriptionByProviderId(
  paymentProvider: string,
  providerSubscriptionId: string
): Promise<SubscriptionRow | null> {
  const row = await db.query.subscriptions.findFirst({
    where: and(
      eq(subscriptions.paymentProvider, paymentProvider),
      eq(subscriptions.providerSubscriptionId, providerSubscriptionId)
    ),
  })
  return row ?? null
}

/**
 * Upsert da assinatura por workspace (1 por workspace — unique). Usado pelo
 * webhook ao ativar/renovar. Atualiza plano/provider/ciclo/créditos.
 */
export async function upsertSubscription(input: NewSubscription): Promise<SubscriptionRow> {
  const [row] = await db
    .insert(subscriptions)
    .values(input)
    .onConflictDoUpdate({
      target: subscriptions.workspaceId,
      set: {
        planId: input.planId,
        status: input.status,
        paymentProvider: input.paymentProvider,
        providerSubscriptionId: input.providerSubscriptionId ?? null,
        providerCustomerId: input.providerCustomerId ?? null,
        creditsPerCycle: input.creditsPerCycle ?? 0,
        currentCycleStartedAt: input.currentCycleStartedAt ?? new Date(),
        currentCycleEndsAt: input.currentCycleEndsAt ?? new Date(),
        cancelledAt: input.cancelledAt ?? null,
        cancellationScheduledAt: input.cancellationScheduledAt ?? null,
        updatedAt: new Date(),
      },
    })
    .returning()
  if (!row) throw new Error('upsertSubscription nao retornou row')
  return row
}

/** Marca a assinatura como cancelada (sem revogar créditos do ciclo). */
export async function markSubscriptionCanceled(
  paymentProvider: string,
  providerSubscriptionId: string
): Promise<void> {
  await db
    .update(subscriptions)
    .set({ status: 'canceled', cancelledAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(subscriptions.paymentProvider, paymentProvider),
        eq(subscriptions.providerSubscriptionId, providerSubscriptionId)
      )
    )
}

/** Atualiza o plano do workspace (espelho do plano ativo p/ UI/budget). */
export async function setWorkspacePlan(workspaceId: string, planId: string): Promise<void> {
  await db.update(workspaces).set({ planId }).where(eq(workspaces.id, workspaceId))
}

export async function getCreditPackageBySku(sku: string) {
  const row = await db.query.creditPackages.findFirst({
    where: eq(creditPackages.sku, sku),
  })
  return row ?? null
}
