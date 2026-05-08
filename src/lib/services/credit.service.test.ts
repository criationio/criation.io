// @vitest-environment node
// credit.service usa server-only env vars via @/env (transitively) e
// Drizzle/postgres-js que requerem node runtime.

import { describe, expect, it } from 'vitest'

import { allocate } from './credit.service'

describe('creditService.allocate — input validation', () => {
  it('throws when amount is zero', async () => {
    await expect(
      allocate('00000000-0000-0000-0000-000000000000', 0, 'signup_bonus', new Date(), {
        idempotencyKey: 'k1',
      })
    ).rejects.toThrow('amount must be positive')
  })

  it('throws when amount is negative', async () => {
    await expect(
      allocate('00000000-0000-0000-0000-000000000000', -1, 'signup_bonus', new Date(), {
        idempotencyKey: 'k2',
      })
    ).rejects.toThrow('amount must be positive')
  })

  it('throws when idempotencyKey is empty', async () => {
    await expect(
      allocate('00000000-0000-0000-0000-000000000000', 50, 'signup_bonus', new Date(), {
        idempotencyKey: '',
      })
    ).rejects.toThrow('idempotencyKey required')
  })
})
