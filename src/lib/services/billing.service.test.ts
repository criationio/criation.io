// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/env', () => ({
  env: {
    ASAAS_WEBHOOK_SECRET: 'whsec',
    ASAAS_API_KEY: 'key',
    ASAAS_BASE_URL: undefined,
    STRIPE_SECRET_KEY: 'sk_test',
    STRIPE_WEBHOOK_SECRET: 'whsec_stripe',
  },
}))
vi.mock('@/lib/logger', () => ({ billingLogger: { error: vi.fn(), info: vi.fn() } }))

import { getProviderForWorkspace } from './billing.service'

describe('getProviderForWorkspace', () => {
  it('BR sem assinatura → asaas', () => {
    expect(getProviderForWorkspace('BR')).toBe('asaas')
  })
  it('outro país sem assinatura → stripe', () => {
    expect(getProviderForWorkspace('US')).toBe('stripe')
    expect(getProviderForWorkspace(null)).toBe('stripe')
  })
  it('lock: assinatura existente vence o país (ADR-007)', () => {
    expect(getProviderForWorkspace('US', 'asaas')).toBe('asaas')
    expect(getProviderForWorkspace('BR', 'stripe')).toBe('stripe')
  })
})
