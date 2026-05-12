import { describe, expect, it } from 'vitest'

import { hashEmail } from '@/lib/security/hash'

import { normalizeKiwifyEvent } from './normalizer'
import { parseKiwifyWebhook } from './parser'

/** Fixture do PAYLOAD REAL Kiwify (smoke E2E sandbox 2026-05-10). */
const ORDER_APPROVED_FIXTURE = {
  Product: {
    product_id: 'bfb4b9e3-51b0-428b-ad9d-c40dfa2dbd1e',
    product_name: 'Example product',
  },
  Customer: {
    ip: '101.250.144.154',
    city: 'Balneário Camboriú',
    cnpj: '11122233000144',
    email: 'JOHN@example.com',
    state: 'SC',
    mobile: '+5547999999999',
    full_name: 'John Doe',
  },
  order_id: 'bce29a87-a7c6-4f2e-aff2-7c92ce5a019c',
  created_at: '2026-05-10 11:35',
  approved_date: '2026-05-11 11:35',
  Commissions: {
    currency: 'BRL',
    kiwify_fee: 115,
    charge_amount: 1042,
    my_commission: 927,
    settlement_amount: 1042,
    product_base_price: 1042,
    commissioned_stores: [
      { id: 's1', type: 'producer', email: 'producer@example.com', value: '927' },
      {
        id: 's2',
        type: 'affiliate',
        email: 'affiliate@example.com',
        value: '127',
        affiliate_id: 'mKCBRLb',
      },
    ],
  },
  Subscription: {
    id: '4b4fe990-0ba7-41f8-988e-c545cc4e5e06',
    status: 'active',
    plan: { id: 'plan-uuid', name: 'Plan Test' },
    charges: {
      completed: [{ amount: 927, status: 'paid', order_id: 'bce29a87' }],
    },
  },
  installments: 1,
  order_status: 'paid',
  product_type: 'membership',
  payment_method: 'credit_card',
  subscription_id: '4b4fe990-0ba7-41f8-988e-c545cc4e5e06',
  TrackingParameters: {
    s1: 'visitor-abc-123',
    utm_source: 'facebook',
    utm_campaign: 'lancamento-2026',
  },
  webhook_event_type: 'order_approved',
}

describe('normalizeKiwifyEvent (schema real)', () => {
  it('mapeia campos chave de order_approved', () => {
    const parsed = parseKiwifyWebhook(JSON.stringify(ORDER_APPROVED_FIXTURE))
    const n = normalizeKiwifyEvent(parsed)

    expect(n.provider).toBe('kiwify')
    expect(n.providerEventId).toBe('bce29a87-a7c6-4f2e-aff2-7c92ce5a019c')
    expect(n.eventType).toBe('PURCHASE_APPROVED')
    expect(n.amountCents).toBe(1042)
    expect(n.currency).toBe('BRL')
    expect(n.feeCents).toBe(115)
    expect(n.producerNetCents).toBe(927)
    expect(n.productId).toBe('bfb4b9e3-51b0-428b-ad9d-c40dfa2dbd1e')
    expect(n.productName).toBe('Example product')
    expect(n.paymentMethod).toBe('CREDIT_CARD')
    expect(n.installmentsNumber).toBe(1)
    expect(n.subscriberCode).toBe('4b4fe990-0ba7-41f8-988e-c545cc4e5e06')
    expect(n.subscriptionStatus).toBe('ACTIVE')
    expect(n.planId).toBe('plan-uuid')
  })

  it('hasheia PII inline (Customer)', () => {
    const parsed = parseKiwifyWebhook(JSON.stringify(ORDER_APPROVED_FIXTURE))
    const n = normalizeKiwifyEvent(parsed)

    expect(n.buyerEmailHash).toBe(hashEmail('JOHN@example.com'))
    expect(n.buyerEmailHash).not.toContain('@')
    expect(n.buyerPhoneHash).toMatch(/^[0-9a-f]{64}$/)
    expect(n.buyerDocumentHash).toBeDefined()

    const stringified = JSON.stringify(n.rawPayload)
    expect(stringified).not.toContain('JOHN@example.com')
    expect(stringified).not.toContain('11122233000144')
    expect(stringified).not.toContain('+5547999999999')
    expect(stringified).not.toContain('John Doe')
    expect(stringified).not.toContain('101.250.144.154') // IP redactado
    expect(stringified).toContain('[REDACTED]')
  })

  it('preserva s1 como externalCode (visitor_id)', () => {
    const parsed = parseKiwifyWebhook(JSON.stringify(ORDER_APPROVED_FIXTURE))
    const n = normalizeKiwifyEvent(parsed)
    expect(n.attribution.externalCode).toBe('visitor-abc-123')
    expect(n.attribution.utms?.source).toBe('facebook')
    expect(n.attribution.utms?.campaign).toBe('lancamento-2026')
  })

  it('extrai afiliado de Commissions.commissioned_stores', () => {
    const parsed = parseKiwifyWebhook(JSON.stringify(ORDER_APPROVED_FIXTURE))
    const n = normalizeKiwifyEvent(parsed)
    expect(n.affiliateEmailHash).toBe(hashEmail('affiliate@example.com'))
    expect(n.affiliateSource).toBe('EXTERNAL')
    expect(n.commissionAffiliateCents).toBe(127)
  })

  it('mapeia eventos EN-US (payload webhook real)', () => {
    const cases = [
      { in: 'order_approved', out: 'PURCHASE_APPROVED' },
      { in: 'order_rejected', out: 'PURCHASE_REJECTED' },
      { in: 'order_refunded', out: 'PURCHASE_REFUNDED' },
      { in: 'chargeback', out: 'PURCHASE_CHARGEBACK' },
      { in: 'pix_created', out: 'PIX_GENERATED' },
      { in: 'billet_created', out: 'PURCHASE_BILLET_PRINTED' },
      { in: 'cart_abandoned', out: 'PURCHASE_OUT_OF_SHOPPING_CART' },
      { in: 'subscription_late', out: 'SUBSCRIPTION_LATE' },
      { in: 'subscription_canceled', out: 'SUBSCRIPTION_CANCELLATION' },
      { in: 'subscription_renewed', out: 'SUBSCRIPTION_RENEWED' },
    ]
    for (const c of cases) {
      const parsed = parseKiwifyWebhook(JSON.stringify({ webhook_event_type: c.in, order_id: 'x' }))
      const n = normalizeKiwifyEvent(parsed)
      expect(n.eventType, c.in).toBe(c.out)
    }
  })

  it('mapping bilingual aceita PT-BR (API REST trigger names)', () => {
    const cases = [
      { in: 'compra_aprovada', out: 'PURCHASE_APPROVED' },
      { in: 'compra_reembolsada', out: 'PURCHASE_REFUNDED' },
      { in: 'pix_gerado', out: 'PIX_GENERATED' },
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
    const parsed = parseKiwifyWebhook(JSON.stringify(ORDER_APPROVED_FIXTURE))
    const n = normalizeKiwifyEvent(parsed)
    expect(n.allocationIdempotencyKey).toBe('bce29a87-a7c6-4f2e-aff2-7c92ce5a019c')
  })

  it('aceita CPF no lugar de CNPJ', () => {
    const cpfFixture = {
      ...ORDER_APPROVED_FIXTURE,
      Customer: { ...ORDER_APPROVED_FIXTURE.Customer, cnpj: undefined, cpf: '12345678910' },
    }
    const parsed = parseKiwifyWebhook(JSON.stringify(cpfFixture))
    const n = normalizeKiwifyEvent(parsed)
    expect(n.buyerDocumentHash).toBeDefined()
  })

  it('payment_method PIX vira PIX', () => {
    const fixture = { ...ORDER_APPROVED_FIXTURE, payment_method: 'pix' }
    const parsed = parseKiwifyWebhook(JSON.stringify(fixture))
    const n = normalizeKiwifyEvent(parsed)
    expect(n.paymentMethod).toBe('PIX')
  })

  it('parseV1 date format Kiwify ("YYYY-MM-DD HH:mm")', () => {
    const parsed = parseKiwifyWebhook(JSON.stringify(ORDER_APPROVED_FIXTURE))
    const n = normalizeKiwifyEvent(parsed)
    // 2026-05-10 11:35 UTC
    expect(n.occurredAtMs).toBe(Date.parse('2026-05-10T11:35:00Z'))
  })

  it('cart_abandoned shape (PII top-level + status discriminador)', () => {
    const cartAbandoned = {
      id: 'h31sv0p4i1zsss63fe',
      status: 'abandoned',
      country: 'br',
      store_id: 'HrsEAbEpdyRY8Pw',
      created_at: '2026-05-07T13:03:25.152Z',
      product_id: '77e277f8-8883-4c1c-b6fb-8bbdad61c89f',
      product_name: 'Example product',
      checkout_link: 'RDbNcEX',
      // PII no TOP LEVEL (sem Customer object)
      name: 'John Doe',
      email: 'JOHN@example.com',
      phone: '+5547999999999',
      cnpj: '11122233000144',
    }
    const parsed = parseKiwifyWebhook(JSON.stringify(cartAbandoned))
    const n = normalizeKiwifyEvent(parsed)
    expect(n.eventType).toBe('PURCHASE_OUT_OF_SHOPPING_CART')
    expect(n.providerEventId).toBe('h31sv0p4i1zsss63fe')
    expect(n.productId).toBe('77e277f8-8883-4c1c-b6fb-8bbdad61c89f')
    expect(n.productName).toBe('Example product')
    expect(n.buyerEmailHash).toBe(hashEmail('JOHN@example.com'))
    expect(n.buyerPhoneHash).toMatch(/^[0-9a-f]{64}$/)
    expect(n.buyerDocumentHash).toBeDefined()
    expect(n.buyerCountry).toBe('br')
  })

  it('aceita null em campos opcionais (eventos nao-aprovados)', () => {
    const refused = {
      webhook_event_type: 'order_rejected',
      order_id: 'abc',
      order_status: 'refused',
      installments: null,
      approved_date: null,
      card_type: '',
      card_last4digits: '',
      card_rejection_reason: 'possible_fraud_ip',
      Customer: { email: 'x@y.com', CPF: '12345678910' }, // CPF uppercase!
    }
    const parsed = parseKiwifyWebhook(JSON.stringify(refused))
    const n = normalizeKiwifyEvent(parsed)
    expect(n.eventType).toBe('PURCHASE_REJECTED')
    expect(n.installmentsNumber).toBeUndefined()
    // CPF uppercase deve ser detectado
    expect(n.buyerDocumentHash).toBeDefined()
  })

  it('detecta renovacao via subscription_renewed event', () => {
    const renewal = {
      ...ORDER_APPROVED_FIXTURE,
      webhook_event_type: 'subscription_renewed',
      Subscription: {
        ...ORDER_APPROVED_FIXTURE.Subscription,
        charges: {
          completed: [
            { amount: 927, status: 'paid', order_id: 'first' },
            { amount: 927, status: 'paid', order_id: 'second' },
          ],
        },
      },
    }
    const parsed = parseKiwifyWebhook(JSON.stringify(renewal))
    const n = normalizeKiwifyEvent(parsed)
    expect(n.eventType).toBe('SUBSCRIPTION_RENEWED')
    expect(n.recurrenceNumber).toBe(2)
  })

  it('extrai clientIpAddress/clientUserAgent quando payload inclui (1.4.9 CAPI)', () => {
    const withIp = structuredClone(ORDER_APPROVED_FIXTURE) as Record<string, unknown> & {
      Customer: Record<string, unknown>
    }
    withIp.Customer.ip = '203.0.113.45'
    withIp.Customer.user_agent = 'Mozilla/5.0 (Macintosh)'

    const parsed = parseKiwifyWebhook(JSON.stringify(withIp))
    const n = normalizeKiwifyEvent(parsed)

    expect(n.clientIpAddress).toBe('203.0.113.45')
    expect(n.clientUserAgent).toBe('Mozilla/5.0 (Macintosh)')
  })

  it('clientIpAddress undefined quando payload nao inclui (graceful)', () => {
    const withoutIp = structuredClone(ORDER_APPROVED_FIXTURE) as Record<string, unknown> & {
      Customer: Record<string, unknown>
    }
    delete withoutIp.Customer.ip
    delete withoutIp.Customer.user_agent
    delete withoutIp.Customer.IPCheckout

    const parsed = parseKiwifyWebhook(JSON.stringify(withoutIp))
    const n = normalizeKiwifyEvent(parsed)

    expect(n.clientIpAddress).toBeUndefined()
    expect(n.clientUserAgent).toBeUndefined()
  })
})
