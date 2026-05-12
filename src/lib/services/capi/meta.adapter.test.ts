import { describe, expect, it } from 'vitest'

import type { GatewayEvent, TrackingEvent } from '@/lib/db/schema'

import { buildCapiUrl, buildMetaCapiPayload, type MetaConnectionView } from './meta.adapter'
import { sha256Hex } from './hashing'

// ---------------------------------------------------------------------------
// Factories — geram fixtures minimamente validas pra adapter
// ---------------------------------------------------------------------------

const WORKSPACE = '00000000-0000-0000-0000-000000000001'
const VISITOR = 'visitor-abc-123'
const EVENT_TS = new Date('2026-05-12T13:45:30.000Z') // Unix seconds: 1778593530

function makeTrackingEvent(overrides: Partial<TrackingEvent> = {}): TrackingEvent {
  return {
    id: 'evt-uuid-001',
    workspaceId: WORKSPACE,
    visitorId: VISITOR,
    eventId: 'browser-event-uuid-v4',
    eventName: 'page_view',
    eventTs: EVENT_TS,
    clientIpHash: null,
    clientUserAgentHash: null,
    clientIpAddress: '203.0.113.45',
    clientUserAgent: 'Mozilla/5.0 (Macintosh)',
    pageUrl: 'https://example.com/checkout',
    pageTitle: 'Checkout',
    referrer: 'https://google.com',
    utms: {},
    fbp: 'fb.1.1715518800000.1234567890',
    fbc: 'fb.1.1715518800000.IwAR1234',
    fbclid: 'IwAR1234',
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

function makeConnection(overrides: Partial<MetaConnectionView> = {}): MetaConnectionView {
  return {
    pixelId: '123456789012345',
    accessToken: 'EAAaccess_token_decrypted',
    marketingApiVersion: 'v25.0',
    partnerAgent: 'criation-io-v1',
    testEventCode: null,
    ...overrides,
  }
}

function makeGatewayEvent(overrides: Partial<GatewayEvent> = {}): GatewayEvent {
  return {
    id: 'gw-uuid-001',
    workspaceId: WORKSPACE,
    connectionId: 'conn-uuid',
    provider: 'hotmart',
    eventType: 'PURCHASE_APPROVED',
    providerEventId: 'hotmart-event-id-xyz',
    providerEventVersion: '2.0.0',
    productId: 'prod-123',
    amountCents: 19700,
    currency: 'BRL',
    customerEmailHash: 'a'.repeat(64), // SHA-256 hash mock
    customerPhoneHash: 'b'.repeat(64),
    clientIpAddress: '198.51.100.1',
    clientUserAgent: 'Mozilla/5.0 (Windows)',
    ...overrides,
  } as GatewayEvent
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('buildMetaCapiPayload — happy path PageView', () => {
  it('produz payload com estrutura Meta CAPI v25.0 minimal', () => {
    const result = buildMetaCapiPayload({
      trackingEvent: makeTrackingEvent(),
      connection: makeConnection(),
    })

    expect(result.kind).toBe('send')
    if (result.kind !== 'send') return

    expect(result.pixelId).toBe('123456789012345')
    expect(result.accessToken).toBe('EAAaccess_token_decrypted')
    expect(result.payload.data).toHaveLength(1)
    expect(result.payload.partner_agent).toBe('criation-io-v1')

    const event = result.payload.data[0]!
    expect(event.event_name).toBe('PageView')
    expect(event.event_time).toBe(1778593530) // unix seconds (2026-05-12T13:45:30Z)
    expect(event.event_id).toBe('browser-event-uuid-v4')
    expect(event.action_source).toBe('website')
    expect(event.event_source_url).toBe('https://example.com/checkout')
  })

  it('inclui fbp/fbc plain no user_data (NUNCA hashear)', () => {
    const result = buildMetaCapiPayload({
      trackingEvent: makeTrackingEvent(),
      connection: makeConnection(),
    })
    if (result.kind !== 'send') throw new Error('expected send')
    expect(result.payload.data[0]!.user_data.fbp).toBe('fb.1.1715518800000.1234567890')
    expect(result.payload.data[0]!.user_data.fbc).toBe('fb.1.1715518800000.IwAR1234')
  })

  it('inclui plain IP/UA no user_data', () => {
    const result = buildMetaCapiPayload({
      trackingEvent: makeTrackingEvent(),
      connection: makeConnection(),
    })
    if (result.kind !== 'send') throw new Error('expected send')
    expect(result.payload.data[0]!.user_data.client_ip_address).toBe('203.0.113.45')
    expect(result.payload.data[0]!.user_data.client_user_agent).toBe('Mozilla/5.0 (Macintosh)')
  })
})

describe('buildMetaCapiPayload — consent gating', () => {
  it('skip quando consent.ad_storage=denied (LGPD BR strict)', () => {
    const result = buildMetaCapiPayload({
      trackingEvent: makeTrackingEvent({ consentState: { ad_storage: 'denied' } }),
      connection: makeConnection(),
    })
    expect(result.kind).toBe('skip')
    if (result.kind === 'skip') {
      expect(result.reason).toBe('consent_denied_ad_storage')
    }
  })

  it('LDU active quando ad_user_data=denied mas ad_storage=granted', () => {
    const result = buildMetaCapiPayload({
      trackingEvent: makeTrackingEvent({
        consentState: { ad_storage: 'granted', ad_user_data: 'denied' },
      }),
      connection: makeConnection(),
    })
    if (result.kind !== 'send') throw new Error('expected send')

    expect(result.meta.lduActive).toBe(true)
    expect(result.payload.data[0]!.opt_out).toBe(true)
    expect(result.payload.data[0]!.data_processing_options).toEqual(['LDU'])
    expect(result.payload.data[0]!.data_processing_options_country).toBe(0)
    expect(result.payload.data[0]!.data_processing_options_state).toBe(0)
  })

  it('LDU active quando ad_personalization=denied', () => {
    const result = buildMetaCapiPayload({
      trackingEvent: makeTrackingEvent({
        consentState: { ad_storage: 'granted', ad_personalization: 'denied' },
      }),
      connection: makeConnection(),
    })
    if (result.kind !== 'send') throw new Error('expected send')
    expect(result.meta.lduActive).toBe(true)
  })

  it('tudo granted ou consent null => sem LDU', () => {
    const result = buildMetaCapiPayload({
      trackingEvent: makeTrackingEvent({ consentState: null }),
      connection: makeConnection(),
    })
    if (result.kind !== 'send') throw new Error('expected send')
    expect(result.meta.lduActive).toBe(false)
    expect(result.payload.data[0]!.opt_out).toBeUndefined()
    expect(result.payload.data[0]!.data_processing_options).toBeUndefined()
  })
})

describe('buildMetaCapiPayload — skip scenarios', () => {
  it('skip quando event_name=identify (sinal interno)', () => {
    const result = buildMetaCapiPayload({
      trackingEvent: makeTrackingEvent({ eventName: 'identify' }),
      connection: makeConnection(),
    })
    expect(result.kind).toBe('skip')
    if (result.kind === 'skip') {
      expect(result.reason).toBe('internal_event')
    }
  })

  it('skip quando pixel_id ausente (config error)', () => {
    const result = buildMetaCapiPayload({
      trackingEvent: makeTrackingEvent(),
      connection: makeConnection({ pixelId: '' }),
    })
    expect(result.kind).toBe('skip')
    if (result.kind === 'skip') {
      expect(result.reason).toBe('missing_pixel_id')
    }
  })
})

describe('buildMetaCapiPayload — event_name mapping', () => {
  it('mapeia eventos canonical Meta', () => {
    const cases: ReadonlyArray<readonly [string, string]> = [
      ['page_view', 'PageView'],
      ['view_content', 'ViewContent'],
      ['add_to_cart', 'AddToCart'],
      ['initiate_checkout', 'InitiateCheckout'],
      ['purchase', 'Purchase'],
      ['lead', 'Lead'],
      ['subscribe', 'Subscribe'],
      ['complete_registration', 'CompleteRegistration'],
    ]
    for (const [criation, meta] of cases) {
      const result = buildMetaCapiPayload({
        trackingEvent: makeTrackingEvent({ eventName: criation }),
        connection: makeConnection(),
      })
      if (result.kind !== 'send') throw new Error(`expected send for ${criation}`)
      expect(result.payload.data[0]!.event_name).toBe(meta)
    }
  })

  it('eventos custom Criation viram capitalized (scroll => Scroll)', () => {
    const result = buildMetaCapiPayload({
      trackingEvent: makeTrackingEvent({ eventName: 'scroll' }),
      connection: makeConnection(),
    })
    if (result.kind !== 'send') throw new Error('expected send')
    expect(result.payload.data[0]!.event_name).toBe('Scroll')
  })

  it('eventos desconhecidos passam through', () => {
    const result = buildMetaCapiPayload({
      trackingEvent: makeTrackingEvent({ eventName: 'CustomBusinessEvent' }),
      connection: makeConnection(),
    })
    if (result.kind !== 'send') throw new Error('expected send')
    expect(result.payload.data[0]!.event_name).toBe('CustomBusinessEvent')
  })
})

describe('buildMetaCapiPayload — external_id strategy', () => {
  it('pre-match: external_id baseado em visitor_id', () => {
    const result = buildMetaCapiPayload({
      trackingEvent: makeTrackingEvent({ matchedBuyerEmailHash: null }),
      connection: makeConnection(),
    })
    if (result.kind !== 'send') throw new Error('expected send')

    const expected = sha256Hex(`criation:${WORKSPACE}:visitor:${VISITOR}`)
    expect(result.payload.data[0]!.user_data.external_id).toEqual([expected])
    expect(result.meta.postMatch).toBe(false)
  })

  it('post-match: external_id baseado em email_hash', () => {
    const emailHash = 'c'.repeat(64)
    const result = buildMetaCapiPayload({
      trackingEvent: makeTrackingEvent({ matchedBuyerEmailHash: emailHash }),
      connection: makeConnection(),
    })
    if (result.kind !== 'send') throw new Error('expected send')

    const expected = sha256Hex(`criation:${WORKSPACE}:email:${emailHash}`)
    expect(result.payload.data[0]!.user_data.external_id).toEqual([expected])
    expect(result.meta.postMatch).toBe(true)
  })
})

describe('buildMetaCapiPayload — CTWA (business_messaging)', () => {
  it('action_source=business_messaging quando ctwa_clid presente', () => {
    const result = buildMetaCapiPayload({
      trackingEvent: makeTrackingEvent({ ctwaClid: 'AwAR1234ctwa' }),
      connection: makeConnection(),
    })
    if (result.kind !== 'send') throw new Error('expected send')

    expect(result.payload.data[0]!.action_source).toBe('business_messaging')
    expect(result.payload.data[0]!.messaging_channel).toBe('whatsapp')
  })
})

describe('buildMetaCapiPayload — test mode', () => {
  it('test_event_code no payload quando connection tem (modo teste)', () => {
    const result = buildMetaCapiPayload({
      trackingEvent: makeTrackingEvent(),
      connection: makeConnection({ testEventCode: 'TEST12345' }),
    })
    if (result.kind !== 'send') throw new Error('expected send')
    expect(result.payload.test_event_code).toBe('TEST12345')
  })

  it('sem test_event_code em payload quando connection null (prod)', () => {
    const result = buildMetaCapiPayload({
      trackingEvent: makeTrackingEvent(),
      connection: makeConnection(),
    })
    if (result.kind !== 'send') throw new Error('expected send')
    expect(result.payload.test_event_code).toBeUndefined()
  })
})

describe('buildMetaCapiPayload — Purchase com gateway link', () => {
  it('user_data com email_hash + phone_hash do gateway (post-match)', () => {
    const emailHash = 'd'.repeat(64)
    const result = buildMetaCapiPayload({
      trackingEvent: makeTrackingEvent({
        eventName: 'purchase',
        matchedBuyerEmailHash: emailHash,
      }),
      gatewayEvent: makeGatewayEvent({ customerEmailHash: emailHash }),
      connection: makeConnection(),
    })
    if (result.kind !== 'send') throw new Error('expected send')

    const ud = result.payload.data[0]!.user_data
    expect(ud.em).toEqual([emailHash])
    expect(ud.ph).toEqual(['b'.repeat(64)])
  })

  it('custom_data com value/currency/order_id/content_ids do gateway', () => {
    const result = buildMetaCapiPayload({
      trackingEvent: makeTrackingEvent({ eventName: 'purchase' }),
      gatewayEvent: makeGatewayEvent(),
      connection: makeConnection(),
    })
    if (result.kind !== 'send') throw new Error('expected send')

    const cd = result.payload.data[0]!.custom_data
    expect(cd?.value).toBe(197) // 19700 cents / 100
    expect(cd?.currency).toBe('BRL')
    expect(cd?.order_id).toBe('hotmart-event-id-xyz')
    expect(cd?.content_ids).toEqual(['prod-123'])
    expect(cd?.content_type).toBe('product')
  })

  it('IP/UA do tracking_event tem precedencia sobre gateway_event', () => {
    const result = buildMetaCapiPayload({
      trackingEvent: makeTrackingEvent({ clientIpAddress: '111.111.111.111' }),
      gatewayEvent: makeGatewayEvent({ clientIpAddress: '222.222.222.222' }),
      connection: makeConnection(),
    })
    if (result.kind !== 'send') throw new Error('expected send')
    expect(result.payload.data[0]!.user_data.client_ip_address).toBe('111.111.111.111')
  })

  it('fallback pra gateway_event IP quando tracking_event sem IP', () => {
    const result = buildMetaCapiPayload({
      trackingEvent: makeTrackingEvent({ clientIpAddress: null }),
      gatewayEvent: makeGatewayEvent({ clientIpAddress: '222.222.222.222' }),
      connection: makeConnection(),
    })
    if (result.kind !== 'send') throw new Error('expected send')
    expect(result.payload.data[0]!.user_data.client_ip_address).toBe('222.222.222.222')
  })
})

describe('buildMetaCapiPayload — custom_data sem gateway', () => {
  it('extrai value/order_id de tracking_event.custom_data quando sem gateway', () => {
    const result = buildMetaCapiPayload({
      trackingEvent: makeTrackingEvent({
        eventName: 'purchase',
        customData: { value: 49.9, currency: 'BRL', order_id: 'manual-order-001' },
      }),
      connection: makeConnection(),
    })
    if (result.kind !== 'send') throw new Error('expected send')
    expect(result.payload.data[0]!.custom_data?.value).toBe(49.9)
    expect(result.payload.data[0]!.custom_data?.order_id).toBe('manual-order-001')
  })
})

describe('buildCapiUrl', () => {
  it('constroi URL Meta canonical com encoding seguro', () => {
    const url = buildCapiUrl('123456789', 'v25.0', 'EAA token with spaces')
    expect(url).toBe(
      'https://graph.facebook.com/v25.0/123456789/events?access_token=EAA%20token%20with%20spaces'
    )
  })
})
