// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/env', () => ({
  env: { ASAAS_WEBHOOK_SECRET: 'whsec_test', ASAAS_API_KEY: 'key', ASAAS_BASE_URL: undefined },
}))
vi.mock('@/lib/logger', () => ({ billingLogger: { error: vi.fn(), info: vi.fn() } }))

import { asaasAdapter } from './asaas.adapter'

function wh(payload: unknown): string {
  return JSON.stringify(payload)
}

describe('asaasAdapter.parseEvent', () => {
  it('pagamento de assinatura → invoice_paid (workspace/plan do externalReference)', () => {
    const e = asaasAdapter.parseEvent(
      wh({
        id: 'evt_1',
        event: 'PAYMENT_RECEIVED',
        payment: {
          id: 'pay_1',
          customer: 'cus_1',
          subscription: 'sub_1',
          value: 497,
          externalReference: 'ws-123|advanced',
          billingType: 'CREDIT_CARD',
          status: 'RECEIVED',
        },
      })
    )
    expect(e.type).toBe('invoice_paid')
    expect(e.workspaceId).toBe('ws-123')
    expect(e.planId).toBe('advanced')
    expect(e.packSku).toBeNull()
    expect(e.amountCents).toBe(49700)
    expect(e.providerSubscriptionId).toBe('sub_1')
    expect(e.externalEventId).toBe('evt_1')
    expect(e.paymentId).toBe('pay_1')
  })

  it('pagamento avulso (sem subscription) → pack_purchased', () => {
    const e = asaasAdapter.parseEvent(
      wh({
        id: 'evt_2',
        event: 'PAYMENT_CONFIRMED',
        payment: {
          id: 'pay_2',
          customer: 'cus_1',
          value: 399,
          externalReference: 'ws-123|pack:pack_300',
          status: 'CONFIRMED',
        },
      })
    )
    expect(e.type).toBe('pack_purchased')
    expect(e.workspaceId).toBe('ws-123')
    expect(e.packSku).toBe('pack_300')
    expect(e.planId).toBeNull()
    expect(e.amountCents).toBe(39900)
  })

  it('estorno → charge_refunded', () => {
    const e = asaasAdapter.parseEvent(
      wh({ id: 'evt_3', event: 'PAYMENT_REFUNDED', payment: { id: 'pay_1', value: 497 } })
    )
    expect(e.type).toBe('charge_refunded')
    expect(e.paymentId).toBe('pay_1')
  })

  it('evento não tratado → ignored', () => {
    const e = asaasAdapter.parseEvent(
      wh({ id: 'evt_4', event: 'PAYMENT_CREATED', payment: { id: 'p' } })
    )
    expect(e.type).toBe('ignored')
  })

  it('externalEventId cai pro id do pagamento quando sem id de evento', () => {
    const e = asaasAdapter.parseEvent(wh({ event: 'PAYMENT_RECEIVED', payment: { id: 'pay_9' } }))
    expect(e.externalEventId).toBe('PAYMENT_RECEIVED_pay_9')
  })
})

describe('asaasAdapter.validateWebhook', () => {
  it('true quando asaas-access-token bate', () => {
    const ok = asaasAdapter.validateWebhook(
      '{}',
      new Headers({ 'asaas-access-token': 'whsec_test' })
    )
    expect(ok).toBe(true)
  })
  it('false quando token erra (fail closed)', () => {
    expect(asaasAdapter.validateWebhook('{}', new Headers({ 'asaas-access-token': 'x' }))).toBe(
      false
    )
  })
  it('false quando header ausente', () => {
    expect(asaasAdapter.validateWebhook('{}', new Headers())).toBe(false)
  })
})
