import type {
  GatewayEvent,
  GoogleAdsAccount,
  GoogleConversionActionMapping,
  TrackingEvent,
} from '@/lib/db/schema'

import { resolveEventId } from './dedup'

/**
 * Google Data Manager API payload builder (1.4.9.B / ADR-015).
 *
 * Pure function. Recebe row(s) ja persistida(s) (TrackingEvent + opcional
 * GatewayEvent + view leve da GoogleConnection + GoogleAdsAccount alvo +
 * mapping conversion_action) e retorna shape pronto pra
 * `POST https://datamanager.googleapis.com/v1/events:ingest`.
 *
 * Decisoes encapsuladas:
 *  - consent.adUserData / consent.adPersonalization populados de
 *    tracking_events.consent_state. Default CONSENT_UNSPECIFIED.
 *  - adIdentifiers ladder: gclid > gbraid > wbraid > none. Tipo retornado
 *    em BuildMeta.clickIdType pra log em capi_events.
 *  - userData.userIdentifiers[] populado de email + phone + address quando
 *    disponiveis. Cada identifier vai como entry separada.
 *  - encoding: 'HEX' sempre (alternativa BASE64).
 *  - validateOnly = connection.testMode (toggle no wizard).
 *  - transactionId = trackingEvent.eventId (dedup com pixel client-side).
 *  - Skip quando: internal_event ('identify'), missing_destination
 *    (conversion_action_id), missing_user_signal (sem click_id + sem
 *    email/phone/address — Google nao consegue match).
 *
 * Data Manager API spec:
 *  - https://developers.google.com/data-manager/api/reference/rest/v1/events/ingest
 *  - https://developers.google.com/data-manager/api/devguides/events/send-events
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** View leve da google_connection (caller decripta access_token). */
export interface GoogleConnectionView {
  /** Decifrado pelo caller via security/encryption. */
  accessToken: string
  /** Default 'v1'. */
  dataManagerApiVersion: string
  /** Quando true, payload entra com validateOnly=true (modo teste). */
  testMode: boolean
}

/** Resultado do build: send (com payload) ou skip (com motivo). */
export type GoogleBuildResult =
  | {
      kind: 'send'
      payload: DataManagerIngestPayload
      meta: GoogleBuildMeta
    }
  | { kind: 'skip'; reason: GoogleSkipReason }

export type GoogleSkipReason =
  | 'internal_event'
  | 'missing_destination'
  | 'missing_customer'
  | 'missing_user_signal'
  | 'missing_event_data'

export interface GoogleBuildMeta {
  /** Event ID resolvido (= transactionId). */
  eventId: string
  /** Click ID enviado em adIdentifiers; 'none' quando so user_data foi enviado. */
  clickIdType: 'gclid' | 'gbraid' | 'wbraid' | 'none'
  /** Valor literal do click_id enviado (audit + capi_events log). */
  clickIdValue: string | null
  /** Count de userIdentifiers embutidos. */
  userIdentifiersCount: number
  /** Order ID enviado (= transactionId). */
  orderId: string
  /** Consent strings enviadas (3 valores enum). */
  consentAdUserData: ConsentState
  consentAdPersonalization: ConsentState
  /** customer_id usado (= operatingAccount.accountId). */
  customerId: string
  /** Conversion_action_id (= productDestinationId). */
  productDestinationId: string
  /** Login customer_id quando MCC, senao null. */
  loginCustomerId: string | null
  /** True quando event tem matched_buyer_email_hash (post-match). */
  postMatch: boolean
}

type ConsentState = 'CONSENT_GRANTED' | 'CONSENT_DENIED' | 'CONSENT_UNSPECIFIED'

// ---------------------------------------------------------------------------
// Payload (Data Manager API v1 shape)
// ---------------------------------------------------------------------------

export interface DataManagerIngestPayload {
  destinations: Destination[]
  events: DataManagerEvent[]
  /** 'HEX' (default Criation) ou 'BASE64' (suportado mas nao usado). */
  encoding: 'HEX' | 'BASE64'
  /** True = modo teste (Google valida sem persistir conversao). */
  validateOnly?: boolean
  /** Consent global aplicado a todos events (override per-event suportado). */
  consent?: Consent
}

export interface Destination {
  operatingAccount: {
    accountType: 'GOOGLE_ADS' | 'GOOGLE_ANALYTICS_PROPERTY'
    accountId: string
  }
  /** Quando user opera via MCC, passar managerCustomerId aqui. */
  loginAccount?: {
    accountType: 'GOOGLE_ADS'
    accountId: string
  }
  /** Conversion action ID Google (string numerica). */
  productDestinationId: string
}

export interface DataManagerEvent {
  /** UUID v4 do Criation = mesmo enviado pra Meta CAPI. Dedup com pixel client-side. */
  transactionId: string
  /** RFC 3339 (Data Manager API exige). */
  eventTimestamp: string
  eventSource: 'WEB' | 'APP' | 'IN_STORE' | 'PHONE' | 'MESSAGE' | 'OTHER'
  /** Valor da conversao em currency unit (NAO cents). */
  conversionValue?: number
  /** ISO 4217 (BRL/USD). */
  currency?: string
  adIdentifiers?: AdIdentifiers
  userData?: UserData
  consent?: Consent
}

export interface AdIdentifiers {
  gclid?: string
  gbraid?: string
  wbraid?: string
}

export interface UserData {
  userIdentifiers: UserIdentifier[]
}

export type UserIdentifier =
  | { emailAddress: string }
  | { phoneNumber: string }
  | { address: AddressIdentifier }

export interface AddressIdentifier {
  /** Hashed hex */
  givenName?: string
  /** Hashed hex */
  familyName?: string
  /** Hashed hex */
  streetAddress?: string
  /** Hashed hex */
  city?: string
  /** PLAIN alpha-2 ISO 3166-1 UPPERCASE. */
  regionCode?: string
  /** PLAIN postal code (Google normaliza por country). */
  postalCode?: string
}

export interface Consent {
  adUserData?: ConsentState
  adPersonalization?: ConsentState
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

export interface GoogleBuildInputs {
  trackingEvent: TrackingEvent
  gatewayEvent?: GatewayEvent | null
  connection: GoogleConnectionView
  account: Pick<
    GoogleAdsAccount,
    'customerId' | 'managerCustomerId' | 'loginCustomerId' | 'isManager'
  >
  mapping: Pick<
    GoogleConversionActionMapping,
    'productDestinationId' | 'internalEventName' | 'conversionActionType'
  >
}

export function buildGoogleDataManagerPayload(inputs: GoogleBuildInputs): GoogleBuildResult {
  const { trackingEvent, gatewayEvent, connection, account, mapping } = inputs

  // Skip eventos internos
  if (isInternalEvent(trackingEvent.eventName)) {
    return { kind: 'skip', reason: 'internal_event' }
  }

  if (!mapping.productDestinationId) {
    return { kind: 'skip', reason: 'missing_destination' }
  }

  if (!account.customerId) {
    return { kind: 'skip', reason: 'missing_customer' }
  }

  // Click ID ladder
  const clickIdRes = pickAdIdentifier(trackingEvent)

  // User identifiers (email + phone + address)
  const userIdentifiers = buildUserIdentifiers(trackingEvent, gatewayEvent)

  // Skip quando NEM click_id NEM user_data presentes (Google nao consegue match)
  if (clickIdRes.type === 'none' && userIdentifiers.length === 0) {
    return { kind: 'skip', reason: 'missing_user_signal' }
  }

  // Event ID determinstico (mesmo que Meta) — dedup cross-channel
  const mappedEventName = mapping.internalEventName
  const eventId = resolveEventId(trackingEvent.eventId, {
    workspaceId: trackingEvent.workspaceId,
    eventName: mappedEventName,
    primaryKey:
      gatewayEvent?.providerEventId ?? trackingEvent.visitorId ?? trackingEvent.workspaceId,
    eventTime: trackingEvent.eventTs,
  })

  // Consent state
  const consent = buildConsent(trackingEvent.consentState)

  // Construct event
  const event: DataManagerEvent = {
    transactionId: eventId,
    eventTimestamp: trackingEvent.eventTs.toISOString(),
    eventSource: 'WEB',
    consent,
  }

  // Value/currency — gateway tem amountCents (preciso); tracking custom_data fallback
  const { value, currency } = pickValueCurrency(trackingEvent, gatewayEvent)
  if (value !== null) event.conversionValue = value
  if (currency) event.currency = currency

  // adIdentifiers — so embute se houver click_id real. Discriminated union
  // garante narrow automatico de `value: string` quando type !== 'none'.
  if (clickIdRes.type !== 'none') {
    event.adIdentifiers = { [clickIdRes.type]: clickIdRes.value } as AdIdentifiers
  }

  // userData — so embute se houver pelo menos 1 identifier
  if (userIdentifiers.length > 0) {
    event.userData = { userIdentifiers }
  }

  const destination: Destination = {
    operatingAccount: {
      accountType: 'GOOGLE_ADS',
      accountId: account.customerId,
    },
    productDestinationId: mapping.productDestinationId,
  }
  // loginAccount obrigatorio quando opera via MCC
  if (account.managerCustomerId && account.managerCustomerId !== account.customerId) {
    destination.loginAccount = {
      accountType: 'GOOGLE_ADS',
      accountId: account.managerCustomerId,
    }
  }

  const payload: DataManagerIngestPayload = {
    destinations: [destination],
    events: [event],
    encoding: 'HEX',
  }
  if (connection.testMode) {
    payload.validateOnly = true
  }

  return {
    kind: 'send',
    payload,
    meta: {
      eventId,
      clickIdType: clickIdRes.type,
      clickIdValue: clickIdRes.value,
      userIdentifiersCount: userIdentifiers.length,
      orderId: eventId,
      consentAdUserData: consent.adUserData ?? 'CONSENT_UNSPECIFIED',
      consentAdPersonalization: consent.adPersonalization ?? 'CONSENT_UNSPECIFIED',
      customerId: account.customerId,
      productDestinationId: mapping.productDestinationId,
      loginCustomerId: destination.loginAccount?.accountId ?? null,
      postMatch: !!trackingEvent.matchedBuyerEmailHash,
    },
  }
}

// ---------------------------------------------------------------------------
// URL
// ---------------------------------------------------------------------------

export function buildDataManagerUrl(version: string): string {
  return `https://datamanager.googleapis.com/${version}/events:ingest`
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isInternalEvent(eventName: string): boolean {
  // 'identify' e sinal interno do criation-tracking.js — nunca pro Google
  return eventName.toLowerCase() === 'identify'
}

/**
 * P3-2 fix: discriminated union em vez de `{ type, value: string | null }`.
 * Antes o caller fazia `clickIdRes.type !== 'none' && clickIdRes.value` —
 * `&& value` redundante runtime mas TypeScript nao narrowava. Agora narrow
 * automatico: type !== 'none' implica value: string.
 */
type ClickIdResult =
  | { type: 'gclid' | 'gbraid' | 'wbraid'; value: string }
  | { type: 'none'; value: null }

/**
 * Ladder de prioridade (audit Google §3): gclid (web->web), gbraid
 * (web->iOS app), wbraid (iOS app->web). iOS ATT denied = wbraid.
 *
 * Se nenhum estiver presente, retorna 'none' — caller decide se ainda
 * envia (so com user_data) ou skip.
 */
function pickAdIdentifier(trackingEvent: TrackingEvent): ClickIdResult {
  if (trackingEvent.gclid) return { type: 'gclid', value: trackingEvent.gclid }
  if (trackingEvent.gbraid) return { type: 'gbraid', value: trackingEvent.gbraid }
  if (trackingEvent.wbraid) return { type: 'wbraid', value: trackingEvent.wbraid }
  return { type: 'none', value: null }
}

/**
 * Constroi userIdentifiers[] do Data Manager API.
 *
 * Implementacao MVP 1.4.9.B: enviamos apenas email hashed.
 *
 * Por que NAO phone/address neste MVP:
 *  - gateway_events.customer_email_hash usa SHA-256 sem salt (security.hashEmail
 *    em src/lib/security/hash.ts) sobre `lowercase + trim` — formato IDENTICO
 *    ao esperado por Meta CAPI e Google Data Manager API. Reusamos diretamente.
 *  - gateway_events.customer_phone_hash usa SHA-256 do E.164 SEM `+` (Meta
 *    format). Google Data Manager API quer E.164 COM `+` — formato diferente.
 *    Sem o plain phone persistido (so em-flight no webhook), nao da pra
 *    re-hashear. **TD-114** ainda aberto: persistir phone plain durante 30d
 *    (paridade plain IP/UA TD-108) pra re-hash google.
 *  - Address (city/street/region/postal) nao existe em gateway_events
 *    (so customer_*_hash). **TD-115** ainda aberto: capturar address quando
 *    payload Hotmart/Kiwify trouxer (so Hotmart traz `buyer.address`).
 *
 * Email path:
 *  1. trackingEvent.matched_buyer_email_hash (1.4.B retroativo) — se setado,
 *     usa esse hash (= SHA-256 do email do gateway_event matcheia,
 *     populado pelo matcher via COALESCE)
 *  2. gatewayEvent.customer_email_hash — quando gateway_event vinculado
 *
 * Match rate MVP (so email + click_ids): Google docs sugerem 30-50% baseline,
 * vs 60-80% com address. Aceitavel pra shadow validation (1.4.9.5) — gate da
 * 1.4.9.5 e ≥60% que e atingivel mesmo so com email + click_id em workspace
 * com infoproduto BR puro (cliente loga email no Hotmart antes do checkout).
 */
function buildUserIdentifiers(
  trackingEvent: TrackingEvent,
  gatewayEvent: GatewayEvent | null | undefined
): UserIdentifier[] {
  const identifiers: UserIdentifier[] = []

  // Email hash ja-pronto (security.hashEmail produz SHA-256 lowercase trim,
  // mesmo formato que Google + Meta esperam). NAO re-hashear.
  const emailHash = trackingEvent.matchedBuyerEmailHash ?? gatewayEvent?.customerEmailHash ?? null
  if (emailHash) identifiers.push({ emailAddress: emailHash })

  // Phone + address: aguardam TD-114/TD-115. Mantemos o helper preparado
  // pra quando schema persistir plain.

  return identifiers
}

function buildConsent(consentState: unknown): Consent {
  if (!consentState || typeof consentState !== 'object') {
    return { adUserData: 'CONSENT_UNSPECIFIED', adPersonalization: 'CONSENT_UNSPECIFIED' }
  }
  const c = consentState as Record<string, unknown>
  return {
    adUserData: mapConsentValue(c.ad_user_data),
    adPersonalization: mapConsentValue(c.ad_personalization),
  }
}

function mapConsentValue(raw: unknown): ConsentState {
  if (raw === 'granted') return 'CONSENT_GRANTED'
  if (raw === 'denied') return 'CONSENT_DENIED'
  return 'CONSENT_UNSPECIFIED'
}

function pickValueCurrency(
  trackingEvent: TrackingEvent,
  gatewayEvent: GatewayEvent | null | undefined
): { value: number | null; currency: string | null } {
  if (gatewayEvent?.amountCents != null) {
    return {
      value: gatewayEvent.amountCents / 100,
      currency: gatewayEvent.currency ?? 'BRL',
    }
  }
  const cdRaw = (trackingEvent.customData as Record<string, unknown> | null) ?? {}
  return {
    value: typeof cdRaw.value === 'number' ? cdRaw.value : null,
    currency: typeof cdRaw.currency === 'string' ? cdRaw.currency : null,
  }
}
