import { describe, expect, it } from 'vitest'

import { blocoTransicaoSchema } from './bloco-transicao'

function validBloco() {
  return {
    campaignContext: {
      name: 'Campanha X',
      objective: 'CONVERSIONS',
      platform: 'meta',
      budgetDaily: 5000,
      audience: 'Mulheres 25-45',
      creativeType: 'video',
      productType: 'infoproduto',
      ticketRange: 'R$197-497',
    },
    funnelMetrics: {
      hookRate: 0.3,
      holdRate: 0.15,
      ctr: 0.02,
      cpa: 4500,
      roas: 2.3,
      impressions: 100000,
      clicks: 2000,
      conversions: 40,
      spend: 180000,
    },
    bottleneckHint: { type: 'creative', stage: 'hook', severity: 'high' },
    creativeData: { copyText: 'Compre agora', creativeUrl: 'https://x.com/v.mp4' },
    userContext: {
      niche: 'emagrecimento',
      investmentRange: 'R$5k-20k',
      profileContextFreeform: null,
    },
  }
}

describe('blocoTransicaoSchema', () => {
  it('aceita um bloco mínimo válido (sem campos opcionais)', () => {
    expect(blocoTransicaoSchema.safeParse(validBloco()).success).toBe(true)
  })

  it('aceita campos opcionais (landing_data, frames, reference_benchmarks)', () => {
    const bloco = {
      ...validBloco(),
      landingData: { screenshotUrl: 'https://x.com/s.png', domExtracted: '<html>' },
      creativeData: {
        copyText: 'x',
        creativeUrl: null,
        frames: ['f1', 'f2'],
        transcription: 'fala...',
      },
      referenceBenchmarks: { marketBenchmarks: { ctr: 0.03 } },
    }
    expect(blocoTransicaoSchema.safeParse(bloco).success).toBe(true)
  })

  it('rejeita platform inválida', () => {
    const bloco = validBloco()
    bloco.campaignContext.platform = 'tiktok'
    expect(blocoTransicaoSchema.safeParse(bloco).success).toBe(false)
  })

  it('rejeita severity fora do enum', () => {
    const bloco = validBloco()
    bloco.bottleneckHint.severity = 'critical'
    expect(blocoTransicaoSchema.safeParse(bloco).success).toBe(false)
  })

  it('rejeita quando falta funnel_metrics', () => {
    const bloco = validBloco() as Record<string, unknown>
    delete bloco.funnelMetrics
    expect(blocoTransicaoSchema.safeParse(bloco).success).toBe(false)
  })
})
