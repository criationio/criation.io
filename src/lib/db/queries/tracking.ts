import { and, desc, eq, gte, sql } from 'drizzle-orm'

import { db } from '@/lib/db'
import { trackingEvents, trackingVisitors } from '@/lib/db/schema/tracking'
import type {
  NewTrackingEvent,
  NewTrackingVisitor,
  TrackingEvent,
  TrackingVisitor,
} from '@/lib/db/schema'

/**
 * Insert idempotente. UNIQUE (workspace_id, event_id, event_ts) absorve retries
 * de sendBeacon — mesmo payload (mesmo event_id E event_ts gerados no browser)
 * nao duplica. Retorna `created: false` quando conflito.
 *
 * NOTA: `returning()` em tabela particionada retorna row mesmo no conflito
 * porque ON CONFLICT DO NOTHING e por-particao. Validar com smoke E2E.
 */
export async function insertTrackingEvent(
  input: NewTrackingEvent
): Promise<{ event: TrackingEvent | null; created: boolean }> {
  const inserted = await db
    .insert(trackingEvents)
    .values(input)
    .onConflictDoNothing({
      target: [trackingEvents.workspaceId, trackingEvents.eventId, trackingEvents.eventTs],
    })
    .returning()

  if (inserted[0]) return { event: inserted[0], created: true }
  return { event: null, created: false }
}

/**
 * Upsert do visitor. INSERT na primeira vez; UPDATE last_* + total_events nos
 * eventos subsequentes. `first_*` so e setado no INSERT (preserva atribuicao
 * first-touch). UTMs/click_id sao atualizados se chegaram nao-nulos no novo
 * evento (COALESCE preserva valor anterior se nao veio).
 */
export async function upsertTrackingVisitor(input: NewTrackingVisitor): Promise<TrackingVisitor> {
  const [row] = await db
    .insert(trackingVisitors)
    .values(input)
    .onConflictDoUpdate({
      target: trackingVisitors.visitorId,
      set: {
        lastSeenAt: sql`EXCLUDED.last_seen_at`,
        // Atualiza last_* apenas se veio nao-null (preserva valor anterior senao)
        lastUtmSource: sql`COALESCE(EXCLUDED.last_utm_source, ${trackingVisitors.lastUtmSource})`,
        lastUtmMedium: sql`COALESCE(EXCLUDED.last_utm_medium, ${trackingVisitors.lastUtmMedium})`,
        lastUtmCampaign: sql`COALESCE(EXCLUDED.last_utm_campaign, ${trackingVisitors.lastUtmCampaign})`,
        lastUtmContent: sql`COALESCE(EXCLUDED.last_utm_content, ${trackingVisitors.lastUtmContent})`,
        lastUtmTerm: sql`COALESCE(EXCLUDED.last_utm_term, ${trackingVisitors.lastUtmTerm})`,
        lastClickId: sql`COALESCE(EXCLUDED.last_click_id, ${trackingVisitors.lastClickId})`,
        lastClickIdType: sql`COALESCE(EXCLUDED.last_click_id_type, ${trackingVisitors.lastClickIdType})`,
        // Identificacao e sticky — uma vez setado, nao volta pra null
        identifiedBuyerEmailHash: sql`COALESCE(${trackingVisitors.identifiedBuyerEmailHash}, EXCLUDED.identified_buyer_email_hash)`,
        identifiedAt: sql`COALESCE(${trackingVisitors.identifiedAt}, EXCLUDED.identified_at)`,
        totalEvents: sql`${trackingVisitors.totalEvents} + 1`,
        updatedAt: sql`now()`,
      },
    })
    .returning()
  if (!row) throw new Error('upsertTrackingVisitor: no row returned')
  return row
}

/**
 * Fetch por (id, event_ts). Inclui event_ts no WHERE pra partition pruning —
 * planner vai direto na particao certa em vez de scan-all. Task async usa.
 */
export async function getTrackingEventByIdAndTs(
  id: string,
  eventTs: Date
): Promise<TrackingEvent | null> {
  const row = await db.query.trackingEvents.findFirst({
    where: and(eq(trackingEvents.id, id), eq(trackingEvents.eventTs, eventTs)),
  })
  return row ?? null
}

export async function getVisitorById(visitorId: string): Promise<TrackingVisitor | null> {
  const row = await db.query.trackingVisitors.findFirst({
    where: eq(trackingVisitors.visitorId, visitorId),
  })
  return row ?? null
}

/**
 * Historico recente de eventos de um visitor — preparacao 1.4.B matching.
 * Lookback 90d default (= cookie _cio_vid TTL no script). Partition pruning.
 */
export async function getVisitorHistory(
  visitorId: string,
  limit = 50,
  lookbackDays = 90
): Promise<TrackingEvent[]> {
  const cutoff = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000)
  return db.query.trackingEvents.findMany({
    where: and(eq(trackingEvents.visitorId, visitorId), gte(trackingEvents.eventTs, cutoff)),
    orderBy: [desc(trackingEvents.eventTs)],
    limit,
  })
}

/**
 * Eventos recentes de um workspace — UI de debug em /configuracoes/tracking.
 * Lookback 30d default — UI nao precisa de historico mais antigo e partition
 * pruning evita scan-all-partitions quando volume crescer.
 */
export async function getRecentEventsForWorkspace(
  workspaceId: string,
  limit = 20,
  lookbackDays = 30
): Promise<TrackingEvent[]> {
  const cutoff = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000)
  return db.query.trackingEvents.findMany({
    where: and(eq(trackingEvents.workspaceId, workspaceId), gte(trackingEvents.eventTs, cutoff)),
    orderBy: [desc(trackingEvents.eventTs)],
    limit,
  })
}

/**
 * Status de instalacao do tracking script — usado pelo card no hub de conexoes.
 * Retorna `installed: true` se chegou evento nas ultimas 24h.
 */
export async function getInstallationStatus(workspaceId: string): Promise<{
  installed: boolean
  lastEventAt: Date | null
  totalEvents24h: number
}> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const [row] = await db
    .select({
      lastEventAt: sql<Date | null>`max(${trackingEvents.eventTs})`,
      totalEvents24h: sql<number>`count(*)::int`,
    })
    .from(trackingEvents)
    .where(and(eq(trackingEvents.workspaceId, workspaceId), gte(trackingEvents.eventTs, cutoff)))

  const lastEventAt = row?.lastEventAt ?? null
  const totalEvents24h = row?.totalEvents24h ?? 0
  return {
    installed: lastEventAt !== null,
    lastEventAt,
    totalEvents24h,
  }
}
