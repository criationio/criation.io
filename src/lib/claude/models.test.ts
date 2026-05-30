import { describe, expect, it } from 'vitest'

import { estimateCostUsd, MODEL_ANALYSIS_DEEP, MODEL_ANALYSIS_QUICK, MODEL_TRIVIAL } from './models'

describe('estimateCostUsd', () => {
  it('calcula custo Sonnet 4.6 (3/15 por MTok)', () => {
    // 1M input + 1M output = 3 + 15 = 18
    expect(estimateCostUsd(MODEL_ANALYSIS_QUICK, 1_000_000, 1_000_000)).toBe(18)
  })

  it('calcula custo Opus 4.8 (5/25 por MTok)', () => {
    expect(estimateCostUsd(MODEL_ANALYSIS_DEEP, 1_000_000, 1_000_000)).toBe(30)
  })

  it('calcula custo Haiku 4.5 (1/5 por MTok)', () => {
    expect(estimateCostUsd(MODEL_TRIVIAL, 1_000_000, 1_000_000)).toBe(6)
  })

  it('cobra tokens cacheados a ~0.1x do input', () => {
    // 1M input dos quais 1M cacheados → 1M * 3 * 0.1 = 0.3 (sem output)
    expect(estimateCostUsd(MODEL_ANALYSIS_QUICK, 1_000_000, 0, 1_000_000)).toBeCloseTo(0.3, 6)
  })

  it('cacheTokens parcial: billa o restante a preco cheio', () => {
    // input 1M, 600k cacheados → 400k full (0.4*3=1.2) + 600k cache (0.6*3*0.1=0.18) = 1.38
    expect(estimateCostUsd(MODEL_ANALYSIS_QUICK, 1_000_000, 0, 600_000)).toBeCloseTo(1.38, 6)
  })

  it('modelo desconhecido retorna 0 (sinaliza auditoria)', () => {
    expect(estimateCostUsd('claude-inexistente', 1000, 1000)).toBe(0)
  })

  it('custo de uma analise Quick tipica e fracao de centavo', () => {
    // ~2k input + ~1k output Sonnet → muito barato
    const cost = estimateCostUsd(MODEL_ANALYSIS_QUICK, 2000, 1000)
    expect(cost).toBeGreaterThan(0)
    expect(cost).toBeLessThan(0.05)
  })
})
