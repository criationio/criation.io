// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/services/claude.service', () => ({ analyze: vi.fn() }))
vi.mock('@/lib/db/queries/campaign-detail', () => ({
  getCampaignHeader: vi.fn(),
  getCampaignKpis: vi.fn(),
  getCreativeForAnalysis: vi.fn(),
}))
vi.mock('@/lib/db/queries/credits', () => ({ getTransactionByIdempotencyKey: vi.fn() }))
vi.mock('@/lib/db/queries/analyses', () => ({
  insertAnalysisResult: vi.fn(),
  updateAnalysisStatus: vi.fn(),
}))
vi.mock('@/lib/db', () => ({
  db: { query: { users: { findFirst: vi.fn() } } },
}))
vi.mock('@/lib/logger', () => ({
  analysisLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { analyze } from '@/lib/services/claude.service'
import { db } from '@/lib/db'
import {
  getCampaignHeader,
  getCampaignKpis,
  getCreativeForAnalysis,
} from '@/lib/db/queries/campaign-detail'
import { getTransactionByIdempotencyKey } from '@/lib/db/queries/credits'
import { insertAnalysisResult, updateAnalysisStatus } from '@/lib/db/queries/analyses'
import { blocoTransicaoSchema } from '@/lib/validators/bloco-transicao'
import { buildBlocoTransicao, detectBottleneckHint, runVideoAdAnalysis } from './analysis.service'

const analyzeMock = analyze as unknown as ReturnType<typeof vi.fn>
const getHeaderMock = getCampaignHeader as unknown as ReturnType<typeof vi.fn>
const getKpisMock = getCampaignKpis as unknown as ReturnType<typeof vi.fn>
const getCreativeMock = getCreativeForAnalysis as unknown as ReturnType<typeof vi.fn>
const getTxMock = getTransactionByIdempotencyKey as unknown as ReturnType<typeof vi.fn>
const insertResultMock = insertAnalysisResult as unknown as ReturnType<typeof vi.fn>
const updateStatusMock = updateAnalysisStatus as unknown as ReturnType<typeof vi.fn>
const usersFindFirst = (
  db as unknown as { query: { users: { findFirst: ReturnType<typeof vi.fn> } } }
).query.users.findFirst

const baseMetrics = {
  hookRate: null,
  holdRate: null,
  ctr: 2.5,
  cpa: 30,
  roas: 3,
  impressions: 50_000,
  clicks: 1200,
  conversions: 40,
  spend: 1200,
}

const sampleCampaign = {
  id: 'c1',
  name: 'Campanha Emagrecimento',
  provider: 'meta',
  status: 'ACTIVE',
  objective: 'OUTCOME_SALES',
  dailyBudgetCents: 5000,
  lifetimeBudgetCents: null,
  lastSyncedAt: null,
}

const sampleKpis = {
  spendCents: 120_000,
  impressions: 50_000,
  clicks: 1200,
  conversions: 40,
  revenueCents: 360_000,
  ctrPct: 2.4,
  cpmCents: 2400,
  cpcCents: 100,
  cpaCents: 3000,
  roas: 3,
}

const sampleCreative = {
  id: 'cr1',
  type: 'video',
  title: 'Headline forte',
  body: 'Corpo do anúncio com CTA.',
  videoUrl: 'https://cdn.example/video.mp4',
  thumbnailUrl: 'https://cdn.example/thumb.jpg',
  durationSeconds: 30,
}

describe('detectBottleneckHint', () => {
  it('aponta creative/hook quando CTR baixo com volume de impressões', () => {
    const hint = detectBottleneckHint({ ...baseMetrics, ctr: 0.4, impressions: 20_000 })
    expect(hint.stage).toBe('creative')
    expect(hint.type).toBe('low_ctr')
    expect(hint.severity).toBe('high') // 0.4 < 0.5
  })

  it('aponta landing quando cliques chegam mas não convertem', () => {
    const hint = detectBottleneckHint({
      ...baseMetrics,
      ctr: 3,
      clicks: 800,
      conversions: 2, // cvr 0.25%
    })
    expect(hint.stage).toBe('landing')
    expect(hint.type).toBe('low_conversion')
  })

  it('aponta offer quando ROAS abaixo de 1', () => {
    const hint = detectBottleneckHint({
      ...baseMetrics,
      ctr: 3,
      clicks: 800,
      conversions: 50,
      roas: 0.4,
      spend: 1000,
    })
    expect(hint.stage).toBe('offer')
    expect(hint.type).toBe('low_roas')
    expect(hint.severity).toBe('high')
  })

  it('retorna baseline quando métricas saudáveis', () => {
    const hint = detectBottleneckHint(baseMetrics)
    expect(hint.stage).toBe('overall')
    expect(hint.type).toBe('baseline')
    expect(hint.severity).toBe('low')
  })

  it('não dispara CTR baixo sem volume mínimo de impressões', () => {
    const hint = detectBottleneckHint({ ...baseMetrics, ctr: 0.2, impressions: 100 })
    expect(hint.type).not.toBe('low_ctr')
  })
})

describe('buildBlocoTransicao', () => {
  it('produz um bloco válido contra o schema', () => {
    const bloco = buildBlocoTransicao({
      campaign: sampleCampaign,
      kpis: sampleKpis,
      creative: sampleCreative,
      profileContext: { niche: 'emagrecimento', monthlyAdSpend: '50k_100k' },
      extraContext: '  foco no hook  ',
    })
    expect(blocoTransicaoSchema.safeParse(bloco).success).toBe(true)
  })

  it('converte money de cents pra reais e zera métricas de vídeo', () => {
    const bloco = buildBlocoTransicao({
      campaign: sampleCampaign,
      kpis: sampleKpis,
      creative: sampleCreative,
      profileContext: null,
    })
    expect(bloco.funnelMetrics.spend).toBe(1200) // 120_000 cents
    expect(bloco.funnelMetrics.cpa).toBe(30) // 3000 cents
    expect(bloco.campaignContext.budgetDaily).toBe(50) // 5000 cents
    expect(bloco.funnelMetrics.hookRate).toBeNull()
    expect(bloco.funnelMetrics.holdRate).toBeNull()
  })

  it('mapeia perfil e contexto extra (trim)', () => {
    const bloco = buildBlocoTransicao({
      campaign: sampleCampaign,
      kpis: sampleKpis,
      creative: sampleCreative,
      profileContext: { niche: 'fitness', monthlyAdSpend: 'lt10k' },
      extraContext: '  meu CTA está fraco  ',
    })
    expect(bloco.userContext.niche).toBe('fitness')
    expect(bloco.userContext.investmentRange).toBe('até R$10k/mês')
    expect(bloco.userContext.profileContextFreeform).toBe('meu CTA está fraco')
  })

  it('usa fallback de copy quando criativo sem texto', () => {
    const bloco = buildBlocoTransicao({
      campaign: sampleCampaign,
      kpis: sampleKpis,
      creative: { ...sampleCreative, title: null, body: null },
      profileContext: null,
    })
    expect(bloco.creativeData.copyText).toContain('sem texto')
  })
})

describe('runVideoAdAnalysis', () => {
  const input = {
    analysisId: 'a1',
    workspaceId: 'w1',
    userId: 'u1',
    planId: 'pro',
    campaignId: 'c1',
    creativeId: 'cr1',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    getHeaderMock.mockResolvedValue(sampleCampaign)
    getCreativeMock.mockResolvedValue(sampleCreative)
    getKpisMock.mockResolvedValue(sampleKpis)
    usersFindFirst.mockResolvedValue({ profileContext: { niche: 'emagrecimento' } })
  })

  it('completa: monta bloco, chama analyze, persiste resultado e marca completed', async () => {
    analyzeMock.mockResolvedValue({
      ok: true,
      data: { verdict: 'strong', score: 80 },
      usage: { model: 'claude-sonnet-4-6', inputTokens: 100, outputTokens: 200, latencyMs: 1500 },
    })
    getTxMock.mockResolvedValue({ id: 'tx1', amount: -1 })

    const res = await runVideoAdAnalysis(input)

    expect(res.ok).toBe(true)
    // analyze recebe credits com idempotencyKey = analysisId
    const callArgs = analyzeMock.mock.calls[0]!
    expect(callArgs[2].credits).toEqual({ cost: 1, idempotencyKey: 'a1' })
    expect(insertResultMock).toHaveBeenCalledOnce()
    expect(updateStatusMock).toHaveBeenCalledWith(
      'a1',
      expect.objectContaining({
        status: 'completed',
        creditsConsumed: 1,
        creditTransactionId: 'tx1',
      })
    )
  })

  it('falha cedo quando campanha não existe — não chama analyze', async () => {
    getHeaderMock.mockResolvedValue(null)

    const res = await runVideoAdAnalysis(input)

    expect(res.ok).toBe(false)
    expect(analyzeMock).not.toHaveBeenCalled()
    expect(updateStatusMock).toHaveBeenCalledWith(
      'a1',
      expect.objectContaining({ status: 'failed' })
    )
  })

  it('propaga erro do analyze marcando failed', async () => {
    analyzeMock.mockResolvedValue({
      ok: false,
      error: { code: 'INSUFFICIENT_CREDITS', message: 'sem saldo' },
    })

    const res = await runVideoAdAnalysis(input)

    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error.code).toBe('INSUFFICIENT_CREDITS')
    expect(insertResultMock).not.toHaveBeenCalled()
    expect(updateStatusMock).toHaveBeenCalledWith(
      'a1',
      expect.objectContaining({ status: 'failed' })
    )
  })
})
