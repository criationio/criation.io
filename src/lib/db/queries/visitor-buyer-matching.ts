/**
 * Queries pro Visitor↔Buyer matching (Sessao 1.4.B / ADR-014).
 *
 * Cascata em ordem decrescente de confianca (4 estrategias):
 *  1. deterministic_xcode (1.0) — gateway_events.externalCode === tracking_visitors.visitorId
 *  2. clickid (0.9) — fbclid/gclid bate em tracking_visitors.last/firstClickId (lookback 7d)
 *  3. utm_recency (0.7) — visitor recente (24h) com mesma utm_campaign
 *  4. reverse_email (0.85) — disparado por matching reverso quando identify() chega no browser
 *
 * Cada funcao retorna apenas o visitor candidato. O service orquestra a cascata.
 *
 * Performance: todas as queries usam indices (PK/parcial). Volume MVP (~100
 * vendas/dia/cliente) nao precisa de cache.
 *
 * Audit fixes aplicados (2026-05-12):
 *  - A1: persistVisitorMatch step 2 filtra workspace_id (cross-workspace leak)
 *  - A4: findVisitorByClickId filtra por click id type (cross-type false match)
 *  - B5: findVisitorByXcode valida UUID v4 antes da query
 *  - B6: UPDATE retroativo em tracking_events com janela 90d (partition pruning)
 */
import { and, desc, eq, gte, isNull, or, sql } from 'drizzle-orm'
import type { ExtractTablesWithRelations } from 'drizzle-orm'
import type { PgTransaction } from 'drizzle-orm/pg-core'
import type { PostgresJsQueryResultHKT } from 'drizzle-orm/postgres-js'

import { db } from '@/lib/db'
import { gatewayEvents, gatewaySubscriptions } from '@/lib/db/schema/gateway'
import { trackingEvents, trackingVisitors } from '@/lib/db/schema/tracking'
import type * as schema from '@/lib/db/schema'
import type { TrackingVisitor } from '@/lib/db/schema'

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Janela retroativa pra UPDATE de tracking_events. Alinhada ao TTL do cookie
 * `_cio_vid` (90d) — alem disso o visitor nao volta com mesmo id de qualquer jeito.
 * Necessaria pra partition pruning funcionar (tracking_events particionada por event_ts).
 */
const RETROACTIVE_LOOKBACK_DAYS = 90

// ---------------------------------------------------------------------------
// Strategy 1 — deterministic xcode (visitor_id injetado via link enrichment)
// ---------------------------------------------------------------------------

/**
 * Match deterministico: o visitor_id chegou no checkout via xcode/s1/code1
 * (link enrichment do criation-tracking.js — Hotmart/Kiwify/Eduzz).
 *
 * Pela definicao do produto: visitor_id e UUID v4 do cookie `_cio_vid`. Se ele
 * bate exatamente com algum tracking_visitors.visitor_id do mesmo workspace,
 * confidence = 1.0.
 *
 * Audit B5: rejeita strings que nao sao UUID v4. Cliente legado podia ter
 * pego CPF/codigo interno em external_code e dar confidence 1.0 silencioso.
 */
export async function findVisitorByXcode(
  workspaceId: string,
  xcode: string
): Promise<TrackingVisitor | null> {
  if (!UUID_V4_RE.test(xcode)) return null
  const visitor = await db.query.trackingVisitors.findFirst({
    where: and(
      eq(trackingVisitors.workspaceId, workspaceId),
      eq(trackingVisitors.visitorId, xcode)
    ),
  })
  return visitor ?? null
}

// ---------------------------------------------------------------------------
// Strategy 2 — click ID match (fbclid/gclid no checkout vs visitor history)
// ---------------------------------------------------------------------------

const CLICKID_LOOKBACK_DAYS = 7

/**
 * Match por click ID. Cliente nao injetou xcode, mas o gateway preservou o
 * fbclid/gclid (alguns gateways copiam do referer). Cruza com tracking_visitors
 * que viram o mesmo click ID em janela de 7d.
 *
 * Audit A4: filtra por (lastClickIdType + lastClickId) e (firstClickIdType +
 * firstClickId) match exato — sem isso, fbclid='abc' podia bater em
 * gclid='abc' (improvavel mas possivel em testes ou colisao).
 *
 * Retorna o visitor mais recente (last_seen_at DESC) quando ha multiplos.
 *
 * NOTA: estrategia esta dormante hoje porque nenhum adapter de gateway
 * (Hotmart/Kiwify/Eduzz) extrai fbclid/gclid pro gateway_events.fbclid
 * ainda — `if (event.fbclid || event.gclid || event.ttclid)` no service
 * sempre cai pro proximo. Documentado em TD-105 (extract fbclid no adapter).
 */
export async function findVisitorByClickId(
  workspaceId: string,
  clickId: { fbclid?: string | null; gclid?: string | null; ttclid?: string | null }
): Promise<TrackingVisitor | null> {
  const cutoff = new Date(Date.now() - CLICKID_LOOKBACK_DAYS * 24 * 60 * 60 * 1000)
  const conditions: ReturnType<typeof sql>[] = []

  // Para cada tipo de clickid presente, gera o predicado especifico (last + first)
  if (clickId.fbclid) {
    conditions.push(
      sql`((${trackingVisitors.lastClickIdType} = 'fbclid' AND ${trackingVisitors.lastClickId} = ${clickId.fbclid})
         OR (${trackingVisitors.firstClickIdType} = 'fbclid' AND ${trackingVisitors.firstClickId} = ${clickId.fbclid}))`
    )
  }
  if (clickId.gclid) {
    conditions.push(
      sql`((${trackingVisitors.lastClickIdType} = 'gclid' AND ${trackingVisitors.lastClickId} = ${clickId.gclid})
         OR (${trackingVisitors.firstClickIdType} = 'gclid' AND ${trackingVisitors.firstClickId} = ${clickId.gclid}))`
    )
  }
  if (clickId.ttclid) {
    conditions.push(
      sql`((${trackingVisitors.lastClickIdType} = 'ttclid' AND ${trackingVisitors.lastClickId} = ${clickId.ttclid})
         OR (${trackingVisitors.firstClickIdType} = 'ttclid' AND ${trackingVisitors.firstClickId} = ${clickId.ttclid}))`
    )
  }

  if (conditions.length === 0) return null

  // OR entre todos os tipos presentes
  const clickIdMatch =
    conditions.length === 1 ? conditions[0]! : sql.join(conditions, sql.raw(' OR '))

  const visitor = await db.query.trackingVisitors.findFirst({
    where: and(
      eq(trackingVisitors.workspaceId, workspaceId),
      gte(trackingVisitors.lastSeenAt, cutoff),
      clickIdMatch
    ),
    orderBy: [desc(trackingVisitors.lastSeenAt)],
  })
  return visitor ?? null
}

// ---------------------------------------------------------------------------
// Strategy 3 — UTM + recência (24h)
// ---------------------------------------------------------------------------

const UTM_RECENCY_HOURS = 24

export interface UtmRecencyResult {
  visitor: TrackingVisitor | null
  /** true quando 2+ candidatos (rejeita pra evitar falso positivo, mas operador deve saber). */
  conflict: boolean
}

/**
 * Fallback fraco: visitor recente (24h) que viu mesma utm_campaign.
 * Confidence baixa porque mesma campanha pode ter sido vista por varios
 * visitors no mesmo dia.
 *
 * Audit C3: retorna { visitor, conflict } pro service logar conflito (antes
 * retornava NULL silencioso, sem operador saber quantas atribuicoes eram
 * perdidas por colisao).
 */
export async function findVisitorByUtmRecency(
  workspaceId: string,
  utmCampaign: string
): Promise<UtmRecencyResult> {
  const cutoff = new Date(Date.now() - UTM_RECENCY_HOURS * 60 * 60 * 1000)
  const candidates = await db
    .select()
    .from(trackingVisitors)
    .where(
      and(
        eq(trackingVisitors.workspaceId, workspaceId),
        gte(trackingVisitors.lastSeenAt, cutoff),
        sql`(${trackingVisitors.lastUtmCampaign} = ${utmCampaign} OR ${trackingVisitors.firstUtmCampaign} = ${utmCampaign})`
      )
    )
    .orderBy(desc(trackingVisitors.lastSeenAt))
    .limit(2)

  if (candidates.length === 0) return { visitor: null, conflict: false }
  if (candidates.length > 1) return { visitor: null, conflict: true }
  return { visitor: candidates[0]!, conflict: false }
}

// ---------------------------------------------------------------------------
// Persist match — UPDATE bidirecional (gateway_events + visitors + events + subscriptions)
// ---------------------------------------------------------------------------

export type VisitorMatchStrategy =
  | 'deterministic_xcode'
  | 'clickid'
  | 'utm_recency'
  | 'reverse_email'

export interface PersistVisitorMatchInput {
  /** gateway_events.id que esta sendo matched */
  gatewayEventId: string
  /** workspace pra escopar updates retroativos */
  workspaceId: string
  /** visitor_id que casou */
  visitorId: string
  strategy: VisitorMatchStrategy
  confidence: number
  /** Hash do email do buyer (gateway_events.customerEmailHash). Sticky no visitor. */
  buyerEmailHash: string | null
  /** subscriberCode do gateway_event (Hotmart subscriber.code). Atualiza
   *  gateway_subscriptions.identified_visitor_id quando presente. Audit B4. */
  subscriberCode?: string | null
  matchedAt: Date
  /** Se true, sobrescreve mesmo quando visitor_match_strategy='unmatched'.
   *  Usado pelo reverse matching (audit A2). */
  overrideUnmatched?: boolean
}

type Tx = PgTransaction<
  PostgresJsQueryResultHKT,
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>

/**
 * Persiste match em 4 lugares atomicos via transaction (audit C1 / TD-101 fix):
 *  1. gateway_events: UPDATE (idempotencia via WHERE).
 *  2. tracking_visitors: identified_buyer_email_hash sticky via COALESCE
 *     (audit A1: filtra por workspace_id pra evitar leak cross-workspace).
 *  3. tracking_events: UPDATE matched_buyer_email_hash retroativo (janela 90d
 *     pra partition pruning — audit B6).
 *  4. gateway_subscriptions: identifiedVisitorId sticky quando subscriberCode
 *     presente (audit B4 — fecha o loop visitor↔subscription pra dashboard MRR).
 *
 * Retroativo em (3) permite que fanout 1.4.9 envie EMQ alto pra eventos
 * historicos do visitor (Meta CAPI valoriza email hash mesmo em PageView).
 */
export async function persistVisitorMatch(input: PersistVisitorMatchInput): Promise<void> {
  await db.transaction(async (tx) => {
    // 1. UPDATE gateway_events (idempotente; A2: aceita override de unmatched)
    const gatewayWhere = input.overrideUnmatched
      ? and(
          eq(gatewayEvents.id, input.gatewayEventId),
          or(
            isNull(gatewayEvents.visitorMatchedAt),
            eq(gatewayEvents.visitorMatchStrategy, 'unmatched')
          )
        )
      : and(eq(gatewayEvents.id, input.gatewayEventId), isNull(gatewayEvents.visitorMatchedAt))

    await tx
      .update(gatewayEvents)
      .set({
        matchedVisitorId: input.visitorId,
        visitorMatchStrategy: input.strategy,
        visitorMatchConfidence: input.confidence.toString(),
        visitorMatchedAt: input.matchedAt,
      })
      .where(gatewayWhere)

    if (!input.buyerEmailHash) return

    // 2. UPDATE tracking_visitors sticky (A1: filtra por workspace_id)
    await tx
      .update(trackingVisitors)
      .set({
        identifiedBuyerEmailHash: sql`COALESCE(${trackingVisitors.identifiedBuyerEmailHash}, ${input.buyerEmailHash})`,
        identifiedAt: sql`COALESCE(${trackingVisitors.identifiedAt}, ${input.matchedAt})`,
      })
      .where(
        and(
          eq(trackingVisitors.visitorId, input.visitorId),
          eq(trackingVisitors.workspaceId, input.workspaceId)
        )
      )

    // 3. UPDATE tracking_events retroativo (janela 90d pra partition pruning — B6)
    const retroactiveCutoff = new Date(Date.now() - RETROACTIVE_LOOKBACK_DAYS * 24 * 60 * 60 * 1000)
    await tx
      .update(trackingEvents)
      .set({
        matchedBuyerEmailHash: input.buyerEmailHash,
        matchedAt: input.matchedAt,
      })
      .where(
        and(
          eq(trackingEvents.workspaceId, input.workspaceId),
          eq(trackingEvents.visitorId, input.visitorId),
          gte(trackingEvents.eventTs, retroactiveCutoff),
          isNull(trackingEvents.matchedBuyerEmailHash)
        )
      )

    // 4. UPDATE gateway_subscriptions.identified_visitor_id sticky (audit B4)
    if (input.subscriberCode) {
      await tx
        .update(gatewaySubscriptions)
        .set({
          identifiedVisitorId: sql`COALESCE(${gatewaySubscriptions.identifiedVisitorId}, ${input.visitorId})`,
        })
        .where(
          and(
            eq(gatewaySubscriptions.workspaceId, input.workspaceId),
            eq(gatewaySubscriptions.subscriberCode, input.subscriberCode)
          )
        )
    }
  })
}

/**
 * Marca gateway_event como "matcher rodou mas nao achou visitor". Necessario
 * pra idempotencia (visitor_matched_at populado evita re-run desnecessario)
 * e pra worker reverso saber que o evento ja foi avaliado.
 *
 * NOTA: o reverse matching (matchGatewayEventsForIdentifiedVisitor) tem direito
 * de sobrescrever este unmatched via overrideUnmatched=true em persistVisitorMatch.
 */
export async function markVisitorMatchUnmatched(
  gatewayEventId: string,
  matchedAt: Date
): Promise<void> {
  await db
    .update(gatewayEvents)
    .set({
      visitorMatchedAt: matchedAt,
      visitorMatchStrategy: 'unmatched',
    })
    .where(and(eq(gatewayEvents.id, gatewayEventId), isNull(gatewayEvents.visitorMatchedAt)))
}

/**
 * Reseta stitched_at quando reverse matching popula matched_visitor_id em evento
 * que ja foi stitched com strategy fraca (unmatched/meta_literal). Permite o
 * stitcher 2.0 re-rodar e usar visitor strategy (0.95). Audit B3.
 *
 * Retorna true se resetou (caller deve re-enfileirar stitchGatewayEventTask).
 */
export async function resetStitchIfWeakStrategy(gatewayEventId: string, tx?: Tx): Promise<boolean> {
  const runner = tx ?? db
  const result = await runner
    .update(gatewayEvents)
    .set({ stitchedAt: null })
    .where(
      and(
        eq(gatewayEvents.id, gatewayEventId),
        or(
          eq(gatewayEvents.matchStrategy, 'unmatched'),
          eq(gatewayEvents.matchStrategy, 'meta_literal')
        )
      )
    )
    .returning({ id: gatewayEvents.id })
  return result.length > 0
}

// ---------------------------------------------------------------------------
// Reverse matching — disparado por process-tracking-event quando vem identify
// ---------------------------------------------------------------------------

/**
 * Busca gateway_events recentes do mesmo buyer_email_hash. Audit A2: nao
 * filtra por visitor_matched_at — caller decide o que fazer com unmatched
 * (override) e matched (skip).
 *
 * Lookback 30d (alem disso a relevancia comercial cai). Limit 10 — clientes
 * fieis costumam ter <10 compras por mes.
 */
export async function findGatewayEventsByBuyerEmail(
  workspaceId: string,
  buyerEmailHash: string,
  lookbackDays = 30,
  limit = 10
): Promise<
  Array<{
    id: string
    externalCode: string | null
    fbclid: string | null
    gclid: string | null
    ttclid: string | null
    utmCampaign: string | null
    subscriberCode: string | null
    visitorMatchedAt: Date | null
    visitorMatchStrategy: string | null
    matchStrategy: string
  }>
> {
  const cutoff = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000)
  return db
    .select({
      id: gatewayEvents.id,
      externalCode: gatewayEvents.externalCode,
      fbclid: gatewayEvents.fbclid,
      gclid: gatewayEvents.gclid,
      ttclid: gatewayEvents.ttclid,
      utmCampaign: gatewayEvents.utmCampaign,
      subscriberCode: gatewayEvents.subscriberCode,
      visitorMatchedAt: gatewayEvents.visitorMatchedAt,
      visitorMatchStrategy: gatewayEvents.visitorMatchStrategy,
      matchStrategy: gatewayEvents.matchStrategy,
    })
    .from(gatewayEvents)
    .where(
      and(
        eq(gatewayEvents.workspaceId, workspaceId),
        eq(gatewayEvents.customerEmailHash, buyerEmailHash),
        gte(gatewayEvents.createdAt, cutoff)
      )
    )
    .orderBy(desc(gatewayEvents.createdAt))
    .limit(limit)
}
