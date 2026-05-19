import { describe, expect, it } from 'vitest'

import type {
  GatewayEvent,
  GoogleAdsAccount,
  GoogleConversionActionMapping,
  TrackingEvent,
} from '@/lib/db/schema'

import {
  buildDataManagerUrl,
  buildGoogleDataManagerPayload,
  type GoogleConnectionView,
} from './google.adapter'

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

const WORKSPACE = '00000000-0000-0000-0000-000000000001'
const VISITOR = 'visitor-abc-123'
const EVENT_TS = new Date('2026-05-13T13:45:30.000Z')

function makeTrackingEvent(overrides: Partial<TrackingEvent> = {}): TrackingEvent {
  return {
    id: 'evt-uuid-001',
    workspaceId: WORKSPACE,
    visitorId: VISITOR,
    eventId: 'browser-event-uuid-v4',
    eventName: 'purchase',
    eventTs: EVENT_TS,
    clientIpHash: null,
    clientUserAgentHash: null,
    clientIpAddress: '203.0.113.45',
    clientUserAgent: 'Mozilla/5.0 (Macintosh)',
    pageUrl: 'https://example.com/checkout',
    pageTitle: 'Checkout',
    referrer: null,
    utms: {},
    fbp: null,
    fbc: null,
    fbclid: null,
    gclid: 'GC.1.123.abc',
    ttclid: null,
    msclkid: null,
    ctwaClid: null,
    wbraid: null,
    gbraid: null,
    gadSource: '1',
    srsltid: null,
    consentState: { ad_user_data: 'granted', ad_personalization: 'granted' },
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
    customerEmailHash: 'a'.repeat(64),
    customerPhoneHash: 'b'.repeat(64),
    clientIpAddress: '198.51.100.1',
    clientUserAgent: 'Mozilla/5.0',
    ...overrides,
  } as GatewayEvent
}

function makeConnection(overrides: Partial<GoogleConnectionView> = {}): GoogleConnectionView {
  return {
    accessToken: 'ya29.access_decrypted',
    dataManagerApiVersion: 'v1',
    testMode: false,
    ...overrides,
  }
}

function makeAccount(
  overrides: Partial<
    Pick<GoogleAdsAccount, 'customerId' | 'managerCustomerId' | 'loginCustomerId' | 'isManager'>
  > = {}
): Pick<GoogleAdsAccount, 'customerId' | 'managerCustomerId' | 'loginCustomerId' | 'isManager'> {
  return {
    customerId: '1234567890',
    managerCustomerId: null,
    loginCustomerId: '1234567890',
    isManager: false,
    ...overrides,
  }
}

function makeMapping(
  overrides: Partial<
    Pick<
      GoogleConversionActionMapping,
      'productDestinationId' | 'internalEventName' | 'conversionActionType'
    >
  > = {}
): Pick<
  GoogleConversionActionMapping,
  'productDestinationId' | 'internalEventName' | 'conversionActionType'
> {
  return {
    productDestinationId: '987654321',
    internalEventName: 'purchase',
    conversionActionType: 'WEBPAGE',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('buildGoogleDataManagerPayload — happy path purchase com gclid + email', () => {
  it('produz payload v1 Data Manager API com destinations + events', () => {
    const result = buildGoogleDataManagerPayload({
      trackingEvent: makeTrackingEvent(),
      gatewayEvent: makeGatewayEvent(),
      connection: makeConnection(),
      account: makeAccount(),
      mapping: makeMapping(),
    })

    expect(result.kind).toBe('send')
    if (result.kind !== 'send') return

    // Destinations
    expect(result.payload.destinations).toHaveLength(1)
    const dest = result.payload.destinations[0]!
    expect(dest.operatingAccount.accountType).toBe('GOOGLE_ADS')
    expect(dest.operatingAccount.accountId).toBe('1234567890')
    expect(dest.productDestinationId).toBe('987654321')
    expect(dest.loginAccount).toBeUndefined() // standalone account

    // Encoding
    expect(result.payload.encoding).toBe('HEX')
    expect(result.payload.validateOnly).toBeUndefined()

    // Event
    expect(result.payload.events).toHaveLength(1)
    const event = result.payload.events[0]!
    expect(event.eventSource).toBe('WEB')
    expect(event.eventTimestamp).toBe('2026-05-13T13:45:30.000Z')
    expect(event.transactionId).toBeTruthy()
    expect(event.adIdentifiers?.gclid).toBe('GC.1.123.abc')
    expect(event.userData?.userIdentifiers).toHaveLength(1)
    expect(event.userData?.userIdentifiers[0]).toEqual({ emailAddress: 'a'.repeat(64) })
    expect(event.consent?.adUserData).toBe('CONSENT_GRANTED')
    expect(event.consent?.adPersonalization).toBe('CONSENT_GRANTED')
    expect(event.conversionValue).toBe(197)
    expect(event.currency).toBe('BRL')
  })
})

describe('buildGoogleDataManagerPayload — MCC routing', () => {
  it('inclui loginAccount quando managerCustomerId presente e diferente do customer', () => {
    const result = buildGoogleDataManagerPayload({
      trackingEvent: makeTrackingEvent(),
      gatewayEvent: makeGatewayEvent(),
      connection: makeConnection(),
      account: makeAccount({
        customerId: '1234567890',
        managerCustomerId: '9999999999',
        loginCustomerId: '9999999999',
      }),
      mapping: makeMapping(),
    })
    expect(result.kind).toBe('send')
    if (result.kind !== 'send') return
    expect(result.payload.destinations[0]!.loginAccount).toEqual({
      accountType: 'GOOGLE_ADS',
      accountId: '9999999999',
    })
    expect(result.meta.loginCustomerId).toBe('9999999999')
  })
})

describe('buildGoogleDataManagerPayload — click ID fallback ladder', () => {
  it('prefere gclid quando disponivel', () => {
    const result = buildGoogleDataManagerPayload({
      trackingEvent: makeTrackingEvent({ gclid: 'g1', gbraid: 'gb1', wbraid: 'w1' }),
      gatewayEvent: makeGatewayEvent(),
      connection: makeConnection(),
      account: makeAccount(),
      mapping: makeMapping(),
    })
    expect(result.kind).toBe('send')
    if (result.kind !== 'send') return
    expect(result.payload.events[0]!.adIdentifiers).toEqual({ gclid: 'g1' })
    expect(result.meta.clickIdType).toBe('gclid')
    expect(result.meta.clickIdValue).toBe('g1')
  })

  it('cai pra gbraid quando gclid ausente', () => {
    const result = buildGoogleDataManagerPayload({
      trackingEvent: makeTrackingEvent({ gclid: null, gbraid: 'gb1', wbraid: 'w1' }),
      gatewayEvent: makeGatewayEvent(),
      connection: makeConnection(),
      account: makeAccount(),
      mapping: makeMapping(),
    })
    expect(result.kind).toBe('send')
    if (result.kind !== 'send') return
    expect(result.payload.events[0]!.adIdentifiers).toEqual({ gbraid: 'gb1' })
    expect(result.meta.clickIdType).toBe('gbraid')
  })

  it('cai pra wbraid quando so wbraid presente (iOS ATT denied)', () => {
    const result = buildGoogleDataManagerPayload({
      trackingEvent: makeTrackingEvent({ gclid: null, gbraid: null, wbraid: 'w1' }),
      gatewayEvent: makeGatewayEvent(),
      connection: makeConnection(),
      account: makeAccount(),
      mapping: makeMapping(),
    })
    expect(result.kind).toBe('send')
    if (result.kind !== 'send') return
    expect(result.payload.events[0]!.adIdentifiers).toEqual({ wbraid: 'w1' })
    expect(result.meta.clickIdType).toBe('wbraid')
  })

  it('sem click_id mas com email continua send (so user_data)', () => {
    const result = buildGoogleDataManagerPayload({
      trackingEvent: makeTrackingEvent({ gclid: null, gbraid: null, wbraid: null }),
      gatewayEvent: makeGatewayEvent(),
      connection: makeConnection(),
      account: makeAccount(),
      mapping: makeMapping(),
    })
    expect(result.kind).toBe('send')
    if (result.kind !== 'send') return
    expect(result.payload.events[0]!.adIdentifiers).toBeUndefined()
    expect(result.meta.clickIdType).toBe('none')
    expect(result.payload.events[0]!.userData).toBeDefined()
  })
})

describe('buildGoogleDataManagerPayload — skip reasons', () => {
  it('skip internal_event quando event_name=identify', () => {
    const result = buildGoogleDataManagerPayload({
      trackingEvent: makeTrackingEvent({ eventName: 'identify' }),
      gatewayEvent: makeGatewayEvent(),
      connection: makeConnection(),
      account: makeAccount(),
      mapping: makeMapping(),
    })
    expect(result).toEqual({ kind: 'skip', reason: 'internal_event' })
  })

  it('skip missing_user_signal quando nem click_id nem email/phone', () => {
    const result = buildGoogleDataManagerPayload({
      trackingEvent: makeTrackingEvent({ gclid: null, gbraid: null, wbraid: null }),
      gatewayEvent: null,
      connection: makeConnection(),
      account: makeAccount(),
      mapping: makeMapping(),
    })
    expect(result).toEqual({ kind: 'skip', reason: 'missing_user_signal' })
  })

  it('skip missing_destination quando productDestinationId vazio', () => {
    const result = buildGoogleDataManagerPayload({
      trackingEvent: makeTrackingEvent(),
      gatewayEvent: makeGatewayEvent(),
      connection: makeConnection(),
      account: makeAccount(),
      mapping: makeMapping({ productDestinationId: '' }),
    })
    expect(result).toEqual({ kind: 'skip', reason: 'missing_destination' })
  })

  it('skip missing_customer quando customerId vazio', () => {
    const result = buildGoogleDataManagerPayload({
      trackingEvent: makeTrackingEvent(),
      gatewayEvent: makeGatewayEvent(),
      connection: makeConnection(),
      account: makeAccount({ customerId: '' }),
      mapping: makeMapping(),
    })
    expect(result).toEqual({ kind: 'skip', reason: 'missing_customer' })
  })
})

describe('buildGoogleDataManagerPayload — consent state', () => {
  it('mapeia consent granted/denied/null pra enum Data Manager API', () => {
    const cases: Array<[unknown, string, string]> = [
      [
        { ad_user_data: 'granted', ad_personalization: 'denied' },
        'CONSENT_GRANTED',
        'CONSENT_DENIED',
      ],
      [{ ad_user_data: 'denied' }, 'CONSENT_DENIED', 'CONSENT_UNSPECIFIED'],
      [null, 'CONSENT_UNSPECIFIED', 'CONSENT_UNSPECIFIED'],
      [{}, 'CONSENT_UNSPECIFIED', 'CONSENT_UNSPECIFIED'],
    ]
    for (const [consentState, expectedAud, expectedAdp] of cases) {
      const result = buildGoogleDataManagerPayload({
        trackingEvent: makeTrackingEvent({ consentState: consentState as never }),
        gatewayEvent: makeGatewayEvent(),
        connection: makeConnection(),
        account: makeAccount(),
        mapping: makeMapping(),
      })
      expect(result.kind).toBe('send')
      if (result.kind !== 'send') continue
      expect(result.payload.events[0]!.consent?.adUserData).toBe(expectedAud)
      expect(result.payload.events[0]!.consent?.adPersonalization).toBe(expectedAdp)
    }
  })
})

describe('buildGoogleDataManagerPayload — test mode', () => {
  it('inclui validateOnly=true quando connection.testMode=true', () => {
    const result = buildGoogleDataManagerPayload({
      trackingEvent: makeTrackingEvent(),
      gatewayEvent: makeGatewayEvent(),
      connection: makeConnection({ testMode: true }),
      account: makeAccount(),
      mapping: makeMapping(),
    })
    expect(result.kind).toBe('send')
    if (result.kind !== 'send') return
    expect(result.payload.validateOnly).toBe(true)
  })
})

describe('buildGoogleDataManagerPayload — post-match retroativo', () => {
  it('flag postMatch=true quando matched_buyer_email_hash presente', () => {
    const result = buildGoogleDataManagerPayload({
      trackingEvent: makeTrackingEvent({
        matchedBuyerEmailHash: 'c'.repeat(64),
      }),
      gatewayEvent: null,
      connection: makeConnection(),
      account: makeAccount(),
      mapping: makeMapping(),
    })
    expect(result.kind).toBe('send')
    if (result.kind !== 'send') return
    expect(result.meta.postMatch).toBe(true)
    // Email usado e o matched (tracking_event) — nao gateway
    expect(result.payload.events[0]!.userData?.userIdentifiers[0]).toEqual({
      emailAddress: 'c'.repeat(64),
    })
  })
})

describe('buildDataManagerUrl', () => {
  it('monta URL com versao default v1', () => {
    expect(buildDataManagerUrl('v1')).toBe('https://datamanager.googleapis.com/v1/events:ingest')
  })

  it('respeita versao per-tenant override', () => {
    expect(buildDataManagerUrl('v2')).toBe('https://datamanager.googleapis.com/v2/events:ingest')
  })
})

describe('buildGoogleDataManagerPayload — dedup com Meta', () => {
  it('transactionId/orderId determinstico (mesmo que Meta event_id pra dedup cross-channel)', () => {
    const result = buildGoogleDataManagerPayload({
      trackingEvent: makeTrackingEvent(),
      gatewayEvent: makeGatewayEvent(),
      connection: makeConnection(),
      account: makeAccount(),
      mapping: makeMapping(),
    })
    expect(result.kind).toBe('send')
    if (result.kind !== 'send') return
    const txnId = result.payload.events[0]!.transactionId
    expect(txnId).toBeTruthy()
    // orderId mirror do transactionId (mesmo Criation event_id)
    expect(result.meta.orderId).toBe(txnId)
  })
})

describe('buildGoogleDataManagerPayload — userIdentifiersCount em meta', () => {
  it('conta corretamente identifiers embutidos', () => {
    const result = buildGoogleDataManagerPayload({
      trackingEvent: makeTrackingEvent(),
      gatewayEvent: makeGatewayEvent(), // tem email_hash
      connection: makeConnection(),
      account: makeAccount(),
      mapping: makeMapping(),
    })
    expect(result.kind).toBe('send')
    if (result.kind !== 'send') return
    // MVP: so email — phone/address esperam TD-114/115
    expect(result.meta.userIdentifiersCount).toBe(1)
  })

  it('zero identifiers quando gateway_event ausente + sem matched email', () => {
    const result = buildGoogleDataManagerPayload({
      trackingEvent: makeTrackingEvent({
        matchedBuyerEmailHash: null,
        gclid: 'g1', // mantem click_id pra nao bater skip missing_user_signal
      }),
      gatewayEvent: null,
      connection: makeConnection(),
      account: makeAccount(),
      mapping: makeMapping(),
    })
    expect(result.kind).toBe('send')
    if (result.kind !== 'send') return
    expect(result.meta.userIdentifiersCount).toBe(0)
    expect(result.payload.events[0]!.userData).toBeUndefined()
  })
})
