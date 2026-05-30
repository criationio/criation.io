// @vitest-environment node
//
// Teste de INTEGRACAO do creditService contra Postgres REAL (Supabase dev).
// Skipado no CI (DATABASE_URL placeholder) — so roda com:
//
//   RUN_DB_INTEGRATION=1 node --env-file=.env.local \
//     ./node_modules/.bin/vitest run src/lib/services/credit.service.integration.test.ts
//
// Prova o que o mock NAO consegue: exclusao mutua real do SELECT FOR UPDATE
// sob N consumes paralelos (race condition §4.11). Cria um workspace de teste
// e o remove no fim (cascade limpa credit_balances + credit_transactions).
//
// Runbook completo: docs/smoke/1.7.5-credit-service.md

import { randomUUID } from 'node:crypto'

import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { db } from '@/lib/db'
import { workspaces } from '@/lib/db/schema/auth'
import { creditBalances, creditTransactions } from '@/lib/db/schema/billing'
import { allocate, checkBalance, consume } from './credit.service'

const RUN = process.env.RUN_DB_INTEGRATION === '1'

describe.skipIf(!RUN)('creditService integration (DB real)', () => {
  let workspaceId: string

  beforeAll(async () => {
    const slug = `test-credit-${randomUUID()}`
    const [ws] = await db
      .insert(workspaces)
      .values({ name: 'Credit Integration Test', slug })
      .returning({ id: workspaces.id })
    if (!ws) throw new Error('failed to create test workspace')
    workspaceId = ws.id
  })

  afterAll(async () => {
    if (workspaceId) {
      // cascade remove credit_balances + credit_transactions
      await db.delete(workspaces).where(eq(workspaces.id, workspaceId))
    }
  })

  // FOR UPDATE serializa os 10 consumes; com latencia de rede ao Supabase
  // (sa-east-1) isso leva alguns segundos — timeout generoso.
  it(
    'race condition: 10 consumes paralelos sobre saldo 5 — nunca negativo',
    { timeout: 30000 },
    async () => {
      // Aloca exatamente 5 creditos (signup_bonus, 90d).
      const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
      await allocate(workspaceId, 5, 'signup_bonus', expiresAt, {
        idempotencyKey: `alloc-${workspaceId}`,
      })

      const pre = await checkBalance(workspaceId, 1)
      expect(pre.available).toBe(5)

      // 10 consumes de 1 credito, em paralelo, cada um com idempotencyKey unico.
      const results = await Promise.all(
        Array.from({ length: 10 }, (_, i) =>
          consume(workspaceId, null, 1, {
            pipelineId: 'analisar.video_ad',
            analysisId: `race-${i}`,
            idempotencyKey: `consume:race-${workspaceId}:${i}`,
          })
        )
      )

      const ok = results.filter((r) => r.ok)
      const insufficient = results.filter((r) => !r.ok)

      // Exatamente 5 passam, 5 sao recusados — soma deduzida == saldo inicial.
      expect(ok).toHaveLength(5)
      expect(insufficient).toHaveLength(5)

      // Saldo final NUNCA negativo — deve ser exatamente 0.
      const finalRow = await db.query.creditBalances.findFirst({
        where: eq(creditBalances.workspaceId, workspaceId),
      })
      expect(finalRow?.balance).toBe(0)
      expect(finalRow?.signupBalance).toBe(0)

      // 5 transactions de consume gravadas.
      const consumeTxns = await db.query.creditTransactions.findMany({
        where: eq(creditTransactions.workspaceId, workspaceId),
      })
      const consumed = consumeTxns.filter((t) => t.type === 'consume')
      expect(consumed).toHaveLength(5)
      expect(consumed.reduce((sum, t) => sum + t.amount, 0)).toBe(-5)
    }
  )
})
