/**
 * HARD CAP de custo Claude por workspace (CLAUDE.md Regra 20 + spec §1.8).
 *
 * Protege a MARGEM da Criation contra power user abusivo + bug que consome
 * tokens. Distinto do sistema de creditos (creditService) — creditos cobram o
 * usuario; este cap limita quanto a Criation gasta com Claude por workspace/mes.
 *
 * claude.service chama checkBudget ANTES de cada request (incluindo chamadas
 * internas como o judge). Se estourou, nao dispara o request.
 */

import { and, eq, gte, sql } from 'drizzle-orm'

import { db } from '@/lib/db'
import { claudeRequestLogs } from '@/lib/db/schema/admin'
import { billingLogger } from '@/lib/logger'

/**
 * Budget mensal por plano, em centavos de BRL (Regra 20: Starter R$10, Pro
 * R$40, Agency R$120). free/trial cai no budget Starter (conservador).
 * Grandfathering (coortes antigos) fica pra quando precos mudarem — defer.
 */
export const PLAN_CLAUDE_BUDGETS_BRL_CENTS: Record<string, number> = {
  free: 1000,
  trial: 1000,
  starter: 1000,
  pro: 4000,
  agency: 12000,
}

const DEFAULT_BUDGET_BRL_CENTS = PLAN_CLAUDE_BUDGETS_BRL_CENTS.starter ?? 1000

/**
 * Conversao USD→BRL pro cap. cost_usd vem em USD; o budget e BRL. Taxa fixa e
 * aproximada de proposito — o cap nao precisa de FX exato, so de uma ordem de
 * grandeza estavel. Recalibrar junto com o pricing dos modelos (§4.3).
 */
export const USD_TO_BRL = 5.5

function budgetForPlan(planId: string | null | undefined): number {
  if (!planId) return DEFAULT_BUDGET_BRL_CENTS
  return PLAN_CLAUDE_BUDGETS_BRL_CENTS[planId.toLowerCase()] ?? DEFAULT_BUDGET_BRL_CENTS
}

function startOfMonthUtc(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0))
}

/**
 * Soma cost_usd das requests do workspace no mes corrente (UTC). Retorna USD
 * (number). claude_request_logs.cost_usd e decimal — Postgres devolve string,
 * convertida aqui.
 */
export async function getMonthlyUsageUsd(workspaceId: string, now = new Date()): Promise<number> {
  const since = startOfMonthUtc(now)
  const [row] = await db
    .select({ total: sql<string>`COALESCE(SUM(${claudeRequestLogs.costUsd}), 0)` })
    .from(claudeRequestLogs)
    .where(
      and(eq(claudeRequestLogs.workspaceId, workspaceId), gte(claudeRequestLogs.createdAt, since))
    )
  return row ? Number(row.total) : 0
}

export interface CheckBudgetResult {
  /** true = dentro do orcamento, pode disparar request. */
  ok: boolean
  usageBrlCents: number
  budgetBrlCents: number
  usageUsd: number
}

export interface CheckBudgetOptions {
  planId?: string | null
  now?: Date
}

/**
 * Pre-flight do hard cap. Soma o gasto USD do mes, converte pra BRL, compara
 * com o budget do plano. NAO lanca — retorna ok=false (o caller decide a UX:
 * "voce atingiu o limite de analises pesadas do plano").
 */
export async function checkBudget(
  workspaceId: string,
  opts: CheckBudgetOptions = {}
): Promise<CheckBudgetResult> {
  const now = opts.now ?? new Date()
  const budgetBrlCents = budgetForPlan(opts.planId)

  const usageUsd = await getMonthlyUsageUsd(workspaceId, now)
  const usageBrlCents = Math.round(usageUsd * USD_TO_BRL * 100)
  const ok = usageBrlCents < budgetBrlCents

  if (!ok) {
    billingLogger.warn(
      { workspaceId, usageBrlCents, budgetBrlCents, plan: opts.planId ?? 'unknown' },
      'claude budget hard cap reached'
    )
  }
  return { ok, usageBrlCents, budgetBrlCents, usageUsd }
}
