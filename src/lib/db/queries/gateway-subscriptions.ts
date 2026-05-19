import { and, eq } from 'drizzle-orm'

import { db } from '@/lib/db'
import { gatewaySubscriptions } from '@/lib/db/schema/gateway'
import type { GatewaySubscription, NewGatewaySubscription } from '@/lib/db/schema'

/**
 * Upsert por `(workspace_id, connection_id, subscriber_code)` UNIQUE.
 * Atualiza estado materializado da subscription apos cada webhook relevante.
 *
 * Snapshot do `origin` so e gravado na CRIACAO (primeira venda) — renovacoes
 * preservam o origin original. Caller deve passar `origin: undefined` em
 * eventos de renovacao para nao sobrescrever.
 */
export async function upsertSubscription(
  input: NewGatewaySubscription
): Promise<GatewaySubscription> {
  const [row] = await db
    .insert(gatewaySubscriptions)
    .values(input)
    .onConflictDoUpdate({
      target: [
        gatewaySubscriptions.workspaceId,
        gatewaySubscriptions.connectionId,
        gatewaySubscriptions.subscriberCode,
      ],
      set: {
        status: input.status,
        planId: input.planId,
        productId: input.productId,
        nextChargeDate: input.nextChargeDate,
        endAccessionDate: input.endAccessionDate,
        currentRecurrence: input.currentRecurrence,
        cancellationReason: input.cancellationReason,
        monthlyValueCents: input.monthlyValueCents,
        currency: input.currency,
        identifiedVisitorId: input.identifiedVisitorId,
        updatedAt: new Date(),
        // origin propositalmente NAO atualizado (snapshot da venda inicial)
      },
    })
    .returning()

  if (!row) throw new Error('upsertSubscription: no row returned')
  return row
}

export async function getSubscription(
  workspaceId: string,
  connectionId: string,
  subscriberCode: string
): Promise<GatewaySubscription | null> {
  const row = await db.query.gatewaySubscriptions.findFirst({
    where: and(
      eq(gatewaySubscriptions.workspaceId, workspaceId),
      eq(gatewaySubscriptions.connectionId, connectionId),
      eq(gatewaySubscriptions.subscriberCode, subscriberCode)
    ),
  })
  return row ?? null
}

export async function markSubscriptionCancelled(
  workspaceId: string,
  connectionId: string,
  subscriberCode: string,
  reason?: string
): Promise<void> {
  await db
    .update(gatewaySubscriptions)
    .set({
      status: 'CANCELLED',
      cancellationReason: reason,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(gatewaySubscriptions.workspaceId, workspaceId),
        eq(gatewaySubscriptions.connectionId, connectionId),
        eq(gatewaySubscriptions.subscriberCode, subscriberCode)
      )
    )
}

export async function listActiveSubscriptions(workspaceId: string): Promise<GatewaySubscription[]> {
  return db.query.gatewaySubscriptions.findMany({
    where: and(
      eq(gatewaySubscriptions.workspaceId, workspaceId),
      eq(gatewaySubscriptions.status, 'ACTIVE')
    ),
  })
}
