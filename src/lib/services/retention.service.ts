/**
 * Retention service — TD-108 LGPD compliance.
 *
 * Plain IP/UA em `tracking_events` e `gateway_events` sao PII LGPD-sensitive.
 * Decisao arquitetural 1.4.9 (ADR-013 + audit Meta 2026-05): plain e necessario
 * pra Meta CAPI EMQ >= 7 e Google EC match rate. Hash HMAC fica como signal
 * estavel pra analytics de longo prazo. Plain tem **retention 30 dias** —
 * janela suficiente pra Meta dedupar via Pixel browser e propagar attribution.
 *
 * Base legal LGPD: art. 7º IX (legitimo interesse — proporcional e necessario
 * pra ROI publicitario). Retention curto, hash mantido pra analytics, plain
 * apenas durante janela ativa de attribution. DPIA documenta justificativa.
 *
 * Implementacao:
 * - UPDATE single-shot por tabela (sem batching). Volume MVP (~100 vendas/dia +
 *   ~1k tracking events/dia/cliente) torna lock contention nao-issue as 03:30
 *   UTC (low-traffic). Se virar problema, migrar pra batches de 10k via CTE.
 * - Particionamento de `tracking_events`: WHERE event_ts < N permite partition
 *   pruning natural — Postgres so toca particoes antigas.
 * - Idempotente: WHERE inclui `IS NOT NULL`, re-runs no-op.
 *
 * Audit log: insert em `audit_logs` com counts por tabela.
 */
import { sql } from 'drizzle-orm'

import { db } from '@/lib/db'
import { auditLogs } from '@/lib/db/schema/audit'

export interface PurgeResult {
  trackingEventsPurged: number
  gatewayEventsPurged: number
  retentionDays: number
  executedAt: Date
}

const RETENTION_DAYS = 30

/**
 * Purga plain IP/UA em `tracking_events` e `gateway_events` com idade > 30d.
 * Insere audit log com counts. Retorna sumario pra logger/observabilidade.
 *
 * Nao recebe `workspaceId` — purga global (cron daily). LGPD compliance
 * aplica universalmente, nao por workspace.
 */
export async function purgePlainPii(): Promise<PurgeResult> {
  const executedAt = new Date()

  // tracking_events (browser side): event_ts e a coluna de particionamento.
  // Postgres faz partition pruning automatico pelo WHERE event_ts < N.
  const trackingResult = await db.execute(
    sql`UPDATE tracking_events
        SET client_ip_address = NULL, client_user_agent = NULL
        WHERE event_ts < now() - interval '${sql.raw(String(RETENTION_DAYS))} days'
          AND (client_ip_address IS NOT NULL OR client_user_agent IS NOT NULL)`
  )

  // gateway_events (webhook side): created_at e a coluna de timestamp.
  // Tabela nao particionada — UPDATE percorre indice se houver, sequential
  // scan se nao (created_at sem index hoje; gateway_events tem volume baixo).
  const gatewayResult = await db.execute(
    sql`UPDATE gateway_events
        SET client_ip_address = NULL, client_user_agent = NULL
        WHERE created_at < now() - interval '${sql.raw(String(RETENTION_DAYS))} days'
          AND (client_ip_address IS NOT NULL OR client_user_agent IS NOT NULL)`
  )

  // postgres-js `db.execute` para UPDATE retorna `{ count }` quando dialect
  // Drizzle node-postgres ou `{ rowCount }` quando dialect postgres-js.
  // Normalizamos via cast seguro.
  const trackingPurged = extractRowCount(trackingResult)
  const gatewayPurged = extractRowCount(gatewayResult)

  await db.insert(auditLogs).values({
    workspaceId: null,
    actorUserId: null,
    eventType: 'lgpd.purge_plain_pii',
    payload: {
      tracking_events_purged: trackingPurged,
      gateway_events_purged: gatewayPurged,
      retention_days: RETENTION_DAYS,
      executed_at: executedAt.toISOString(),
    },
  })

  return {
    trackingEventsPurged: trackingPurged,
    gatewayEventsPurged: gatewayPurged,
    retentionDays: RETENTION_DAYS,
    executedAt,
  }
}

function extractRowCount(result: unknown): number {
  if (!result || typeof result !== 'object') return 0
  const r = result as { count?: number; rowCount?: number; rows?: { length?: number } }
  if (typeof r.count === 'number') return r.count
  if (typeof r.rowCount === 'number') return r.rowCount
  if (r.rows && typeof r.rows.length === 'number') return r.rows.length
  return 0
}
