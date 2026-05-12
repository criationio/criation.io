import { hashDocument, hashEmail, hashPhone } from '@/lib/security/hash'

import type {
  NormalizedAttribution,
  NormalizedEventType,
  NormalizedGatewayEvent,
  PaymentMethod,
} from '../types'

import { parseEduzzInvoiceData, type EduzzInvoiceData, type EduzzWebhookEnvelope } from './parser'

/**
 * Normaliza payload Eduzz Webhook v3 para `NormalizedGatewayEvent`.
 *
 * Mapping:
 * - `myeduzz.invoice_*` → invoice events (PURCHASE_APPROVED, REFUNDED, etc)
 * - `myeduzz.contract_*` → subscription events (RENEWED, LATE)
 * - `sun.cart_abandoned` → PURCHASE_OUT_OF_SHOPPING_CART
 * - `ping` → UNKNOWN (filtrado upstream pelo route handler)
 *
 * Detalhes do schema em audit EDUZZ_API_2026-05.md.
 */
export function normalizeEduzzEvent(envelope: EduzzWebhookEnvelope): NormalizedGatewayEvent {
  const eventName = envelope.event
  const data = parseEduzzInvoiceData(envelope.data) ?? ({} as EduzzInvoiceData)
  const eventType = mapEduzzEvent(eventName, data.paymentMethod ?? undefined)

  const occurredAtMs = envelope.sentDate ? Date.parse(envelope.sentDate) : Date.now()
  const occurredAt = new Date(occurredAtMs)

  const buyer = data.buyer ?? {}
  const tracker = data.tracker ?? {}
  const utm = data.utm ?? {}

  // Money: `paid.value` quando pago, `price.value` em outros casos
  const paidValue = data.paid?.value ?? data.price?.value ?? 0
  const amountCents = Math.round((paidValue ?? 0) * 100)
  const currency = data.paid?.currency ?? data.price?.currency ?? 'BRL'

  // Subscription via `contract.id` (Eduzz nao tem evento dedicado de
  // renovacao — heuristica fica no processGatewayEventTask)
  const subscriberCode = data.contract?.id ?? undefined

  // PII hashing inline
  const buyerEmailHash = buyer.email ? hashEmail(buyer.email) : ''
  const phone = buyer.cellphone ?? buyer.phone ?? buyer.phone2
  const buyerPhoneHash = phone ? hashPhone(phone) : undefined
  const buyerDocumentHash = buyer.document ? hashDocument(buyer.document) : undefined
  const affiliateEmailHash = data.affiliate?.email ? hashEmail(data.affiliate.email) : undefined

  const attribution: NormalizedAttribution = {
    utms: {
      source: utm.source ?? undefined,
      medium: utm.medium ?? undefined,
      campaign: utm.campaign ?? undefined,
      content: utm.content ?? undefined,
      term: utm.term ?? undefined,
    },
    origin: {
      // tracker.code2/code3 paralelo ao src/sck do Hotmart
      src: tracker.code2 ?? undefined,
      sck: tracker.code3 ?? undefined,
    },
    // tracker.code1 = visitor_id quando injetado via link de checkout
    externalCode: tracker.code1 ?? undefined,
  }

  const productId = data.items?.[0]?.productId ?? ''
  const productName = data.items?.[0]?.name ?? undefined

  return {
    provider: 'eduzz',
    providerEventId: envelope.id,
    providerEventVersion: '3.0.0',
    eventType,
    occurredAt,
    occurredAtMs,
    amountCents,
    currency,
    productId,
    productName,
    offerId: data.offer?.name ?? undefined,
    subscriberCode,
    recurrenceNumber: subscriberCode ? 1 : undefined, // sem evento dedicado de renovacao
    paymentMethod: mapPaymentMethod(data.paymentMethod ?? undefined),
    installmentsNumber: data.installments ?? undefined,
    buyerCountry: buyer.address?.country ?? undefined,
    buyerEmailHash,
    buyerPhoneHash,
    buyerDocumentHash,
    // Plain IP/UA pra Meta CAPI EMQ (1.4.9). Eduzz inclui buyer.ip em
    // alguns webhooks — best-effort. Undefined quando ausente.
    clientIpAddress: (buyer as Record<string, unknown>).ip as string | undefined,
    clientUserAgent: (buyer as Record<string, unknown>).user_agent as string | undefined,
    affiliateEmailHash,
    affiliateSource: data.affiliate ? 'EXTERNAL' : undefined,
    attribution,
    allocationIdempotencyKey: envelope.id,
    rawPayload: redactPayload(envelope),
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Mapping Eduzz event name → NormalizedEventType.
 *
 * `invoice_waiting_payment` desambigua via paymentMethod (PIX vs boleto).
 */
function mapEduzzEvent(eventName: string, paymentMethod?: string | null): NormalizedEventType {
  // Invoice events (confirmados via smoke real 2026-05-10)
  const invoiceMap: Record<string, NormalizedEventType> = {
    'myeduzz.invoice_paid': 'PURCHASE_APPROVED',
    'myeduzz.invoice_refused': 'PURCHASE_REJECTED',
    'myeduzz.invoice_refunded': 'PURCHASE_REFUNDED',
    'myeduzz.invoice_canceled': 'PURCHASE_CANCELED',
    'myeduzz.invoice_expired': 'PURCHASE_EXPIRED',
    'myeduzz.invoice_overdue': 'PURCHASE_DELAYED',
    'myeduzz.invoice_waiting_refund': 'PURCHASE_REFUND_REQUESTED',
    // Descoberto via smoke: chargeback e evento de invoice (nao contract)
    'myeduzz.invoice_chargeback': 'PURCHASE_CHARGEBACK',
  }
  if (invoiceMap[eventName]) return invoiceMap[eventName]

  // invoice_waiting_payment desambigua por paymentMethod
  if (eventName === 'myeduzz.invoice_waiting_payment') {
    const pm = (paymentMethod ?? '').toLowerCase()
    if (pm.includes('pix')) return 'PIX_GENERATED'
    return 'PURCHASE_BILLET_PRINTED'
  }

  // Subscription/contract events: TODAS as variantes contract_*_attempted
  // (card, bankslip, pix, eduzz_balance) indicam tentativa de cobranca
  // recorrente — todas viram SUBSCRIPTION_LATE quando falham.
  if (eventName.startsWith('myeduzz.contract_') && eventName.endsWith('_attempted')) {
    return 'SUBSCRIPTION_LATE'
  }

  // Sun cart abandoned — nome real confirmado via smoke
  if (eventName === 'sun.cart_abandonment') {
    return 'PURCHASE_OUT_OF_SHOPPING_CART'
  }

  return 'UNKNOWN'
}

function mapPaymentMethod(raw: string | undefined): PaymentMethod | undefined {
  if (!raw) return undefined
  const lower = raw.toLowerCase()
  if (lower.includes('credit') || lower.includes('card')) return 'CREDIT_CARD'
  if (lower === 'pix') return 'PIX'
  if (lower.includes('boleto') || lower.includes('billet') || lower.includes('bank_slip'))
    return 'BILLET'
  if (lower.includes('paypal')) return 'PAYPAL'
  return 'OTHER'
}

const REDACT_KEYS = new Set([
  'email',
  'document',
  'phone',
  'phone2',
  'cellphone',
  'name',
  'street',
  'zipCode',
  'address',
  'complement',
  'number',
  'neighborhood',
  'city',
  'state',
  'originSecret',
])

function redactPayload(envelope: EduzzWebhookEnvelope): Record<string, unknown> {
  const cloned = structuredClone(envelope) as unknown as Record<string, unknown>
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
