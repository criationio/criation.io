import { and, desc, eq, gt, gte, inArray, lt, lte, or, sql } from 'drizzle-orm'

import { db } from '@/lib/db'
import { creditBalances, creditTransactions, packPurchases } from '@/lib/db/schema/billing'
import { billingLogger } from '@/lib/logger'

type CreditBalanceRow = typeof creditBalances.$inferSelect
type CreditTransactionRow = typeof creditTransactions.$inferSelect

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

// ---------------------------------------------------------------------------
// Helpers de mapeamento DB <-> snapshot e cursor de paginacao.
// ---------------------------------------------------------------------------

function rowToSnapshot(row: CreditBalanceRow): BalanceSnapshot {
  return {
    balance: row.balance,
    signupBalance: row.signupBalance,
    signupExpiresAt: row.signupExpiresAt,
    subscriptionBalance: row.subscriptionBalance,
    subscriptionExpiresAt: row.subscriptionExpiresAt,
    packBalance: row.packBalance,
    adminBalance: row.adminBalance,
    adminExpiresAt: row.adminExpiresAt,
  }
}

const EMPTY_SNAPSHOT: BalanceSnapshot = {
  balance: 0,
  signupBalance: 0,
  signupExpiresAt: null,
  subscriptionBalance: 0,
  subscriptionExpiresAt: null,
  packBalance: 0,
  adminBalance: 0,
  adminExpiresAt: null,
}

function encodeCursor(createdAt: Date, id: string): string {
  return Buffer.from(`${createdAt.toISOString()}|${id}`, 'utf8').toString('base64')
}

function decodeCursor(cursor: string): { createdAt: Date; id: string } | null {
  try {
    const decoded = Buffer.from(cursor, 'base64').toString('utf8')
    const sepIdx = decoded.indexOf('|')
    if (sepIdx === -1) return null
    const createdAt = new Date(decoded.slice(0, sepIdx))
    const id = decoded.slice(sepIdx + 1)
    if (Number.isNaN(createdAt.getTime()) || !id) return null
    return { createdAt, id }
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// checkBalance — pre-flight read-only (sem lock). §4.10/§4.11.
// ---------------------------------------------------------------------------

export interface CheckBalanceResult {
  /** true se available >= ceil(required * safetyFactor). */
  ok: boolean
  available: number
  required: number
  breakdown: Record<BucketName, number>
}

export interface CheckBalanceOptions {
  /**
   * Fator de seguranca pro pre-flight (§4.11): bloqueia se o saldo for menor
   * que `ceil(required * safetyFactor)`. Pre-flight de analise usa 1.5; o
   * proprio consume usa 1 (default). Evita iniciar pipeline que falharia no
   * fim por saldo limitrofe.
   */
  safetyFactor?: number
  /** Injetavel pra teste. Default new Date(). */
  now?: Date
}

/**
 * Pre-flight de saldo. Leitura simples (sem FOR UPDATE) — a deducao real e
 * atomica em consume(). Nunca lanca por saldo insuficiente: retorna ok=false.
 * Lanca apenas no inesperado (DB fora do ar).
 */
export async function checkBalance(
  workspaceId: string,
  required: number,
  opts: CheckBalanceOptions = {}
): Promise<CheckBalanceResult> {
  const now = opts.now ?? new Date()
  const safetyFactor = opts.safetyFactor ?? 1

  const row = await db.query.creditBalances.findFirst({
    where: eq(creditBalances.workspaceId, workspaceId),
  })
  const snapshot = row ? rowToSnapshot(row) : EMPTY_SNAPSHOT
  const { total, breakdown } = sumEligible(snapshot, now)
  const threshold = Math.ceil(required * safetyFactor)

  return { ok: total >= threshold, available: total, required, breakdown }
}

// ---------------------------------------------------------------------------
// getHistory — extrato paginado (keyset). §4.10.
// ---------------------------------------------------------------------------

const HISTORY_DEFAULT_LIMIT = 50
const HISTORY_MAX_LIMIT = 100

export interface HistoryOptions {
  since?: Date
  until?: Date
  /** Default 50, max 100. */
  limit?: number
  /** Cursor opaco retornado por uma pagina anterior. */
  cursor?: string
}

export interface HistoryResult {
  items: CreditTransactionRow[]
  /** null quando nao ha mais paginas. */
  nextCursor: string | null
}

/**
 * Extrato de transactions, paginacao keyset (createdAt DESC, id DESC) — nao
 * OFFSET, pra evitar drift quando novas transactions entram entre paginas.
 * Read-only, nunca lanca por vazio.
 */
export async function getHistory(
  workspaceId: string,
  opts: HistoryOptions = {}
): Promise<HistoryResult> {
  const limit = Math.min(Math.max(opts.limit ?? HISTORY_DEFAULT_LIMIT, 1), HISTORY_MAX_LIMIT)

  const conditions = [eq(creditTransactions.workspaceId, workspaceId)]
  if (opts.since) conditions.push(gte(creditTransactions.createdAt, opts.since))
  if (opts.until) conditions.push(lte(creditTransactions.createdAt, opts.until))

  const cursor = opts.cursor ? decodeCursor(opts.cursor) : null
  if (cursor) {
    const keyset = or(
      lt(creditTransactions.createdAt, cursor.createdAt),
      and(eq(creditTransactions.createdAt, cursor.createdAt), lt(creditTransactions.id, cursor.id))
    )
    if (keyset) conditions.push(keyset)
  }

  // Busca limit+1 pra detectar se ha proxima pagina sem COUNT.
  const rows = await db.query.creditTransactions.findMany({
    where: and(...conditions),
    orderBy: [desc(creditTransactions.createdAt), desc(creditTransactions.id)],
    limit: limit + 1,
  })

  const hasMore = rows.length > limit
  const items = hasMore ? rows.slice(0, limit) : rows
  const last = items[items.length - 1]
  const nextCursor = hasMore && last ? encodeCursor(last.createdAt, last.id) : null

  return { items, nextCursor }
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

// ---------------------------------------------------------------------------
// consume — deducao atomica com lock pessimista. §4.10/§4.11/§4.12.
// ---------------------------------------------------------------------------

export interface ConsumeContext {
  pipelineId: string
  analysisId: string
  /**
   * Chave deterministica por analise (NAO um UUID novo por retry). Garante
   * que retries do pipeline nao cobrem em dobro. Recomendado derivar de
   * analysisId. §4.11.
   */
  idempotencyKey: string
}

export type ConsumeResult =
  | { ok: true; transactionId: string; idempotent: boolean; newBalance: number }
  | {
      ok: false
      error: { code: 'INSUFFICIENT_CREDITS'; message: string }
      available: number
      required: number
    }

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: unknown }).code === '23505'
  )
}

/**
 * Deduz `amount` creditos seguindo a ordem de consumo (§4.12), atomico via
 * SELECT FOR UPDATE na linha de credit_balances. Idempotente por
 * ctx.idempotencyKey. Saldo insuficiente NAO lanca — retorna ok=false (Regra
 * 7). Lanca apenas no inesperado (DB fora do ar, row de insert ausente).
 *
 * §4.11: a deducao deve acontecer no FIM do pipeline (junto com o INSERT do
 * resultado), nao no inicio — se o pipeline falha, nada e deduzido.
 */
export async function consume(
  workspaceId: string,
  userId: string | null,
  amount: number,
  ctx: ConsumeContext
): Promise<ConsumeResult> {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error('amount must be a positive integer')
  }
  if (!ctx.idempotencyKey) throw new Error('idempotencyKey required')
  if (!ctx.pipelineId) throw new Error('pipelineId required')
  if (!ctx.analysisId) throw new Error('analysisId required')

  // 1. Idempotency check antes da transacao (igual allocate).
  const existing = await db.query.creditTransactions.findFirst({
    where: eq(creditTransactions.idempotencyKey, ctx.idempotencyKey),
    columns: { id: true },
  })
  if (existing) {
    const newBalance = await getBalance(workspaceId)
    billingLogger.info(
      { workspaceId, idempotencyKey: ctx.idempotencyKey },
      'consume idempotent hit'
    )
    return { ok: true, transactionId: existing.id, idempotent: true, newBalance }
  }

  try {
    return await db.transaction(async (tx): Promise<ConsumeResult> => {
      // 2. Lock pessimista na linha de saldo (.for('update') — só no query
      // builder; o relational API nao suporta lock).
      const [row] = await tx
        .select()
        .from(creditBalances)
        .where(eq(creditBalances.workspaceId, workspaceId))
        .for('update')
        .limit(1)

      const snapshot = row ? rowToSnapshot(row) : EMPTY_SNAPSHOT
      const plan = computeDeduction(snapshot, amount, new Date())

      if (!plan.ok) {
        // Saldo insuficiente — commit limpo (nada escrito). Sem throw (Regra 7).
        return {
          ok: false,
          error: {
            code: 'INSUFFICIENT_CREDITS',
            message: `saldo insuficiente: ${plan.available} disponivel, ${plan.required} necessario`,
          },
          available: plan.available,
          required: plan.required,
        }
      }

      // 3. Agregar deducao por balde e montar o UPDATE (sem clamp GREATEST —
      // confiamos no lock + plan; saldo negativo seria bug a expor).
      const perBucket: Record<BucketName, number> = {
        signup: 0,
        subscription: 0,
        pack: 0,
        admin: 0,
      }
      for (const line of plan.lines) perBucket[line.bucket] += line.amount

      const setObj: Record<string, unknown> = {
        balance: sql`${creditBalances.balance} - ${amount}`,
        updatedAt: new Date(),
      }
      if (perBucket.signup > 0) {
        setObj.signupBalance = sql`${creditBalances.signupBalance} - ${perBucket.signup}`
      }
      if (perBucket.subscription > 0) {
        setObj.subscriptionBalance = sql`${creditBalances.subscriptionBalance} - ${perBucket.subscription}`
      }
      if (perBucket.pack > 0) {
        setObj.packBalance = sql`${creditBalances.packBalance} - ${perBucket.pack}`
      }
      if (perBucket.admin > 0) {
        setObj.adminBalance = sql`${creditBalances.adminBalance} - ${perBucket.admin}`
      }

      await tx.update(creditBalances).set(setObj).where(eq(creditBalances.workspaceId, workspaceId))

      // 4. Uma unica transaction tipo 'consume' — breakdown completo em
      // metadata.deduction (lido por refund). source = fonte primaria.
      const primarySource = plan.lines[0]?.source ?? 'subscription'
      const [txn] = await tx
        .insert(creditTransactions)
        .values({
          workspaceId,
          userId,
          type: 'consume',
          source: primarySource,
          amount: -amount,
          analysisId: ctx.analysisId,
          pipelineId: ctx.pipelineId,
          idempotencyKey: ctx.idempotencyKey,
          metadata: { deduction: plan.lines, pipelineCost: amount },
        })
        .returning({ id: creditTransactions.id })

      if (!txn) throw new Error('insert credit_transactions returned no row')

      const newBalance = snapshot.balance - amount
      billingLogger.info(
        { workspaceId, amount, pipelineId: ctx.pipelineId, newBalance },
        'credits consumed'
      )

      return { ok: true, transactionId: txn.id, idempotent: false, newBalance }
    })
  } catch (err) {
    // Idempotency race: dois requests com a mesma key passaram o pre-check e
    // ambos tentaram INSERT. O segundo viola o UNIQUE — re-busca e retorna
    // idempotent em vez de propagar o erro.
    if (isUniqueViolation(err)) {
      const raced = await db.query.creditTransactions.findFirst({
        where: eq(creditTransactions.idempotencyKey, ctx.idempotencyKey),
        columns: { id: true },
      })
      if (raced) {
        const newBalance = await getBalance(workspaceId)
        billingLogger.info(
          { workspaceId, idempotencyKey: ctx.idempotencyKey },
          'consume idempotent hit (race resolved)'
        )
        return { ok: true, transactionId: raced.id, idempotent: true, newBalance }
      }
    }
    throw err
  }
}

// ---------------------------------------------------------------------------
// refund — reverte um consume, devolvendo ao(s) balde(s) de origem. §4.14.
// ---------------------------------------------------------------------------

const SOURCE_BUCKET: Record<CreditSource, BucketName> = {
  signup_bonus: 'signup',
  subscription: 'subscription',
  pack: 'pack',
  admin_grant: 'admin',
}

/**
 * Le metadata.deduction de um consume (JSON: expiresAt vem como string —
 * ignorado aqui, so precisamos de bucket+amount). Retorna [] se ausente.
 */
function readDeductionLines(metadata: unknown): Array<{ bucket: BucketName; amount: number }> {
  if (metadata && typeof metadata === 'object' && 'deduction' in metadata) {
    const d = (metadata as { deduction?: unknown }).deduction
    if (Array.isArray(d)) {
      return d
        .filter(
          (x): x is { bucket: BucketName; amount: number } =>
            !!x && typeof x === 'object' && 'bucket' in x && 'amount' in x
        )
        .map((x) => ({ bucket: x.bucket, amount: Number(x.amount) }))
    }
  }
  return []
}

export type RefundResult =
  | { ok: true; transactionId: string; idempotent: boolean; refunded: number }
  | {
      ok: false
      error: { code: 'NOT_CONSUME' | 'WRONG_WORKSPACE'; message: string }
    }

/**
 * Reverte um consume: devolve cada parcela ao balde de origem (lido de
 * metadata.deduction) mantendo o expiry atual do balde, e soma ao balance.
 * Idempotente por chave `refund:<transactionId>`. Regras de negocio (tipo
 * errado, workspace errado) retornam ok=false (Regra 7); id inexistente ou
 * balance ausente lancam (inesperado).
 *
 * Suposicao (§4.14): refund automatico ocorre segundos apos o consume
 * (analise falhou), entao expiry intermediario do balde e improvavel. Refund
 * tardio para balde ja expirado deixaria credito-zumbi (contado em balance
 * mas inelegivel) ate o expireBatch seguinte limpar — aceito e documentado.
 */
export async function refund(
  workspaceId: string,
  transactionId: string,
  reason: string
): Promise<RefundResult> {
  const original = await db.query.creditTransactions.findFirst({
    where: eq(creditTransactions.id, transactionId),
    columns: {
      id: true,
      workspaceId: true,
      type: true,
      source: true,
      amount: true,
      metadata: true,
      analysisId: true,
      pipelineId: true,
    },
  })
  if (!original) {
    throw new Error(`refund: transaction ${transactionId} not found`)
  }
  if (original.workspaceId !== workspaceId) {
    return {
      ok: false,
      error: { code: 'WRONG_WORKSPACE', message: 'transaction nao pertence ao workspace' },
    }
  }
  if (original.type !== 'consume') {
    return {
      ok: false,
      error: {
        code: 'NOT_CONSUME',
        message: `so consume pode ser revertido (tipo: ${original.type})`,
      },
    }
  }

  const refundAmount = Math.abs(original.amount)
  const idempotencyKey = `refund:${transactionId}`

  // Idempotency check antes da transacao.
  const existing = await db.query.creditTransactions.findFirst({
    where: eq(creditTransactions.idempotencyKey, idempotencyKey),
    columns: { id: true },
  })
  if (existing) {
    billingLogger.info({ workspaceId, transactionId }, 'refund idempotent hit')
    return { ok: true, transactionId: existing.id, idempotent: true, refunded: refundAmount }
  }

  // Reconstroi a distribuicao por balde. Fallback: se metadata nao tem
  // deduction (consume legado), devolve tudo ao balde da fonte primaria.
  const lines = readDeductionLines(original.metadata)
  const perBucket: Record<BucketName, number> = { signup: 0, subscription: 0, pack: 0, admin: 0 }
  if (lines.length > 0) {
    for (const l of lines) perBucket[l.bucket] += l.amount
  } else {
    perBucket[SOURCE_BUCKET[original.source as CreditSource] ?? 'subscription'] += refundAmount
  }

  try {
    return await db.transaction(async (tx): Promise<RefundResult> => {
      const [row] = await tx
        .select()
        .from(creditBalances)
        .where(eq(creditBalances.workspaceId, workspaceId))
        .for('update')
        .limit(1)

      if (!row) {
        throw new Error(`refund: balance row missing for workspace ${workspaceId}`)
      }

      const setObj: Record<string, unknown> = {
        balance: sql`${creditBalances.balance} + ${refundAmount}`,
        updatedAt: new Date(),
      }
      if (perBucket.signup > 0) {
        setObj.signupBalance = sql`${creditBalances.signupBalance} + ${perBucket.signup}`
      }
      if (perBucket.subscription > 0) {
        setObj.subscriptionBalance = sql`${creditBalances.subscriptionBalance} + ${perBucket.subscription}`
      }
      if (perBucket.pack > 0) {
        setObj.packBalance = sql`${creditBalances.packBalance} + ${perBucket.pack}`
      }
      if (perBucket.admin > 0) {
        setObj.adminBalance = sql`${creditBalances.adminBalance} + ${perBucket.admin}`
      }

      await tx.update(creditBalances).set(setObj).where(eq(creditBalances.workspaceId, workspaceId))

      const [txn] = await tx
        .insert(creditTransactions)
        .values({
          workspaceId,
          userId: null,
          type: 'refund',
          source: original.source,
          amount: refundAmount,
          analysisId: original.analysisId,
          pipelineId: original.pipelineId,
          idempotencyKey,
          reason,
          metadata: { refundOf: transactionId, restored: perBucket },
        })
        .returning({ id: creditTransactions.id })

      if (!txn) throw new Error('insert credit_transactions (refund) returned no row')

      billingLogger.info(
        { workspaceId, transactionId, refunded: refundAmount, reason },
        'credits refunded'
      )
      return { ok: true, transactionId: txn.id, idempotent: false, refunded: refundAmount }
    })
  } catch (err) {
    if (isUniqueViolation(err)) {
      const raced = await db.query.creditTransactions.findFirst({
        where: eq(creditTransactions.idempotencyKey, idempotencyKey),
        columns: { id: true },
      })
      if (raced) {
        return { ok: true, transactionId: raced.id, idempotent: true, refunded: refundAmount }
      }
    }
    throw err
  }
}

// ---------------------------------------------------------------------------
// expireBatch — zera baldes/packs vencidos. §4.13. Chamado pela task diaria
// credit-expiration (Sessao 1.14, FORA do escopo aqui — so a funcao).
// ---------------------------------------------------------------------------

type ExpiredPackRow = {
  id: string
  workspaceId: string
  creditsRemaining: number
}

export interface ExpireBatchOptions {
  /** Limita o numero de workspaces processados (pra a task 1.14 paginar). */
  limit?: number
  /** Restringe a workspaces especificos (idempotencia de re-run / teste). */
  workspaceIds?: string[]
}

export interface ExpireBatchResult {
  workspacesProcessed: number
  totalExpired: number
  details: Array<{ workspaceId: string; expired: number; buckets: BucketName[] }>
}

/**
 * Expira, em `asOf`:
 *  - baldes signup/subscription/admin com expires_at <= asOf (zera, soma
 *    credito expirado, anula o expires_at);
 *  - packs em pack_purchases com expires_at <= asOf (status='expired',
 *    credits_remaining=0, decrementa packBalance).
 *
 * Uma transacao POR workspace (com FOR UPDATE) — nao uma transacao gigante,
 * pra evitar lock longo. Idempotente: cada transaction 'expire' usa chave
 * `expire:<ws>:<bucket>:<dia>` com ON CONFLICT DO NOTHING, e os baldes ja
 * zerados deixam de ser candidatos. `asOf` injetavel pra teste.
 *
 * Reset/realocacao de subscription no fim de ciclo NAO e responsabilidade
 * desta funcao — vive no billing.service / webhook de renovacao (1.12).
 */
export async function expireBatch(
  asOf: Date,
  opts: ExpireBatchOptions = {}
): Promise<ExpireBatchResult> {
  // 1. Candidatos por balde (signup/subscription/admin).
  const bucketExpiry = or(
    lte(creditBalances.signupExpiresAt, asOf),
    lte(creditBalances.subscriptionExpiresAt, asOf),
    lte(creditBalances.adminExpiresAt, asOf)
  )
  const balanceConditions = [gt(creditBalances.balance, 0)]
  if (bucketExpiry) balanceConditions.push(bucketExpiry)
  if (opts.workspaceIds?.length) {
    balanceConditions.push(inArray(creditBalances.workspaceId, opts.workspaceIds))
  }
  const balanceCandidates = await db.query.creditBalances.findMany({
    where: and(...balanceConditions),
    columns: { workspaceId: true },
    ...(opts.limit ? { limit: opts.limit } : {}),
  })

  // 2. Packs vencidos (granular — resolve a tensao pack-sem-expiry-no-balde).
  const packConditions = [
    eq(packPurchases.status, 'active'),
    gt(packPurchases.creditsRemaining, 0),
    lte(packPurchases.expiresAt, asOf),
  ]
  if (opts.workspaceIds?.length) {
    packConditions.push(inArray(packPurchases.workspaceId, opts.workspaceIds))
  }
  const expiredPacks = (await db.query.packPurchases.findMany({
    where: and(...packConditions),
    columns: { id: true, workspaceId: true, creditsRemaining: true },
  })) as ExpiredPackRow[]

  const packsByWorkspace = new Map<string, ExpiredPackRow[]>()
  for (const p of expiredPacks) {
    const list = packsByWorkspace.get(p.workspaceId) ?? []
    list.push(p)
    packsByWorkspace.set(p.workspaceId, list)
  }

  // 3. Uniao de workspaces a processar.
  const workspaceIds = new Set<string>([
    ...balanceCandidates.map((b) => b.workspaceId),
    ...packsByWorkspace.keys(),
  ])

  const details: ExpireBatchResult['details'] = []
  let totalExpired = 0

  for (const workspaceId of workspaceIds) {
    const res = await expireWorkspace(workspaceId, asOf, packsByWorkspace.get(workspaceId) ?? [])
    if (res.expired > 0) {
      details.push(res)
      totalExpired += res.expired
    }
  }

  billingLogger.info(
    { asOf: asOf.toISOString(), workspacesProcessed: details.length, totalExpired },
    'credit expiration batch complete'
  )
  return { workspacesProcessed: details.length, totalExpired, details }
}

/**
 * Expira baldes + packs de um unico workspace numa transacao. Falha de um
 * workspace nao deve derrubar o batch — o caller (expireBatch) itera; aqui
 * lancamos so no inesperado e deixamos o catch da task tratar por workspace.
 */
async function expireWorkspace(
  workspaceId: string,
  asOf: Date,
  packs: ExpiredPackRow[]
): Promise<{ workspaceId: string; expired: number; buckets: BucketName[] }> {
  const asOfMs = asOf.getTime()
  const dayKey = asOf.toISOString().slice(0, 10)

  return db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(creditBalances)
      .where(eq(creditBalances.workspaceId, workspaceId))
      .for('update')
      .limit(1)

    if (!row) return { workspaceId, expired: 0, buckets: [] as BucketName[] }
    const snap = rowToSnapshot(row)

    const expired: Array<{ bucket: BucketName; source: CreditSource; amount: number }> = []
    if (
      snap.signupExpiresAt &&
      snap.signupExpiresAt.getTime() <= asOfMs &&
      snap.signupBalance > 0
    ) {
      expired.push({ bucket: 'signup', source: 'signup_bonus', amount: snap.signupBalance })
    }
    if (
      snap.subscriptionExpiresAt &&
      snap.subscriptionExpiresAt.getTime() <= asOfMs &&
      snap.subscriptionBalance > 0
    ) {
      expired.push({
        bucket: 'subscription',
        source: 'subscription',
        amount: snap.subscriptionBalance,
      })
    }
    if (snap.adminExpiresAt && snap.adminExpiresAt.getTime() <= asOfMs && snap.adminBalance > 0) {
      expired.push({ bucket: 'admin', source: 'admin_grant', amount: snap.adminBalance })
    }
    const packSum = packs.reduce((sum, p) => sum + p.creditsRemaining, 0)

    if (expired.length === 0 && packSum === 0) {
      return { workspaceId, expired: 0, buckets: [] as BucketName[] }
    }

    // Monta o UPDATE: zera baldes vencidos + anula expiry, decrementa balance
    // pelo total expirado (baldes + packs).
    const setObj: Record<string, unknown> = { updatedAt: new Date() }
    let totalDecrement = 0
    for (const e of expired) {
      totalDecrement += e.amount
      if (e.bucket === 'signup') {
        setObj.signupBalance = 0
        setObj.signupExpiresAt = null
      } else if (e.bucket === 'subscription') {
        setObj.subscriptionBalance = 0
        setObj.subscriptionExpiresAt = null
      } else if (e.bucket === 'admin') {
        setObj.adminBalance = 0
        setObj.adminExpiresAt = null
      }
    }
    if (packSum > 0) {
      totalDecrement += packSum
      setObj.packBalance = sql`${creditBalances.packBalance} - ${packSum}`
    }
    setObj.balance = sql`${creditBalances.balance} - ${totalDecrement}`

    await tx.update(creditBalances).set(setObj).where(eq(creditBalances.workspaceId, workspaceId))

    // Marca cada pack vencido como expired.
    for (const p of packs) {
      await tx
        .update(packPurchases)
        .set({ status: 'expired', creditsRemaining: 0, expiredAt: asOf })
        .where(eq(packPurchases.id, p.id))
    }

    // Uma transaction 'expire' por fonte vencida (idempotente por dia).
    const expireLines = [...expired]
    if (packSum > 0) expireLines.push({ bucket: 'pack', source: 'pack', amount: packSum })
    for (const e of expireLines) {
      await tx
        .insert(creditTransactions)
        .values({
          workspaceId,
          userId: null,
          type: 'expire',
          source: e.source,
          amount: -e.amount,
          idempotencyKey: `expire:${workspaceId}:${e.bucket}:${dayKey}`,
          reason: `expired at ${asOf.toISOString()}`,
          metadata: {},
        })
        .onConflictDoNothing({ target: creditTransactions.idempotencyKey })
    }

    return { workspaceId, expired: totalDecrement, buckets: expireLines.map((e) => e.bucket) }
  })
}
