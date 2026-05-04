import { describe, expect, it } from 'vitest'
import { formatBRL, formatPercent, formatNumber, formatCompact, formatDelta } from './format'

describe('formatBRL', () => {
  it('formats positive cents to BRL currency', () => {
    expect(formatBRL(15000)).toBe('R$ 150,00')
  })

  it('formats zero', () => {
    expect(formatBRL(0)).toBe('R$ 0,00')
  })

  it('formats negative cents', () => {
    expect(formatBRL(-5090)).toBe('-R$ 50,90')
  })

  it('formats large values', () => {
    expect(formatBRL(12458000)).toBe('R$ 124.580,00')
  })
})

describe('formatPercent', () => {
  it('formats positive percentage', () => {
    expect(formatPercent(25.5)).toBe('25,5%')
  })

  it('formats zero', () => {
    expect(formatPercent(0)).toBe('0,0%')
  })

  it('formats negative percentage', () => {
    expect(formatPercent(-8.2)).toBe('-8,2%')
  })

  it('respects decimal parameter', () => {
    expect(formatPercent(33.333, 2)).toBe('33,33%')
  })
})

describe('formatNumber', () => {
  it('formats with pt-BR thousand separators', () => {
    expect(formatNumber(1234567)).toBe('1.234.567')
  })

  it('formats zero', () => {
    expect(formatNumber(0)).toBe('0')
  })

  it('formats negative numbers', () => {
    expect(formatNumber(-42300)).toBe('-42.300')
  })
})

describe('formatCompact', () => {
  it('formats thousands', () => {
    expect(formatCompact(1500)).toBe('1,5 mil')
  })

  it('formats millions', () => {
    expect(formatCompact(2500000)).toBe('2,5 mi')
  })

  it('formats zero', () => {
    expect(formatCompact(0)).toBe('0')
  })
})

describe('formatDelta', () => {
  it('formats positive delta with + sign', () => {
    const result = formatDelta(12.5)
    expect(result.text).toBe('+12.5%')
    expect(result.trend).toBe('up')
  })

  it('formats negative delta', () => {
    const result = formatDelta(-8.2)
    expect(result.text).toBe('-8.2%')
    expect(result.trend).toBe('down')
  })

  it('formats zero as flat', () => {
    const result = formatDelta(0)
    expect(result.text).toBe('0%')
    expect(result.trend).toBe('flat')
  })

  it('respects decimal parameter', () => {
    const result = formatDelta(12.567, 2)
    expect(result.text).toBe('+12.57%')
    expect(result.trend).toBe('up')
  })
})
