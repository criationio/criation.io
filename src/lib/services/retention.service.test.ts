/**
 * Testes do retention service (TD-108). Mocka `db.execute` e `db.insert` —
 * smoke E2E com banco real fica na sessao 1.4.9.5.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db', () => {
  const execute = vi.fn()
  const values = vi.fn()
  const insert = vi.fn(() => ({ values }))
  return {
    db: { execute, insert },
  }
})

vi.mock('@/lib/db/schema/audit', () => ({
  auditLogs: { __table: 'audit_logs' },
}))

import { db } from '@/lib/db'

import { purgePlainPii } from './retention.service'

const executeMock = vi.mocked(db.execute)
const insertMock = vi.mocked(db.insert)

beforeEach(() => {
  // Cada chamada de db.insert(...) retorna o mesmo objeto { values }
  // pra que mocking de values.mockResolvedValue persista entre chamadas.
  const valuesMock = vi.fn().mockResolvedValue(undefined)
  insertMock.mockReturnValue({ values: valuesMock } as never)
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('purgePlainPii', () => {
  it('executa 2 UPDATEs (tracking_events + gateway_events) e insere audit log', async () => {
    executeMock.mockResolvedValueOnce({ count: 42 } as never)
    executeMock.mockResolvedValueOnce({ count: 7 } as never)

    const result = await purgePlainPii()

    expect(executeMock).toHaveBeenCalledTimes(2)
    expect(result.trackingEventsPurged).toBe(42)
    expect(result.gatewayEventsPurged).toBe(7)
    expect(result.retentionDays).toBe(30)
    expect(result.executedAt).toBeInstanceOf(Date)

    expect(insertMock).toHaveBeenCalledTimes(1)
    const valuesArgs = (
      insertMock.mock.results[0]!.value as { values: { mock: { calls: unknown[][] } } }
    ).values.mock.calls[0]![0] as Record<string, unknown>
    expect(valuesArgs.workspaceId).toBeNull()
    expect(valuesArgs.actorUserId).toBeNull()
    expect(valuesArgs.eventType).toBe('lgpd.purge_plain_pii')
    expect(valuesArgs.payload).toMatchObject({
      tracking_events_purged: 42,
      gateway_events_purged: 7,
      retention_days: 30,
    })
  })

  it('zera counts quando nenhuma linha precisa purgar (idempotente em re-run)', async () => {
    executeMock.mockResolvedValue({ count: 0 } as never)

    const result = await purgePlainPii()

    expect(result.trackingEventsPurged).toBe(0)
    expect(result.gatewayEventsPurged).toBe(0)
    expect(insertMock).toHaveBeenCalled() // audit log entry sempre roda
  })

  it('normaliza retorno do dialect — aceita rowCount em vez de count', async () => {
    executeMock.mockResolvedValueOnce({ rowCount: 15 } as never)
    executeMock.mockResolvedValueOnce({ rowCount: 3 } as never)

    const result = await purgePlainPii()
    expect(result.trackingEventsPurged).toBe(15)
    expect(result.gatewayEventsPurged).toBe(3)
  })

  it('normaliza retorno alternativo — array rows', async () => {
    executeMock.mockResolvedValueOnce({ rows: { length: 8 } } as never)
    executeMock.mockResolvedValueOnce({ rows: { length: 2 } } as never)

    const result = await purgePlainPii()
    expect(result.trackingEventsPurged).toBe(8)
    expect(result.gatewayEventsPurged).toBe(2)
  })

  it('count 0 quando retorno e null/undefined ou shape inesperado', async () => {
    executeMock.mockResolvedValueOnce(undefined as never)
    executeMock.mockResolvedValueOnce({ unexpected: 'shape' } as never)

    const result = await purgePlainPii()
    expect(result.trackingEventsPurged).toBe(0)
    expect(result.gatewayEventsPurged).toBe(0)
  })

  it('audit log captura timestamp ISO 8601', async () => {
    executeMock.mockResolvedValue({ count: 1 } as never)

    await purgePlainPii()

    const valuesArgs = (
      insertMock.mock.results[0]!.value as { values: { mock: { calls: unknown[][] } } }
    ).values.mock.calls[0]![0] as Record<string, unknown>
    const payload = valuesArgs.payload as Record<string, unknown>
    expect(payload.executed_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
  })
})
