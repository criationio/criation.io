import { describe, expect, it } from 'vitest'

import { presetToRange, previousRange } from './period-range'

const REF = new Date('2026-06-15T12:00:00Z') // dia 15 de junho 2026, meio-dia UTC

describe('presetToRange', () => {
  it('today: start no inicio do dia, end no ref', () => {
    const { start, end } = presetToRange('today', REF)
    expect(start.toISOString()).toBe('2026-06-15T00:00:00.000Z')
    expect(end.getTime()).toBe(REF.getTime())
  })

  it('yesterday: dia anterior inteiro', () => {
    const { start, end } = presetToRange('yesterday', REF)
    expect(start.toISOString()).toBe('2026-06-14T00:00:00.000Z')
    expect(end.toISOString()).toBe('2026-06-14T23:59:59.999Z')
  })

  it('last_7d: 7 dias antes', () => {
    const { start } = presetToRange('last_7d', REF)
    expect(start.getTime()).toBe(REF.getTime() - 7 * 86_400_000)
  })

  it('last_30d: 30 dias antes', () => {
    const { start } = presetToRange('last_30d', REF)
    expect(start.getTime()).toBe(REF.getTime() - 30 * 86_400_000)
  })

  it('last_90d: 90 dias antes', () => {
    const { start } = presetToRange('last_90d', REF)
    expect(start.getTime()).toBe(REF.getTime() - 90 * 86_400_000)
  })

  it('mtd: comeca dia 1 do mes corrente', () => {
    const { start } = presetToRange('mtd', REF)
    expect(start.toISOString()).toBe('2026-06-01T00:00:00.000Z')
  })

  it('qtd: comeca primeiro dia do trimestre', () => {
    const { start } = presetToRange('qtd', REF)
    // Q2 2026 comeca em abril
    expect(start.toISOString()).toBe('2026-04-01T00:00:00.000Z')
  })

  it('ytd: comeca 1 de janeiro', () => {
    const { start } = presetToRange('ytd', REF)
    expect(start.toISOString()).toBe('2026-01-01T00:00:00.000Z')
  })

  it('last_month: mes inteiro anterior', () => {
    const { start, end } = presetToRange('last_month', REF)
    expect(start.toISOString()).toBe('2026-05-01T00:00:00.000Z')
    expect(end.toISOString()).toBe('2026-05-31T23:59:59.999Z')
  })

  it('last_quarter: trimestre anterior', () => {
    const { start, end } = presetToRange('last_quarter', REF)
    // Em Q2 2026, last_quarter = Q1 2026 (jan-mar)
    expect(start.toISOString()).toBe('2026-01-01T00:00:00.000Z')
    expect(end.toISOString()).toBe('2026-03-31T23:59:59.999Z')
  })

  it('preset desconhecido → default last_30d', () => {
    const { start } = presetToRange('xxx', REF)
    expect(start.getTime()).toBe(REF.getTime() - 30 * 86_400_000)
  })
})

describe('previousRange', () => {
  it('janela imediatamente anterior, mesma duracao', () => {
    const current = {
      start: new Date('2026-06-08T00:00:00Z'),
      end: new Date('2026-06-15T00:00:00Z'),
    }
    const prev = previousRange(current)
    // Duracao = 7 dias; previous deve comecar 7 dias antes do current.start
    expect(prev.start.toISOString()).toBe('2026-06-01T00:00:00.000Z')
    // end e current.start - 1ms
    expect(prev.end.getTime()).toBe(current.start.getTime() - 1)
  })

  it('duracao de 30d', () => {
    const current = {
      start: new Date('2026-05-16T00:00:00Z'),
      end: new Date('2026-06-15T00:00:00Z'),
    }
    const prev = previousRange(current)
    expect(prev.start.toISOString()).toBe('2026-04-16T00:00:00.000Z')
  })
})
