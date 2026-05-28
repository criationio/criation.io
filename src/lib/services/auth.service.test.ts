/**
 * Tests do auth.service (Sessao 1.5 PR-10 — fecha TD-018).
 *
 * Foca em detectSignupBurst (anti-fraude D3): >=3 signups com mesmo
 * IP hash em 24h gera audit_logs.fraud_alert_signup_burst, NAO bloqueia.
 *
 * Cobertura completa de signupWithPassword (Supabase mock + transaction)
 * fica em TDs 015/016/017 (mesmo padrao DB-bound).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { insertFn, insertValues } = vi.hoisted(() => {
  const insertValues = vi.fn().mockResolvedValue(undefined)
  const insertFn = vi.fn(() => ({ values: insertValues }))
  return { insertFn, insertValues }
})

vi.mock('@/lib/db', () => ({
  db: { insert: insertFn },
}))

vi.mock('@/lib/db/queries/users', () => ({
  countRecentSignupsByIpHash: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  authLogger: { warn: vi.fn(), error: vi.fn() },
}))

import { countRecentSignupsByIpHash } from '@/lib/db/queries/users'

import { detectSignupBurst, SIGNUP_BURST_THRESHOLD } from './auth.service'

const USER = '00000000-0000-0000-0000-000000000001'
const WS = '00000000-0000-0000-0000-0000000000ws'
const IP_HASH = 'ip_hash_aaa'

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('detectSignupBurst (TD-018)', () => {
  it('threshold = 3 (CLAUDE.md / D3 spec)', () => {
    expect(SIGNUP_BURST_THRESHOLD).toBe(3)
  })

  it('nao detecta burst com count = 0 (primeiro signup do IP)', async () => {
    vi.mocked(countRecentSignupsByIpHash).mockResolvedValueOnce(0)
    const result = await detectSignupBurst({ ipHash: IP_HASH, userId: USER, workspaceId: WS })
    expect(result).toEqual({ detected: false, count: 0 })
    expect(insertFn).not.toHaveBeenCalled()
  })

  it('nao detecta burst com count = 2 (abaixo do threshold)', async () => {
    vi.mocked(countRecentSignupsByIpHash).mockResolvedValueOnce(2)
    const result = await detectSignupBurst({ ipHash: IP_HASH, userId: USER, workspaceId: WS })
    expect(result).toEqual({ detected: false, count: 2 })
    expect(insertFn).not.toHaveBeenCalled()
  })

  it('detecta burst com count = 3 (exato no threshold) e insere audit_log', async () => {
    vi.mocked(countRecentSignupsByIpHash).mockResolvedValueOnce(3)
    const result = await detectSignupBurst({ ipHash: IP_HASH, userId: USER, workspaceId: WS })
    expect(result).toEqual({ detected: true, count: 3 })
    expect(insertFn).toHaveBeenCalledTimes(1)
    expect(insertValues).toHaveBeenCalledWith({
      eventType: 'fraud_alert_signup_burst',
      actorUserId: USER,
      ipHash: IP_HASH,
      payload: { count: 3, workspaceId: WS },
    })
  })

  it('detecta burst com count = 4 (acima do threshold) e propaga count no payload', async () => {
    vi.mocked(countRecentSignupsByIpHash).mockResolvedValueOnce(4)
    const result = await detectSignupBurst({ ipHash: IP_HASH, userId: USER, workspaceId: WS })
    expect(result).toEqual({ detected: true, count: 4 })
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'fraud_alert_signup_burst',
        payload: { count: 4, workspaceId: WS },
      })
    )
  })

  it('nao bloqueia signup quando query falha — retorna count:0 e nao insere', async () => {
    vi.mocked(countRecentSignupsByIpHash).mockRejectedValueOnce(new Error('db_down'))
    const result = await detectSignupBurst({ ipHash: IP_HASH, userId: USER, workspaceId: WS })
    expect(result).toEqual({ detected: false, count: 0 })
    expect(insertFn).not.toHaveBeenCalled()
  })

  it('nao bloqueia signup quando audit insert falha', async () => {
    vi.mocked(countRecentSignupsByIpHash).mockResolvedValueOnce(5)
    insertValues.mockRejectedValueOnce(new Error('audit_table_locked'))
    const result = await detectSignupBurst({ ipHash: IP_HASH, userId: USER, workspaceId: WS })
    // Insert tentou rolar — mas erro foi capturado, signup continua.
    expect(result).toEqual({ detected: false, count: 0 })
  })
})
