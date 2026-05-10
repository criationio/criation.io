import { and, eq, isNull, sql } from 'drizzle-orm'

import { db } from '@/lib/db'
import { gatewayConnections } from '@/lib/db/schema/connections'
import type { GatewayConnection, NewGatewayConnection } from '@/lib/db/schema'

import type { GatewayProvider } from '@/lib/services/gateways/types'

export async function getActiveConnection(
  workspaceId: string,
  provider: GatewayProvider
): Promise<GatewayConnection | null> {
  const row = await db.query.gatewayConnections.findFirst({
    where: and(
      eq(gatewayConnections.workspaceId, workspaceId),
      eq(gatewayConnections.provider, provider),
      isNull(gatewayConnections.deletedAt)
    ),
  })
  return row ?? null
}

export async function getConnectionById(connectionId: string): Promise<GatewayConnection | null> {
  const row = await db.query.gatewayConnections.findFirst({
    where: and(eq(gatewayConnections.id, connectionId), isNull(gatewayConnections.deletedAt)),
  })
  return row ?? null
}

export async function listActiveConnections(
  provider?: GatewayProvider
): Promise<GatewayConnection[]> {
  return db.query.gatewayConnections.findMany({
    where: and(
      isNull(gatewayConnections.deletedAt),
      eq(gatewayConnections.status, 'active'),
      provider ? eq(gatewayConnections.provider, provider) : undefined
    ),
  })
}

export async function insertConnection(input: NewGatewayConnection): Promise<GatewayConnection> {
  const [row] = await db.insert(gatewayConnections).values(input).returning()
  if (!row) throw new Error('insertConnection: no row returned')
  return row
}

/**
 * Soft delete (`deleted_at`). Mantem dados de evento ligados (FK CASCADE so
 * dispara em hard delete). Re-conexao no mesmo workspace+provider e permitida
 * via INSERT novo apos soft delete (UNIQUE parcial WHERE deleted_at IS NULL).
 */
export async function softDeleteConnection(connectionId: string): Promise<void> {
  await db
    .update(gatewayConnections)
    .set({ deletedAt: new Date(), status: 'disconnected' })
    .where(eq(gatewayConnections.id, connectionId))
}

/**
 * Atualiza telemetria de webhook recebido. Resetea contador de falhas se
 * o ultimo evento foi sucesso.
 */
export async function recordWebhookEvent(connectionId: string, eventId: string): Promise<void> {
  await db
    .update(gatewayConnections)
    .set({
      lastWebhookEventAt: new Date(),
      lastWebhookEventId: eventId,
      webhookFailures24h: 0,
    })
    .where(eq(gatewayConnections.id, connectionId))
}

export async function incrementWebhookFailures(connectionId: string): Promise<void> {
  await db
    .update(gatewayConnections)
    .set({
      webhookFailures24h: sql`${gatewayConnections.webhookFailures24h} + 1`,
    })
    .where(eq(gatewayConnections.id, connectionId))
}

export async function markConnectionStatus(connectionId: string, status: string): Promise<void> {
  await db.update(gatewayConnections).set({ status }).where(eq(gatewayConnections.id, connectionId))
}
