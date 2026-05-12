import { logger, schedules, task } from '@trigger.dev/sdk/v3'
import { sql } from 'drizzle-orm'

import { db } from '@/lib/db'

/**
 * Trigger.dev v3 task — garante que a particao mensal de tracking_events
 * para o mes corrente + 3 existe (M+3 = buffer de 3 meses).
 *
 * Estrategia M+3: roda daily, mas so cria efetivamente quando o mes alvo
 * ainda nao tem particao. Trade-off:
 *  - M+3 da margem de 3 meses se task quebrar ou cron pausar.
 *  - Cria 1 particao por mes (idempotente nos outros 30 dias).
 *
 * Particoes orfãs (gap entre hoje e M+3) sao tambem cobertas: a task
 * itera de M+1 ate M+3 e cria as que faltam. Garante recuperacao apos
 * downtime.
 *
 * NAO faz:
 * - Drop de particoes antigas (retention policy e Fase 3 — TD futuro).
 * - Re-particionamento (TimescaleDB/ClickHouse migration e Fase 3).
 */
export const createTrackingPartitionTask = task({
  id: 'create-tracking-partition',
  maxDuration: 60,
  run: async () => {
    const now = new Date()
    const created: string[] = []
    const existed: string[] = []

    // Cria M+1, M+2, M+3 — defensivo contra downtime de varios dias.
    for (let offset = 1; offset <= 3; offset += 1) {
      const target = addMonths(now, offset)
      const result = await ensurePartitionForMonth(target)
      if (result.created) created.push(result.name)
      else existed.push(result.name)
    }

    const summary = {
      created,
      existed,
      now: now.toISOString(),
    }
    logger.info('create-tracking-partition: done', summary)

    // Alerta se TODAS particoes precisaram ser criadas — significa que ja
    // perdemos cobertura nos meses anteriores (cron quebrou por > 60 dias).
    if (created.length === 3) {
      logger.warn(
        'create-tracking-partition: criou TODAS particoes — possivel gap historico',
        summary
      )
    }

    return summary
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
    logger.info('create-tracking-partition-cron disparou', { ts: new Date().toISOString() })
    const handle = await createTrackingPartitionTask.trigger()
    return { runId: handle.id }
  },
})

// ---------------------------------------------------------------------------

interface PartitionResult {
  name: string
  created: boolean
}

async function ensurePartitionForMonth(monthStart: Date): Promise<PartitionResult> {
  const { name, fromIso, toIso } = computePartitionSpec(monthStart)

  // Check se ja existe via pg_class (mais preciso que CREATE IF NOT EXISTS,
  // que silencia notice sem retornar status estruturado).
  const rows = (await db.execute(
    sql`SELECT 1 FROM pg_class WHERE relname = ${name} LIMIT 1`
  )) as unknown as Array<{ '?column?': number }>

  if (rows.length > 0) {
    return { name, created: false }
  }

  // Particao nao existe — cria. Nomes/datas sao deterministicos (nao vem de
  // input externo), interpolar via sql.raw e seguro aqui.
  await db.execute(
    sql.raw(
      `CREATE TABLE IF NOT EXISTS ${name} PARTITION OF tracking_events ` +
        `FOR VALUES FROM ('${fromIso}') TO ('${toIso}')`
    )
  )

  return { name, created: true }
}

function computePartitionSpec(monthStart: Date): {
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
    name: `tracking_events_${year}_${monthPadded}`,
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
