// @vitest-environment node
// credit.service usa server-only env vars via @/env (transitively) e
// Drizzle/postgres-js que requerem node runtime.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db', () => {
  const creditBalancesFindFirst = vi.fn()
  const creditTransactionsFindFirst = vi.fn()
  const creditTransactionsFindMany = vi.fn()

  // tx chain: select().from().where().for().limit() -> rows
  const txSelectLimit = vi.fn()
  const txSelectFor = vi.fn(() => ({ limit: txSelectLimit }))
  const txSelectWhere = vi.fn(() => ({ for: txSelectFor }))
  const txSelectFrom = vi.fn(() => ({ where: txSelectWhere }))
  const txSelect = vi.fn(() => ({ from: txSelectFrom }))

  // tx.update().set().where() -> Promise
  const txUpdateWhere = vi.fn()
  const txUpdateSet = vi.fn(() => ({ where: txUpdateWhere }))
  const txUpdate = vi.fn(() => ({ set: txUpdateSet }))

  // tx.insert().values().returning() -> [{ id }]
  const txInsertReturning = vi.fn()
  const txInsertValues = vi.fn(() => ({ returning: txInsertReturning }))
  const txInsert = vi.fn(() => ({ values: txInsertValues }))

  const tx = { select: txSelect, update: txUpdate, insert: txInsert }
  const transaction = vi.fn(async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx))

  return {
    db: {
      transaction,
      query: {
        creditBalances: { findFirst: creditBalancesFindFirst },
        creditTransactions: {
          findFirst: creditTransactionsFindFirst,
          findMany: creditTransactionsFindMany,
        },
      },
    },
    __mocks: {
      creditBalancesFindFirst,
      creditTransactionsFindFirst,
      creditTransactionsFindMany,
      transaction,
      txSelectFor,
      txSelectLimit,
      txUpdateSet,
      txUpdateWhere,
      txInsertValues,
      txInsertReturning,
    },
  }
})

import {
  allocate,
  checkBalance,
  computeDeduction,
  consume,
  getHistory,
  sumEligible,
  type BalanceSnapshot,
} from './credit.service'

const dbModule = (await import('@/lib/db')) as unknown as {
  __mocks: {
    creditBalancesFindFirst: ReturnType<typeof vi.fn>
    creditTransactionsFindFirst: ReturnType<typeof vi.fn>
    creditTransactionsFindMany: ReturnType<typeof vi.fn>
    transaction: ReturnType<typeof vi.fn>
    txSelectFor: ReturnType<typeof vi.fn>
    txSelectLimit: ReturnType<typeof vi.fn>
    txUpdateSet: ReturnType<typeof vi.fn>
    txUpdateWhere: ReturnType<typeof vi.fn>
    txInsertValues: ReturnType<typeof vi.fn>
    txInsertReturning: ReturnType<typeof vi.fn>
  }
}
const mocks = dbModule.__mocks

beforeEach(() => {
  // Defaults: balance row vazio, insert devolve id, update/limit ok.
  mocks.txSelectLimit.mockResolvedValue([])
  mocks.txUpdateWhere.mockResolvedValue(undefined)
  mocks.txInsertReturning.mockResolvedValue([{ id: 'txn-new' }])
  mocks.creditTransactionsFindFirst.mockResolvedValue(undefined)
  mocks.creditBalancesFindFirst.mockResolvedValue(undefined)
})

afterEach(() => {
  vi.clearAllMocks()
})

const NOW = new Date('2026-06-01T12:00:00.000Z')

function days(n: number): Date {
  return new Date(NOW.getTime() + n * 24 * 60 * 60 * 1000)
}

/** Snapshot zerado — sobrescreva apenas os campos relevantes por teste. */
function snapshot(overrides: Partial<BalanceSnapshot> = {}): BalanceSnapshot {
  return {
    balance: 0,
    signupBalance: 0,
    signupExpiresAt: null,
    subscriptionBalance: 0,
    subscriptionExpiresAt: null,
    packBalance: 0,
    adminBalance: 0,
    adminExpiresAt: null,
    ...overrides,
  }
}

describe('computeDeduction — ordem de consumo (§4.12)', () => {
  it('deduz de um unico balde quando cabe', () => {
    const s = snapshot({ balance: 50, signupBalance: 50, signupExpiresAt: days(90) })
    const r = computeDeduction(s, 10, NOW)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.lines).toHaveLength(1)
    expect(r.lines[0]).toMatchObject({ bucket: 'signup', source: 'signup_bonus', amount: 10 })
    expect(r.totalDeducted).toBe(10)
  })

  it('expira primeiro sai primeiro: admin (30d) antes de signup (90d)', () => {
    const s = snapshot({
      balance: 20,
      signupBalance: 12,
      signupExpiresAt: days(90),
      adminBalance: 8,
      adminExpiresAt: days(30),
    })
    const r = computeDeduction(s, 10, NOW)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    // admin expira antes → consumido primeiro (8), depois signup (2)
    expect(r.lines).toEqual([
      { bucket: 'admin', source: 'admin_grant', amount: 8, expiresAt: days(30) },
      { bucket: 'signup', source: 'signup_bonus', amount: 2, expiresAt: days(90) },
    ])
  })

  it('exemplo da spec §4.12: signup 12(5d) + subscription 200(18d) + pack 100 → 15 creditos', () => {
    const s = snapshot({
      balance: 312,
      signupBalance: 12,
      signupExpiresAt: days(5),
      subscriptionBalance: 200,
      subscriptionExpiresAt: days(18),
      packBalance: 100,
    })
    const r = computeDeduction(s, 15, NOW)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.lines).toEqual([
      { bucket: 'signup', source: 'signup_bonus', amount: 12, expiresAt: days(5) },
      { bucket: 'subscription', source: 'subscription', amount: 3, expiresAt: days(18) },
    ])
    // pack nao e tocado
    expect(r.lines.some((l) => l.bucket === 'pack')).toBe(false)
  })

  it('pack (far-future) e consumido por ultimo entre baldes com saldo', () => {
    const s = snapshot({
      balance: 15,
      packBalance: 10,
      subscriptionBalance: 5,
      subscriptionExpiresAt: days(40),
    })
    const r = computeDeduction(s, 8, NOW)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    // subscription (40d) antes de pack (far-future)
    expect(r.lines[0]).toMatchObject({ bucket: 'subscription', amount: 5 })
    expect(r.lines[1]).toMatchObject({ bucket: 'pack', amount: 3 })
  })

  it('ignora balde expirado mesmo com saldo', () => {
    const s = snapshot({
      balance: 30,
      signupBalance: 20,
      signupExpiresAt: days(-1), // expirado
      subscriptionBalance: 10,
      subscriptionExpiresAt: days(10),
    })
    const r = computeDeduction(s, 5, NOW)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.lines).toEqual([
      { bucket: 'subscription', source: 'subscription', amount: 5, expiresAt: days(10) },
    ])
  })

  it('insuficiente: amount > soma dos elegiveis (ignora expirado)', () => {
    const s = snapshot({
      balance: 30,
      signupBalance: 20,
      signupExpiresAt: days(-1), // expirado, nao conta
      subscriptionBalance: 10,
      subscriptionExpiresAt: days(10),
    })
    const r = computeDeduction(s, 15, NOW)
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.reason).toBe('insufficient')
    expect(r.available).toBe(10)
    expect(r.required).toBe(15)
  })

  it('tie-break determinístico: mesmo expiry → ordem signup<admin<subscription<pack', () => {
    const s = snapshot({
      balance: 40,
      signupBalance: 10,
      signupExpiresAt: days(20),
      adminBalance: 10,
      adminExpiresAt: days(20),
      subscriptionBalance: 10,
      subscriptionExpiresAt: days(20),
      packBalance: 10,
    })
    const r = computeDeduction(s, 40, NOW)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.lines.map((l) => l.bucket)).toEqual(['signup', 'admin', 'subscription', 'pack'])
  })

  it('expiresAt null com saldo (nao-pack) e tratado como far-future (elegivel)', () => {
    const s = snapshot({ balance: 10, subscriptionBalance: 10, subscriptionExpiresAt: null })
    const r = computeDeduction(s, 5, NOW)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.lines[0]).toMatchObject({ bucket: 'subscription', amount: 5 })
  })

  it('amount exatamente igual a soma elegivel esvazia tudo', () => {
    const s = snapshot({
      balance: 30,
      signupBalance: 10,
      signupExpiresAt: days(5),
      packBalance: 20,
    })
    const r = computeDeduction(s, 30, NOW)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.totalDeducted).toBe(30)
    expect(r.lines.reduce((sum, l) => sum + l.amount, 0)).toBe(30)
  })
})

describe('sumEligible', () => {
  it('soma apenas baldes nao expirados e monta breakdown', () => {
    const s = snapshot({
      balance: 50,
      signupBalance: 20,
      signupExpiresAt: days(-1), // expirado
      subscriptionBalance: 20,
      subscriptionExpiresAt: days(10),
      packBalance: 10,
    })
    const r = sumEligible(s, NOW)
    expect(r.total).toBe(30)
    expect(r.breakdown).toEqual({ signup: 0, subscription: 20, pack: 10, admin: 0 })
  })
})

describe('checkBalance', () => {
  function balanceRow(overrides: Partial<BalanceSnapshot> = {}) {
    return {
      workspaceId: 'ws-1',
      balance: 0,
      signupBalance: 0,
      signupExpiresAt: null,
      subscriptionBalance: 0,
      subscriptionExpiresAt: null,
      packBalance: 0,
      adminBalance: 0,
      adminExpiresAt: null,
      updatedAt: NOW,
      ...overrides,
    }
  }

  it('ok=true quando available >= required (safetyFactor default 1)', async () => {
    mocks.creditBalancesFindFirst.mockResolvedValue(
      balanceRow({ balance: 50, signupBalance: 50, signupExpiresAt: days(90) })
    )
    const r = await checkBalance('ws-1', 10, { now: NOW })
    expect(r).toEqual({
      ok: true,
      available: 50,
      required: 10,
      breakdown: { signup: 50, subscription: 0, pack: 0, admin: 0 },
    })
  })

  it('ok=false quando saldo < required (sem lancar)', async () => {
    mocks.creditBalancesFindFirst.mockResolvedValue(balanceRow({ balance: 3, packBalance: 3 }))
    const r = await checkBalance('ws-1', 10, { now: NOW })
    expect(r.ok).toBe(false)
    expect(r.available).toBe(3)
  })

  it('safetyFactor 1.5 bloqueia saldo limitrofe (available 10, required 8 → ceil(12))', async () => {
    mocks.creditBalancesFindFirst.mockResolvedValue(
      balanceRow({ balance: 10, subscriptionBalance: 10, subscriptionExpiresAt: days(15) })
    )
    const r = await checkBalance('ws-1', 8, { now: NOW, safetyFactor: 1.5 })
    expect(r.ok).toBe(false)
    expect(r.available).toBe(10)
    expect(r.required).toBe(8)
  })

  it('workspace sem balance row → available 0, ok=false', async () => {
    mocks.creditBalancesFindFirst.mockResolvedValue(undefined)
    const r = await checkBalance('ws-novo', 1, { now: NOW })
    expect(r).toEqual({
      ok: false,
      available: 0,
      required: 1,
      breakdown: { signup: 0, subscription: 0, pack: 0, admin: 0 },
    })
  })

  it('ignora balde expirado no available', async () => {
    mocks.creditBalancesFindFirst.mockResolvedValue(
      balanceRow({
        balance: 30,
        signupBalance: 20,
        signupExpiresAt: days(-1),
        packBalance: 10,
      })
    )
    const r = await checkBalance('ws-1', 5, { now: NOW })
    expect(r.available).toBe(10)
    expect(r.ok).toBe(true)
  })
})

describe('getHistory', () => {
  function txRow(id: string, createdAt: Date) {
    return { id, workspaceId: 'ws-1', type: 'consume', amount: -1, createdAt }
  }

  it('retorna items e nextCursor null quando ha menos que o limit', async () => {
    mocks.creditTransactionsFindMany.mockResolvedValue([
      txRow('t1', days(0)),
      txRow('t2', days(-1)),
    ])
    const r = await getHistory('ws-1', { limit: 50 })
    expect(r.items).toHaveLength(2)
    expect(r.nextCursor).toBeNull()
  })

  it('emite nextCursor quando ha mais paginas (busca limit+1)', async () => {
    // limit 2 → busca 3; retornamos 3 → hasMore, fatia pra 2
    mocks.creditTransactionsFindMany.mockResolvedValue([
      txRow('t1', days(0)),
      txRow('t2', days(-1)),
      txRow('t3', days(-2)),
    ])
    const r = await getHistory('ws-1', { limit: 2 })
    expect(r.items).toHaveLength(2)
    expect(r.items.map((i) => i.id)).toEqual(['t1', 't2'])
    expect(r.nextCursor).not.toBeNull()
    // o findMany foi chamado com limit+1
    expect(mocks.creditTransactionsFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 3 })
    )
  })

  it('cursor faz round-trip (decode aceita o que encode gerou)', async () => {
    mocks.creditTransactionsFindMany.mockResolvedValue([
      txRow('t1', days(0)),
      txRow('t2', days(-1)),
      txRow('t3', days(-2)),
    ])
    const first = await getHistory('ws-1', { limit: 2 })
    expect(first.nextCursor).toBeTruthy()
    // segunda pagina com o cursor: nao deve lancar
    mocks.creditTransactionsFindMany.mockResolvedValue([txRow('t3', days(-2))])
    const second = await getHistory('ws-1', { limit: 2, cursor: first.nextCursor! })
    expect(second.items).toHaveLength(1)
    expect(second.nextCursor).toBeNull()
  })
})

describe('consume', () => {
  function lockedRow(overrides: Partial<BalanceSnapshot> = {}) {
    return {
      workspaceId: 'ws-1',
      balance: 0,
      signupBalance: 0,
      signupExpiresAt: null,
      subscriptionBalance: 0,
      subscriptionExpiresAt: null,
      packBalance: 0,
      adminBalance: 0,
      adminExpiresAt: null,
      updatedAt: NOW,
      ...overrides,
    }
  }

  const ctx = { pipelineId: 'analisar.video_ad', analysisId: 'a-1', idempotencyKey: 'consume:a-1' }

  it('lanca para amount nao-inteiro ou <= 0', async () => {
    await expect(consume('ws-1', null, 0, ctx)).rejects.toThrow('positive integer')
    await expect(consume('ws-1', null, -5, ctx)).rejects.toThrow('positive integer')
    await expect(consume('ws-1', null, 1.5, ctx)).rejects.toThrow('positive integer')
  })

  it('lanca quando faltam pipelineId/analysisId/idempotencyKey', async () => {
    await expect(consume('ws-1', null, 1, { ...ctx, idempotencyKey: '' })).rejects.toThrow(
      'idempotencyKey required'
    )
    await expect(consume('ws-1', null, 1, { ...ctx, pipelineId: '' })).rejects.toThrow(
      'pipelineId required'
    )
    await expect(consume('ws-1', null, 1, { ...ctx, analysisId: '' })).rejects.toThrow(
      'analysisId required'
    )
  })

  it('idempotente: key ja existe → nao abre transaction', async () => {
    mocks.creditTransactionsFindFirst.mockResolvedValue({ id: 'txn-old' })
    mocks.creditBalancesFindFirst.mockResolvedValue({ balance: 40 })
    const r = await consume('ws-1', null, 10, ctx)
    expect(r).toEqual({ ok: true, transactionId: 'txn-old', idempotent: true, newBalance: 40 })
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it('happy path: deduz, 1 insert negativo com metadata.deduction', async () => {
    mocks.txSelectLimit.mockResolvedValue([
      lockedRow({ balance: 50, signupBalance: 50, signupExpiresAt: days(90) }),
    ])
    const r = await consume('ws-1', 'user-1', 10, ctx)
    expect(r).toEqual({ ok: true, transactionId: 'txn-new', idempotent: false, newBalance: 40 })

    // lock pedido
    expect(mocks.txSelectFor).toHaveBeenCalledWith('update')
    // update aplicado
    expect(mocks.txUpdateSet).toHaveBeenCalledTimes(1)
    // 1 unica transaction de consume
    expect(mocks.txInsertValues).toHaveBeenCalledTimes(1)
    const inserted = mocks.txInsertValues.mock.calls[0]![0] as {
      type: string
      amount: number
      source: string
      metadata: { deduction: unknown[] }
    }
    expect(inserted.type).toBe('consume')
    expect(inserted.amount).toBe(-10)
    expect(inserted.source).toBe('signup_bonus')
    expect(inserted.metadata.deduction).toHaveLength(1)
  })

  it('insufficient: nenhum write, ok=false', async () => {
    mocks.txSelectLimit.mockResolvedValue([lockedRow({ balance: 3, packBalance: 3 })])
    const r = await consume('ws-1', null, 10, ctx)
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error.code).toBe('INSUFFICIENT_CREDITS')
    expect(r.available).toBe(3)
    expect(r.required).toBe(10)
    expect(mocks.txUpdateSet).not.toHaveBeenCalled()
    expect(mocks.txInsertValues).not.toHaveBeenCalled()
  })

  it('ordem: lock (.for) acontece ANTES do update e do insert', async () => {
    mocks.txSelectLimit.mockResolvedValue([
      lockedRow({ balance: 50, subscriptionBalance: 50, subscriptionExpiresAt: days(20) }),
    ])
    await consume('ws-1', null, 10, ctx)
    const lockOrder = mocks.txSelectFor.mock.invocationCallOrder[0]!
    const updateOrder = mocks.txUpdateSet.mock.invocationCallOrder[0]!
    const insertOrder = mocks.txInsertValues.mock.invocationCallOrder[0]!
    expect(lockOrder).toBeLessThan(updateOrder)
    expect(lockOrder).toBeLessThan(insertOrder)
  })

  it('race de idempotencia: INSERT viola UNIQUE → re-busca e retorna idempotent', async () => {
    mocks.txSelectLimit.mockResolvedValue([lockedRow({ balance: 50, packBalance: 50 })])
    // pre-check: nao existe; pos-erro: existe
    mocks.creditTransactionsFindFirst
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ id: 'txn-raced' })
    mocks.creditBalancesFindFirst.mockResolvedValue({ balance: 40 })
    mocks.txInsertReturning.mockRejectedValue(
      Object.assign(new Error('duplicate key'), { code: '23505' })
    )
    const r = await consume('ws-1', null, 10, ctx)
    expect(r).toEqual({ ok: true, transactionId: 'txn-raced', idempotent: true, newBalance: 40 })
  })
})

describe('creditService.allocate — input validation', () => {
  it('throws when amount is zero', async () => {
    await expect(
      allocate('00000000-0000-0000-0000-000000000000', 0, 'signup_bonus', new Date(), {
        idempotencyKey: 'k1',
      })
    ).rejects.toThrow('amount must be positive')
  })

  it('throws when amount is negative', async () => {
    await expect(
      allocate('00000000-0000-0000-0000-000000000000', -1, 'signup_bonus', new Date(), {
        idempotencyKey: 'k2',
      })
    ).rejects.toThrow('amount must be positive')
  })

  it('throws when idempotencyKey is empty', async () => {
    await expect(
      allocate('00000000-0000-0000-0000-000000000000', 50, 'signup_bonus', new Date(), {
        idempotencyKey: '',
      })
    ).rejects.toThrow('idempotencyKey required')
  })
})
