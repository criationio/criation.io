import { describe, expect, it } from 'vitest'

import { parseV1, mapV1StatusToEvent } from './legacyParser'
import { detectHotmartVersion, parseV2 } from './parser'

describe('parseV2', () => {
  it('parses envelope basico v2', () => {
    const body = JSON.stringify({
      id: 'evt-123',
      creation_date: 1715000000000,
      event: 'PURCHASE_APPROVED',
      version: '2.0.0',
      hottok: 'x',
      data: {
        purchase: {
          transaction: 'HP1234',
          price: { value: 49.9, currency_value: 'BRL' },
        },
      },
    })
    const parsed = parseV2(body)
    expect(parsed.envelope.id).toBe('evt-123')
    expect(parsed.envelope.event).toBe('PURCHASE_APPROVED')
    expect(parsed.data.purchase?.price?.value).toBe(49.9)
  })

  it('aceita campos extras no envelope (passthrough)', () => {
    const body = JSON.stringify({
      id: 'x',
      creation_date: 1,
      event: 'X',
      version: '2.0.0',
      data: { foo: 'bar' },
      extra_field: 'preserved',
    })
    expect(() => parseV2(body)).not.toThrow()
  })

  it('throw em payload sem id', () => {
    const body = JSON.stringify({ event: 'X', creation_date: 1, version: '2.0.0', data: {} })
    expect(() => parseV2(body)).toThrow()
  })
})

describe('parseV1', () => {
  it('extrai fields do form-urlencoded', () => {
    const body = 'transaction=HP123&status=APPROVED&prod=12345&email=foo@bar.com'
    const parsed = parseV1(body)
    expect(parsed.fields.transaction).toBe('HP123')
    expect(parsed.fields.status).toBe('APPROVED')
    expect(parsed.fields.email).toBe('foo@bar.com')
    expect(parsed.syntheticEventId).toMatch(/^[0-9a-f]{64}$/)
  })

  it('gera syntheticEventId estavel para mesmos inputs', () => {
    const body = 'transaction=HP123&status=APPROVED&creation_date=2024-01-01'
    const a = parseV1(body)
    const b = parseV1(body)
    expect(a.syntheticEventId).toBe(b.syntheticEventId)
  })

  it('mapeia status v1 para event canonico', () => {
    expect(mapV1StatusToEvent('APPROVED')).toBe('PURCHASE_APPROVED')
    expect(mapV1StatusToEvent('REFUNDED')).toBe('PURCHASE_REFUNDED')
    expect(mapV1StatusToEvent('chargeback')).toBe('PURCHASE_CHARGEBACK')
    expect(mapV1StatusToEvent('FOOBAR')).toBe('UNKNOWN_FOOBAR')
  })
})

describe('detectHotmartVersion', () => {
  it('detecta v2 via content-type application/json', () => {
    const body = JSON.stringify({ id: 'x', event: 'Y', data: {} })
    const headers = new Headers({ 'content-type': 'application/json' })
    expect(detectHotmartVersion(body, headers)).toBe('v2')
  })

  it('detecta v1 via content-type form-urlencoded', () => {
    const headers = new Headers({ 'content-type': 'application/x-www-form-urlencoded' })
    expect(detectHotmartVersion('a=1&b=2', headers)).toBe('v1')
  })

  it('heuristica: body comeca com { => v2', () => {
    expect(detectHotmartVersion('{"id":"x","event":"Y","data":{}}', new Headers())).toBe('v2')
  })

  it('heuristica: body com & e = => v1', () => {
    expect(detectHotmartVersion('a=1&b=2', new Headers())).toBe('v1')
  })

  it('unknown quando body nao bate nenhuma heuristica', () => {
    expect(detectHotmartVersion('plain text', new Headers())).toBe('unknown')
  })
})
