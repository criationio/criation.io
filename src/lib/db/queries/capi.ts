import { and, desc, eq, sql } from 'drizzle-orm'

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

/** Active meta_connection do workspace (1:1 via UNIQUE). Exclui soft-deleted
 * — workspace que reconectou Meta pode ter row antiga com status='active' +
 * deletedAt setado. */
export async function getActiveMetaConnection(workspaceId: string): Promise<MetaConnection | null> {
  const rows = await db
    .select()
    .from(metaConnections)
    .where(
      and(
        eq(metaConnections.workspaceId, workspaceId),
        eq(metaConnections.status, 'active'),
        sql`${metaConnections.deletedAt} IS NULL`
      )
    )
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

/**
 * Sweep defensivo: tracking_events com fanout_meta_status='pending' parados
 * ha mais de 5min. Cron re-enfileira via fanoutMetaCapiTask. Janela de 7d
 * pra nao reprocessar eventos muito antigos (downtime catch-up bounded).
 *
 * Rate-limit per workspace via row_number() PARTITION BY workspace_id (audit
 * P1 #5): cap maxPerWorkspace=20 eventos por workspace por ciclo de cron.
 * Evita 1 workspace com 1000 pending monopolizar a quota global de 100.
 *
 * Usa indice parcial `tracking_events_pending_meta_idx` (criado em 0009).
 */
export async function listPendingMetaFanout(
  limit = 100,
  maxPerWorkspace = 20
): Promise<Array<{ id: string; eventTs: Date; workspaceId: string; eventId: string }>> {
  const rows = await db.execute<{
    id: string
    event_ts: Date
    workspace_id: string
    event_id: string
  }>(
    sql`SELECT id, event_ts, workspace_id, event_id
      FROM (
        SELECT id, event_ts, workspace_id, event_id,
          row_number() OVER (PARTITION BY workspace_id ORDER BY event_ts) AS rn
        FROM tracking_events
        WHERE fanout_meta_status = 'pending'
          AND event_ts < now() - interval '5 minutes'
          AND event_ts > now() - interval '7 days'
      ) t
      WHERE rn <= ${maxPerWorkspace}
      ORDER BY event_ts
      LIMIT ${limit}`
  )

  return (
    rows as unknown as Array<{
      id: string
      event_ts: Date
      workspace_id: string
      event_id: string
    }>
  ).map((r) => ({
    id: r.id,
    eventTs: new Date(r.event_ts),
    workspaceId: r.workspace_id,
    eventId: r.event_id,
  }))
}

/**
 * Eventos CAPI recentes pra dashboard `/tracking` (1.4.9 step 11).
 * Ordenado por event_time DESC. Inclui status + http_status pra UI mostrar
 * tone (success/danger/warning).
 */
export async function getRecentCapiEvents(
  workspaceId: string,
  limit = 10
): Promise<
  Array<{
    id: string
    eventName: string
    eventTime: Date
    status: string
    pixelId: string | null
    actionSource: string | null
  }>
> {
  const rows = await db
    .select({
      id: capiEvents.id,
      eventName: capiEvents.eventName,
      eventTime: capiEvents.eventTime,
      status: capiEvents.status,
      pixelId: capiEvents.pixelId,
      actionSource: capiEvents.actionSource,
    })
    .from(capiEvents)
    .where(and(eq(capiEvents.workspaceId, workspaceId), eq(capiEvents.provider, 'meta')))
    .orderBy(desc(capiEvents.eventTime))
    .limit(limit)
  return rows
}

/**
 * Stats agregados pro wizard `/configuracoes/meta/eventos` (1.4.9 step 10).
 * Top event_names por count last 7d + totals last 24h por status.
 */
export interface MetaFanoutStats {
  totalSent24h: number
  totalFailed24h: number
  totalSkipped24h: number
  totalPending: number
  topEvents7d: Array<{ eventName: string; count: number }>
  lastSentAt: Date | null
}

export async function getMetaFanoutStats(workspaceId: string): Promise<MetaFanoutStats> {
  const [totals, topEvents, lastSent] = await Promise.all([
    db
      .select({
        status: capiEvents.status,
        c: sql<number>`count(*)::int`,
      })
      .from(capiEvents)
      .where(
        sql`${capiEvents.workspaceId} = ${workspaceId}
          AND ${capiEvents.provider} = 'meta'
          AND ${capiEvents.eventTime} > now() - interval '24 hours'`
      )
      .groupBy(capiEvents.status),
    db
      .select({
        eventName: capiEvents.eventName,
        c: sql<number>`count(*)::int`,
      })
      .from(capiEvents)
      .where(
        sql`${capiEvents.workspaceId} = ${workspaceId}
          AND ${capiEvents.provider} = 'meta'
          AND ${capiEvents.eventTime} > now() - interval '7 days'
          AND ${capiEvents.status} = 'sent'`
      )
      .groupBy(capiEvents.eventName)
      .orderBy(sql`count(*) DESC`)
      .limit(10),
    db
      .select({ sentAt: capiEvents.sentAt })
      .from(capiEvents)
      .where(
        and(
          eq(capiEvents.workspaceId, workspaceId),
          eq(capiEvents.provider, 'meta'),
          eq(capiEvents.status, 'sent')
        )
      )
      .orderBy(desc(capiEvents.sentAt))
      .limit(1),
  ])

  const totalsByStatus = new Map<string, number>(totals.map((r) => [r.status, r.c]))
  const pendingTotal = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(trackingEvents)
    .where(
      sql`${trackingEvents.workspaceId} = ${workspaceId}
        AND ${trackingEvents.fanoutMetaStatus} = 'pending'
        AND ${trackingEvents.eventTs} > now() - interval '7 days'`
    )

  return {
    totalSent24h: totalsByStatus.get('sent') ?? 0,
    totalFailed24h: totalsByStatus.get('failed') ?? 0,
    totalSkipped24h: totalsByStatus.get('skipped') ?? 0,
    totalPending: pendingTotal[0]?.c ?? 0,
    topEvents7d: topEvents.map((e) => ({ eventName: e.eventName, count: e.c })),
    lastSentAt: lastSent[0]?.sentAt ?? null,
  }
}

// ---------------------------------------------------------------------------
// Google fanout — sibling helpers (1.4.9.B / ADR-015)
// ---------------------------------------------------------------------------

/**
 * Atualiza status de fanout Google no tracking_events. Idempotente.
 */
export async function updateFanoutGoogleStatus(args: {
  id: string
  eventTs: Date
  status: 'pending' | 'sent' | 'failed' | 'skipped'
  errorMessage: string | null
}): Promise<void> {
  await db
    .update(trackingEvents)
    .set({
      fanoutGoogleStatus: args.status,
      fanoutGoogleSentAt: args.status === 'sent' ? new Date() : null,
      fanoutGoogleError: args.errorMessage,
    })
    .where(and(eq(trackingEvents.id, args.id), eq(trackingEvents.eventTs, args.eventTs)))
}

/**
 * Stats agregados pro wizard `/configuracoes/google/conversoes` + aba
 * Google do /tracking (1.4.9.B step 11). Mesmo shape do Meta — UI espelha.
 */
export interface GoogleFanoutStats {
  totalSent24h: number
  totalFailed24h: number
  totalSkipped24h: number
  totalPending: number
  topEvents7d: Array<{ eventName: string; count: number }>
  lastSentAt: Date | null
}

export async function getGoogleFanoutStats(workspaceId: string): Promise<GoogleFanoutStats> {
  const [totals, topEvents, lastSent] = await Promise.all([
    db
      .select({ status: capiEvents.status, c: sql<number>`count(*)::int` })
      .from(capiEvents)
      .where(
        sql`${capiEvents.workspaceId} = ${workspaceId}
          AND ${capiEvents.provider} = 'google'
          AND ${capiEvents.eventTime} > now() - interval '24 hours'`
      )
      .groupBy(capiEvents.status),
    db
      .select({ eventName: capiEvents.eventName, c: sql<number>`count(*)::int` })
      .from(capiEvents)
      .where(
        sql`${capiEvents.workspaceId} = ${workspaceId}
          AND ${capiEvents.provider} = 'google'
          AND ${capiEvents.eventTime} > now() - interval '7 days'
          AND ${capiEvents.status} = 'sent'`
      )
      .groupBy(capiEvents.eventName)
      .orderBy(sql`count(*) DESC`)
      .limit(10),
    db
      .select({ sentAt: capiEvents.sentAt })
      .from(capiEvents)
      .where(
        and(
          eq(capiEvents.workspaceId, workspaceId),
          eq(capiEvents.provider, 'google'),
          eq(capiEvents.status, 'sent')
        )
      )
      .orderBy(desc(capiEvents.sentAt))
      .limit(1),
  ])

  const totalsByStatus = new Map<string, number>(totals.map((r) => [r.status, r.c]))
  const pendingTotal = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(trackingEvents)
    .where(
      sql`${trackingEvents.workspaceId} = ${workspaceId}
        AND ${trackingEvents.fanoutGoogleStatus} = 'pending'
        AND ${trackingEvents.eventTs} > now() - interval '7 days'`
    )

  return {
    totalSent24h: totalsByStatus.get('sent') ?? 0,
    totalFailed24h: totalsByStatus.get('failed') ?? 0,
    totalSkipped24h: totalsByStatus.get('skipped') ?? 0,
    totalPending: pendingTotal[0]?.c ?? 0,
    topEvents7d: topEvents.map((e) => ({ eventName: e.eventName, count: e.c })),
    lastSentAt: lastSent[0]?.sentAt ?? null,
  }
}

/**
 * Ultimos 10 capi_events do provider Google. Inclui google_customer_id e
 * google_product_destination_id pra a tabela do /tracking distinguir entre
 * Meta (pixel_id) e Google (conta + conversion action).
 */
export async function getRecentGoogleCapiEvents(
  workspaceId: string,
  limit = 10
): Promise<
  Array<{
    id: string
    eventName: string
    eventTime: Date
    status: string
    googleCustomerId: string | null
    googleProductDestinationId: string | null
  }>
> {
  return db
    .select({
      id: capiEvents.id,
      eventName: capiEvents.eventName,
      eventTime: capiEvents.eventTime,
      status: capiEvents.status,
      googleCustomerId: capiEvents.googleCustomerId,
      googleProductDestinationId: capiEvents.googleProductDestinationId,
    })
    .from(capiEvents)
    .where(and(eq(capiEvents.workspaceId, workspaceId), eq(capiEvents.provider, 'google')))
    .orderBy(desc(capiEvents.eventTime))
    .limit(limit)
}

/**
 * Sweep defensivo Google: igual ao Meta mas filtra fanout_google_status.
 * Usa indice `tracking_events_pending_google_idx`.
 */
export async function listPendingGoogleFanout(
  limit = 100,
  maxPerWorkspace = 20
): Promise<Array<{ id: string; eventTs: Date; workspaceId: string; eventId: string }>> {
  const rows = await db.execute<{
    id: string
    event_ts: Date
    workspace_id: string
    event_id: string
  }>(
    sql`SELECT id, event_ts, workspace_id, event_id
      FROM (
        SELECT id, event_ts, workspace_id, event_id,
          row_number() OVER (PARTITION BY workspace_id ORDER BY event_ts) AS rn
        FROM tracking_events
        WHERE fanout_google_status = 'pending'
          AND event_ts < now() - interval '5 minutes'
          AND event_ts > now() - interval '7 days'
      ) t
      WHERE rn <= ${maxPerWorkspace}
      ORDER BY event_ts
      LIMIT ${limit}`
  )

  return (
    rows as unknown as Array<{
      id: string
      event_ts: Date
      workspace_id: string
      event_id: string
    }>
  ).map((r) => ({
    id: r.id,
    eventTs: new Date(r.event_ts),
    workspaceId: r.workspace_id,
    eventId: r.event_id,
  }))
}

/**
 * Retro re-fanout candidates: eventos historicos do mesmo visitor que
 * acabaram de ganhar matched_buyer_email_hash via persistVisitorMatch
 * (1.4.B) — agora podem ser enviados pro Meta com external_id pos-match
 * (email-based), elevando EMQ.
 *
 * Filtros:
 *  - workspace_id + visitor_id pra escopo
 *  - matched_buyer_email_hash IS NOT NULL (so retroativo)
 *  - fanout_meta_status IN ('pending', 'skipped', 'failed') — NUNCA 'sent':
 *    Meta dedupa por event_id em janela 48h; re-enviar com mesmo event_id
 *    e descartado. Pra ja-sent o ganho de EMQ retroativo e zero.
 *  - event_ts > now() - 7d: alem disso campaign decisions ja foram feitas
 *
 * Cap 50 eventos pra evitar runaway quando visitor tem muitos eventos.
 */
export async function listRetroFanoutCandidates(input: {
  workspaceId: string
  visitorId: string
  limit?: number
}): Promise<Array<{ id: string; eventTs: Date }>> {
  const rows = await db
    .select({
      id: trackingEvents.id,
      eventTs: trackingEvents.eventTs,
    })
    .from(trackingEvents)
    .where(
      sql`${trackingEvents.workspaceId} = ${input.workspaceId}
        AND ${trackingEvents.visitorId} = ${input.visitorId}
        AND ${trackingEvents.matchedBuyerEmailHash} IS NOT NULL
        AND ${trackingEvents.fanoutMetaStatus} IN ('pending', 'skipped', 'failed')
        AND ${trackingEvents.eventTs} > now() - interval '7 days'`
    )
    .orderBy(trackingEvents.eventTs)
    .limit(input.limit ?? 50)
  return rows
}
