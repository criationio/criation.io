import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { GatewayEvent, MetaConnection, TrackingEvent } from '@/lib/db/schema'

vi.mock('@/lib/db/queries/capi', () => ({
  getTrackingEventById: vi.fn(),
  getActiveMetaConnection: vi.fn(),
  getGatewayEventById: vi.fn(),
  updateFanoutMetaStatus: vi.fn(),
  upsertCapiEvent: vi.fn(),
  insertCapiEventLog: vi.fn(),
  countCapiEventLogAttempts: vi.fn(),
}))

vi.mock('@/lib/encryption', () => ({
  decrypt: vi.fn((s: string) => s.replace('encrypted_', '')),
}))

import * as queries from '@/lib/db/queries/capi'

import { processMetaCapiFanout } from './capi.service'

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

const WORKSPACE = '00000000-0000-0000-0000-000000000001'
const EVENT_TS = new Date('2026-05-12T13:45:30.000Z')

function makeTrackingEvent(overrides: Partial<TrackingEvent> = {}): TrackingEvent {
  return {
    id: 'evt-uuid-001',
    workspaceId: WORKSPACE,
    visitorId: 'visitor-abc',
    eventId: 'browser-uuid-v4',
    eventName: 'page_view',
    eventTs: EVENT_TS,
    clientIpHash: null,
    clientUserAgentHash: null,
    clientIpAddress: '203.0.113.45',
    clientUserAgent: 'Mozilla/5.0',
    pageUrl: 'https://example.com/checkout',
    pageTitle: null,
    referrer: null,
    utms: {},
    fbp: 'fb.1.123.456',
    fbc: null,
    fbclid: null,
    gclid: null,
    ttclid: null,
    msclkid: null,
    ctwaClid: null,
    wbraid: null,
    gbraid: null,
    consentState: null,
    customData: null,
    matchedBuyerEmailHash: null,
    matchedAt: null,
    fanoutMetaStatus: 'pending',
    fanoutMetaSentAt: null,
    fanoutMetaError: null,
    fanoutGoogleStatus: 'pending',
    fanoutGoogleSentAt: null,
    fanoutGoogleError: null,
    createdAt: EVENT_TS,
    ...overrides,
  } as TrackingEvent
}

function makeMetaConnection(overrides: Partial<MetaConnection> = {}): MetaConnection {
  return {
    id: 'conn-001',
    workspaceId: WORKSPACE,
    adAccountId: null,
    adAccountName: null,
    encryptedAccessToken: 'encrypted_TOKEN_XYZ',
    encryptedRefreshToken: null,
    tokenExpiresAt: null,
    encryptionKeyVersion: 'v1',
    metaUserId: null,
    metaUserName: null,
    metaUserEmail: null,
    systemUserId: null,
    isSystemUserToken: false,
    grantedScopes: null,
    accessTier: 'standard',
    pixelId: '123456789012345',
    businessId: null,
    businessVerificationStatus: 'not_started',
    verifiedDomains: null,
    marketingApiVersion: 'v25.0',
    partnerAgent: 'criation-io-v1',
    lastTokenRefreshAt: null,
    tokenRefreshFailures: 0,
    testEventCode: null,
    status: 'active',
    lastSyncAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  } as MetaConnection
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.mocked(queries.upsertCapiEvent).mockResolvedValue('capi-event-id-001')
  vi.mocked(queries.insertCapiEventLog).mockResolvedValue(undefined)
  vi.mocked(queries.countCapiEventLogAttempts).mockResolvedValue(0)
  vi.mocked(queries.updateFanoutMetaStatus).mockResolvedValue(undefined)
  vi.mocked(queries.getGatewayEventById).mockResolvedValue(null)
})

afterEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('processMetaCapiFanout', () => {
  it('happy path: persiste capi_events + atualiza status=sent + retorna sent', async () => {
    vi.mocked(queries.getTrackingEventById).mockResolvedValue(makeTrackingEvent())
    vi.mocked(queries.getActiveMetaConnection).mockResolvedValue(makeMetaConnection())

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ events_received: 1, fbtrace_id: 'A123' }), {
        status: 200,
      })
    )

    const result = await processMetaCapiFanout({
      trackingEventId: 'evt-uuid-001',
      trackingEventTs: EVENT_TS,
    })

    expect(result.kind).toBe('sent')
    if (result.kind === 'sent') {
      expect(result.capiEventId).toBe('capi-event-id-001')
      expect(result.httpStatus).toBe(200)
    }
    expect(fetchSpy).toHaveBeenCalledOnce()
    expect(queries.upsertCapiEvent).toHaveBeenCalledOnce()
    expect(queries.insertCapiEventLog).toHaveBeenCalledOnce()
    expect(queries.updateFanoutMetaStatus).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'sent', errorMessage: null })
    )

    fetchSpy.mockRestore()
  })

  it('skip por consent denied: NAO faz fetch, persiste status=skipped', async () => {
    vi.mocked(queries.getTrackingEventById).mockResolvedValue(
      makeTrackingEvent({ consentState: { ad_storage: 'denied' } })
    )
    vi.mocked(queries.getActiveMetaConnection).mockResolvedValue(makeMetaConnection())

    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    const result = await processMetaCapiFanout({
      trackingEventId: 'evt-uuid-001',
      trackingEventTs: EVENT_TS,
    })

    expect(result.kind).toBe('skipped')
    if (result.kind === 'skipped') {
      expect(result.reason).toBe('consent_denied_ad_storage')
    }
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(queries.updateFanoutMetaStatus).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'skipped' })
    )

    fetchSpy.mockRestore()
  })

  it('HTTP 5xx: retorna failed + retry=true + status=pending (Trigger.dev re-trigger)', async () => {
    vi.mocked(queries.getTrackingEventById).mockResolvedValue(makeTrackingEvent())
    vi.mocked(queries.getActiveMetaConnection).mockResolvedValue(makeMetaConnection())

    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ error: 'temporarily unavailable' }), { status: 503 })
      )

    const result = await processMetaCapiFanout({
      trackingEventId: 'evt-uuid-001',
      trackingEventTs: EVENT_TS,
    })

    expect(result.kind).toBe('failed')
    if (result.kind === 'failed') {
      expect(result.retry).toBe(true)
      expect(result.httpStatus).toBe(503)
      expect(result.error).toBe('http_503')
    }
    expect(queries.updateFanoutMetaStatus).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'pending' })
    )

    fetchSpy.mockRestore()
  })

  it('HTTP 4xx config error: retorna failed + retry=false + status=failed', async () => {
    vi.mocked(queries.getTrackingEventById).mockResolvedValue(makeTrackingEvent())
    vi.mocked(queries.getActiveMetaConnection).mockResolvedValue(makeMetaConnection())

    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ error: { message: 'Invalid pixel' } }), { status: 400 })
      )

    const result = await processMetaCapiFanout({
      trackingEventId: 'evt-uuid-001',
      trackingEventTs: EVENT_TS,
    })

    expect(result.kind).toBe('failed')
    if (result.kind === 'failed') {
      expect(result.retry).toBe(false)
      expect(result.httpStatus).toBe(400)
    }
    expect(queries.updateFanoutMetaStatus).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed' })
    )

    fetchSpy.mockRestore()
  })

  it('tracking_event nao existe: retorna not_found (sem side-effects)', async () => {
    vi.mocked(queries.getTrackingEventById).mockResolvedValue(null)
    vi.mocked(queries.getActiveMetaConnection).mockResolvedValue(makeMetaConnection())

    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    const result = await processMetaCapiFanout({
      trackingEventId: 'evt-uuid-001',
      trackingEventTs: EVENT_TS,
    })

    expect(result.kind).toBe('not_found')
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(queries.upsertCapiEvent).not.toHaveBeenCalled()

    fetchSpy.mockRestore()
  })

  it('no_connection: workspace sem meta_connection ativa', async () => {
    vi.mocked(queries.getTrackingEventById).mockResolvedValue(makeTrackingEvent())
    vi.mocked(queries.getActiveMetaConnection).mockResolvedValue(null)

    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    const result = await processMetaCapiFanout({
      trackingEventId: 'evt-uuid-001',
      trackingEventTs: EVENT_TS,
    })

    expect(result.kind).toBe('no_connection')
    expect(fetchSpy).not.toHaveBeenCalled()

    fetchSpy.mockRestore()
  })

  it('idempotency: status=sent ja => skipped (already_sent), nao re-envia', async () => {
    vi.mocked(queries.getTrackingEventById).mockResolvedValue(
      makeTrackingEvent({ fanoutMetaStatus: 'sent' })
    )
    vi.mocked(queries.getActiveMetaConnection).mockResolvedValue(makeMetaConnection())

    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    const result = await processMetaCapiFanout({
      trackingEventId: 'evt-uuid-001',
      trackingEventTs: EVENT_TS,
    })

    expect(result.kind).toBe('skipped')
    if (result.kind === 'skipped') {
      expect(result.reason).toBe('already_sent')
    }
    expect(fetchSpy).not.toHaveBeenCalled()

    fetchSpy.mockRestore()
  })

  it('events_received=0 (Meta validation failure): retry=false mesmo com HTTP 200', async () => {
    vi.mocked(queries.getTrackingEventById).mockResolvedValue(makeTrackingEvent())
    vi.mocked(queries.getActiveMetaConnection).mockResolvedValue(makeMetaConnection())

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          events_received: 0,
          messages: ['Invalid email format in user_data.em'],
        }),
        { status: 200 }
      )
    )

    const result = await processMetaCapiFanout({
      trackingEventId: 'evt-uuid-001',
      trackingEventTs: EVENT_TS,
    })

    expect(result.kind).toBe('failed')
    if (result.kind === 'failed') {
      expect(result.retry).toBe(false)
      expect(result.error).toContain('meta_validation_failed')
      expect(result.error).toContain('Invalid email format')
    }
    expect(queries.updateFanoutMetaStatus).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed' })
    )

    fetchSpy.mockRestore()
  })

  it('max attempts exhausted: 5xx + 10+ tentativas anteriores forca status=failed (corta loop)', async () => {
    vi.mocked(queries.getTrackingEventById).mockResolvedValue(makeTrackingEvent())
    vi.mocked(queries.getActiveMetaConnection).mockResolvedValue(makeMetaConnection())
    // Simula 10 tentativas anteriores ja registradas no log
    vi.mocked(queries.countCapiEventLogAttempts).mockResolvedValue(10)

    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ error: 'temporarily unavailable' }), { status: 503 })
      )

    const result = await processMetaCapiFanout({
      trackingEventId: 'evt-uuid-001',
      trackingEventTs: EVENT_TS,
    })

    expect(result.kind).toBe('failed')
    if (result.kind === 'failed') {
      // Mesmo 5xx (que normalmente seria retry=true), exhausted forca retry=false
      expect(result.retry).toBe(false)
      expect(result.httpStatus).toBe(503)
    }
    expect(queries.updateFanoutMetaStatus).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed' })
    )

    fetchSpy.mockRestore()
  })

  it('network error: retorna failed + retry=true (Trigger.dev retry)', async () => {
    vi.mocked(queries.getTrackingEventById).mockResolvedValue(makeTrackingEvent())
    vi.mocked(queries.getActiveMetaConnection).mockResolvedValue(makeMetaConnection())

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('ECONNREFUSED'))

    const result = await processMetaCapiFanout({
      trackingEventId: 'evt-uuid-001',
      trackingEventTs: EVENT_TS,
    })

    expect(result.kind).toBe('failed')
    if (result.kind === 'failed') {
      expect(result.retry).toBe(true)
      expect(result.error).toBe('ECONNREFUSED')
    }

    fetchSpy.mockRestore()
  })

  it('gatewayEventId opcional carrega gateway_event pra re-fanout retroativo', async () => {
    vi.mocked(queries.getTrackingEventById).mockResolvedValue(
      makeTrackingEvent({
        eventName: 'purchase',
        matchedBuyerEmailHash: 'a'.repeat(64),
      })
    )
    vi.mocked(queries.getActiveMetaConnection).mockResolvedValue(makeMetaConnection())
    vi.mocked(queries.getGatewayEventById).mockResolvedValue({
      id: 'gw-001',
      workspaceId: WORKSPACE,
      provider: 'hotmart',
      providerEventId: 'hotmart-order-xyz',
      amountCents: 19700,
      currency: 'BRL',
      customerEmailHash: 'a'.repeat(64),
      customerPhoneHash: 'b'.repeat(64),
      clientIpAddress: null,
      clientUserAgent: null,
    } as GatewayEvent)

    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ events_received: 1 }), { status: 200 }))

    const result = await processMetaCapiFanout({
      trackingEventId: 'evt-uuid-001',
      trackingEventTs: EVENT_TS,
      gatewayEventId: 'gw-001',
    })

    expect(result.kind).toBe('sent')
    expect(queries.getGatewayEventById).toHaveBeenCalledWith('gw-001')

    // O payload enviado deve incluir value/currency/order_id do gateway
    const callArgs = fetchSpy.mock.calls[0]!
    const body = JSON.parse((callArgs[1] as RequestInit).body as string) as {
      data: Array<{ custom_data?: { value?: number; currency?: string; order_id?: string } }>
    }
    expect(body.data[0]!.custom_data?.value).toBe(197)
    expect(body.data[0]!.custom_data?.currency).toBe('BRL')
    expect(body.data[0]!.custom_data?.order_id).toBe('hotmart-order-xyz')

    fetchSpy.mockRestore()
  })
})
