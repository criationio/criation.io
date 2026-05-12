/**
 * Testes do visitor-buyer-matcher service. Mock das queries Drizzle (visitor-buyer-matching)
 * — testa orquestracao da cascata sem precisar de banco real.
 *
 * Coverage pos-audit (2026-05-12):
 *  - 4 estrategias (xcode/clickid/utm_recency/reverse_email)
 *  - Reverse override de unmatched (audit A2)
 *  - Reverse usa strategy correta (audit A3)
 *  - Conflict utm_recency loga (audit C3)
 *  - Mystery xcode UUID v4 sem visitor loga (audit C7)
 *  - subscriberCode propagado pro persist (audit B4)
 *  - needsRestitch retornado quando match strategy fraca (audit B3)
 *
 * Smoke E2E real fica em docs/smoke/1.4.B-visitor-buyer-matching.md.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: {
    query: {
      gatewayEvents: { findFirst: vi.fn() },
    },
  },
}))

vi.mock('@/lib/db/queries/visitor-buyer-matching', () => ({
  findVisitorByXcode: vi.fn(),
  findVisitorByClickId: vi.fn(),
  findVisitorByUtmRecency: vi.fn(),
  findGatewayEventsByBuyerEmail: vi.fn(),
  persistVisitorMatch: vi.fn(),
  markVisitorMatchUnmatched: vi.fn(),
  resetStitchIfWeakStrategy: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  trackingLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

import { db } from '@/lib/db'
import * as queries from '@/lib/db/queries/visitor-buyer-matching'
import { trackingLogger } from '@/lib/logger'

import {
  matchGatewayEventsForIdentifiedVisitor,
  matchVisitorForGatewayEvent,
} from './visitor-buyer-matcher.service'

const baseEvent = {
  id: 'evt-1',
  workspaceId: 'ws-1',
  externalCode: null as string | null,
  fbclid: null as string | null,
  gclid: null as string | null,
  ttclid: null as string | null,
  utmCampaign: null as string | null,
  customerEmailHash: 'email-hash-abc',
  subscriberCode: null as string | null,
  matchedVisitorId: null as string | null,
  visitorMatchedAt: null as Date | null,
  visitorMatchStrategy: null as string | null,
  visitorMatchConfidence: null as string | null,
}

const baseVisitor = {
  visitorId: '11111111-1111-4111-8111-111111111111',
  workspaceId: 'ws-1',
  firstSeenAt: new Date(),
  lastSeenAt: new Date(),
  identifiedBuyerEmailHash: null,
  identifiedAt: null,
  totalEvents: 1,
  firstUtmSource: null,
  firstUtmMedium: null,
  firstUtmCampaign: null,
  firstUtmContent: null,
  firstUtmTerm: null,
  lastUtmSource: null,
  lastUtmMedium: null,
  lastUtmCampaign: null,
  lastUtmContent: null,
  lastUtmTerm: null,
  firstClickId: null,
  firstClickIdType: null,
  lastClickId: null,
  lastClickIdType: null,
  firstReferrer: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}

function baseGatewayCandidate(
  overrides: Partial<{
    id: string
    externalCode: string | null
    fbclid: string | null
    gclid: string | null
    ttclid: string | null
    utmCampaign: string | null
    subscriberCode: string | null
    visitorMatchedAt: Date | null
    visitorMatchStrategy: string | null
    matchStrategy: string
  }>
) {
  return {
    id: 'evt-1',
    externalCode: null,
    fbclid: null,
    gclid: null,
    ttclid: null,
    utmCampaign: null,
    subscriberCode: null,
    visitorMatchedAt: null,
    visitorMatchStrategy: null,
    matchStrategy: 'unmatched',
    ...overrides,
  }
}

beforeEach(() => {
  vi.mocked(queries.findVisitorByXcode).mockResolvedValue(null)
  vi.mocked(queries.findVisitorByClickId).mockResolvedValue(null)
  vi.mocked(queries.findVisitorByUtmRecency).mockResolvedValue({ visitor: null, conflict: false })
  vi.mocked(queries.persistVisitorMatch).mockResolvedValue(undefined)
  vi.mocked(queries.markVisitorMatchUnmatched).mockResolvedValue(undefined)
  vi.mocked(queries.findGatewayEventsByBuyerEmail).mockResolvedValue([])
  vi.mocked(queries.resetStitchIfWeakStrategy).mockResolvedValue(false)
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('matchVisitorForGatewayEvent', () => {
  it('returns event_not_found when gateway_event missing', async () => {
    vi.mocked(db.query.gatewayEvents.findFirst).mockResolvedValueOnce(undefined)
    const result = await matchVisitorForGatewayEvent('missing')
    expect(result.ok).toBe(false)
    expect(result.strategy).toBe('event_not_found')
  })

  it('idempotency: returns already_matched when visitor_matched_at set', async () => {
    vi.mocked(db.query.gatewayEvents.findFirst).mockResolvedValueOnce({
      ...baseEvent,
      visitorMatchedAt: new Date(),
      visitorMatchStrategy: 'deterministic_xcode',
      matchedVisitorId: 'visitor-abc',
      visitorMatchConfidence: '1.0000',
    } as never)
    const result = await matchVisitorForGatewayEvent('evt-1')
    expect(result.ok).toBe(true)
    expect(result.strategy).toBe('deterministic_xcode')
    expect(result.visitorId).toBe('visitor-abc')
    expect(result.confidence).toBe(1)
    expect(result.reason).toBe('already_matched')
    expect(queries.persistVisitorMatch).not.toHaveBeenCalled()
  })

  it('strategy 1: deterministic xcode match (confidence 1.0)', async () => {
    vi.mocked(db.query.gatewayEvents.findFirst).mockResolvedValueOnce({
      ...baseEvent,
      externalCode: '11111111-1111-4111-8111-111111111111',
      subscriberCode: 'sub-99',
    } as never)
    vi.mocked(queries.findVisitorByXcode).mockResolvedValueOnce(baseVisitor as never)

    const result = await matchVisitorForGatewayEvent('evt-1')
    expect(result.strategy).toBe('deterministic_xcode')
    expect(result.visitorId).toBe('11111111-1111-4111-8111-111111111111')
    expect(result.confidence).toBe(1.0)
    expect(queries.persistVisitorMatch).toHaveBeenCalledWith(
      expect.objectContaining({
        gatewayEventId: 'evt-1',
        visitorId: '11111111-1111-4111-8111-111111111111',
        strategy: 'deterministic_xcode',
        confidence: 1.0,
        buyerEmailHash: 'email-hash-abc',
        // Audit B4: subscriberCode propagado pro persist
        subscriberCode: 'sub-99',
      })
    )
    expect(queries.findVisitorByClickId).not.toHaveBeenCalled()
    expect(queries.findVisitorByUtmRecency).not.toHaveBeenCalled()
  })

  it('audit C7: xcode UUID v4 valido sem visitor loga warn de cross-workspace', async () => {
    vi.mocked(db.query.gatewayEvents.findFirst).mockResolvedValueOnce({
      ...baseEvent,
      externalCode: '11111111-1111-4111-8111-111111111111',
    } as never)
    vi.mocked(queries.findVisitorByXcode).mockResolvedValueOnce(null)

    await matchVisitorForGatewayEvent('evt-1')
    expect(trackingLogger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        externalCode: '11111111-1111-4111-8111-111111111111',
      }),
      expect.stringContaining('cross-workspace')
    )
  })

  it('audit C7: xcode invalido (nao UUID v4) NAO loga warn', async () => {
    vi.mocked(db.query.gatewayEvents.findFirst).mockResolvedValueOnce({
      ...baseEvent,
      externalCode: 'not-a-uuid',
    } as never)
    // findVisitorByXcode internamente rejeita string nao-UUID e retorna null
    vi.mocked(queries.findVisitorByXcode).mockResolvedValueOnce(null)

    await matchVisitorForGatewayEvent('evt-1')
    expect(trackingLogger.warn).not.toHaveBeenCalled()
  })

  it('strategy 2: clickid match quando xcode nao bate (confidence 0.9)', async () => {
    vi.mocked(db.query.gatewayEvents.findFirst).mockResolvedValueOnce({
      ...baseEvent,
      externalCode: '22222222-2222-4222-8222-222222222222',
      fbclid: 'fb-123',
    } as never)
    vi.mocked(queries.findVisitorByXcode).mockResolvedValueOnce(null)
    vi.mocked(queries.findVisitorByClickId).mockResolvedValueOnce(baseVisitor as never)

    const result = await matchVisitorForGatewayEvent('evt-1')
    expect(result.strategy).toBe('clickid')
    expect(result.confidence).toBe(0.9)
    expect(queries.findVisitorByClickId).toHaveBeenCalledWith('ws-1', {
      fbclid: 'fb-123',
      gclid: null,
      ttclid: null,
    })
    expect(queries.findVisitorByUtmRecency).not.toHaveBeenCalled()
  })

  it('strategy 3: utm_recency quando xcode + clickid falham (confidence 0.7)', async () => {
    vi.mocked(db.query.gatewayEvents.findFirst).mockResolvedValueOnce({
      ...baseEvent,
      utmCampaign: 'Black Friday 2026',
    } as never)
    vi.mocked(queries.findVisitorByUtmRecency).mockResolvedValueOnce({
      visitor: baseVisitor as never,
      conflict: false,
    })

    const result = await matchVisitorForGatewayEvent('evt-1')
    expect(result.strategy).toBe('utm_recency')
    expect(result.confidence).toBe(0.7)
    expect(queries.findVisitorByUtmRecency).toHaveBeenCalledWith('ws-1', 'Black Friday 2026')
  })

  it('audit C3: conflict utm_recency loga info estruturado', async () => {
    vi.mocked(db.query.gatewayEvents.findFirst).mockResolvedValueOnce({
      ...baseEvent,
      utmCampaign: 'Black Friday 2026',
    } as never)
    vi.mocked(queries.findVisitorByUtmRecency).mockResolvedValueOnce({
      visitor: null,
      conflict: true,
    })

    const result = await matchVisitorForGatewayEvent('evt-1')
    expect(result.strategy).toBe('unmatched')
    expect(trackingLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({ utmCampaign: 'Black Friday 2026' }),
      expect.stringContaining('conflict')
    )
  })

  it('marks unmatched quando todas estrategias falham', async () => {
    vi.mocked(db.query.gatewayEvents.findFirst).mockResolvedValueOnce({
      ...baseEvent,
      externalCode: '33333333-3333-4333-8333-333333333333',
      fbclid: 'no-match-fb',
      utmCampaign: 'Unknown Campaign',
    } as never)

    const result = await matchVisitorForGatewayEvent('evt-1')
    expect(result.strategy).toBe('unmatched')
    expect(result.visitorId).toBeNull()
    expect(queries.markVisitorMatchUnmatched).toHaveBeenCalled()
    expect(queries.persistVisitorMatch).not.toHaveBeenCalled()
  })

  it('pula clickid quando nao ha clickid no event', async () => {
    vi.mocked(db.query.gatewayEvents.findFirst).mockResolvedValueOnce({
      ...baseEvent,
      utmCampaign: 'Black Friday',
    } as never)
    vi.mocked(queries.findVisitorByUtmRecency).mockResolvedValueOnce({
      visitor: baseVisitor as never,
      conflict: false,
    })

    await matchVisitorForGatewayEvent('evt-1')
    expect(queries.findVisitorByClickId).not.toHaveBeenCalled()
  })

  it('xcode tem precedencia sobre clickid', async () => {
    vi.mocked(db.query.gatewayEvents.findFirst).mockResolvedValueOnce({
      ...baseEvent,
      externalCode: '44444444-4444-4444-8444-444444444444',
      fbclid: 'fb-123',
    } as never)
    vi.mocked(queries.findVisitorByXcode).mockResolvedValueOnce({
      ...baseVisitor,
      visitorId: '44444444-4444-4444-8444-444444444444',
    } as never)

    const result = await matchVisitorForGatewayEvent('evt-1')
    expect(result.visitorId).toBe('44444444-4444-4444-8444-444444444444')
    expect(result.strategy).toBe('deterministic_xcode')
    expect(queries.findVisitorByClickId).not.toHaveBeenCalled()
  })

  it('clickid tem precedencia sobre utm_recency', async () => {
    vi.mocked(db.query.gatewayEvents.findFirst).mockResolvedValueOnce({
      ...baseEvent,
      fbclid: 'fb-abc',
      utmCampaign: 'Some Campaign',
    } as never)
    vi.mocked(queries.findVisitorByClickId).mockResolvedValueOnce(baseVisitor as never)

    const result = await matchVisitorForGatewayEvent('evt-1')
    expect(result.strategy).toBe('clickid')
    expect(queries.findVisitorByUtmRecency).not.toHaveBeenCalled()
  })
})

describe('matchGatewayEventsForIdentifiedVisitor (reverse matching)', () => {
  it('returns 0 matched quando nao ha gateway_events do email', async () => {
    vi.mocked(queries.findGatewayEventsByBuyerEmail).mockResolvedValueOnce([])
    const result = await matchGatewayEventsForIdentifiedVisitor({
      workspaceId: 'ws-1',
      visitorId: 'visitor-abc',
      buyerEmailHash: 'email-hash',
    })
    expect(result.matched).toBe(0)
    expect(result.checked).toBe(0)
    expect(result.needsRestitch).toEqual([])
  })

  it('audit A3: usa strategy reverse_email (nao clickid) com confidence 0.85', async () => {
    vi.mocked(queries.findGatewayEventsByBuyerEmail).mockResolvedValueOnce([
      baseGatewayCandidate({ id: 'evt-1' }),
    ])

    await matchGatewayEventsForIdentifiedVisitor({
      workspaceId: 'ws-1',
      visitorId: 'visitor-abc',
      buyerEmailHash: 'email-hash',
    })
    expect(queries.persistVisitorMatch).toHaveBeenCalledWith(
      expect.objectContaining({
        strategy: 'reverse_email',
        confidence: 0.85,
      })
    )
  })

  it('audit A2: SOBRESCREVE eventos com strategy unmatched (caso de uso primario)', async () => {
    vi.mocked(queries.findGatewayEventsByBuyerEmail).mockResolvedValueOnce([
      baseGatewayCandidate({
        id: 'evt-1',
        visitorMatchedAt: new Date(),
        visitorMatchStrategy: 'unmatched',
      }),
    ])

    const result = await matchGatewayEventsForIdentifiedVisitor({
      workspaceId: 'ws-1',
      visitorId: 'visitor-abc',
      buyerEmailHash: 'email-hash',
    })
    expect(result.matched).toBe(1)
    expect(queries.persistVisitorMatch).toHaveBeenCalledWith(
      expect.objectContaining({
        strategy: 'reverse_email',
        overrideUnmatched: true,
      })
    )
  })

  it('PULA eventos com strategy real ja matched (deterministic/clickid/utm)', async () => {
    vi.mocked(queries.findGatewayEventsByBuyerEmail).mockResolvedValueOnce([
      baseGatewayCandidate({
        id: 'evt-1',
        visitorMatchedAt: new Date(),
        visitorMatchStrategy: 'deterministic_xcode',
      }),
      baseGatewayCandidate({
        id: 'evt-2',
        visitorMatchedAt: null,
        visitorMatchStrategy: null,
      }),
    ])

    const result = await matchGatewayEventsForIdentifiedVisitor({
      workspaceId: 'ws-1',
      visitorId: 'visitor-abc',
      buyerEmailHash: 'email-hash',
    })
    expect(result.matched).toBe(1) // so o segundo
    expect(result.checked).toBe(2)
  })

  it('audit B3: needsRestitch retorna IDs de eventos com strategy fraca quando reset funciona', async () => {
    vi.mocked(queries.findGatewayEventsByBuyerEmail).mockResolvedValueOnce([
      baseGatewayCandidate({ id: 'evt-1', matchStrategy: 'unmatched' }),
      baseGatewayCandidate({ id: 'evt-2', matchStrategy: 'meta_literal' }),
      baseGatewayCandidate({ id: 'evt-3', matchStrategy: 'perfect' }),
    ])
    vi.mocked(queries.resetStitchIfWeakStrategy)
      .mockResolvedValueOnce(true) // evt-1 resetou
      .mockResolvedValueOnce(true) // evt-2 resetou

    const result = await matchGatewayEventsForIdentifiedVisitor({
      workspaceId: 'ws-1',
      visitorId: 'visitor-abc',
      buyerEmailHash: 'email-hash',
    })
    expect(result.matched).toBe(3)
    expect(result.needsRestitch).toEqual(['evt-1', 'evt-2'])
    // evt-3 nao chama reset (strategy='perfect' nao precisa)
    expect(queries.resetStitchIfWeakStrategy).toHaveBeenCalledTimes(2)
  })

  it('subscriberCode propagado pro persist (audit B4)', async () => {
    vi.mocked(queries.findGatewayEventsByBuyerEmail).mockResolvedValueOnce([
      baseGatewayCandidate({ id: 'evt-1', subscriberCode: 'sub-xyz' }),
    ])

    await matchGatewayEventsForIdentifiedVisitor({
      workspaceId: 'ws-1',
      visitorId: 'visitor-abc',
      buyerEmailHash: 'email-hash',
    })
    expect(queries.persistVisitorMatch).toHaveBeenCalledWith(
      expect.objectContaining({ subscriberCode: 'sub-xyz' })
    )
  })
})
