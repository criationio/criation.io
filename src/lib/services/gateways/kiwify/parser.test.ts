import { describe, expect, it } from 'vitest'

import { parseKiwifyWebhook } from './parser'

describe('parseKiwifyWebhook', () => {
  it('parseia compra_aprovada minimo', () => {
    const body = JSON.stringify({
      webhook_event_type: 'compra_aprovada',
      order_id: 'fc96cec5-1ff1-49b3-aa22-0e131f353b62',
      status: 'paid',
      payment_method: 'credit_card',
      net_amount: 8853,
      currency: 'BRL',
      customer: { email: 'test@example.com' },
      product: { id: 'aaa86f40-d7ae-...', name: 'My Product' },
    })
    const parsed = parseKiwifyWebhook(body)
    expect(parsed.webhook_event_type).toBe('compra_aprovada')
    expect(parsed.order_id).toBe('fc96cec5-1ff1-49b3-aa22-0e131f353b62')
    expect(parsed.product?.name).toBe('My Product')
  })

  it('aceita campos extras (passthrough)', () => {
    const body = JSON.stringify({
      webhook_event_type: 'compra_aprovada',
      order_id: 'x',
      future_field_we_dont_know: 'preserved',
      nested: { also: 'preserved' },
    })
    expect(() => parseKiwifyWebhook(body)).not.toThrow()
  })

  it('parseia subscription_renewed com parent_order_id', () => {
    const body = JSON.stringify({
      webhook_event_type: 'subscription_renewed',
      order_id: 'renewal-uuid',
      parent_order_id: 'original-sale-uuid',
      type: 'subscription',
      status: 'paid',
      payment: { charge_amount: 4990, charge_currency: 'BRL' },
      subscription: { status: 'ACTIVE', plan: { id: 'plan-uuid' } },
    })
    const parsed = parseKiwifyWebhook(body)
    expect(parsed.parent_order_id).toBe('original-sale-uuid')
    expect(parsed.subscription?.plan?.id).toBe('plan-uuid')
  })

  it('parseia tracking com s1/s2/s3', () => {
    const body = JSON.stringify({
      webhook_event_type: 'compra_aprovada',
      order_id: 'x',
      tracking: { s1: 'visitor-abc-123', utm_source: 'fb', utm_campaign: 'cmp1' },
    })
    const parsed = parseKiwifyWebhook(body)
    expect(parsed.tracking?.s1).toBe('visitor-abc-123')
    expect(parsed.tracking?.utm_source).toBe('fb')
  })

  it('aceita datas em ISO ou ms epoch (union)', () => {
    const iso = parseKiwifyWebhook(JSON.stringify({ created_at: '2024-01-01T00:00:00Z' }))
    const epoch = parseKiwifyWebhook(JSON.stringify({ created_at: 1704067200000 }))
    expect(iso.created_at).toBe('2024-01-01T00:00:00Z')
    expect(epoch.created_at).toBe(1704067200000)
  })
})
