import { hashDocument, hashEmail, hashPhone } from '@/lib/security/hash'

import type {
  AffiliateSource,
  NormalizedAttribution,
  NormalizedEventType,
  NormalizedGatewayEvent,
  PaymentMethod,
  SubscriptionStatus,
} from '../types'

import type { ParsedHotmartV1 } from './legacyParser'
import { mapV1StatusToEvent } from './legacyParser'
import type { ParsedHotmartV2 } from './parser'

/**
 * Normaliza payload Hotmart (v1 ou v2) para `NormalizedGatewayEvent`.
 *
 * **Garantias do contrato:**
 * - PII (email/phone/document) chega ja hasheada. Plain so existe na funcao
 *   local — nao retorna em rawPayload (rawPayload e a versao redacted).
 * - `creation_date` em ms epoch (gotcha Hotmart) e convertido para Date UTC
 *   + preservado como `occurredAtMs` para auditoria.
 * - `allocationIdempotencyKey` = `event.id` (v2) ou `syntheticEventId` (v1).
 * - Money em cents (multiplica `price.value * 100` arredondando).
 *
 * Mapping table completa em ADR-016 §10 e audit HOTMART_API_2026-05.md §10.
 */
export function normalizeV2(parsed: ParsedHotmartV2): NormalizedGatewayEvent {
  const { envelope, data } = parsed
  const purchase = data.purchase ?? {}
  const subscription = data.subscription ?? {}
  const buyer = data.buyer ?? {}
  const product = data.product ?? purchase.product ?? {}
  const affiliations = data.affiliations ?? []
  const firstAffiliate = affiliations[0]
  const commissions = purchase.commissions ?? []

  // creation_date pode vir number (ms epoch) ou string ISO em alguns eventos
  const occurredAtMs = toEpochMs(envelope.creation_date)
  const occurredAt = new Date(occurredAtMs)

  const eventType = mapV2EventName(envelope.event)

  const productId = product.id ? String(product.id) : ''
  const amountCents = priceToCents(purchase.price?.value)
  const currency = purchase.price?.currency_value ?? 'BRL'

  const affiliateSource = pickAffiliateSource(purchase.tracking?.source, firstAffiliate?.source)

  const buyerEmailHash = buyer.email ? hashEmail(buyer.email) : ''
  const buyerPhoneHash = buyer.phone ? hashPhone(buyer.phone) : undefined
  const buyerDocumentHash = buyer.document ? hashDocument(buyer.document) : undefined
  const affiliateEmailHash = firstAffiliate?.affiliate?.email
    ? hashEmail(firstAffiliate.affiliate.email)
    : undefined

  const attribution: NormalizedAttribution = {
    origin: {
      src: purchase.origin?.src ?? purchase.tracking?.source,
      sck: purchase.origin?.sck ?? purchase.tracking?.source_sck,
      xcode: purchase.origin?.xcode,
    },
    externalCode: purchase.tracking?.external_code,
  }

  const subscriptionStatus = subscription.status
    ? toSubscriptionStatus(subscription.status)
    : undefined

  return {
    provider: 'hotmart',
    providerEventId: envelope.id,
    providerEventVersion: envelope.version,
    eventType,
    occurredAt,
    occurredAtMs,
    amountCents,
    feeCents: pickCommissionCents(commissions, 'MARKETPLACE'),
    producerNetCents: pickCommissionCents(commissions, 'PRODUCER'),
    currency,
    productId,
    productName: product.name,
    offerId: purchase.offer?.code ?? purchase.offer?.key,
    subscriberCode: subscription.subscriber?.code,
    subscriptionStatus,
    recurrenceNumber: purchase.recurrence_number ?? undefined,
    planId: subscription.plan?.id ? String(subscription.plan.id) : undefined,
    paymentMethod: mapPaymentMethod(purchase.payment?.type ?? purchase.payment?.method),
    installmentsNumber: purchase.payment?.installments_number,
    buyerCountry: purchase.checkout_country?.iso ?? buyer.address?.country_iso,
    buyerEmailHash,
    buyerPhoneHash,
    buyerDocumentHash,
    affiliateEmailHash,
    affiliateSource,
    commissionAffiliateCents: pickCommissionCents(commissions, 'AFFILIATE'),
    attribution,
    allocationIdempotencyKey: envelope.id,
    rawPayload: redactPayload(envelope, data),
  }
}

/**
 * Normaliza v1 (form-urlencoded). Usa `syntheticEventId` para idempotencia.
 * Cobertura de campos e MENOR que v1 — muitos vem ausentes ou em chaves variadas.
 */
export function normalizeV1(parsed: ParsedHotmartV1): NormalizedGatewayEvent {
  const f = parsed.fields
  const status = f.status ?? ''
  const eventType = mapV2EventName(mapV1StatusToEvent(status))

  const occurredAtMs = parseV1Date(f.creation_date ?? f.purchase_date ?? '')
  const occurredAt = new Date(occurredAtMs)

  const amountCents = priceToCents(f.prod_price ? Number.parseFloat(f.prod_price) : undefined)

  return {
    provider: 'hotmart',
    providerEventId: parsed.syntheticEventId,
    providerEventVersion: '1.0.0',
    eventType,
    occurredAt,
    occurredAtMs,
    amountCents,
    currency: f.currency ?? 'BRL',
    productId: f.prod ?? '',
    productName: f.prod_name,
    offerId: f.off,
    paymentMethod: mapPaymentMethod(f.payment_type),
    buyerEmailHash: f.email ? hashEmail(f.email) : '',
    buyerPhoneHash: f.phone_checkout_user ? hashPhone(f.phone_checkout_user) : undefined,
    buyerDocumentHash: f.doc ? hashDocument(f.doc) : undefined,
    attribution: {
      origin: {
        src: f.src,
        sck: f.sck,
      },
    },
    allocationIdempotencyKey: parsed.syntheticEventId,
    rawPayload: redactV1Payload(f),
  }
}

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

function priceToCents(value: number | undefined): number {
  if (value == null || Number.isNaN(value)) return 0
  return Math.round(value * 100)
}

/**
 * Hotmart envia datas em formatos mistos:
 * - ms epoch (number) — maioria dos eventos
 * - ISO string — UPDATE_SUBSCRIPTION_CHARGE_DATE.subscription.date_next_charge
 *
 * Sempre devolvemos ms epoch (number). Date.parse retorna NaN em formato
 * desconhecido — caimos no Date.now() como fallback (logger captura via DLQ
 * se o processamento downstream depender da data).
 */
function toEpochMs(raw: number | string | undefined): number {
  if (raw == null) return Date.now()
  if (typeof raw === 'number') {
    return raw > 1e12 ? raw : raw * 1000
  }
  const parsed = Date.parse(raw)
  return Number.isNaN(parsed) ? Date.now() : parsed
}

function pickCommissionCents(
  commissions: Array<{ value?: number | undefined; source?: string | undefined }>,
  source: string
): number | undefined {
  const found = commissions.find((c) => c.source === source)
  if (!found?.value) return undefined
  return priceToCents(found.value)
}

function mapV2EventName(eventName: string): NormalizedEventType {
  // Hotmart usa nomes ja proximos ao nosso schema canonico — mapeamos um-a-um
  // com fallback UNKNOWN para eventos novos/desconhecidos
  const known: Record<string, NormalizedEventType> = {
    PURCHASE_APPROVED: 'PURCHASE_APPROVED',
    PURCHASE_COMPLETE: 'PURCHASE_COMPLETE',
    PURCHASE_REFUNDED: 'PURCHASE_REFUNDED',
    PURCHASE_CHARGEBACK: 'PURCHASE_CHARGEBACK',
    PURCHASE_CANCELED: 'PURCHASE_CANCELED',
    PURCHASE_BILLET_PRINTED: 'PURCHASE_BILLET_PRINTED',
    PURCHASE_DELAYED: 'PURCHASE_DELAYED',
    PURCHASE_EXPIRED: 'PURCHASE_EXPIRED',
    PURCHASE_OUT_OF_SHOPPING_CART: 'PURCHASE_OUT_OF_SHOPPING_CART',
    PURCHASE_REFUND_REQUESTED: 'PURCHASE_REFUND_REQUESTED',
    PURCHASE_PROTEST: 'PURCHASE_PROTEST',
    SUBSCRIPTION_CANCELLATION: 'SUBSCRIPTION_CANCELLATION',
    SUBSCRIPTION_REACTIVATED: 'SUBSCRIPTION_REACTIVATED',
    SWITCH_PLAN: 'SWITCH_PLAN',
    UPDATE_SUBSCRIPTION_CHARGE_DATE: 'UPDATE_SUBSCRIPTION_CHARGE_DATE',
    CLUB_FIRST_ACCESS: 'CLUB_FIRST_ACCESS',
    CLUB_MODULE_COMPLETED: 'CLUB_MODULE_COMPLETED',
  }
  return known[eventName] ?? 'UNKNOWN'
}

function mapPaymentMethod(raw: string | undefined): PaymentMethod | undefined {
  if (!raw) return undefined
  const upper = raw.toUpperCase()
  if (upper.includes('CREDIT_CARD') || upper === 'CREDIT' || upper.includes('CARD'))
    return 'CREDIT_CARD'
  if (upper === 'PIX') return 'PIX'
  if (upper.includes('BILLET') || upper === 'BOLETO' || upper === 'BANK_SLIP') return 'BILLET'
  if (upper.includes('PAYPAL')) return 'PAYPAL'
  return 'OTHER'
}

function toSubscriptionStatus(raw: string): SubscriptionStatus | undefined {
  const upper = raw.toUpperCase()
  const known: Record<string, SubscriptionStatus> = {
    ACTIVE: 'ACTIVE',
    INACTIVE: 'INACTIVE',
    CANCELLED: 'CANCELLED',
    CANCELLED_BY_CUSTOMER: 'CANCELLED',
    CANCELLED_BY_SELLER: 'CANCELLED',
    CANCELLED_BY_ADMIN: 'CANCELLED',
    CANCELED: 'CANCELLED',
    OVERDUE: 'OVERDUE',
    DELAYED: 'DELAYED',
    STARTED: 'STARTED',
  }
  return known[upper]
}

function pickAffiliateSource(
  trackingSource: string | undefined,
  affiliationSource: string | undefined
): AffiliateSource | undefined {
  const candidate = (trackingSource ?? affiliationSource ?? '').toUpperCase()
  if (candidate === 'SPARKLE') return 'SPARKLE'
  if (candidate === 'EXTERNAL') return 'EXTERNAL'
  return undefined
}

function parseV1Date(raw: string): number {
  if (!raw) return Date.now()
  const asNumber = Number(raw)
  if (!Number.isNaN(asNumber)) {
    // Hotmart v1 as vezes manda epoch ms, as vezes seconds
    return asNumber > 1e12 ? asNumber : asNumber * 1000
  }
  const parsed = Date.parse(raw)
  return Number.isNaN(parsed) ? Date.now() : parsed
}

/**
 * Remove plain PII do payload original antes de persistir em
 * `gateway_events.raw_payload`. Mantem estrutura para debug, mas substitui
 * email/phone/document/name/address por marker `[REDACTED]` em qualquer
 * nivel da arvore (recursive walk).
 */
const REDACT_KEYS = new Set([
  'email',
  'phone',
  'document',
  'name',
  'checkout_phone',
  'cust_email',
  'doc',
  'phone_checkout_user',
  'phone_local_code',
  'phone_ddi',
  'address',
  'address_city',
  'address_state',
  'address_zip_code',
  'address_country',
  'address_neighborhood',
  'address_complement',
  'address_number',
  'buyer_name',
])

function redactPayload(
  envelope: ParsedHotmartV2['envelope'],
  _data: ParsedHotmartV2['data']
): Record<string, unknown> {
  // O envelope ja carrega `data` dentro (passthrough do parser). Clonamos
  // apenas o envelope para evitar duplicacao.
  const cloned = structuredClone(envelope) as Record<string, unknown>
  redactDeep(cloned)
  return cloned
}

function redactDeep(node: unknown): void {
  if (node == null || typeof node !== 'object') return
  if (Array.isArray(node)) {
    for (const item of node) redactDeep(item)
    return
  }
  const obj = node as Record<string, unknown>
  for (const key of Object.keys(obj)) {
    if (REDACT_KEYS.has(key) && obj[key] != null && typeof obj[key] !== 'object') {
      obj[key] = '[REDACTED]'
      continue
    }
    if (typeof obj[key] === 'object') redactDeep(obj[key])
  }
}

function redactV1Payload(fields: Record<string, string>): Record<string, unknown> {
  const cloned: Record<string, unknown> = { ...fields }
  redactKeys(cloned, [
    'email',
    'doc',
    'phone_checkout_user',
    'phone_local_code',
    'phone_ddi',
    'name',
    'buyer_name',
    'address',
    'address_city',
    'address_state',
    'address_zip_code',
    'address_country',
    'address_neighborhood',
    'address_complement',
    'address_number',
    'cust_email',
  ])
  return cloned
}

function redactKeys(obj: Record<string, unknown>, keys: string[]) {
  for (const k of keys) {
    if (obj[k] != null) obj[k] = '[REDACTED]'
  }
}
