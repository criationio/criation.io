import { describe, expect, it } from 'vitest'

import { deterministicEventId, resolveEventId, type DedupInputs } from './dedup'

const baseInputs: DedupInputs = {
  workspaceId: 'ws-abc-123',
  eventName: 'Purchase',
  primaryKey: 'order-xyz-789',
  eventTime: new Date('2026-05-12T13:45:30.000Z'),
}

describe('deterministicEventId', () => {
  it('produz UUID-formatted string (8-4-4-4-12)', () => {
    const id = deterministicEventId(baseInputs)
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
  })

  it('e deterministico — mesmos inputs => mesmo ID (retry-safe)', () => {
    const id1 = deterministicEventId(baseInputs)
    const id2 = deterministicEventId(baseInputs)
    expect(id1).toBe(id2)
  })

  it('inputs diferentes => IDs diferentes', () => {
    const base = deterministicEventId(baseInputs)
    expect(deterministicEventId({ ...baseInputs, workspaceId: 'ws-other' })).not.toBe(base)
    expect(deterministicEventId({ ...baseInputs, eventName: 'AddToCart' })).not.toBe(base)
    expect(deterministicEventId({ ...baseInputs, primaryKey: 'order-other' })).not.toBe(base)
    expect(
      deterministicEventId({ ...baseInputs, eventTime: new Date('2026-05-12T13:45:30.001Z') })
    ).not.toBe(base)
  })

  it('normaliza case e whitespace em strings', () => {
    const a = deterministicEventId({
      ...baseInputs,
      workspaceId: 'WS-ABC-123',
      eventName: 'PURCHASE',
      primaryKey: '  order-xyz-789  ',
    })
    const b = deterministicEventId(baseInputs)
    expect(a).toBe(b)
  })

  it('precisao em ms — 2 eventos 1ms apart tem IDs diferentes', () => {
    const t1 = new Date('2026-05-12T13:45:30.000Z')
    const t2 = new Date('2026-05-12T13:45:30.001Z')
    expect(deterministicEventId({ ...baseInputs, eventTime: t1 })).not.toBe(
      deterministicEventId({ ...baseInputs, eventTime: t2 })
    )
  })

  it('cross-platform Meta+Google: NAO depende de provider (chave canonica omite)', () => {
    // Mesma fonte de verdade — fanout pra Meta e Google usam mesmo event_id.
    // (Provider nao e parte dos inputs; nao tem como gerar IDs diferentes
    // por canal sem mudar inputs do logical event.)
    const id = deterministicEventId(baseInputs)
    expect(id).toBe(deterministicEventId(baseInputs))
  })
})

describe('resolveEventId', () => {
  it('passa existingId quando preenchido', () => {
    const id = resolveEventId('abc-existing-uuid-from-browser', baseInputs)
    expect(id).toBe('abc-existing-uuid-from-browser')
  })

  it('trim no existingId', () => {
    const id = resolveEventId('  abc-existing  ', baseInputs)
    expect(id).toBe('abc-existing')
  })

  it('gera deterministico quando existingId null/undefined', () => {
    expect(resolveEventId(null, baseInputs)).toBe(deterministicEventId(baseInputs))
    expect(resolveEventId(undefined, baseInputs)).toBe(deterministicEventId(baseInputs))
  })

  it('gera deterministico quando existingId vazio ou so-whitespace', () => {
    expect(resolveEventId('', baseInputs)).toBe(deterministicEventId(baseInputs))
    expect(resolveEventId('   ', baseInputs)).toBe(deterministicEventId(baseInputs))
  })

  it('gera mesmo ID em retries do fanout (idempotencia)', () => {
    // Simula: gateway webhook sem event_id, fanout tenta 3x com retry.
    // Cada retry chama resolveEventId(null, sameInputs).
    const id1 = resolveEventId(null, baseInputs)
    const id2 = resolveEventId(null, baseInputs)
    const id3 = resolveEventId(null, baseInputs)
    expect(id1).toBe(id2)
    expect(id2).toBe(id3)
  })
})
