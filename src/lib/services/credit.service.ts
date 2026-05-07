import { eq, sql } from 'drizzle-orm'

import { db } from '@/lib/db'
import { creditBalances, creditTransactions } from '@/lib/db/schema/billing'
import { billingLogger } from '@/lib/logger'

/**
 * STUB minimal de creditService — apenas allocate.
 *
 * Implementacao completa (checkBalance, consume, refund, expireBatch,
 * getHistory + atomicidade FOR UPDATE) na Sessao 1.7.5. A signature
 * de allocate aqui e a definitiva (compativel com 1.7.5) para nao
 * exigir refactor do consumer.
 *
 * Especificacao: docs/criation-io-arquitetura-v06.html §4.10.
 */

export type CreditSource = 'signup_bonus' | 'subscription' | 'pack' | 'admin_grant'

export interface AllocateContext {
  idempotencyKey: string
  userId?: string
  metadata?: Record<string, unknown>
}

export interface AllocateResult {
  transactionId: string
  idempotent: boolean
  newBalance: number
}

class NotImplementedError extends Error {
  constructor(method: string, source: string) {
    super(`creditService.${method}() not implemented yet — see ${source}`)
    this.name = 'NotImplementedError'
  }
}

async function getBalance(workspaceId: string): Promise<number> {
  const row = await db.query.creditBalances.findFirst({
    where: eq(creditBalances.workspaceId, workspaceId),
    columns: { balance: true },
  })
  return row?.balance ?? 0
}

export async function allocate(
  workspaceId: string,
  amount: number,
  source: CreditSource,
  expiresAt: Date,
  ctx: AllocateContext
): Promise<AllocateResult> {
  if (amount <= 0) {
    throw new Error('amount must be positive')
  }
  if (!ctx.idempotencyKey) {
    throw new Error('idempotencyKey required')
  }

  // 1. Idempotency check (lookup by unique idempotency_key constraint).
  const existing = await db.query.creditTransactions.findFirst({
    where: eq(creditTransactions.idempotencyKey, ctx.idempotencyKey),
    columns: { id: true },
  })
  if (existing) {
    const newBalance = await getBalance(workspaceId)
    billingLogger.info(
      { workspaceId, idempotencyKey: ctx.idempotencyKey },
      'allocate idempotent hit'
    )
    return { transactionId: existing.id, idempotent: true, newBalance }
  }

  // 2. Atomic transaction: insert tx + upsert balance bucket.
  return await db.transaction(async (tx) => {
    const [txn] = await tx
      .insert(creditTransactions)
      .values({
        workspaceId,
        userId: ctx.userId ?? null,
        type: 'allocate',
        source,
        amount,
        idempotencyKey: ctx.idempotencyKey,
        metadata: ctx.metadata ?? {},
      })
      .returning({ id: creditTransactions.id })

    if (!txn) {
      throw new Error('insert credit_transactions returned no row')
    }

    // Ensure balance row exists.
    await tx
      .insert(creditBalances)
      .values({ workspaceId, balance: 0 })
      .onConflictDoNothing({ target: creditBalances.workspaceId })

    // Build bucket-specific update set.
    const baseSet = {
      balance: sql`${creditBalances.balance} + ${amount}`,
      updatedAt: new Date(),
    }

    let bucketSet: Record<string, unknown>
    switch (source) {
      case 'signup_bonus':
        bucketSet = {
          signupBalance: sql`${creditBalances.signupBalance} + ${amount}`,
          signupExpiresAt: expiresAt,
        }
        break
      case 'subscription':
        bucketSet = {
          subscriptionBalance: sql`${creditBalances.subscriptionBalance} + ${amount}`,
          subscriptionExpiresAt: expiresAt,
        }
        break
      case 'pack':
        bucketSet = {
          packBalance: sql`${creditBalances.packBalance} + ${amount}`,
        }
        break
      case 'admin_grant':
        bucketSet = {
          adminBalance: sql`${creditBalances.adminBalance} + ${amount}`,
          adminExpiresAt: expiresAt,
        }
        break
    }

    await tx
      .update(creditBalances)
      .set({ ...baseSet, ...bucketSet })
      .where(eq(creditBalances.workspaceId, workspaceId))

    const updated = await tx.query.creditBalances.findFirst({
      where: eq(creditBalances.workspaceId, workspaceId),
      columns: { balance: true },
    })

    billingLogger.info(
      { workspaceId, source, amount, newBalance: updated?.balance ?? 0 },
      'credits allocated'
    )

    return { transactionId: txn.id, idempotent: false, newBalance: updated?.balance ?? 0 }
  })
}

// Stubs com signature compatível com 1.7.5 — throw NotImplementedError.

export async function checkBalance(workspaceId: string): Promise<never> {
  void workspaceId
  throw new NotImplementedError('checkBalance', 'Session 1.7.5 (v0.6 §4.10)')
}

export async function consume(
  workspaceId: string,
  amount: number,
  ctx: { pipelineId: string; analysisId: string; idempotencyKey: string }
): Promise<never> {
  void workspaceId
  void amount
  void ctx
  throw new NotImplementedError('consume', 'Session 1.7.5 (v0.6 §4.10)')
}

export async function refund(transactionId: string, reason: string): Promise<never> {
  void transactionId
  void reason
  throw new NotImplementedError('refund', 'Session 1.7.5 (v0.6 §4.10)')
}

export async function expireBatch(): Promise<never> {
  throw new NotImplementedError('expireBatch', 'Session 1.7.5 (v0.6 §4.10)')
}

export async function getHistory(workspaceId: string): Promise<never> {
  void workspaceId
  throw new NotImplementedError('getHistory', 'Session 1.7.5 (v0.6 §4.10)')
}
