// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/correlation', () => ({
  generateCorrelationId: () => 'cid',
  withCorrelation: (_cid: string, fn: () => unknown) => fn(),
}))
vi.mock('@/lib/db/queries/gateway-events', () => ({ recordProcessedWebhook: vi.fn() }))
vi.mock('@/lib/services/billing.service', () => ({ handleWebhook: vi.fn() }))
vi.mock('@/lib/trigger/client', () => ({ triggerProcessBillingEvent: vi.fn() }))
vi.mock('@/lib/logger', () => ({
  billingLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { recordProcessedWebhook } from '@/lib/db/queries/gateway-events'
import { handleWebhook } from '@/lib/services/billing.service'
import { triggerProcessBillingEvent } from '@/lib/trigger/client'
import { handleBillingWebhook } from './webhook-handler'

const handleWebhookMock = handleWebhook as unknown as ReturnType<typeof vi.fn>
const recordMock = recordProcessedWebhook as unknown as ReturnType<typeof vi.fn>
const triggerMock = triggerProcessBillingEvent as unknown as ReturnType<typeof vi.fn>

function req(): Request {
  return new Request('https://x/api/webhooks/asaas', { method: 'POST', body: '{}' })
}
const EVENT = {
  provider: 'asaas',
  type: 'invoice_paid',
  externalEventId: 'evt_1',
  workspaceId: 'ws-1',
  planId: 'advanced',
  raw: { foo: 1 },
}

beforeEach(() => vi.clearAllMocks())

describe('handleBillingWebhook', () => {
  it('evento novo → enfileira + 200', async () => {
    handleWebhookMock.mockReturnValue({ ...EVENT })
    recordMock.mockResolvedValue({ alreadyProcessed: false })
    triggerMock.mockResolvedValue({ id: 'run_1' })

    const res = await handleBillingWebhook('asaas', req() as never)
    expect(res.status).toBe(200)
    expect(triggerMock).toHaveBeenCalledOnce()
    // raw é removido do payload enfileirado
    expect(triggerMock.mock.calls[0]![0].event.raw).toBeUndefined()
    expect(recordMock).toHaveBeenCalledWith('asaas', 'evt_1', 'invoice_paid', { foo: 1 })
  })

  it('evento duplicado → NÃO enfileira (200 deduped)', async () => {
    handleWebhookMock.mockReturnValue({ ...EVENT })
    recordMock.mockResolvedValue({ alreadyProcessed: true })

    const res = await handleBillingWebhook('asaas', req() as never)
    expect(res.status).toBe(200)
    expect(triggerMock).not.toHaveBeenCalled()
  })

  it('assinatura inválida → 401, não registra nem enfileira (fail closed)', async () => {
    handleWebhookMock.mockImplementation(() => {
      throw new Error('assinatura inválida')
    })

    const res = await handleBillingWebhook('asaas', req() as never)
    expect(res.status).toBe(401)
    expect(recordMock).not.toHaveBeenCalled()
    expect(triggerMock).not.toHaveBeenCalled()
  })
})
