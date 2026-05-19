import { describe, expect, it } from 'vitest'

import { parseKiwifyWebhook } from './parser'

/**
 * Fixture do PAYLOAD REAL Kiwify (smoke E2E em sandbox 2026-05-10).
 * Confirma schema PascalCase + nomes em ingles.
 */
const REAL_PAYLOAD_FIXTURE = {
  Product: {
    product_id: 'bfb4b9e3-51b0-428b-ad9d-c40dfa2dbd1e',
    product_name: 'Example product',
  },
  Customer: {
    ip: '101.250.144.154',
    city: 'Balneário Camboriú',
    cnpj: '11122233000144',
    email: 'john@example.com',
    state: 'SC',
    mobile: '+5547999999999',
    full_name: 'John Doe',
    first_name: 'John',
  },
  order_id: 'bce29a87-a7c6-4f2e-aff2-7c92ce5a019c',
  order_ref: 'gAdLrDl',
  sale_type: 'producer',
  store_id: 'FeT4phfzL5O9cte',
  card_type: 'mastercard',
  created_at: '2026-05-10 11:35',
  updated_at: '2026-05-10 11:35',
  approved_date: '2026-05-11 11:35',
  Commissions: {
    currency: 'BRL',
    kiwify_fee: 115,
    charge_amount: 1042,
    my_commission: 927,
    settlement_amount: 1042,
    product_base_price: 1042,
    sale_tax_rate: 0,
    sale_tax_amount: 0,
    commissioned_stores: [
      { id: 'store-1', type: 'producer', email: 'producer@example.com', value: '927' },
      {
        id: 'store-2',
        type: 'affiliate',
        email: 'affiliate@example.com',
        value: '927',
        affiliate_id: 'mKCBRLb',
      },
    ],
  },
  Subscription: {
    id: '4b4fe990-0ba7-41f8-988e-c545cc4e5e06',
    status: 'active',
    start_date: '2026-05-07T11:35:13.617Z',
    next_payment: '2026-05-14T11:35:13.617Z',
    plan: {
      id: '54aedb00-a996-4282-9e0f-c6d2b52e2a87',
      name: 'Plan Test',
      frequency: 'weekly',
      qty_charges: 0,
    },
    charges: {
      future: [{ charge_date: '2026-05-14T11:35:13.617Z' }],
      completed: [
        {
          amount: 927,
          status: 'paid',
          order_id: 'bce29a87-a7c6-4f2e-aff2-7c92ce5a019c',
          card_type: 'mastercard',
          created_at: '2026-05-07T11:35:13.617Z',
          installments: 1,
        },
      ],
    },
  },
  installments: 1,
  order_status: 'paid',
  product_type: 'membership',
  payment_method: 'credit_card',
  subscription_id: '4b4fe990-0ba7-41f8-988e-c545cc4e5e06',
  card_last4digits: '9680',
  TrackingParameters: {
    s1: null,
    s2: null,
    s3: null,
    sck: null,
    src: null,
    utm_term: null,
    utm_medium: null,
    utm_source: null,
    utm_content: null,
    utm_campaign: null,
  },
  webhook_event_type: 'order_approved',
  payment_merchant_id: 88264052,
}

describe('parseKiwifyWebhook (schema PascalCase real)', () => {
  it('parseia payload completo de order_approved', () => {
    const parsed = parseKiwifyWebhook(JSON.stringify(REAL_PAYLOAD_FIXTURE))
    expect(parsed.webhook_event_type).toBe('order_approved')
    expect(parsed.order_id).toBe('bce29a87-a7c6-4f2e-aff2-7c92ce5a019c')
    expect(parsed.Product?.product_id).toBe('bfb4b9e3-51b0-428b-ad9d-c40dfa2dbd1e')
    expect(parsed.Customer?.full_name).toBe('John Doe')
    expect(parsed.Commissions?.charge_amount).toBe(1042)
    expect(parsed.Commissions?.kiwify_fee).toBe(115)
    expect(parsed.Subscription?.id).toBe('4b4fe990-0ba7-41f8-988e-c545cc4e5e06')
    expect(parsed.Subscription?.plan?.frequency).toBe('weekly')
  })

  it('aceita campos extras (passthrough)', () => {
    const body = JSON.stringify({
      ...REAL_PAYLOAD_FIXTURE,
      future_field_we_dont_know: 'preserved',
      Customer: { ...REAL_PAYLOAD_FIXTURE.Customer, new_pii_field: 'val' },
    })
    expect(() => parseKiwifyWebhook(body)).not.toThrow()
  })

  it('parseia commissioned_stores array', () => {
    const parsed = parseKiwifyWebhook(JSON.stringify(REAL_PAYLOAD_FIXTURE))
    const stores = parsed.Commissions?.commissioned_stores
    expect(stores).toHaveLength(2)
    expect(stores?.[0]?.type).toBe('producer')
    expect(stores?.[1]?.type).toBe('affiliate')
    expect(stores?.[1]?.affiliate_id).toBe('mKCBRLb')
  })

  it('payload minimo (so order_approved + order_id)', () => {
    const minimal = JSON.stringify({
      webhook_event_type: 'order_approved',
      order_id: 'minimal-uuid',
    })
    const parsed = parseKiwifyWebhook(minimal)
    expect(parsed.webhook_event_type).toBe('order_approved')
    expect(parsed.Customer).toBeUndefined()
  })

  it('aceita TrackingParameters com nulls explicitos', () => {
    const parsed = parseKiwifyWebhook(JSON.stringify(REAL_PAYLOAD_FIXTURE))
    expect(parsed.TrackingParameters?.s1).toBeNull()
    expect(parsed.TrackingParameters?.utm_source).toBeNull()
  })
})
