/**
 * Testes do erasure service (TD-104). Mocka db.transaction + queries
 * encapsuladas. Smoke E2E com banco real fica como follow-up (1.4.9.5 ou
 * sessao dedicada quando primeiro titular request chegar).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db', () => {
  // Mocks da tx — todas as operacoes dentro do transaction
  const txSelectFrom = vi.fn()
  const txSelectWhere = vi.fn()
  const txSelect = vi.fn(() => ({ from: txSelectFrom }))

  const txDeleteWhere = vi.fn()
  const txDeleteReturning = vi.fn()
  const txDelete = vi.fn(() => ({ where: txDeleteWhere }))

  const txUpdateSet = vi.fn()
  const txUpdateWhere = vi.fn()
  const txUpdateReturning = vi.fn()
  const txUpdate = vi.fn(() => ({ set: txUpdateSet }))

  const txInsertValues = vi.fn()
  const txInsert = vi.fn(() => ({ values: txInsertValues }))

  // Chain builders precisam de implementacao default que retorna o proximo step
  txSelectFrom.mockImplementation(() => ({ where: txSelectWhere }))
  txDeleteWhere.mockImplementation(() => ({ returning: txDeleteReturning }))
  txUpdateSet.mockImplementation(() => ({ where: txUpdateWhere }))
  txUpdateWhere.mockImplementation(() => ({ returning: txUpdateReturning }))

  const tx = {
    select: txSelect,
    delete: txDelete,
    update: txUpdate,
    insert: txInsert,
  }

  const transaction = vi.fn(async (cb: (tx: typeof txSelect.prototype) => Promise<unknown>) => {
    return cb(tx as never)
  })

  return {
    db: {
      transaction,
      // helpers expostos pros testes via __mocks
    },
    __mocks: {
      tx,
      txSelectWhere,
      txDeleteReturning,
      txUpdateReturning,
      txInsertValues,
      txSelect,
      txDelete,
      txUpdate,
      txInsert,
    },
  }
})

vi.mock('@/lib/db/schema/audit', () => ({
  auditLogs: { __table: 'audit_logs' },
}))

vi.mock('@/lib/db/schema/gateway', () => ({
  gatewayEvents: {
    workspaceId: '__ws',
    customerEmailHash: '__email_hash',
    customerPhoneHash: '__phone_hash',
    buyerDocumentHash: '__doc_hash',
    matchedVisitorId: '__mvid',
    visitorMatchStrategy: '__vms',
    visitorMatchConfidence: '__vmc',
    visitorMatchedAt: '__vma',
    id: '__id',
  },
  gatewaySubscriptions: {
    workspaceId: '__ws',
    identifiedVisitorId: '__ivid',
    id: '__id',
  },
}))

vi.mock('@/lib/db/schema/tracking', () => ({
  trackingEvents: {
    workspaceId: '__ws',
    matchedBuyerEmailHash: '__mbeh',
    id: '__id',
  },
  trackingVisitors: {
    workspaceId: '__ws',
    visitorId: '__visitor_id',
    identifiedBuyerEmailHash: '__ibeh',
  },
}))

import { eraseDataSubject, ErasureValidationError } from './erasure.service'

const dbModule = (await import('@/lib/db')) as unknown as {
  __mocks: {
    txSelectWhere: ReturnType<typeof vi.fn>
    txDeleteReturning: ReturnType<typeof vi.fn>
    txUpdateReturning: ReturnType<typeof vi.fn>
    txInsertValues: ReturnType<typeof vi.fn>
    txSelect: ReturnType<typeof vi.fn>
    txDelete: ReturnType<typeof vi.fn>
    txUpdate: ReturnType<typeof vi.fn>
    txInsert: ReturnType<typeof vi.fn>
  }
}

const mocks = dbModule.__mocks

beforeEach(() => {
  // Defaults: vazio em todas as queries
  mocks.txSelectWhere.mockResolvedValue([])
  mocks.txDeleteReturning.mockResolvedValue([])
  mocks.txUpdateReturning.mockResolvedValue([])
  mocks.txInsertValues.mockResolvedValue(undefined)
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('eraseDataSubject — validation', () => {
  it('throws quando nem emailHash nem visitorId fornecidos', async () => {
    await expect(
      eraseDataSubject({
        workspaceId: 'ws-1',
        actorUserId: 'admin-1',
        reason: 'test',
      })
    ).rejects.toBeInstanceOf(ErasureValidationError)
  })

  it('throws quando workspaceId ausente', async () => {
    await expect(
      eraseDataSubject({
        workspaceId: '',
        emailHash: 'a'.repeat(64),
        actorUserId: 'admin-1',
        reason: 'test',
      })
    ).rejects.toBeInstanceOf(ErasureValidationError)
  })

  it('throws quando reason ausente ou whitespace', async () => {
    await expect(
      eraseDataSubject({
        workspaceId: 'ws-1',
        emailHash: 'a'.repeat(64),
        actorUserId: 'admin-1',
        reason: '   ',
      })
    ).rejects.toBeInstanceOf(ErasureValidationError)
  })
})

describe('eraseDataSubject — cascade behavior', () => {
  it('apenas emailHash: encontra visitors sticky + executa cascade completa', async () => {
    // Sticky visitors retornados na primeira tx.select
    mocks.txSelectWhere.mockResolvedValueOnce([
      { visitorId: 'visitor-aaa' },
      { visitorId: 'visitor-bbb' },
    ])
    // tracking_visitors DELETE retorna 2 ids deletados
    mocks.txDeleteReturning.mockResolvedValueOnce([{ id: 'visitor-aaa' }, { id: 'visitor-bbb' }])
    // tracking_events UPDATE retorna 5 ids
    mocks.txUpdateReturning.mockResolvedValueOnce(
      Array(5)
        .fill(null)
        .map((_, i) => ({ id: `te-${i}` }))
    )
    // gateway_events UPDATE customer_email_hash retorna 3
    mocks.txUpdateReturning.mockResolvedValueOnce(
      Array(3)
        .fill(null)
        .map((_, i) => ({ id: `ge-${i}` }))
    )
    // gateway_events UPDATE matched_visitor_id retorna 1
    mocks.txUpdateReturning.mockResolvedValueOnce([{ id: 'ge-mv-1' }])
    // gateway_subscriptions UPDATE retorna 1
    mocks.txUpdateReturning.mockResolvedValueOnce([{ id: 'sub-1' }])

    const result = await eraseDataSubject({
      workspaceId: 'ws-1',
      emailHash: 'a'.repeat(64),
      actorUserId: 'admin-1',
      reason: 'LGPD Art. 18 III',
    })

    expect(result.cascadedVisitorIds).toEqual(['visitor-aaa', 'visitor-bbb'])
    expect(result.trackingVisitorsDeleted).toBe(2)
    expect(result.trackingEventsCleared).toBe(5)
    expect(result.gatewayEventsCleared).toBe(4) // 3 + 1
    expect(result.gatewaySubscriptionsCleared).toBe(1)

    // Audit log foi inserido
    expect(mocks.txInsertValues).toHaveBeenCalledTimes(1)
    const auditPayload = mocks.txInsertValues.mock.calls[0]![0] as Record<string, unknown>
    expect(auditPayload.eventType).toBe('lgpd.erasure_request')
    expect(auditPayload.workspaceId).toBe('ws-1')
    expect(auditPayload.actorUserId).toBe('admin-1')
  })

  it('apenas visitorId: skipa busca sticky, executa cascade visitor', async () => {
    // tracking_visitors DELETE retorna 1
    mocks.txDeleteReturning.mockResolvedValueOnce([{ id: 'visitor-direct' }])
    // tracking_events nao roda (sem email_hash)
    // gateway_events UPDATE customer_email_hash NAO roda (sem email_hash)
    // gateway_events UPDATE matched_visitor_id retorna 2
    mocks.txUpdateReturning.mockResolvedValueOnce(
      Array(2)
        .fill(null)
        .map((_, i) => ({ id: `ge-${i}` }))
    )
    // gateway_subscriptions retorna 1
    mocks.txUpdateReturning.mockResolvedValueOnce([{ id: 'sub-1' }])

    const result = await eraseDataSubject({
      workspaceId: 'ws-1',
      visitorId: 'visitor-direct',
      actorUserId: 'admin-1',
      reason: 'self-service',
    })

    expect(result.cascadedVisitorIds).toEqual(['visitor-direct'])
    expect(result.trackingVisitorsDeleted).toBe(1)
    expect(result.trackingEventsCleared).toBe(0) // sem emailHash, pula
    expect(result.gatewayEventsCleared).toBe(2)
    expect(result.gatewaySubscriptionsCleared).toBe(1)

    // Sticky lookup nao deve ter rodado
    expect(mocks.txSelect).not.toHaveBeenCalled()
  })

  it('ambos emailHash e visitorId: combina cascadedVisitorIds (dedup via Set)', async () => {
    // Sticky lookup retorna o mesmo visitorId + outro
    mocks.txSelectWhere.mockResolvedValueOnce([
      { visitorId: 'visitor-direct' }, // duplicado com input
      { visitorId: 'visitor-other' },
    ])
    mocks.txDeleteReturning.mockResolvedValueOnce([
      { id: 'visitor-direct' },
      { id: 'visitor-other' },
    ])
    mocks.txUpdateReturning.mockResolvedValueOnce([])
    mocks.txUpdateReturning.mockResolvedValueOnce([])
    mocks.txUpdateReturning.mockResolvedValueOnce([])
    mocks.txUpdateReturning.mockResolvedValueOnce([])

    const result = await eraseDataSubject({
      workspaceId: 'ws-1',
      emailHash: 'b'.repeat(64),
      visitorId: 'visitor-direct',
      actorUserId: 'admin-1',
      reason: 'both',
    })

    // Set dedup: 2 unicos (visitor-direct, visitor-other), nao 3
    expect(result.cascadedVisitorIds).toHaveLength(2)
    expect(new Set(result.cascadedVisitorIds)).toEqual(new Set(['visitor-direct', 'visitor-other']))
  })

  it('audit log capturado com counts mesmo quando ja-deletado (re-run idempotente)', async () => {
    // Nada encontrado em todas as queries
    mocks.txSelectWhere.mockResolvedValue([])
    mocks.txDeleteReturning.mockResolvedValue([])
    mocks.txUpdateReturning.mockResolvedValue([])

    const result = await eraseDataSubject({
      workspaceId: 'ws-1',
      emailHash: 'c'.repeat(64),
      actorUserId: 'admin-1',
      reason: 're-run',
    })

    expect(result.trackingVisitorsDeleted).toBe(0)
    expect(result.trackingEventsCleared).toBe(0)
    expect(result.gatewayEventsCleared).toBe(0)
    expect(result.gatewaySubscriptionsCleared).toBe(0)

    // Audit log inserido mesmo com 0 deletados — prova da tentativa
    expect(mocks.txInsertValues).toHaveBeenCalledTimes(1)
  })

  it('actorUserId null e aceito (endpoint publico futuro)', async () => {
    mocks.txDeleteReturning.mockResolvedValueOnce([{ id: 'visitor-1' }])
    mocks.txUpdateReturning.mockResolvedValueOnce([])
    mocks.txUpdateReturning.mockResolvedValueOnce([])

    await eraseDataSubject({
      workspaceId: 'ws-1',
      visitorId: 'visitor-1',
      actorUserId: null,
      reason: 'public endpoint',
    })

    const auditPayload = mocks.txInsertValues.mock.calls[0]![0] as Record<string, unknown>
    expect(auditPayload.actorUserId).toBeNull()
  })

  it('payload do audit inclui counts + reason + timestamps', async () => {
    mocks.txDeleteReturning.mockResolvedValueOnce([{ id: 'v-1' }])
    mocks.txUpdateReturning.mockResolvedValueOnce([])
    mocks.txUpdateReturning.mockResolvedValueOnce([])

    await eraseDataSubject({
      workspaceId: 'ws-1',
      visitorId: 'v-1',
      actorUserId: 'admin-1',
      reason: 'ticket 1234',
    })

    const auditPayload = (mocks.txInsertValues.mock.calls[0]![0] as Record<string, unknown>)
      .payload as Record<string, unknown>
    expect(auditPayload.reason).toBe('ticket 1234')
    expect(auditPayload.tracking_visitors_deleted).toBe(1)
    expect(auditPayload.executed_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
  })
})
