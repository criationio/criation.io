import { describe, expect, it } from 'vitest'

import { hashEmail } from '@/lib/security/hash'

import { normalizeEduzzEvent } from './normalizer'
import { parseEduzzWebhook } from './parser'

const INVOICE_PAID_FIXTURE = {
  id: 'z154l2pvk6jltotg0xy86glx',
  event: 'myeduzz.invoice_paid',
  sentDate: '2026-05-10T18:34:23.023Z',
  data: {
    id: 'invoice-uuid',
    status: 'paid',
    buyer: {
      id: 'buyer-uuid',
      name: 'John Doe',
      email: 'JOHN@example.com',
      document: '12345678910',
      cellphone: '+5511987654321',
      address: { country: 'BR', city: 'SP', state: 'SP' },
    },
    producer: { id: 'p1', name: 'Producer', email: 'p@x.com', originSecret: 'redact-me' },
    offer: { name: 'Curso Teste' },
    utm: { source: 'facebook', campaign: 'lancamento-2026', medium: 'cpc' },
    tracker: { code1: 'visitor-abc-123', code2: null, code3: null },
    paid: { currency: 'BRL', value: 49.9 },
    price: { currency: 'BRL', value: 49.9 },
    installments: 12,
    paymentMethod: 'credit_card',
    items: [{ productId: 'prod-uuid', name: 'Curso Teste' }],
    contract: { id: 'contract-uuid' },
    affiliate: { id: 'aff-1', name: 'Aff Name', email: 'affiliate@example.com' },
  },
}

describe('normalizeEduzzEvent', () => {
  it('mapeia campos chave de myeduzz.invoice_paid', () => {
    const parsed = parseEduzzWebhook(JSON.stringify(INVOICE_PAID_FIXTURE))
    const n = normalizeEduzzEvent(parsed)

    expect(n.provider).toBe('eduzz')
    expect(n.providerEventId).toBe('z154l2pvk6jltotg0xy86glx')
    expect(n.providerEventVersion).toBe('3.0.0')
    expect(n.eventType).toBe('PURCHASE_APPROVED')
    expect(n.amountCents).toBe(4990)
    expect(n.currency).toBe('BRL')
    expect(n.productId).toBe('prod-uuid')
    expect(n.productName).toBe('Curso Teste')
    expect(n.offerId).toBe('Curso Teste')
    expect(n.installmentsNumber).toBe(12)
    expect(n.paymentMethod).toBe('CREDIT_CARD')
    expect(n.subscriberCode).toBe('contract-uuid')
    expect(n.buyerCountry).toBe('BR')
  })

  it('hasheia PII inline (Customer + redact originSecret)', () => {
    const parsed = parseEduzzWebhook(JSON.stringify(INVOICE_PAID_FIXTURE))
    const n = normalizeEduzzEvent(parsed)

    expect(n.buyerEmailHash).toBe(hashEmail('JOHN@example.com'))
    expect(n.buyerEmailHash).not.toContain('@')
    expect(n.buyerPhoneHash).toMatch(/^[0-9a-f]{64}$/)
    expect(n.buyerDocumentHash).toBeDefined()
    expect(n.affiliateEmailHash).toBe(hashEmail('affiliate@example.com'))

    const stringified = JSON.stringify(n.rawPayload)
    expect(stringified).not.toContain('JOHN@example.com')
    expect(stringified).not.toContain('12345678910')
    expect(stringified).not.toContain('+5511987654321')
    expect(stringified).not.toContain('John Doe')
    expect(stringified).not.toContain('redact-me') // originSecret redacted
    expect(stringified).toContain('[REDACTED]')
  })

  it('preserva tracker.code1 como externalCode (visitor_id)', () => {
    const parsed = parseEduzzWebhook(JSON.stringify(INVOICE_PAID_FIXTURE))
    const n = normalizeEduzzEvent(parsed)
    expect(n.attribution.externalCode).toBe('visitor-abc-123')
    expect(n.attribution.utms?.source).toBe('facebook')
    expect(n.attribution.utms?.campaign).toBe('lancamento-2026')
  })

  it('mapeia eventos invoice_* + contract_*_attempted + sun.cart_abandonment', () => {
    const cases = [
      // Invoice
      { event: 'myeduzz.invoice_paid', out: 'PURCHASE_APPROVED' },
      { event: 'myeduzz.invoice_refused', out: 'PURCHASE_REJECTED' },
      { event: 'myeduzz.invoice_refunded', out: 'PURCHASE_REFUNDED' },
      { event: 'myeduzz.invoice_canceled', out: 'PURCHASE_CANCELED' },
      { event: 'myeduzz.invoice_expired', out: 'PURCHASE_EXPIRED' },
      { event: 'myeduzz.invoice_overdue', out: 'PURCHASE_DELAYED' },
      { event: 'myeduzz.invoice_waiting_refund', out: 'PURCHASE_REFUND_REQUESTED' },
      // Descoberto via smoke E2E 2026-05-10
      { event: 'myeduzz.invoice_chargeback', out: 'PURCHASE_CHARGEBACK' },
      // Todas variantes contract_*_attempted -> SUBSCRIPTION_LATE
      { event: 'myeduzz.contract_card_attempted', out: 'SUBSCRIPTION_LATE' },
      { event: 'myeduzz.contract_bankslip_attempted', out: 'SUBSCRIPTION_LATE' },
      { event: 'myeduzz.contract_pix_attempted', out: 'SUBSCRIPTION_LATE' },
      { event: 'myeduzz.contract_eduzz_balance_attempted', out: 'SUBSCRIPTION_LATE' },
      // Sun cart — nome real confirmado via smoke
      { event: 'sun.cart_abandonment', out: 'PURCHASE_OUT_OF_SHOPPING_CART' },
    ]
    for (const c of cases) {
      const parsed = parseEduzzWebhook(
        JSON.stringify({
          id: 'x',
          event: c.event,
          sentDate: '2026-05-10T00:00:00Z',
          data: {},
        })
      )
      const n = normalizeEduzzEvent(parsed)
      expect(n.eventType, c.event).toBe(c.out)
    }
  })

  it('invoice_waiting_payment desambigua via paymentMethod', () => {
    const pix = {
      id: 'x',
      event: 'myeduzz.invoice_waiting_payment',
      sentDate: '2026-05-10T00:00:00Z',
      data: { paymentMethod: 'pix' },
    }
    const boleto = {
      ...pix,
      data: { paymentMethod: 'bank_slip' },
    }
    const credit = {
      ...pix,
      data: { paymentMethod: 'credit_card' },
    }
    expect(normalizeEduzzEvent(parseEduzzWebhook(JSON.stringify(pix))).eventType).toBe(
      'PIX_GENERATED'
    )
    expect(normalizeEduzzEvent(parseEduzzWebhook(JSON.stringify(boleto))).eventType).toBe(
      'PURCHASE_BILLET_PRINTED'
    )
    // Credit card como default fallback
    expect(normalizeEduzzEvent(parseEduzzWebhook(JSON.stringify(credit))).eventType).toBe(
      'PURCHASE_BILLET_PRINTED'
    )
  })

  it('UNKNOWN para eventos nao mapeados (alpaclass, nutror, etc)', () => {
    const parsed = parseEduzzWebhook(
      JSON.stringify({
        id: 'x',
        event: 'nutror.lesson_started',
        sentDate: '2026-05-10T00:00:00Z',
        data: {},
      })
    )
    const n = normalizeEduzzEvent(parsed)
    expect(n.eventType).toBe('UNKNOWN')
  })

  it('idempotencyKey == envelope.id', () => {
    const parsed = parseEduzzWebhook(JSON.stringify(INVOICE_PAID_FIXTURE))
    const n = normalizeEduzzEvent(parsed)
    expect(n.allocationIdempotencyKey).toBe('z154l2pvk6jltotg0xy86glx')
  })

  it('aceita data null/vazio (eventos sem data util)', () => {
    const parsed = parseEduzzWebhook(
      JSON.stringify({ id: 'x', event: 'ping', sentDate: '2026-05-10T00:00:00Z' })
    )
    const n = normalizeEduzzEvent(parsed)
    expect(n.eventType).toBe('UNKNOWN')
    expect(n.amountCents).toBe(0)
  })

  it('extrai clientIpAddress/clientUserAgent quando payload inclui (1.4.9 CAPI)', () => {
    const withIp = structuredClone(INVOICE_PAID_FIXTURE) as Record<string, unknown> & {
      data: { buyer: Record<string, unknown> }
    }
    withIp.data.buyer.ip = '203.0.113.45'
    withIp.data.buyer.user_agent = 'Mozilla/5.0 (Macintosh)'

    const parsed = parseEduzzWebhook(JSON.stringify(withIp))
    const n = normalizeEduzzEvent(parsed)

    expect(n.clientIpAddress).toBe('203.0.113.45')
    expect(n.clientUserAgent).toBe('Mozilla/5.0 (Macintosh)')
  })

  it('clientIpAddress undefined quando payload nao inclui (graceful)', () => {
    const parsed = parseEduzzWebhook(JSON.stringify(INVOICE_PAID_FIXTURE))
    const n = normalizeEduzzEvent(parsed)

    expect(n.clientIpAddress).toBeUndefined()
    expect(n.clientUserAgent).toBeUndefined()
  })
})
