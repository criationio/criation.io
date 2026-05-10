import { hashDocument, hashEmail, hashPhone } from '@/lib/security/hash'

import type {
  NormalizedAttribution,
  NormalizedEventType,
  NormalizedGatewayEvent,
  PaymentMethod,
  SubscriptionStatus,
} from '../types'

import type { KiwifyWebhookPayload } from './parser'

/**
 * Normaliza payload Kiwify (schema REAL — PascalCase) para `NormalizedGatewayEvent`.
 *
 * Schema descoberto via smoke E2E em sandbox real (2026-05-10). Difere do
 * `/v1/sales/{id}` REST API: webhook usa `Customer`/`Product`/`Commissions`/
 * `Subscription`/`TrackingParameters` em PascalCase + nomes de evento em
 * INGLES (`order_approved` vs `compra_aprovada` da API REST).
 *
 * Mapping bilingual: aceita PT-BR (API REST trigger names) e EN-US (payload
 * webhook names) por defesa.
 *
 * **Garantias do contrato:**
 * - PII (email/cpf/cnpj/mobile/address/instagram/IP) chega ja hasheada.
 * - Datas em formato Kiwify mistura ISO 8601 e "YYYY-MM-DD HH:mm" sem TZ.
 * - `allocationIdempotencyKey` = `order_id`.
 * - Money em cents (Kiwify ja envia em cents).
 */
export function normalizeKiwifyEvent(parsed: KiwifyWebhookPayload): NormalizedGatewayEvent {
  const eventName = parsed.webhook_event_type ?? ''
  const eventType = mapKiwifyEvent(eventName)

  const orderId = parsed.order_id ?? ''
  const customer = parsed.Customer ?? {}
  const product = parsed.Product ?? {}
  const commissions = parsed.Commissions ?? {}
  const tracking = parsed.TrackingParameters ?? {}
  const subscription = parsed.Subscription ?? {}

  const occurredAtMs = toEpochMs(
    parsed.created_at ?? parsed.approved_date ?? subscription.start_date
  )
  const occurredAt = new Date(occurredAtMs)

  const amountCents = commissions.charge_amount ?? commissions.product_base_price ?? 0
  const currency = commissions.currency ?? commissions.product_base_price_currency ?? 'BRL'

  // Subscription: a presenca de Subscription bloco indica recorrencia.
  // Renovacao: completed.length > 1 e subscription_id presente.
  const completedCharges = subscription.charges?.completed ?? []
  const isRenewal =
    eventType === 'SUBSCRIPTION_RENEWED' ||
    (eventType === 'PURCHASE_APPROVED' && completedCharges.length > 1)
  const subscriberCode = subscription.id ?? parsed.subscription_id ?? undefined
  const subscriptionStatus = subscription.status
    ? toSubscriptionStatus(subscription.status)
    : eventToSubscriptionStatus(eventType)

  const buyerEmailHash = customer.email ? hashEmail(customer.email) : ''
  const buyerPhoneHash = customer.mobile ? hashPhone(customer.mobile) : undefined
  const document = customer.cpf ?? customer.cnpj
  const buyerDocumentHash = document ? hashDocument(document) : undefined

  // Affiliate: vem dentro de commissions.commissioned_stores[type=affiliate]
  const affiliateStore = commissions.commissioned_stores?.find((s) => s.type === 'affiliate')
  const affiliateEmailHash = affiliateStore?.email ? hashEmail(affiliateStore.email) : undefined
  const commissionAffiliateCents = affiliateStore?.value
    ? Number.parseInt(affiliateStore.value, 10)
    : undefined

  const attribution: NormalizedAttribution = {
    utms: {
      source: tracking.utm_source ?? undefined,
      medium: tracking.utm_medium ?? undefined,
      campaign: tracking.utm_campaign ?? undefined,
      content: tracking.utm_content ?? undefined,
      term: tracking.utm_term ?? undefined,
    },
    origin: {
      src: tracking.src ?? undefined,
      sck: tracking.sck ?? undefined,
    },
    // s1 = visitor_id quando injetado via link de checkout
    externalCode: tracking.s1 ?? undefined,
  }

  return {
    provider: 'kiwify',
    providerEventId: orderId || `kiwify-${occurredAtMs}-${eventName}`,
    providerEventVersion: '1.0.0',
    eventType,
    occurredAt,
    occurredAtMs,
    amountCents,
    feeCents: commissions.kiwify_fee,
    producerNetCents: commissions.my_commission ?? commissions.settlement_amount,
    currency,
    productId: product.product_id ?? '',
    productName: product.product_name,
    offerId: undefined, // Kiwify nao tem offer code separado
    subscriberCode,
    subscriptionStatus,
    recurrenceNumber: isRenewal ? completedCharges.length || 2 : 1,
    planId: subscription.plan?.id,
    paymentMethod: mapPaymentMethod(parsed.payment_method),
    installmentsNumber: parsed.installments,
    buyerCountry: undefined, // Kiwify nao envia country no webhook
    buyerEmailHash,
    buyerPhoneHash,
    buyerDocumentHash,
    affiliateEmailHash,
    affiliateSource: affiliateStore ? 'EXTERNAL' : undefined,
    commissionAffiliateCents,
    attribution,
    allocationIdempotencyKey: orderId || `kiwify-${occurredAtMs}-${eventName}`,
    rawPayload: redactPayload(parsed),
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Mapping bilingual: aceita nomes EN-US (payload webhook) e PT-BR (API REST
 * triggers). Defesa contra Kiwify usar um conjunto ou outro inconsistentemente.
 */
function mapKiwifyEvent(eventName: string): NormalizedEventType {
  const map: Record<string, NormalizedEventType> = {
    // EN-US (payload webhook real)
    order_approved: 'PURCHASE_APPROVED',
    order_rejected: 'PURCHASE_REJECTED',
    order_refunded: 'PURCHASE_REFUNDED',
    chargeback: 'PURCHASE_CHARGEBACK',
    billet_created: 'PURCHASE_BILLET_PRINTED',
    pix_created: 'PIX_GENERATED',
    cart_abandoned: 'PURCHASE_OUT_OF_SHOPPING_CART',
    subscription_canceled: 'SUBSCRIPTION_CANCELLATION',
    subscription_late: 'SUBSCRIPTION_LATE',
    subscription_renewed: 'SUBSCRIPTION_RENEWED',

    // PT-BR (API REST trigger names — backward compat)
    compra_aprovada: 'PURCHASE_APPROVED',
    compra_recusada: 'PURCHASE_REJECTED',
    compra_reembolsada: 'PURCHASE_REFUNDED',
    boleto_gerado: 'PURCHASE_BILLET_PRINTED',
    pix_gerado: 'PIX_GENERATED',
    carrinho_abandonado: 'PURCHASE_OUT_OF_SHOPPING_CART',
  }
  return map[eventName] ?? 'UNKNOWN'
}

function mapPaymentMethod(raw: string | undefined): PaymentMethod | undefined {
  if (!raw) return undefined
  const lower = raw.toLowerCase()
  if (lower.includes('credit') || lower.includes('card')) return 'CREDIT_CARD'
  if (lower === 'pix') return 'PIX'
  if (lower.includes('boleto') || lower.includes('billet')) return 'BILLET'
  if (lower.includes('paypal')) return 'PAYPAL'
  return 'OTHER'
}

function toSubscriptionStatus(raw: string): SubscriptionStatus | undefined {
  const upper = raw.toUpperCase()
  const known: Record<string, SubscriptionStatus> = {
    ACTIVE: 'ACTIVE',
    INACTIVE: 'INACTIVE',
    CANCELLED: 'CANCELLED',
    CANCELED: 'CANCELLED',
    OVERDUE: 'OVERDUE',
    LATE: 'OVERDUE',
    DELAYED: 'DELAYED',
    STARTED: 'STARTED',
  }
  return known[upper]
}

function eventToSubscriptionStatus(eventType: NormalizedEventType): SubscriptionStatus | undefined {
  switch (eventType) {
    case 'SUBSCRIPTION_CANCELLATION':
      return 'CANCELLED'
    case 'SUBSCRIPTION_LATE':
      return 'OVERDUE'
    case 'SUBSCRIPTION_RENEWED':
    case 'PURCHASE_APPROVED':
      return 'ACTIVE'
    default:
      return undefined
  }
}

/**
 * Aceita formatos:
 * - ISO 8601 com TZ: `2026-05-07T11:35:13.617Z`
 * - Kiwify "YYYY-MM-DD HH:mm" sem TZ (assume UTC): `2026-05-10 11:35`
 * - ms epoch (number)
 */
function toEpochMs(raw: string | number | undefined): number {
  if (raw == null) return Date.now()
  if (typeof raw === 'number') return raw > 1e12 ? raw : raw * 1000
  // Kiwify "YYYY-MM-DD HH:mm" — adiciona Z pra Date.parse interpretar como UTC
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(raw)) {
    const parsed = Date.parse(raw.replace(' ', 'T') + ':00Z')
    if (!Number.isNaN(parsed)) return parsed
  }
  const parsed = Date.parse(raw)
  return Number.isNaN(parsed) ? Date.now() : parsed
}

/**
 * Remove plain PII do payload antes de persistir em `gateway_events.raw_payload`.
 * Cobre Customer.* + commissioned_stores[].email (afiliados).
 */
const REDACT_KEYS = new Set([
  'email',
  'cpf',
  'cnpj',
  'mobile',
  'phone',
  'instagram',
  'name',
  'full_name',
  'first_name',
  'last_name',
  'document',
  'street',
  'zipcode',
  'address',
  'complement',
  'number',
  'neighborhood',
  'card_last_digits',
  'card_first_digits',
  'card_last4digits',
  'ip',
])

function redactPayload(parsed: KiwifyWebhookPayload): Record<string, unknown> {
  const cloned = structuredClone(parsed) as unknown as Record<string, unknown>
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
