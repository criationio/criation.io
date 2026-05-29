// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db/queries/billing', () => ({
  getCreditPackageBySku: vi.fn(),
  markSubscriptionCanceled: vi.fn(),
  setWorkspacePlan: vi.fn(),
  upsertSubscription: vi.fn(),
}))
vi.mock('@/lib/db/queries/credits', () => ({ getTransactionByIdempotencyKey: vi.fn() }))
vi.mock('@/lib/services/credit.service', () => ({ allocate: vi.fn(), refund: vi.fn() }))
vi.mock('@/lib/logger', () => ({
  billingLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import {
  getCreditPackageBySku,
  markSubscriptionCanceled,
  setWorkspacePlan,
  upsertSubscription,
} from '@/lib/db/queries/billing'
import { getTransactionByIdempotencyKey } from '@/lib/db/queries/credits'
import { allocate, refund } from '@/lib/services/credit.service'
import { applyBillingEvent } from './apply-event'
import type { BillingEvent } from './types'

const allocateMock = allocate as unknown as ReturnType<typeof vi.fn>
const refundMock = refund as unknown as ReturnType<typeof vi.fn>
const upsertSubMock = upsertSubscription as unknown as ReturnType<typeof vi.fn>
const setPlanMock = setWorkspacePlan as unknown as ReturnType<typeof vi.fn>
const getPackMock = getCreditPackageBySku as unknown as ReturnType<typeof vi.fn>
const getTxMock = getTransactionByIdempotencyKey as unknown as ReturnType<typeof vi.fn>
const cancelMock = markSubscriptionCanceled as unknown as ReturnType<typeof vi.fn>

function ev(partial: Partial<BillingEvent>): BillingEvent {
  return {
    provider: 'asaas',
    type: 'ignored',
    externalEventId: 'evt_1',
    workspaceId: 'ws-1',
    planId: null,
    packSku: null,
    amountCents: null,
    currency: 'BRL',
    providerCustomerId: null,
    providerSubscriptionId: null,
    invoiceId: null,
    paymentId: null,
    cycleEndsAt: null,
    ...partial,
  }
}

beforeEach(() => vi.clearAllMocks())

describe('applyBillingEvent', () => {
  it('invoice_paid → upsert sub + set plan + allocate subscription (créditos do catálogo)', async () => {
    const r = await applyBillingEvent(
      ev({
        type: 'invoice_paid',
        planId: 'advanced',
        invoiceId: 'pay_1',
        providerSubscriptionId: 'sub_1',
      })
    )
    expect(r.ok).toBe(true)
    expect(upsertSubMock).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'ws-1',
        planId: 'advanced',
        creditsPerCycle: 300,
        status: 'active',
      })
    )
    expect(setPlanMock).toHaveBeenCalledWith('ws-1', 'advanced')
    expect(allocateMock).toHaveBeenCalledWith('ws-1', 300, 'subscription', expect.any(Date), {
      idempotencyKey: 'sub_pay_1',
    })
  })

  it('invoice_paid sem plano resolvível → erro, não aloca', async () => {
    const r = await applyBillingEvent(ev({ type: 'invoice_paid', planId: 'inexistente' }))
    expect(r.ok).toBe(false)
    expect(allocateMock).not.toHaveBeenCalled()
  })

  it('pack_purchased → allocate pack com validade do pacote', async () => {
    getPackMock.mockResolvedValue({ sku: 'pack_300', credits: 300, validityDays: 60 })
    const r = await applyBillingEvent(
      ev({ type: 'pack_purchased', packSku: 'pack_300', paymentId: 'pay_9' })
    )
    expect(r.ok).toBe(true)
    expect(allocateMock).toHaveBeenCalledWith('ws-1', 300, 'pack', expect.any(Date), {
      idempotencyKey: 'pack_pay_9',
    })
  })

  it('charge_refunded → acha alocação original e estorna', async () => {
    getTxMock.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'tx_1', amount: 300 })
    const r = await applyBillingEvent(ev({ type: 'charge_refunded', paymentId: 'pay_1' }))
    expect(r.ok).toBe(true)
    expect(refundMock).toHaveBeenCalledWith('ws-1', 'tx_1', expect.stringContaining('refund'))
  })

  it('charge_refunded sem alocação original → no-op (não estorna)', async () => {
    getTxMock.mockResolvedValue(null)
    const r = await applyBillingEvent(ev({ type: 'charge_refunded', paymentId: 'pay_x' }))
    expect(r.ok).toBe(true)
    expect(refundMock).not.toHaveBeenCalled()
  })

  it('subscription_canceled → marca cancelado, NÃO estorna créditos', async () => {
    const r = await applyBillingEvent(
      ev({ type: 'subscription_canceled', providerSubscriptionId: 'sub_1' })
    )
    expect(r.ok).toBe(true)
    expect(cancelMock).toHaveBeenCalledWith('asaas', 'sub_1')
    expect(refundMock).not.toHaveBeenCalled()
    expect(allocateMock).not.toHaveBeenCalled()
  })

  it('sem workspaceId → erro', async () => {
    const r = await applyBillingEvent(ev({ type: 'invoice_paid', workspaceId: null }))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toBe('no_workspace')
  })
})
