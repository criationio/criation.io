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

// ---------------------------------------------------------------------------
// Logica pura de deducao (ordem de consumo §4.12). Sem acesso a DB — testavel
// 100% em isolamento. `now` e sempre injetado pra manter pureza/determinismo.
// ---------------------------------------------------------------------------

/** Nome do balde em `credit_balances` (prefixo das colunas *_balance). */
export type BucketName = 'signup' | 'subscription' | 'pack' | 'admin'

/** Sentinel pra baldes sem expiry proprio (pack) ou expiry nulo inconsistente. */
const FAR_FUTURE = new Date('9999-12-31T23:59:59.999Z')

const BUCKET_SOURCE: Record<BucketName, CreditSource> = {
  signup: 'signup_bonus',
  subscription: 'subscription',
  pack: 'pack',
  admin: 'admin_grant',
}

/**
 * Tie-break determinístico quando dois baldes têm o MESMO expires_at.
 * Reflete §4.2: signup_bonus e admin_grant consomem primeiro, depois
 * subscription, por último pack. Só é desempate — a chave primária de
 * ordenação é sempre expires_at ascendente.
 */
const BUCKET_PRIORITY: Record<BucketName, number> = {
  signup: 0,
  admin: 1,
  subscription: 2,
  pack: 3,
}

/**
 * Snapshot dos baldes de `credit_balances` no momento da operacao. Os campos
 * espelham as colunas da tabela. `packBalance` NAO tem expiry proprio no balde
 * (cada pack_purchase tem o seu) — tratado como far-future na ordem de consumo.
 */
export interface BalanceSnapshot {
  balance: number
  signupBalance: number
  signupExpiresAt: Date | null
  subscriptionBalance: number
  subscriptionExpiresAt: Date | null
  packBalance: number
  adminBalance: number
  adminExpiresAt: Date | null
}

/** Uma linha do plano de deducao: quanto sai de qual balde. */
export interface DeductionLine {
  bucket: BucketName
  source: CreditSource
  amount: number
  /** Expiry do balde no momento da deducao (null = pack/far-future). */
  expiresAt: Date | null
}

export type DeductionResult =
  | { ok: true; lines: DeductionLine[]; totalDeducted: number }
  | { ok: false; reason: 'insufficient'; available: number; required: number }

interface BucketCandidate {
  bucket: BucketName
  balance: number
  expiresAt: Date | null
}

function buildCandidates(s: BalanceSnapshot): BucketCandidate[] {
  return [
    { bucket: 'signup', balance: s.signupBalance, expiresAt: s.signupExpiresAt },
    { bucket: 'subscription', balance: s.subscriptionBalance, expiresAt: s.subscriptionExpiresAt },
    // pack nao tem expiry por balde — far-future (consumido por ultimo).
    { bucket: 'pack', balance: s.packBalance, expiresAt: null },
    { bucket: 'admin', balance: s.adminBalance, expiresAt: s.adminExpiresAt },
  ]
}

/**
 * Expiry efetivo: null (pack ou inconsistencia) vira far-future, garantindo
 * que o balde seja considerado elegivel e ordenado por ultimo.
 */
function effectiveExpiry(c: BucketCandidate): Date {
  return c.expiresAt ?? FAR_FUTURE
}

function eligibleCandidates(s: BalanceSnapshot, now: Date): BucketCandidate[] {
  return buildCandidates(s)
    .filter((c) => c.balance > 0 && effectiveExpiry(c).getTime() > now.getTime())
    .sort((a, b) => {
      const ea = effectiveExpiry(a).getTime()
      const eb = effectiveExpiry(b).getTime()
      if (ea !== eb) return ea - eb
      return BUCKET_PRIORITY[a.bucket] - BUCKET_PRIORITY[b.bucket]
    })
}

/**
 * Soma os baldes elegiveis (saldo > 0 e nao expirados em `now`) + breakdown
 * por balde. Reusado por checkBalance. Baldes expirados contam 0.
 */
export function sumEligible(
  s: BalanceSnapshot,
  now: Date
): { total: number; breakdown: Record<BucketName, number> } {
  const breakdown: Record<BucketName, number> = {
    signup: 0,
    subscription: 0,
    pack: 0,
    admin: 0,
  }
  let total = 0
  for (const c of eligibleCandidates(s, now)) {
    breakdown[c.bucket] = c.balance
    total += c.balance
  }
  return { total, breakdown }
}

/**
 * Plano de deducao seguindo a ordem de consumo §4.12: baldes elegiveis
 * ordenados por expires_at ASCENDENTE (o que expira primeiro sai primeiro),
 * deduzindo do topo ate atingir `amount`. NAO e FIFO — e por expiracao, pra
 * o cliente nunca perder credito que pagou.
 *
 * Funcao pura: nao toca DB, nao loga, `now` injetado. O caller (consume) e
 * responsavel por aplicar as `lines` ao DB sob lock.
 *
 * Limitacao conhecida (1.7.5): o balde `pack` e agregado e nao distingue
 * multiplas compras com expiries diferentes — tratado como far-future na
 * ordem de consumo. A expiracao granular de packs vive em expireBatch, que
 * le pack_purchases diretamente. Baldes signup/subscription/admin com saldo
 * mas expiresAt null sao dado inconsistente — tratados como far-future
 * (elegiveis) por seguranca, em vez de descartados.
 */
export function computeDeduction(
  snapshot: BalanceSnapshot,
  amount: number,
  now: Date
): DeductionResult {
  const candidates = eligibleCandidates(snapshot, now)
  const available = candidates.reduce((sum, c) => sum + c.balance, 0)

  if (available < amount) {
    return { ok: false, reason: 'insufficient', available, required: amount }
  }

  const lines: DeductionLine[] = []
  let remaining = amount
  for (const c of candidates) {
    if (remaining <= 0) break
    const take = Math.min(remaining, c.balance)
    lines.push({
      bucket: c.bucket,
      source: BUCKET_SOURCE[c.bucket],
      amount: take,
      expiresAt: c.expiresAt,
    })
    remaining -= take
  }

  return { ok: true, lines, totalDeducted: amount }
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
