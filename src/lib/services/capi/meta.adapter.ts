import type { GatewayEvent, TrackingEvent, TrackingVisitor } from '@/lib/db/schema'

import { resolveEventId } from './dedup'
import { sha256Hex } from './hashing'

/**
 * Meta CAPI payload builder — Sessao 1.4.9.
 *
 * Recebe row(s) ja persistida(s) (TrackingEvent + opcionalmente TrackingVisitor
 * e GatewayEvent + view leve da MetaConnection) e retorna shape pronto pra
 * POST `graph.facebook.com/{version}/{pixel_id}/events`.
 *
 * Decisoes encapsuladas:
 *  - Consent gating: `ad_storage=denied` => skip (BR LGPD strict, audit Meta §5)
 *    `ad_user_data=denied|ad_personalization=denied` => send com LDU flag
 *  - external_id: pre-match `sha256(workspace:visitor:VID)`, post-match
 *    `sha256(workspace:email:EMAIL_HASH)` — re-fanout retroativo (1.4.9 step 8)
 *    eleva EMQ historico apos matcher 1.4.B identificar buyer
 *  - action_source: `ctwa_clid` => `business_messaging`, default `website`
 *  - event_name: mapping Criation → Meta canonical; custom events pass-through;
 *    eventos internos (`identify`) sao skip
 *  - PII ja-hashed: matched_buyer_email_hash / customer_email_hash / customer_phone_hash
 *    sao SHA-256 do plain. NAO re-hashear — Meta espera lowercase hex.
 *  - event_time: Unix seconds (Meta exige; tracking_events guarda timestamptz)
 *  - test_event_code: passado quando connection.testEventCode preenchido
 */

/** View leve da meta_connections (caller decripta access_token antes). */
export interface MetaConnectionView {
  pixelId: string
  /** Decifrado pelo caller via security/encryption. */
  accessToken: string
  /** Default 'v25.0' do schema. */
  marketingApiVersion: string
  /** Default 'criation-io-v1'. */
  partnerAgent: string
  /** Quando preenchido, payload entra em modo teste no Events Manager. */
  testEventCode: string | null
}

/** Resultado do build: send (com payload) ou skip (com motivo). */
export type BuildResult =
  | { kind: 'send'; pixelId: string; accessToken: string; payload: CapiPayload; meta: BuildMeta }
  | { kind: 'skip'; reason: SkipReason }

export type SkipReason =
  | 'consent_denied_ad_storage'
  | 'internal_event'
  | 'missing_pixel_id'
  | 'missing_event_data'

export interface BuildMeta {
  /** Event ID resolvido (usado pra UNIQUE de capi_events). */
  eventId: string
  /** True quando LDU flag ativada (consent parcial). */
  lduActive: boolean
  /** True quando event tem visitor↔buyer match (external_id pos-match). */
  postMatch: boolean
}

/** Payload Meta CAPI v25.0 — shape de POST `/{pixel_id}/events`. */
export interface CapiPayload {
  data: CapiEvent[]
  partner_agent: string
  test_event_code?: string
}

export interface CapiEvent {
  event_name: string
  event_time: number // Unix seconds (NOT ms)
  event_id: string
  action_source:
    | 'website'
    | 'system_generated'
    | 'business_messaging'
    | 'app'
    | 'email'
    | 'phone_call'
    | 'chat'
    | 'other'
  event_source_url?: string
  opt_out?: boolean
  user_data: CapiUserData
  custom_data?: CapiCustomData
  data_processing_options?: ['LDU']
  data_processing_options_country?: number
  data_processing_options_state?: number
  messaging_channel?: string
}

export interface CapiUserData {
  /** SHA-256 lowercase hex do email normalizado. Pre-hashed nas tabelas. */
  em?: string[]
  /** SHA-256 lowercase hex do phone E.164 sem +. */
  ph?: string[]
  /** SHA-256 lowercase hex do external_id composto. */
  external_id?: string[]
  /** Plain IP — Meta dedupa por IP. */
  client_ip_address?: string
  /** Plain UA. */
  client_user_agent?: string
  /** Plain fb.1.{ts}.{fbclid}. NUNCA hashear. */
  fbc?: string
  /** Plain fb.1.{ts}.{random}. NUNCA hashear. */
  fbp?: string
}

export interface CapiCustomData {
  value?: number
  currency?: string
  order_id?: string
  content_ids?: string[]
  content_name?: string
  content_type?: string
}

// ---------------------------------------------------------------------------
// Inputs do builder
// ---------------------------------------------------------------------------

export interface BuildInputs {
  trackingEvent: TrackingEvent
  /** Optional — pra UTM context e identified_buyer (1.4.B). */
  trackingVisitor?: TrackingVisitor | null
  /** Optional — quando event_name='purchase' matcheia gateway_event via
   * matched_buyer_email_hash. Brings amount/currency/order_id/PII. */
  gatewayEvent?: GatewayEvent | null
  connection: MetaConnectionView
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

export function buildMetaCapiPayload(inputs: BuildInputs): BuildResult {
  const { trackingEvent, gatewayEvent, connection } = inputs

  if (!connection.pixelId) {
    return { kind: 'skip', reason: 'missing_pixel_id' }
  }

  const mappedEventName = mapEventName(trackingEvent.eventName)
  if (mappedEventName === null) {
    return { kind: 'skip', reason: 'internal_event' }
  }

  const consentDecision = decideConsent(trackingEvent.consentState)
  if (consentDecision.kind === 'skip') {
    return { kind: 'skip', reason: 'consent_denied_ad_storage' }
  }

  const eventId = resolveEventId(trackingEvent.eventId, {
    workspaceId: trackingEvent.workspaceId,
    eventName: mappedEventName,
    primaryKey:
      gatewayEvent?.providerEventId ?? trackingEvent.visitorId ?? trackingEvent.workspaceId,
    eventTime: trackingEvent.eventTs,
  })

  const postMatch = !!trackingEvent.matchedBuyerEmailHash
  const externalIdPlain = buildExternalIdPlain(trackingEvent, postMatch)
  const externalIdHash = sha256Hex(externalIdPlain)

  const userData = buildUserData(trackingEvent, gatewayEvent, externalIdHash)
  const customData = buildCustomData(trackingEvent, gatewayEvent)
  const actionSource = decideActionSource(trackingEvent)

  const event: CapiEvent = {
    event_name: mappedEventName,
    event_time: Math.floor(trackingEvent.eventTs.getTime() / 1000),
    event_id: eventId,
    action_source: actionSource,
    user_data: userData,
  }

  if (trackingEvent.pageUrl) {
    event.event_source_url = trackingEvent.pageUrl
  }
  if (Object.keys(customData).length > 0) {
    event.custom_data = customData
  }
  if (consentDecision.lduActive) {
    event.opt_out = true
    event.data_processing_options = ['LDU']
    event.data_processing_options_country = 0
    event.data_processing_options_state = 0
  }
  if (actionSource === 'business_messaging' && trackingEvent.ctwaClid) {
    event.messaging_channel = 'whatsapp'
  }

  const payload: CapiPayload = {
    data: [event],
    partner_agent: connection.partnerAgent,
  }
  if (connection.testEventCode) {
    payload.test_event_code = connection.testEventCode
  }

  return {
    kind: 'send',
    pixelId: connection.pixelId,
    accessToken: connection.accessToken,
    payload,
    meta: { eventId, lduActive: consentDecision.lduActive, postMatch },
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Mapping Criation event_name → Meta canonical event name.
 * Eventos internos (`identify`) retornam null = skip.
 * Custom events nao-mapeados passam through.
 */
function mapEventName(criationName: string): string | null {
  switch (criationName.toLowerCase()) {
    case 'page_view':
    case 'pageview':
      return 'PageView'
    case 'view_content':
    case 'viewcontent':
      return 'ViewContent'
    case 'add_to_cart':
    case 'addtocart':
      return 'AddToCart'
    case 'initiate_checkout':
    case 'initiatecheckout':
      return 'InitiateCheckout'
    case 'purchase':
      return 'Purchase'
    case 'lead':
      return 'Lead'
    case 'subscribe':
      return 'Subscribe'
    case 'complete_registration':
    case 'completeregistration':
      return 'CompleteRegistration'
    case 'identify':
      // Sinal interno do criation-tracking.js — nao envia pro Meta
      return null
    case 'scroll':
    case 'form_submit':
      // Eventos custom Criation — passa through capitalizado
      return capitalize(criationName)
    default:
      return criationName
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/**
 * Decide se envia o evento baseado em consent_state.
 * BR LGPD strict (audit Meta §5):
 *  - ad_storage denied => SKIP completo (nao envia request)
 *  - ad_user_data ou ad_personalization denied => send com LDU
 *  - Tudo granted (ou consent null = nao-EEA + default browser) => send normal
 */
interface ConsentDecision {
  kind: 'send' | 'skip'
  lduActive: boolean
}

function decideConsent(consentState: unknown): ConsentDecision {
  if (!consentState || typeof consentState !== 'object') {
    return { kind: 'send', lduActive: false }
  }
  const consent = consentState as Record<string, unknown>
  if (consent.ad_storage === 'denied') {
    return { kind: 'skip', lduActive: false }
  }
  const lduActive = consent.ad_user_data === 'denied' || consent.ad_personalization === 'denied'
  return { kind: 'send', lduActive }
}

/**
 * external_id estrategia:
 *  - Pre-match (visitor anonimo): `criation:{ws}:visitor:{visitor_id}`
 *  - Post-match (matched_buyer_email_hash presente): `criation:{ws}:email:{email_hash}`
 *
 * Re-fanout retroativo (1.4.9 step 8) re-envia eventos historicos com
 * external_id atualizado quando matcher 1.4.B identifica o buyer.
 */
function buildExternalIdPlain(trackingEvent: TrackingEvent, postMatch: boolean): string {
  if (postMatch && trackingEvent.matchedBuyerEmailHash) {
    return `criation:${trackingEvent.workspaceId}:email:${trackingEvent.matchedBuyerEmailHash}`
  }
  return `criation:${trackingEvent.workspaceId}:visitor:${trackingEvent.visitorId}`
}

/** action_source baseado em sinais do evento. */
function decideActionSource(trackingEvent: TrackingEvent): CapiEvent['action_source'] {
  if (trackingEvent.ctwaClid) {
    return 'business_messaging'
  }
  // Future: detectar `event_source_url` ausente + sem visitor_id => system_generated
  return 'website'
}

function buildUserData(
  trackingEvent: TrackingEvent,
  gatewayEvent: GatewayEvent | null | undefined,
  externalIdHash: string
): CapiUserData {
  const ud: CapiUserData = {}

  // Email hash: prefer tracking_event match (1.4.B retroativo) > gateway_event
  const emailHash = trackingEvent.matchedBuyerEmailHash ?? gatewayEvent?.customerEmailHash ?? null
  if (emailHash) ud.em = [emailHash]

  // Phone hash: so vem de gateway_event (browser nao captura phone)
  if (gatewayEvent?.customerPhoneHash) {
    ud.ph = [gatewayEvent.customerPhoneHash]
  }

  ud.external_id = [externalIdHash]

  // Plain IP/UA — prefer tracking_event (browser-captured) > gateway_event
  const ip = trackingEvent.clientIpAddress ?? gatewayEvent?.clientIpAddress ?? null
  if (ip) ud.client_ip_address = ip

  const ua = trackingEvent.clientUserAgent ?? gatewayEvent?.clientUserAgent ?? null
  if (ua) ud.client_user_agent = ua

  if (trackingEvent.fbc) ud.fbc = trackingEvent.fbc
  if (trackingEvent.fbp) ud.fbp = trackingEvent.fbp

  return ud
}

function buildCustomData(
  trackingEvent: TrackingEvent,
  gatewayEvent: GatewayEvent | null | undefined
): CapiCustomData {
  const cd: CapiCustomData = {}

  // value/currency: gateway tem amount_cents (preciso); tracking custom_data pode ter floating value
  if (gatewayEvent?.amountCents != null) {
    cd.value = gatewayEvent.amountCents / 100
    cd.currency = gatewayEvent.currency ?? 'BRL'
  } else {
    const cdRaw = (trackingEvent.customData as Record<string, unknown> | null) ?? {}
    if (typeof cdRaw.value === 'number') cd.value = cdRaw.value
    if (typeof cdRaw.currency === 'string') cd.currency = cdRaw.currency
  }

  if (gatewayEvent?.providerEventId) {
    cd.order_id = gatewayEvent.providerEventId
  } else {
    const cdRaw = (trackingEvent.customData as Record<string, unknown> | null) ?? {}
    if (typeof cdRaw.order_id === 'string') cd.order_id = cdRaw.order_id
  }

  if (gatewayEvent?.productId) {
    cd.content_ids = [gatewayEvent.productId]
    cd.content_type = 'product'
  } else {
    const cdRaw = (trackingEvent.customData as Record<string, unknown> | null) ?? {}
    if (Array.isArray(cdRaw.content_ids)) {
      cd.content_ids = cdRaw.content_ids.filter((x): x is string => typeof x === 'string')
    }
    if (typeof cdRaw.content_name === 'string') cd.content_name = cdRaw.content_name
    if (typeof cdRaw.content_type === 'string') cd.content_type = cdRaw.content_type
  }

  return cd
}

/**
 * URL pra POST CAPI events.
 * `graph.facebook.com/{version}/{pixel_id}/events?access_token={token}`
 */
export function buildCapiUrl(
  pixelId: string,
  marketingApiVersion: string,
  accessToken: string
): string {
  return `https://graph.facebook.com/${marketingApiVersion}/${pixelId}/events?access_token=${encodeURIComponent(accessToken)}`
}
