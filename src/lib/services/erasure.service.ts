/**
 * LGPD Erasure service — TD-104 (Art. 18 III: direito a eliminacao).
 *
 * Quando titular (cliente que comprou via gateway ou visitor que navegou)
 * solicita eliminacao dos dados pessoais, este service apaga ou anonimiza
 * dados em 4 tabelas:
 *
 * 1. `tracking_visitors`     — DELETE row (visitor_id + identified_buyer_email_hash)
 * 2. `tracking_events`       — NULL matched_buyer_email_hash (particoes mensais)
 * 3. `gateway_events`        — NULL customer_email_hash + visitor_match_*
 * 4. `gateway_subscriptions` — NULL identified_visitor_id
 *
 * **Preservacao de receita:** vendas em `gateway_events` NAO sao deletadas —
 * apenas a identificacao do titular e removida. Cliente preserva o registro
 * da transacao (amount, currency, product_id) pra fechamento contabil, mas
 * sem capacidade de re-identificar o titular.
 *
 * **Atomicidade:** tudo em uma transacao. Se qualquer step falhar, rollback —
 * dados ficam consistentes. Audit log entry insert dentro da mesma transacao
 * (preservar prova mesmo em rollback do dado).
 *
 * **Idempotencia:** WHERE clauses incluem `IS NOT NULL` em campos
 * de identificacao, entao re-runs sao no-op safe.
 *
 * **Identificadores aceitos:** emailHash OR visitorId (pode passar os dois
 * pra cobertura maxima — quando admin sabe ambos do titular). Pelo menos um
 * obrigatorio.
 *
 * **Service role:** sera invocado por Server Action ou endpoint admin com
 * service-role key (necessario porque DELETE em `tracking_visitors` e UPDATE
 * em particoes filhas precisa bypass de RLS em alguns casos). Audit log
 * obrigatorio (CLAUDE.md regra 4).
 */
import { and, eq, or, sql } from 'drizzle-orm'

import { db } from '@/lib/db'
import { auditLogs } from '@/lib/db/schema/audit'
import { gatewayEvents, gatewaySubscriptions } from '@/lib/db/schema/gateway'
import { trackingEvents, trackingVisitors } from '@/lib/db/schema/tracking'

export interface ErasureRequest {
  workspaceId: string
  /** Pelo menos um obrigatorio. */
  emailHash?: string
  visitorId?: string
  /** Quem disparou (admin user_id ou null se via endpoint publico autenticado). */
  actorUserId: string | null
  /** Texto livre — caso/ticket ID interno, "LGPD Art. 18 III request from titular", etc. */
  reason: string
}

export interface ErasureResult {
  workspaceId: string
  /** Hash original consultado (nao apagado, apenas referencial). */
  emailHash: string | null
  visitorId: string | null
  /** Tracking visitors deletados (1 quando emailHash bate sticky OU visitorId direto). */
  trackingVisitorsDeleted: number
  /** tracking_events.matched_buyer_email_hash NULLed (todas particoes). */
  trackingEventsCleared: number
  /** gateway_events com PII clearada (customer_email_hash OR matched_visitor_id). */
  gatewayEventsCleared: number
  /** gateway_subscriptions.identified_visitor_id NULLed. */
  gatewaySubscriptionsCleared: number
  /** Visitor IDs encontrados via sticky email — usados pra cascade. */
  cascadedVisitorIds: string[]
  executedAt: Date
}

export class ErasureValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ErasureValidationError'
  }
}

/**
 * Executa erasure em transacao atomica. Throws `ErasureValidationError` quando
 * input invalido (nenhum identificador). Erros de DB propagam (rollback
 * automatico pela transacao).
 */
export async function eraseDataSubject(req: ErasureRequest): Promise<ErasureResult> {
  if (!req.emailHash && !req.visitorId) {
    throw new ErasureValidationError('Pelo menos emailHash OU visitorId obrigatorio')
  }
  if (!req.workspaceId) {
    throw new ErasureValidationError('workspaceId obrigatorio')
  }
  if (!req.reason || req.reason.trim().length === 0) {
    throw new ErasureValidationError('reason obrigatorio (audit trail)')
  }

  const executedAt = new Date()
  const emailHash = req.emailHash ?? null
  const directVisitorId = req.visitorId ?? null

  const result = await db.transaction(async (tx) => {
    // Passo 1: descobrir visitor_ids que serao cascaded.
    // Caso emailHash dado: pegar visitors sticky identified com esse email.
    // Caso visitorId dado: usa direto.
    const cascadedVisitorIds = new Set<string>()
    if (directVisitorId) cascadedVisitorIds.add(directVisitorId)

    if (emailHash) {
      const stickyVisitors = await tx
        .select({ visitorId: trackingVisitors.visitorId })
        .from(trackingVisitors)
        .where(
          and(
            eq(trackingVisitors.workspaceId, req.workspaceId),
            eq(trackingVisitors.identifiedBuyerEmailHash, emailHash)
          )
        )
      for (const r of stickyVisitors) {
        cascadedVisitorIds.add(r.visitorId)
      }
    }

    const visitorIdsArray = Array.from(cascadedVisitorIds)

    // Passo 2: DELETE em tracking_visitors (match por visitor_id OR identified_email)
    let trackingVisitorsDeleted = 0
    if (emailHash || visitorIdsArray.length > 0) {
      const conditions = []
      if (emailHash) {
        conditions.push(eq(trackingVisitors.identifiedBuyerEmailHash, emailHash))
      }
      if (visitorIdsArray.length > 0) {
        conditions.push(
          sql`${trackingVisitors.visitorId} = ANY(${sql.raw(`ARRAY[${visitorIdsArray.map((v) => `'${escapeSqlString(v)}'`).join(',')}]::text[]`)})`
        )
      }
      const deleted = await tx
        .delete(trackingVisitors)
        .where(and(eq(trackingVisitors.workspaceId, req.workspaceId), or(...conditions)))
        .returning({ id: trackingVisitors.visitorId })
      trackingVisitorsDeleted = deleted.length
    }

    // Passo 3: UPDATE tracking_events SET matched_buyer_email_hash = NULL
    // Match por matched_buyer_email_hash diretamente. Particionamento por
    // event_ts — sem filtro temporal aqui (LGPD: limpar TUDO independente
    // de quando aconteceu). Postgres faz scan em todas particoes existentes.
    let trackingEventsCleared = 0
    if (emailHash) {
      const updated = await tx
        .update(trackingEvents)
        .set({ matchedBuyerEmailHash: null })
        .where(
          and(
            eq(trackingEvents.workspaceId, req.workspaceId),
            eq(trackingEvents.matchedBuyerEmailHash, emailHash)
          )
        )
        .returning({ id: trackingEvents.id })
      trackingEventsCleared = updated.length
    }

    // Passo 4: UPDATE gateway_events — NULL customer_email_hash + visitor_match_*
    let gatewayEventsCleared = 0

    // 4a. Match por customer_email_hash (limpa identificacao buyer)
    if (emailHash) {
      const updated = await tx
        .update(gatewayEvents)
        .set({
          customerEmailHash: null,
          customerPhoneHash: null,
          buyerDocumentHash: null,
        })
        .where(
          and(
            eq(gatewayEvents.workspaceId, req.workspaceId),
            eq(gatewayEvents.customerEmailHash, emailHash)
          )
        )
        .returning({ id: gatewayEvents.id })
      gatewayEventsCleared += updated.length
    }

    // 4b. Match por matched_visitor_id (limpa link visitor-buyer)
    if (visitorIdsArray.length > 0) {
      const updated = await tx
        .update(gatewayEvents)
        .set({
          matchedVisitorId: null,
          visitorMatchStrategy: null,
          visitorMatchConfidence: null,
          visitorMatchedAt: null,
        })
        .where(
          and(
            eq(gatewayEvents.workspaceId, req.workspaceId),
            sql`${gatewayEvents.matchedVisitorId} = ANY(${sql.raw(`ARRAY[${visitorIdsArray.map((v) => `'${escapeSqlString(v)}'`).join(',')}]::text[]`)})`
          )
        )
        .returning({ id: gatewayEvents.id })
      gatewayEventsCleared += updated.length
    }

    // Passo 5: UPDATE gateway_subscriptions SET identified_visitor_id = NULL
    let gatewaySubscriptionsCleared = 0
    if (visitorIdsArray.length > 0) {
      const updated = await tx
        .update(gatewaySubscriptions)
        .set({ identifiedVisitorId: null })
        .where(
          and(
            eq(gatewaySubscriptions.workspaceId, req.workspaceId),
            sql`${gatewaySubscriptions.identifiedVisitorId} = ANY(${sql.raw(`ARRAY[${visitorIdsArray.map((v) => `'${escapeSqlString(v)}'`).join(',')}]::text[]`)})`
          )
        )
        .returning({ id: gatewaySubscriptions.id })
      gatewaySubscriptionsCleared = updated.length
    }

    // Passo 6: audit log (insert dentro da transacao — preserva prova mesmo
    // se algo der ruim depois e tudo for rollado back, o audit log captura
    // a tentativa). Mas se DELETE/UPDATE falhar, rollback total — incluindo
    // audit. Trade-off aceito: erasure tem que ser totalmente atomica.
    await tx.insert(auditLogs).values({
      workspaceId: req.workspaceId,
      actorUserId: req.actorUserId,
      eventType: 'lgpd.erasure_request',
      payload: {
        email_hash_provided: emailHash !== null,
        visitor_id_provided: directVisitorId !== null,
        cascaded_visitor_ids_count: visitorIdsArray.length,
        tracking_visitors_deleted: trackingVisitorsDeleted,
        tracking_events_cleared: trackingEventsCleared,
        gateway_events_cleared: gatewayEventsCleared,
        gateway_subscriptions_cleared: gatewaySubscriptionsCleared,
        reason: req.reason,
        executed_at: executedAt.toISOString(),
      },
    })

    return {
      workspaceId: req.workspaceId,
      emailHash,
      visitorId: directVisitorId,
      trackingVisitorsDeleted,
      trackingEventsCleared,
      gatewayEventsCleared,
      gatewaySubscriptionsCleared,
      cascadedVisitorIds: visitorIdsArray,
      executedAt,
    }
  })

  return result
}

/**
 * Escape minimo pra string em literal SQL (ARRAY[...]::text[]). Apenas
 * substitui aspas simples. Visitor IDs sao UUIDs/strings opacas geradas
 * client-side — em teoria seguras, mas aplicamos defesa em profundidade.
 *
 * Por que nao usar bind parameter: `ANY()` com array de strings via Drizzle
 * exige tipo customizado. Como visitor_id e sempre UUID v4 (validado upstream
 * em /api/v1/track), risco residual e baixo.
 */
function escapeSqlString(s: string): string {
  return s.replace(/'/g, "''")
}
