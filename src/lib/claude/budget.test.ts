// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db', () => {
  const selectWhere = vi.fn()
  const selectFrom = vi.fn(() => ({ where: selectWhere }))
  const select = vi.fn(() => ({ from: selectFrom }))
  return { db: { select }, __mocks: { select, selectWhere } }
})

import { checkBudget, getMonthlyUsageUsd, USD_TO_BRL } from './budget'

const dbModule = (await import('@/lib/db')) as unknown as {
  __mocks: { select: ReturnType<typeof vi.fn>; selectWhere: ReturnType<typeof vi.fn> }
}
const mocks = dbModule.__mocks

const NOW = new Date('2026-06-15T12:00:00.000Z')

beforeEach(() => {
  mocks.selectWhere.mockResolvedValue([{ total: '0' }])
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('getMonthlyUsageUsd', () => {
  it('soma cost_usd (Postgres devolve string)', async () => {
    mocks.selectWhere.mockResolvedValue([{ total: '1.234567' }])
    expect(await getMonthlyUsageUsd('ws-1', NOW)).toBeCloseTo(1.234567, 6)
  })

  it('retorna 0 quando nao ha requests', async () => {
    mocks.selectWhere.mockResolvedValue([{ total: '0' }])
    expect(await getMonthlyUsageUsd('ws-1', NOW)).toBe(0)
  })
})

describe('checkBudget', () => {
  it('ok=true quando dentro do orcamento (Pro R$40)', async () => {
    mocks.selectWhere.mockResolvedValue([{ total: '1.0' }]) // ~R$5.50
    const r = await checkBudget('ws-1', { planId: 'pro', now: NOW })
    expect(r.ok).toBe(true)
    expect(r.budgetBrlCents).toBe(4000)
    expect(r.usageBrlCents).toBe(Math.round(1.0 * USD_TO_BRL * 100))
  })

  it('ok=false quando estoura o budget Starter (R$10)', async () => {
    // 2 USD * 5.5 = R$11.00 > R$10
    mocks.selectWhere.mockResolvedValue([{ total: '2.0' }])
    const r = await checkBudget('ws-1', { planId: 'starter', now: NOW })
    expect(r.ok).toBe(false)
    expect(r.budgetBrlCents).toBe(1000)
  })

  it('free/trial cai no budget Starter', async () => {
    mocks.selectWhere.mockResolvedValue([{ total: '0' }])
    const free = await checkBudget('ws-1', { planId: 'free', now: NOW })
    expect(free.budgetBrlCents).toBe(1000)
    const unknown = await checkBudget('ws-1', { planId: 'plano-desconhecido', now: NOW })
    expect(unknown.budgetBrlCents).toBe(1000)
    const missing = await checkBudget('ws-1', { now: NOW })
    expect(missing.budgetBrlCents).toBe(1000)
  })

  it('Agency tem budget R$120', async () => {
    const r = await checkBudget('ws-1', { planId: 'agency', now: NOW })
    expect(r.budgetBrlCents).toBe(12000)
  })

  it('nunca lanca por budget — sempre retorna shape', async () => {
    mocks.selectWhere.mockResolvedValue([{ total: '999' }])
    const r = await checkBudget('ws-1', { planId: 'pro', now: NOW })
    expect(r.ok).toBe(false)
  })
})
