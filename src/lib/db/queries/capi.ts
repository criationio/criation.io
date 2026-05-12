import { and, eq, sql } from 'drizzle-orm'

import { db } from '@/lib/db'
import {
  capiEventLog,
  capiEvents,
  gatewayEvents,
  metaConnections,
  trackingEvents,
} from '@/lib/db/schema'
import type {
  GatewayEvent,
  MetaConnection,
  NewCapiEvent,
  NewCapiEventLog,
  TrackingEvent,
} from '@/lib/db/schema'

/**
 * Queries Drizzle pra CAPI fanout (Sessao 1.4.9).
 *
 * Per CLAUDE.md regra 3 — queries vivem aqui, services consomem.
 */

/** Lookup direto por PK (event_ts partition key + id). */
export async function getTrackingEventById(
  id: string,
  eventTs: Date
): Promise<TrackingEvent | null> {
  const rows = await db
    .select()
    .from(trackingEvents)
    .where(and(eq(trackingEvents.id, id), eq(trackingEvents.eventTs, eventTs)))
    .limit(1)
  return rows[0] ?? null
}

/** Active meta_connection do workspace (1:1 via UNIQUE). */
export async function getActiveMetaConnection(workspaceId: string): Promise<MetaConnection | null> {
  const rows = await db
    .select()
    .from(metaConnections)
    .where(and(eq(metaConnections.workspaceId, workspaceId), eq(metaConnections.status, 'active')))
    .limit(1)
  return rows[0] ?? null
}

export async function getGatewayEventById(id: string): Promise<GatewayEvent | null> {
  const rows = await db.select().from(gatewayEvents).where(eq(gatewayEvents.id, id)).limit(1)
  return rows[0] ?? null
}

/**
 * Atualiza status de fanout no tracking_events. Idempotente — UPDATE com
 * WHERE estrito (id + event_ts).
 */
export async function updateFanoutMetaStatus(args: {
  id: string
  eventTs: Date
  status: 'pending' | 'sent' | 'failed' | 'skipped'
  errorMessage: string | null
}): Promise<void> {
  await db
    .update(trackingEvents)
    .set({
      fanoutMetaStatus: args.status,
      fanoutMetaSentAt: args.status === 'sent' ? new Date() : null,
      fanoutMetaError: args.errorMessage,
    })
    .where(and(eq(trackingEvents.id, args.id), eq(trackingEvents.eventTs, args.eventTs)))
}

/**
 * Upsert em capi_events. UNIQUE (workspace_id, provider, event_id, event_time)
 * — retry de fanout reusa mesma row (status atualizado, response_data novo).
 * Retorna o id da row (insert OR update existente).
 */
export async function upsertCapiEvent(row: NewCapiEvent): Promise<string> {
  const result = await db
    .insert(capiEvents)
    .values(row)
    .onConflictDoUpdate({
      target: [
        capiEvents.workspaceId,
        capiEvents.provider,
        capiEvents.eventId,
        capiEvents.eventTime,
      ],
      set: {
        status: row.status,
        responseData: row.responseData,
        sentAt: row.sentAt,
        eventMatchQuality: row.eventMatchQuality,
      },
    })
    .returning({ id: capiEvents.id })

  return result[0]!.id
}

/** Append-only log de tentativa HTTP (audit trail). */
export async function insertCapiEventLog(row: NewCapiEventLog): Promise<void> {
  await db.insert(capiEventLog).values(row)
}

/** Conta tentativas anteriores pra incrementar `attempt`. */
export async function countCapiEventLogAttempts(capiEventId: string): Promise<number> {
  const rows = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(capiEventLog)
    .where(eq(capiEventLog.capiEventId, capiEventId))
  return rows[0]?.c ?? 0
}
