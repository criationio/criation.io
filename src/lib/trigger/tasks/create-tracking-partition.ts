import { logger, schedules, task } from '@trigger.dev/sdk/v3'
import { sql } from 'drizzle-orm'

import { generateCorrelationId, withCorrelation } from '@/lib/correlation'
import { db } from '@/lib/db'

/**
 * Trigger.dev v3 task — garante que as particoes mensais das tabelas
 * particionadas (`tracking_events` da 1.4.A + `capi_events` da 1.4.9)
 * existem com horizonte M+3 (buffer de 3 meses).
 *
 * Estrategia M+3: roda daily, mas so cria efetivamente quando o mes alvo
 * ainda nao tem particao. Trade-off:
 *  - M+3 da margem de 3 meses se task quebrar ou cron pausar.
 *  - Cria N particoes por mes (idempotente nos outros 30 dias).
 *
 * Particoes orfãs (gap entre hoje e M+3) sao tambem cobertas: a task
 * itera de M+1 ate M+3 e cria as que faltam. Garante recuperacao apos
 * downtime.
 *
 * RLS por particao: Postgres NAO propaga RLS de parent partitioned table
 * pras particoes filhas (verified — migration 0014 corrigiu retroativo).
 * Cada particao recem-criada executa `ENABLE ROW LEVEL SECURITY` +
 * `CREATE POLICY` em transacao atomica com o CREATE TABLE. Se ENABLE/POLICY
 * falhar, transacao rolla back e particao nao fica em estado inseguro.
 *
 * NAO faz:
 * - Drop de particoes antigas (retention policy e Fase 3 — TD futuro).
 * - Re-particionamento (TimescaleDB/ClickHouse migration e Fase 3).
 */

const PARTITION_TARGETS = [
  {
    parentTable: 'tracking_events',
    policyName: 'workspace_isolation_tracking_events',
  },
  {
    parentTable: 'capi_events',
    policyName: 'workspace_isolation_capi_events',
  },
] as const

type PartitionTarget = (typeof PARTITION_TARGETS)[number]

export const createTrackingPartitionTask = task({
  id: 'create-tracking-partition',
  maxDuration: 60,
  run: async (payload: { correlationId?: string } = {}) => {
    const cid = payload.correlationId ?? generateCorrelationId()
    return withCorrelation(cid, async () => {
      const now = new Date()
      const created: string[] = []
      const existed: string[] = []

      // Cria M+1, M+2, M+3 pra cada parent particionada.
      for (let offset = 1; offset <= 3; offset += 1) {
        const target = addMonths(now, offset)
        for (const partitionTarget of PARTITION_TARGETS) {
          const result = await ensurePartitionForMonth(partitionTarget, target)
          if (result.created) created.push(result.name)
          else existed.push(result.name)
        }
      }

      const summary = {
        correlationId: cid,
        created,
        existed,
        now: now.toISOString(),
      }
      logger.info('create-tracking-partition: done', summary)

      // Alerta se TODAS particoes (2 tabelas x 3 meses = 6) precisaram ser
      // criadas — significa gap historico ou cron quebrado por > 60 dias.
      if (created.length === PARTITION_TARGETS.length * 3) {
        logger.warn(
          'create-tracking-partition: criou TODAS particoes — possivel gap historico',
          summary
        )
      }

      return summary
    })
  },
})

/**
 * Cron diario 03:00 UTC (00:00 BRT, low-traffic).
 */
export const createTrackingPartitionCron = schedules.task({
  id: 'create-tracking-partition-cron',
  cron: '0 3 * * *',
  maxDuration: 60,
  run: async () => {
    const cid = generateCorrelationId()
    return withCorrelation(cid, async () => {
      logger.info('create-tracking-partition-cron disparou', {
        correlationId: cid,
        ts: new Date().toISOString(),
      })
      const handle = await createTrackingPartitionTask.trigger({ correlationId: cid })
      return { runId: handle.id }
    })
  },
})

// ---------------------------------------------------------------------------

interface PartitionResult {
  name: string
  created: boolean
}

async function ensurePartitionForMonth(
  target: PartitionTarget,
  monthStart: Date
): Promise<PartitionResult> {
  const { name, fromIso, toIso } = computePartitionSpec(target.parentTable, monthStart)

  // Check se ja existe via pg_class (mais preciso que CREATE IF NOT EXISTS,
  // que silencia notice sem retornar status estruturado).
  const rows = (await db.execute(
    sql`SELECT 1 FROM pg_class WHERE relname = ${name} LIMIT 1`
  )) as unknown as Array<{ '?column?': number }>

  if (rows.length > 0) {
    return { name, created: false }
  }

  // Particao nao existe — cria + habilita RLS + cria policy em transacao
  // atomica. Se qualquer passo falhar, particao nao fica em estado inseguro.
  // Nomes/datas sao deterministicos (nao vem de input externo), interpolar
  // via sql.raw e seguro aqui.
  await db.transaction(async (tx) => {
    await tx.execute(
      sql.raw(
        `CREATE TABLE IF NOT EXISTS ${name} PARTITION OF ${target.parentTable} ` +
          `FOR VALUES FROM ('${fromIso}') TO ('${toIso}')`
      )
    )
    await tx.execute(sql.raw(`ALTER TABLE ${name} ENABLE ROW LEVEL SECURITY`))
    await tx.execute(
      sql.raw(
        `CREATE POLICY ${target.policyName} ON ${name} FOR ALL USING (` +
          `workspace_id IN (` +
          `SELECT workspace_id FROM workspace_members ` +
          `WHERE user_id = auth.uid() AND is_active = true` +
          `))`
      )
    )
  })

  return { name, created: true }
}

function computePartitionSpec(
  parentTable: string,
  monthStart: Date
): {
  name: string
  fromIso: string
  toIso: string
} {
  const year = monthStart.getUTCFullYear()
  const month = monthStart.getUTCMonth() // 0-11
  const monthPadded = String(month + 1).padStart(2, '0')

  const from = new Date(Date.UTC(year, month, 1, 0, 0, 0))
  const to = new Date(Date.UTC(year, month + 1, 1, 0, 0, 0))

  return {
    name: `${parentTable}_${year}_${monthPadded}`,
    fromIso: from.toISOString().replace('T', ' ').replace('.000Z', '+00'),
    toIso: to.toISOString().replace('T', ' ').replace('.000Z', '+00'),
  }
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date)
  d.setUTCDate(1)
  d.setUTCMonth(d.getUTCMonth() + months)
  d.setUTCHours(0, 0, 0, 0)
  return d
}
