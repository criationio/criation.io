/**
 * Testes do stitcher service. Estrategia: mock das queries Drizzle (vitest mock
 * do modulo `utm-matching`) — testa orquestracao da cascata sem precisar de
 * banco real. Smoke E2E real fica na task 52 com banco de dev.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db', () => {
  const findFirst = vi.fn()
  return {
    db: {
      query: {
        gatewayEvents: { findFirst },
        ads: { findFirst: vi.fn() },
        adSets: { findFirst: vi.fn() },
        trackingVisitors: { findFirst: vi.fn() },
      },
    },
    __findFirst: findFirst,
  }
})

vi.mock('@/lib/db/queries/utm-matching', () => ({
  findCampaignByNormalizedName: vi.fn(),
  findManualMapping: vi.fn(),
  findAffiliateMappingByOriginSrc: vi.fn(),
  incrementCampaignAggregates: vi.fn(),
  decrementCampaignAggregates: vi.fn(),
  persistStitchResult: vi.fn(),
}))

import * as matching from '@/lib/db/queries/utm-matching'
import { db } from '@/lib/db'

import { stitchAndAggregate, stitchGatewayEvent } from './utm-stitcher.service'

const baseEvent = {
  id: 'evt-1',
  workspaceId: 'ws-1',
  utmSource: 'facebook',
  utmMedium: 'cpc',
  utmCampaign: 'Black Friday 2026',
  utmContent: null,
  utmTerm: null,
  amountCents: 4990,
  eventType: 'PURCHASE_APPROVED',
  creationDateMs: null,
  createdAt: new Date('2026-05-10T10:00:00Z'),
  stitchedAt: null,
  matchStrategy: 'unmatched',
  matchedCampaignId: null,
  matchedAdSetId: null,
  matchedAdId: null,
  matchConfidence: null,
  // 1.4.B fields
  matchedVisitorId: null as string | null,
  visitorMatchStrategy: null as string | null,
  visitorMatchConfidence: null as string | null,
  visitorMatchedAt: null as Date | null,
}

beforeEach(() => {
  vi.mocked(matching.findManualMapping).mockResolvedValue(null)
  vi.mocked(matching.findCampaignByNormalizedName).mockResolvedValue(null)
  vi.mocked(matching.findAffiliateMappingByOriginSrc).mockResolvedValue(null)
  vi.mocked(matching.persistStitchResult).mockResolvedValue(undefined)
  vi.mocked(matching.incrementCampaignAggregates).mockResolvedValue(undefined)
  vi.mocked(matching.decrementCampaignAggregates).mockResolvedValue(undefined)
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('stitchGatewayEvent', () => {
  it('returns unmatched when event not found', async () => {
    vi.mocked(db.query.gatewayEvents.findFirst).mockResolvedValueOnce(undefined)
    const result = await stitchGatewayEvent('missing')
    expect(result.strategy).toBe('unmatched')
    expect(result.reason).toBe('event_not_found')
  })

  it('idempotency: returns existing result when already stitched', async () => {
    vi.mocked(db.query.gatewayEvents.findFirst).mockResolvedValueOnce({
      ...baseEvent,
      stitchedAt: new Date(),
      matchStrategy: 'perfect',
      matchedCampaignId: 'camp-1',
      matchConfidence: '1.0000',
    } as never)
    const result = await stitchGatewayEvent('evt-1')
    expect(result.strategy).toBe('perfect')
    expect(result.matchedCampaignId).toBe('camp-1')
    expect(result.confidence).toBe(1)
    expect(result.reason).toBe('already_stitched')
    expect(matching.persistStitchResult).not.toHaveBeenCalled()
  })

  it('manual mapping has precedence over name match', async () => {
    vi.mocked(db.query.gatewayEvents.findFirst).mockResolvedValueOnce(baseEvent as never)
    vi.mocked(matching.findManualMapping).mockResolvedValueOnce({
      adId: 'ad-99',
      confidence: 0.95,
    })
    vi.mocked(db.query.ads.findFirst).mockResolvedValueOnce({
      id: 'ad-99',
      adSetId: 'as-99',
    } as never)
    vi.mocked(db.query.adSets.findFirst).mockResolvedValueOnce({
      id: 'as-99',
      campaignId: 'camp-99',
    } as never)

    const result = await stitchGatewayEvent('evt-1')
    expect(result.strategy).toBe('manual')
    expect(result.matchedAdId).toBe('ad-99')
    expect(result.matchedAdSetId).toBe('as-99')
    expect(result.matchedCampaignId).toBe('camp-99')
    // Quando manual ganha, perfect nao deve ser consultado
    expect(matching.findCampaignByNormalizedName).not.toHaveBeenCalled()
  })

  it('perfect match when name normalizes equal', async () => {
    vi.mocked(db.query.gatewayEvents.findFirst).mockResolvedValueOnce(baseEvent as never)
    vi.mocked(matching.findCampaignByNormalizedName).mockResolvedValueOnce({
      campaignId: 'camp-1',
      campaignName: 'Black Friday 2026',
      matchedAdSetId: null,
      matchedAdId: null,
    })

    const result = await stitchGatewayEvent('evt-1')
    expect(result.strategy).toBe('perfect')
    expect(result.matchedCampaignId).toBe('camp-1')
    expect(result.confidence).toBe(1.0)
  })

  it('detects meta literal placeholder before trying name match', async () => {
    vi.mocked(db.query.gatewayEvents.findFirst).mockResolvedValueOnce({
      ...baseEvent,
      utmCampaign: '{{campaign.name}}',
    } as never)

    const result = await stitchGatewayEvent('evt-1')
    expect(result.strategy).toBe('meta_literal')
    expect(result.reason).toBe('utm_contains_unresolved_meta_placeholder')
    expect(matching.findCampaignByNormalizedName).not.toHaveBeenCalled()
  })

  it('unmatched when campaign name does not exist', async () => {
    vi.mocked(db.query.gatewayEvents.findFirst).mockResolvedValueOnce(baseEvent as never)
    vi.mocked(matching.findCampaignByNormalizedName).mockResolvedValueOnce(null)

    const result = await stitchGatewayEvent('evt-1')
    expect(result.strategy).toBe('unmatched')
    expect(result.reason).toBe('no_campaign_name_match')
  })

  it('unmatched with reason when no utm_campaign at all', async () => {
    vi.mocked(db.query.gatewayEvents.findFirst).mockResolvedValueOnce({
      ...baseEvent,
      utmCampaign: null,
    } as never)

    const result = await stitchGatewayEvent('evt-1')
    expect(result.strategy).toBe('unmatched')
    expect(result.reason).toBe('no_utm_campaign_provided')
  })

  it('persists result for non-idempotent paths', async () => {
    vi.mocked(db.query.gatewayEvents.findFirst).mockResolvedValueOnce(baseEvent as never)
    vi.mocked(matching.findCampaignByNormalizedName).mockResolvedValueOnce({
      campaignId: 'camp-1',
      campaignName: 'X',
      matchedAdSetId: null,
      matchedAdId: null,
    })

    await stitchGatewayEvent('evt-1')
    expect(matching.persistStitchResult).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: 'evt-1',
        strategy: 'perfect',
        matchedCampaignId: 'camp-1',
      })
    )
  })

  // ---- 1.4.B: visitor strategy ---------------------------------------------

  it('visitor strategy: usa UTMs do tracking_visitor quando matched_visitor_id setado', async () => {
    // Gateway sem UTM mas matcher ja resolveu visitor
    vi.mocked(db.query.gatewayEvents.findFirst).mockResolvedValueOnce({
      ...baseEvent,
      utmCampaign: null,
      matchedVisitorId: 'visitor-abc',
    } as never)
    vi.mocked(db.query.trackingVisitors.findFirst).mockResolvedValueOnce({
      visitorId: 'visitor-abc',
      lastUtmCampaign: 'Black Friday 2026',
      lastUtmContent: null,
      lastUtmTerm: null,
      firstUtmCampaign: null,
      firstUtmContent: null,
      firstUtmTerm: null,
    } as never)
    vi.mocked(matching.findCampaignByNormalizedName).mockResolvedValueOnce({
      campaignId: 'camp-bf',
      campaignName: 'Black Friday 2026',
      matchedAdSetId: null,
      matchedAdId: null,
    })

    const result = await stitchGatewayEvent('evt-1')
    expect(result.strategy).toBe('visitor')
    expect(result.matchedCampaignId).toBe('camp-bf')
    expect(result.confidence).toBe(0.95)
  })

  it('visitor strategy: fallback first-touch quando last-touch vazio', async () => {
    vi.mocked(db.query.gatewayEvents.findFirst).mockResolvedValueOnce({
      ...baseEvent,
      utmCampaign: null,
      matchedVisitorId: 'visitor-abc',
    } as never)
    vi.mocked(db.query.trackingVisitors.findFirst).mockResolvedValueOnce({
      visitorId: 'visitor-abc',
      lastUtmCampaign: null,
      firstUtmCampaign: 'Original Campaign',
      lastUtmContent: null,
      lastUtmTerm: null,
      firstUtmContent: null,
      firstUtmTerm: null,
    } as never)
    vi.mocked(matching.findCampaignByNormalizedName).mockResolvedValueOnce({
      campaignId: 'camp-original',
      campaignName: 'Original Campaign',
      matchedAdSetId: null,
      matchedAdId: null,
    })

    const result = await stitchGatewayEvent('evt-1')
    expect(result.strategy).toBe('visitor')
    expect(result.matchedCampaignId).toBe('camp-original')
  })

  it('visitor strategy: pula se gateway tem UTM literal mas visitor tem UTM real', async () => {
    // Caso de uso TD-083: gateway recebeu {{ad.name}} literal, visitor tem UTM bom
    vi.mocked(db.query.gatewayEvents.findFirst).mockResolvedValueOnce({
      ...baseEvent,
      utmCampaign: '{{campaign.name}}',
      matchedVisitorId: 'visitor-abc',
    } as never)
    vi.mocked(db.query.trackingVisitors.findFirst).mockResolvedValueOnce({
      visitorId: 'visitor-abc',
      lastUtmCampaign: 'Real Campaign 2026',
      lastUtmContent: null,
      lastUtmTerm: null,
      firstUtmCampaign: null,
      firstUtmContent: null,
      firstUtmTerm: null,
    } as never)
    vi.mocked(matching.findCampaignByNormalizedName).mockResolvedValueOnce({
      campaignId: 'camp-real',
      campaignName: 'Real Campaign 2026',
      matchedAdSetId: null,
      matchedAdId: null,
    })

    const result = await stitchGatewayEvent('evt-1')
    // Visitor strategy ganha — meta_literal nao roda porque visitor resolveu
    expect(result.strategy).toBe('visitor')
    expect(result.matchedCampaignId).toBe('camp-real')
  })

  it('visitor strategy: cai pra meta_literal quando visitor tambem tem UTM literal', async () => {
    vi.mocked(db.query.gatewayEvents.findFirst).mockResolvedValueOnce({
      ...baseEvent,
      utmCampaign: '{{campaign.name}}',
      matchedVisitorId: 'visitor-abc',
    } as never)
    vi.mocked(db.query.trackingVisitors.findFirst).mockResolvedValueOnce({
      visitorId: 'visitor-abc',
      lastUtmCampaign: '{{campaign.name}}',
      firstUtmCampaign: null,
      lastUtmContent: null,
      lastUtmTerm: null,
      firstUtmContent: null,
      firstUtmTerm: null,
    } as never)

    const result = await stitchGatewayEvent('evt-1')
    expect(result.strategy).toBe('meta_literal')
  })

  it('visitor strategy: pula sem matched_visitor_id (matcher nao rodou ou unmatched)', async () => {
    vi.mocked(db.query.gatewayEvents.findFirst).mockResolvedValueOnce({
      ...baseEvent,
      matchedVisitorId: null,
    } as never)
    vi.mocked(matching.findCampaignByNormalizedName).mockResolvedValueOnce({
      campaignId: 'camp-1',
      campaignName: 'Black Friday 2026',
      matchedAdSetId: null,
      matchedAdId: null,
    })

    const result = await stitchGatewayEvent('evt-1')
    // Cai pra perfect via UTM do gateway (cascata original)
    expect(result.strategy).toBe('perfect')
    // trackingVisitors.findFirst NAO foi chamado
    expect(db.query.trackingVisitors.findFirst).not.toHaveBeenCalled()
  })

  it('manual mapping ainda tem precedencia sobre visitor strategy', async () => {
    vi.mocked(db.query.gatewayEvents.findFirst).mockResolvedValueOnce({
      ...baseEvent,
      matchedVisitorId: 'visitor-abc',
    } as never)
    vi.mocked(matching.findManualMapping).mockResolvedValueOnce({
      adId: 'ad-99',
      confidence: 1.0,
    })
    vi.mocked(db.query.ads.findFirst).mockResolvedValueOnce({
      id: 'ad-99',
      adSetId: 'as-99',
    } as never)
    vi.mocked(db.query.adSets.findFirst).mockResolvedValueOnce({
      id: 'as-99',
      campaignId: 'camp-99',
    } as never)

    const result = await stitchGatewayEvent('evt-1')
    expect(result.strategy).toBe('manual')
    // Visitor lookup nao foi feito porque manual ja resolveu
    expect(db.query.trackingVisitors.findFirst).not.toHaveBeenCalled()
  })

  // ---- TD-087: affiliate strategy (origin.src fallback) --------------------

  it('affiliate strategy: matchea via origin.src quando UTMs nao resolvem', async () => {
    vi.mocked(db.query.gatewayEvents.findFirst).mockResolvedValueOnce({
      ...baseEvent,
      utmCampaign: null,
      origin: { src: 'sparkle-afiliado-123' },
    } as never)
    vi.mocked(matching.findAffiliateMappingByOriginSrc).mockResolvedValueOnce({
      adId: 'ad-aff',
      confidence: 0.95,
    })
    vi.mocked(db.query.ads.findFirst).mockResolvedValueOnce({
      id: 'ad-aff',
      adSetId: 'as-aff',
    } as never)
    vi.mocked(db.query.adSets.findFirst).mockResolvedValueOnce({
      id: 'as-aff',
      campaignId: 'camp-aff',
    } as never)

    const result = await stitchGatewayEvent('evt-1')
    expect(result.strategy).toBe('affiliate')
    expect(result.matchedAdId).toBe('ad-aff')
    expect(result.matchedAdSetId).toBe('as-aff')
    expect(result.matchedCampaignId).toBe('camp-aff')
    expect(result.confidence).toBe(0.95)
  })

  it('affiliate strategy: pula quando origin ausente ou sem src', async () => {
    vi.mocked(db.query.gatewayEvents.findFirst).mockResolvedValueOnce({
      ...baseEvent,
      utmCampaign: null,
      origin: null,
    } as never)

    const result = await stitchGatewayEvent('evt-1')
    expect(result.strategy).toBe('unmatched')
    expect(matching.findAffiliateMappingByOriginSrc).not.toHaveBeenCalled()
  })

  it('affiliate strategy: pula quando origin.src e string vazia', async () => {
    vi.mocked(db.query.gatewayEvents.findFirst).mockResolvedValueOnce({
      ...baseEvent,
      utmCampaign: null,
      origin: { src: '   ' },
    } as never)

    const result = await stitchGatewayEvent('evt-1')
    expect(result.strategy).toBe('unmatched')
    expect(matching.findAffiliateMappingByOriginSrc).not.toHaveBeenCalled()
  })

  it('affiliate strategy: nao override perfect (UTM-based ganha quando disponivel)', async () => {
    vi.mocked(db.query.gatewayEvents.findFirst).mockResolvedValueOnce({
      ...baseEvent,
      origin: { src: 'sparkle-afiliado-123' },
    } as never)
    vi.mocked(matching.findCampaignByNormalizedName).mockResolvedValueOnce({
      campaignId: 'camp-perfect',
      campaignName: 'Black Friday 2026',
      matchedAdSetId: null,
      matchedAdId: null,
    })

    const result = await stitchGatewayEvent('evt-1')
    expect(result.strategy).toBe('perfect')
    expect(result.matchedCampaignId).toBe('camp-perfect')
    expect(matching.findAffiliateMappingByOriginSrc).not.toHaveBeenCalled()
  })

  it('affiliate strategy: nao override manual', async () => {
    vi.mocked(db.query.gatewayEvents.findFirst).mockResolvedValueOnce({
      ...baseEvent,
      origin: { src: 'sparkle-afiliado-123' },
    } as never)
    vi.mocked(matching.findManualMapping).mockResolvedValueOnce({
      adId: 'ad-manual',
      confidence: 1.0,
    })
    vi.mocked(db.query.ads.findFirst).mockResolvedValueOnce({
      id: 'ad-manual',
      adSetId: 'as-manual',
    } as never)
    vi.mocked(db.query.adSets.findFirst).mockResolvedValueOnce({
      id: 'as-manual',
      campaignId: 'camp-manual',
    } as never)

    const result = await stitchGatewayEvent('evt-1')
    expect(result.strategy).toBe('manual')
    expect(matching.findAffiliateMappingByOriginSrc).not.toHaveBeenCalled()
  })

  it('affiliate strategy: unmatched quando origin.src nao tem mapping', async () => {
    vi.mocked(db.query.gatewayEvents.findFirst).mockResolvedValueOnce({
      ...baseEvent,
      utmCampaign: null,
      origin: { src: 'codigo-desconhecido' },
    } as never)
    vi.mocked(matching.findAffiliateMappingByOriginSrc).mockResolvedValueOnce(null)

    const result = await stitchGatewayEvent('evt-1')
    expect(result.strategy).toBe('unmatched')
    expect(matching.findAffiliateMappingByOriginSrc).toHaveBeenCalledWith(
      'ws-1',
      'codigo-desconhecido'
    )
  })
})

// ---- TD-086: stitchAndAggregate refund/chargeback handling ------------------

describe('stitchAndAggregate aggregate behavior', () => {
  it('incrementa pra PURCHASE_APPROVED quando matched', async () => {
    vi.mocked(db.query.gatewayEvents.findFirst).mockResolvedValueOnce({
      ...baseEvent,
      eventType: 'PURCHASE_APPROVED',
    } as never)
    vi.mocked(matching.findCampaignByNormalizedName).mockResolvedValueOnce({
      campaignId: 'camp-1',
      campaignName: 'Black Friday',
      matchedAdSetId: null,
      matchedAdId: null,
    })
    // Segunda chamada do findFirst (apos stitch) dentro de stitchAndAggregate
    vi.mocked(db.query.gatewayEvents.findFirst).mockResolvedValueOnce({
      ...baseEvent,
      eventType: 'PURCHASE_APPROVED',
    } as never)

    await stitchAndAggregate('evt-1')
    expect(matching.incrementCampaignAggregates).toHaveBeenCalledWith(
      'camp-1',
      4990,
      expect.any(Date)
    )
    expect(matching.decrementCampaignAggregates).not.toHaveBeenCalled()
  })

  it('decrementa pra PURCHASE_REFUNDED quando matched', async () => {
    const refundEvent = {
      ...baseEvent,
      eventType: 'PURCHASE_REFUNDED',
    }
    vi.mocked(db.query.gatewayEvents.findFirst).mockResolvedValueOnce(refundEvent as never)
    vi.mocked(matching.findCampaignByNormalizedName).mockResolvedValueOnce({
      campaignId: 'camp-1',
      campaignName: 'Black Friday',
      matchedAdSetId: null,
      matchedAdId: null,
    })
    vi.mocked(db.query.gatewayEvents.findFirst).mockResolvedValueOnce(refundEvent as never)

    const result = await stitchAndAggregate('evt-1')
    expect(result.strategy).toBe('perfect')
    expect(matching.decrementCampaignAggregates).toHaveBeenCalledWith(
      'camp-1',
      4990,
      expect.any(Date)
    )
    expect(matching.incrementCampaignAggregates).not.toHaveBeenCalled()
  })

  it('decrementa pra PURCHASE_CHARGEBACK quando matched', async () => {
    const chargebackEvent = {
      ...baseEvent,
      eventType: 'PURCHASE_CHARGEBACK',
    }
    vi.mocked(db.query.gatewayEvents.findFirst).mockResolvedValueOnce(chargebackEvent as never)
    vi.mocked(matching.findCampaignByNormalizedName).mockResolvedValueOnce({
      campaignId: 'camp-1',
      campaignName: 'Black Friday',
      matchedAdSetId: null,
      matchedAdId: null,
    })
    vi.mocked(db.query.gatewayEvents.findFirst).mockResolvedValueOnce(chargebackEvent as never)

    await stitchAndAggregate('evt-1')
    expect(matching.decrementCampaignAggregates).toHaveBeenCalledWith(
      'camp-1',
      4990,
      expect.any(Date)
    )
  })

  it('nao decrementa quando refund e unmatched (sem matched_campaign_id)', async () => {
    const refundUnmatched = {
      ...baseEvent,
      utmCampaign: null,
      eventType: 'PURCHASE_REFUNDED',
    }
    vi.mocked(db.query.gatewayEvents.findFirst).mockResolvedValueOnce(refundUnmatched as never)

    const result = await stitchAndAggregate('evt-1')
    expect(result.strategy).toBe('unmatched')
    expect(matching.decrementCampaignAggregates).not.toHaveBeenCalled()
    expect(matching.incrementCampaignAggregates).not.toHaveBeenCalled()
  })

  it('decrement via affiliate strategy (refund de venda afiliado matched)', async () => {
    const refundAffiliateEvent = {
      ...baseEvent,
      utmCampaign: null,
      eventType: 'PURCHASE_REFUNDED',
      origin: { src: 'sparkle-aff-123' },
    }
    vi.mocked(db.query.gatewayEvents.findFirst).mockResolvedValueOnce(refundAffiliateEvent as never)
    vi.mocked(matching.findAffiliateMappingByOriginSrc).mockResolvedValueOnce({
      adId: 'ad-aff',
      confidence: 0.95,
    })
    vi.mocked(db.query.ads.findFirst).mockResolvedValueOnce({
      id: 'ad-aff',
      adSetId: 'as-aff',
    } as never)
    vi.mocked(db.query.adSets.findFirst).mockResolvedValueOnce({
      id: 'as-aff',
      campaignId: 'camp-aff',
    } as never)
    vi.mocked(db.query.gatewayEvents.findFirst).mockResolvedValueOnce(refundAffiliateEvent as never)

    const result = await stitchAndAggregate('evt-1')
    expect(result.strategy).toBe('affiliate')
    expect(matching.decrementCampaignAggregates).toHaveBeenCalledWith(
      'camp-aff',
      4990,
      expect.any(Date)
    )
  })

  it('nao mexe em aggregates pra eventos no-op (PURCHASE_BILLET_PRINTED)', async () => {
    const billetEvent = {
      ...baseEvent,
      eventType: 'PURCHASE_BILLET_PRINTED',
    }
    vi.mocked(db.query.gatewayEvents.findFirst).mockResolvedValueOnce(billetEvent as never)
    vi.mocked(matching.findCampaignByNormalizedName).mockResolvedValueOnce({
      campaignId: 'camp-1',
      campaignName: 'X',
      matchedAdSetId: null,
      matchedAdId: null,
    })
    vi.mocked(db.query.gatewayEvents.findFirst).mockResolvedValueOnce(billetEvent as never)

    await stitchAndAggregate('evt-1')
    expect(matching.incrementCampaignAggregates).not.toHaveBeenCalled()
    expect(matching.decrementCampaignAggregates).not.toHaveBeenCalled()
  })
})
