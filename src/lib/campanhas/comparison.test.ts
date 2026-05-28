import { describe, expect, it } from 'vitest'

import { deltaPct, formatMetricValue, totalPages } from './comparison'

describe('deltaPct', () => {
  it('retorna 0 quando ambos sao zero', () => {
    expect(deltaPct(0, 0)).toBe(0)
  })

  it('retorna 100 quando previous e zero e current > 0', () => {
    expect(deltaPct(50, 0)).toBe(100)
  })

  it('calcula crescimento positivo corretamente', () => {
    expect(deltaPct(150, 100)).toBe(50)
  })

  it('calcula queda corretamente', () => {
    expect(deltaPct(75, 100)).toBe(-25)
  })

  it('lida com valores negativos', () => {
    expect(deltaPct(-10, -20)).toBe(-50)
  })

  it('nao retorna Infinity quando current > 0 e previous = 0', () => {
    const result = deltaPct(999, 0)
    expect(Number.isFinite(result)).toBe(true)
  })

  it('retorna numero decimal preciso', () => {
    expect(deltaPct(110, 100)).toBeCloseTo(10, 5)
    expect(deltaPct(123, 100)).toBeCloseTo(23, 5)
  })
})

describe('formatMetricValue', () => {
  it('formata BRL dividindo cents por 100', () => {
    expect(formatMetricValue(12345, 'brl')).toContain('123')
    expect(formatMetricValue(100000, 'brl')).toContain('1.000')
  })

  it('formata percent com 2 casas e sufixo %', () => {
    expect(formatMetricValue(2.567, 'percent')).toBe('2.57%')
    expect(formatMetricValue(10, 'percent')).toBe('10.00%')
  })

  it('formata roas com 2 casas e simbolo de multiplicacao', () => {
    expect(formatMetricValue(2.5, 'roas')).toBe('2.50×')
    expect(formatMetricValue(0.95, 'roas')).toBe('0.95×')
  })

  it('formata number com locale pt-BR', () => {
    expect(formatMetricValue(1234, 'number')).toContain('1.234')
    expect(formatMetricValue(1000000, 'number')).toContain('1.000.000')
  })

  it('arredonda number para inteiro', () => {
    expect(formatMetricValue(123.7, 'number')).toBe('124')
  })

  it('retorna em-dash para zero', () => {
    expect(formatMetricValue(0, 'brl')).toBe('—')
    expect(formatMetricValue(0, 'percent')).toBe('—')
    expect(formatMetricValue(0, 'roas')).toBe('—')
    expect(formatMetricValue(0, 'number')).toBe('—')
  })

  it('retorna em-dash para valores nao-finitos', () => {
    expect(formatMetricValue(Number.NaN, 'brl')).toBe('—')
    expect(formatMetricValue(Number.POSITIVE_INFINITY, 'brl')).toBe('—')
  })
})

describe('totalPages', () => {
  it('retorna 1 quando total e 0', () => {
    expect(totalPages(0, 25)).toBe(1)
  })

  it('retorna 1 quando total <= pageSize', () => {
    expect(totalPages(10, 25)).toBe(1)
    expect(totalPages(25, 25)).toBe(1)
  })

  it('arredonda pra cima quando ha sobra', () => {
    expect(totalPages(26, 25)).toBe(2)
    expect(totalPages(50, 25)).toBe(2)
    expect(totalPages(51, 25)).toBe(3)
  })

  it('retorna 1 quando pageSize e invalido (0 ou negativo)', () => {
    expect(totalPages(100, 0)).toBe(1)
    expect(totalPages(100, -5)).toBe(1)
  })

  it('lida com totais grandes', () => {
    expect(totalPages(1000, 25)).toBe(40)
    expect(totalPages(1001, 25)).toBe(41)
  })
})
