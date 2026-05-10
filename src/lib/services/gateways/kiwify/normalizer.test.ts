import { describe, expect, it } from 'vitest'

import { hashEmail } from '@/lib/security/hash'

import { normalizeKiwifyEvent } from './normalizer'
import { parseKiwifyWebhook } from './parser'

const COMPRA_APROVADA_FIXTURE = {
  webhook_event_type: 'compra_aprovada',
  order_id: 'fc96cec5-1ff1-49b3-aa22-0e131f353b62',
  reference: 'iYJwhMP',
  type: 'product',
  created_at: '2023-10-31T16:34:35.491Z',
  approved_date: '2023-10-31T16:34:35.491Z',
  status: 'paid',
  payment_method: 'credit_card',
  net_amount: 8853,
  currency: 'BRL',
  installments: 12,
  product: { id: 'aaa86f40-d7ae-11ed', name: 'Curso Teste' },
  customer: {
    name: 'Comprador Teste',
    email: 'BUYER@example.com',
    cpf: '123.456.789-10',
    mobile: '+5511987654321',
    country: 'BR',
    address: { street: 'Rua A', city: 'SP', zipcode: '01000-000' },
  },
  payment: {
    charge_amount: 10388,
    charge_currency: 'BRL',
    net_amount: 8853,
    fee: 984,
  },
  tracking: {
    src: 'fb_ads',
    sck: 'campanha-x',
    s1: 'visitor-abc-123',
    utm_source: 'facebook',
    utm_campaign: 'lancamento-2026',
  },
  affiliate_commission: {
    name: 'Afiliado Teste',
    email: 'affiliate@example.com',
    amount: 2849,
  },
}

describe('normalizeKiwifyEvent', () => {
  it('mapeia campos chave de compra_aprovada', () => {
    const parsed = parseKiwifyWebhook(JSON.stringify(COMPRA_APROVADA_FIXTURE))
    const n = normalizeKiwifyEvent(parsed)

    expect(n.provider).toBe('kiwify')
    expect(n.providerEventId).toBe('fc96cec5-1ff1-49b3-aa22-0e131f353b62')
    expect(n.eventType).toBe('PURCHASE_APPROVED')
    expect(n.amountCents).toBe(10388)
    expect(n.currency).toBe('BRL')
    expect(n.feeCents).toBe(984)
    expect(n.producerNetCents).toBe(8853)
    expect(n.productId).toBe('aaa86f40-d7ae-11ed')
    expect(n.productName).toBe('Curso Teste')
    expect(n.paymentMethod).toBe('CREDIT_CARD')
    expect(n.installmentsNumber).toBe(12)
    expect(n.buyerCountry).toBe('BR')
  })

  it('hasheia PII inline (email/phone/document)', () => {
    const parsed = parseKiwifyWebhook(JSON.stringify(COMPRA_APROVADA_FIXTURE))
    const n = normalizeKiwifyEvent(parsed)

    expect(n.buyerEmailHash).toBe(hashEmail('BUYER@example.com'))
    expect(n.buyerEmailHash).not.toContain('@')
    expect(n.buyerPhoneHash).toMatch(/^[0-9a-f]{64}$/)
    expect(n.buyerDocumentHash).toBeDefined()

    const stringified = JSON.stringify(n.rawPayload)
    expect(stringified).not.toContain('BUYER@example.com')
    expect(stringified).not.toContain('123.456.789-10')
    expect(stringified).not.toContain('+5511987654321')
    expect(stringified).toContain('[REDACTED]')
  })

  it('preserva s1 como externalCode (visitor_id)', () => {
    const parsed = parseKiwifyWebhook(JSON.stringify(COMPRA_APROVADA_FIXTURE))
    const n = normalizeKiwifyEvent(parsed)
    expect(n.attribution.externalCode).toBe('visitor-abc-123')
    expect(n.attribution.utms?.source).toBe('facebook')
    expect(n.attribution.origin?.src).toBe('fb_ads')
  })

  it('detecta renovacao via parent_order_id', () => {
    const renewal = JSON.stringify({
      webhook_event_type: 'subscription_renewed',
      order_id: 'renewal-uuid',
      parent_order_id: 'original-sale-uuid',
      type: 'subscription',
      payment: { charge_amount: 4990, charge_currency: 'BRL' },
      subscription: { status: 'ACTIVE' },
    })
    const parsed = parseKiwifyWebhook(renewal)
    const n = normalizeKiwifyEvent(parsed)
    expect(n.eventType).toBe('SUBSCRIPTION_RENEWED')
    expect(n.subscriberCode).toBe('original-sale-uuid')
    expect(n.recurrenceNumber).toBe(2)
    expect(n.subscriptionStatus).toBe('ACTIVE')
  })

  it('mapeia eventos exoticos', () => {
    const cases = [
      { in: 'compra_recusada', out: 'PURCHASE_REJECTED' },
      { in: 'compra_reembolsada', out: 'PURCHASE_REFUNDED' },
      { in: 'chargeback', out: 'PURCHASE_CHARGEBACK' },
      { in: 'pix_gerado', out: 'PIX_GENERATED' },
      { in: 'boleto_gerado', out: 'PURCHASE_BILLET_PRINTED' },
      { in: 'carrinho_abandonado', out: 'PURCHASE_OUT_OF_SHOPPING_CART' },
      { in: 'subscription_late', out: 'SUBSCRIPTION_LATE' },
      { in: 'subscription_canceled', out: 'SUBSCRIPTION_CANCELLATION' },
    ]
    for (const c of cases) {
      const parsed = parseKiwifyWebhook(JSON.stringify({ webhook_event_type: c.in, order_id: 'x' }))
      const n = normalizeKiwifyEvent(parsed)
      expect(n.eventType, c.in).toBe(c.out)
    }
  })

  it('UNKNOWN para evento nao mapeado', () => {
    const parsed = parseKiwifyWebhook(
      JSON.stringify({ webhook_event_type: 'evento_novo_da_kiwify', order_id: 'x' })
    )
    const n = normalizeKiwifyEvent(parsed)
    expect(n.eventType).toBe('UNKNOWN')
  })

  it('idempotencyKey == order_id', () => {
    const parsed = parseKiwifyWebhook(JSON.stringify(COMPRA_APROVADA_FIXTURE))
    const n = normalizeKiwifyEvent(parsed)
    expect(n.allocationIdempotencyKey).toBe('fc96cec5-1ff1-49b3-aa22-0e131f353b62')
  })

  it('aceita CNPJ no lugar de CPF', () => {
    const cnpjFixture = {
      ...COMPRA_APROVADA_FIXTURE,
      customer: { ...COMPRA_APROVADA_FIXTURE.customer, cpf: undefined, cnpj: '12.345.678/0001-90' },
    }
    const parsed = parseKiwifyWebhook(JSON.stringify(cnpjFixture))
    const n = normalizeKiwifyEvent(parsed)
    expect(n.buyerDocumentHash).toBeDefined()
    expect(n.buyerDocumentHash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('payment_method PIX vira PIX', () => {
    const fixture = { ...COMPRA_APROVADA_FIXTURE, payment_method: 'pix' }
    const parsed = parseKiwifyWebhook(JSON.stringify(fixture))
    const n = normalizeKiwifyEvent(parsed)
    expect(n.paymentMethod).toBe('PIX')
  })
})
