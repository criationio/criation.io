import { and, eq, isNull, sql } from 'drizzle-orm'

import { db } from '@/lib/db'
import { connections } from '@/lib/db/schema/connections'
import type { Connection, NewConnection } from '@/lib/db/schema'

import type { GatewayProvider } from '@/lib/services/gateways/types'

/**
 * Categorias de integracao suportadas (ADR-019). Tabela `connections` aceita
 * varios tipos via coluna `type`. Hoje so 'gateway' esta implementado.
 */
export type ConnectionType =
  | 'gateway'
  | 'crm'
  | 'email'
  | 'ad_network'
  | 'analytics'
  | 'helpdesk'
  | 'communication'

export async function getActiveConnection(
  workspaceId: string,
  provider: GatewayProvider | string,
  type: ConnectionType = 'gateway'
): Promise<Connection | null> {
  const row = await db.query.connections.findFirst({
    where: and(
      eq(connections.workspaceId, workspaceId),
      eq(connections.type, type),
      eq(connections.provider, provider),
      isNull(connections.deletedAt)
    ),
  })
  return row ?? null
}

export async function getConnectionById(connectionId: string): Promise<Connection | null> {
  const row = await db.query.connections.findFirst({
    where: and(eq(connections.id, connectionId), isNull(connections.deletedAt)),
  })
  return row ?? null
}

export async function listActiveConnections(filter?: {
  provider?: GatewayProvider | string
  type?: ConnectionType
}): Promise<Connection[]> {
  return db.query.connections.findMany({
    where: and(
      isNull(connections.deletedAt),
      eq(connections.status, 'active'),
      filter?.provider ? eq(connections.provider, filter.provider) : undefined,
      filter?.type ? eq(connections.type, filter.type) : undefined
    ),
  })
}

export async function insertConnection(input: NewConnection): Promise<Connection> {
  const [row] = await db.insert(connections).values(input).returning()
  if (!row) throw new Error('insertConnection: no row returned')
  return row
}

/**
 * Soft delete (`deleted_at`). Mantem dados de evento ligados (FK CASCADE so
 * dispara em hard delete). Re-conexao no mesmo workspace+type+provider e
 * permitida via INSERT novo apos soft delete (UNIQUE parcial WHERE
 * deleted_at IS NULL).
 */
export async function softDeleteConnection(connectionId: string): Promise<void> {
  await db
    .update(connections)
    .set({ deletedAt: new Date(), status: 'disconnected' })
    .where(eq(connections.id, connectionId))
}

/**
 * Atualiza telemetria de webhook recebido. Reseta contador de falhas se
 * o ultimo evento foi sucesso.
 */
export async function recordWebhookEvent(connectionId: string, eventId: string): Promise<void> {
  await db
    .update(connections)
    .set({
      lastWebhookEventAt: new Date(),
      lastWebhookEventId: eventId,
      webhookFailures24h: 0,
    })
    .where(eq(connections.id, connectionId))
}

export async function incrementWebhookFailures(connectionId: string): Promise<void> {
  await db
    .update(connections)
    .set({
      webhookFailures24h: sql`${connections.webhookFailures24h} + 1`,
    })
    .where(eq(connections.id, connectionId))
}

export async function markConnectionStatus(connectionId: string, status: string): Promise<void> {
  await db.update(connections).set({ status }).where(eq(connections.id, connectionId))
}
