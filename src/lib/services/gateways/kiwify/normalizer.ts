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
 * Normaliza payload Kiwify para `NormalizedGatewayEvent`.
 *
 * **Garantias do contrato:**
 * - PII (email/cpf/cnpj/mobile/address/instagram) chega ja hasheada. Plain
 *   so existe na funcao local.
 * - Datas ISO 8601 ou ms epoch — convertido para Date UTC + ms preservado.
 * - `allocationIdempotencyKey` = `order_id` (ou `id` como fallback).
 * - Money em cents (Kiwify ja envia em cents — `payment.charge_amount`).
 *
 * Mapping completo em ADR-017 + audit KIWIFY_API_2026-05.md §10.
 */
export function normalizeKiwifyEvent(parsed: KiwifyWebhookPayload): NormalizedGatewayEvent {
  const eventName = parsed.webhook_event_type ?? parsed.event ?? ''
  const eventType = mapKiwifyEvent(eventName)

  const occurredAtMs = toEpochMs(parsed.created_at ?? parsed.approved_date ?? parsed.updated_at)
  const occurredAt = new Date(occurredAtMs)

  const orderId = parsed.order_id ?? parsed.id ?? ''
  const customer = parsed.customer ?? {}
  const product = parsed.product ?? {}
  const payment = parsed.payment ?? {}
  const tracking = parsed.tracking ?? {}
  const affiliate = parsed.affiliate_commission

  const amountCents = payment.charge_amount ?? parsed.net_amount ?? 0
  const currency = payment.charge_currency ?? parsed.currency ?? 'BRL'

  // Subscription: parent_order_id presente em renovacoes
  const isRenewal = !!parsed.parent_order_id
  const subscriberCode =
    parsed.parent_order_id ?? (parsed.type === 'subscription' ? orderId : undefined)
  const subscriptionStatus = parsed.subscription?.status
    ? toSubscriptionStatus(parsed.subscription.status)
    : eventToSubscriptionStatus(eventType)

  const buyerEmailHash = customer.email ? hashEmail(customer.email) : ''
  const buyerPhoneHash = customer.mobile ? hashPhone(customer.mobile) : undefined
  const document = customer.cpf ?? customer.cnpj
  const buyerDocumentHash = document ? hashDocument(document) : undefined
  const affiliateEmailHash = affiliate?.email ? hashEmail(affiliate.email) : undefined

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
      // s2/s3 vao para rawPayload (catch-all). s1 vira externalCode.
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
    feeCents: payment.fee,
    producerNetCents: payment.net_amount ?? parsed.net_amount,
    currency,
    productId: product.id ?? '',
    productName: product.name,
    offerId: undefined, // Kiwify nao tem offer code separado
    subscriberCode,
    subscriptionStatus,
    recurrenceNumber: isRenewal ? 2 : 1, // heuristica — sem campo dedicado
    planId: parsed.subscription?.plan?.id,
    paymentMethod: mapPaymentMethod(parsed.payment_method),
    installmentsNumber: parsed.installments,
    buyerCountry: customer.country,
    buyerEmailHash,
    buyerPhoneHash,
    buyerDocumentHash,
    affiliateEmailHash,
    affiliateSource: affiliate ? 'EXTERNAL' : undefined,
    commissionAffiliateCents: affiliate?.amount,
    attribution,
    allocationIdempotencyKey: orderId || `kiwify-${occurredAtMs}-${eventName}`,
    rawPayload: redactPayload(parsed),
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapKiwifyEvent(eventName: string): NormalizedEventType {
  const map: Record<string, NormalizedEventType> = {
    compra_aprovada: 'PURCHASE_APPROVED',
    compra_recusada: 'PURCHASE_REJECTED',
    compra_reembolsada: 'PURCHASE_REFUNDED',
    chargeback: 'PURCHASE_CHARGEBACK',
    boleto_gerado: 'PURCHASE_BILLET_PRINTED',
    pix_gerado: 'PIX_GENERATED',
    carrinho_abandonado: 'PURCHASE_OUT_OF_SHOPPING_CART',
    subscription_canceled: 'SUBSCRIPTION_CANCELLATION',
    subscription_late: 'SUBSCRIPTION_LATE',
    subscription_renewed: 'SUBSCRIPTION_RENEWED',
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

/** Inferir subscription status a partir do tipo de evento, quando o payload nao traz. */
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

function toEpochMs(raw: string | number | undefined): number {
  if (raw == null) return Date.now()
  if (typeof raw === 'number') return raw > 1e12 ? raw : raw * 1000
  const parsed = Date.parse(raw)
  return Number.isNaN(parsed) ? Date.now() : parsed
}

/** Remove plain PII do payload antes de persistir em `gateway_events.raw_payload`. */
const REDACT_KEYS = new Set([
  'email',
  'cpf',
  'cnpj',
  'mobile',
  'phone',
  'instagram',
  'name',
  'document',
  'street',
  'zipcode',
  'address',
  'complement',
  'number',
  'neighborhood',
  'card_last_digits',
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
