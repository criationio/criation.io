import { describe, expect, it } from 'vitest'

import { analysisQuickOutputSchema } from './analysis-quick'
import { copyGeneratorOutputSchema } from './copy-generator'

describe('analysisQuickOutputSchema', () => {
  const valid = {
    verdict: 'strong',
    score: 82,
    summary: 'Bom criativo.',
    bottleneck: { stage: 'checkout', explanation: 'CPA alto no checkout' },
    strengths: ['hook forte'],
    weaknesses: [],
    recommendations: ['testar nova CTA'],
  }

  it('aceita output válido', () => {
    expect(analysisQuickOutputSchema.safeParse(valid).success).toBe(true)
  })

  it('rejeita verdict fora do enum', () => {
    expect(analysisQuickOutputSchema.safeParse({ ...valid, verdict: 'amazing' }).success).toBe(
      false
    )
  })

  it('rejeita score fora de 0-100', () => {
    expect(analysisQuickOutputSchema.safeParse({ ...valid, score: 150 }).success).toBe(false)
  })

  it('rejeita recommendations vazias', () => {
    expect(analysisQuickOutputSchema.safeParse({ ...valid, recommendations: [] }).success).toBe(
      false
    )
  })
})

describe('copyGeneratorOutputSchema', () => {
  it('aceita variações válidas', () => {
    const valid = { variations: [{ angle: 'dor', headline: 'h', body: 'b' }] }
    expect(copyGeneratorOutputSchema.safeParse(valid).success).toBe(true)
  })

  it('rejeita array de variações vazio', () => {
    expect(copyGeneratorOutputSchema.safeParse({ variations: [] }).success).toBe(false)
  })
})
