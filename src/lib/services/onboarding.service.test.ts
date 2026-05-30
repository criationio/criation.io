/**
 * Tests do onboarding.service (Sessao 1.5 restruct 2026-05-28).
 *
 * Wizard simplificado pra 2 steps visiveis: `perfil` -> `credits` -> `completed`.
 * Configuracao de integracoes (gateway/meta/google/etc) virou tour interativo
 * no dashboard, nao step de wizard.
 *
 * Coverage:
 *   - getNextStep (pure) — perfil → credits → completed → completed (fixed point)
 *   - getPreviousStep (pure) — credits → perfil; perfil é ponto fixo de início
 *   - canAccessStep (pure) — back nav permitida; forward jump bloqueado
 *   - markStepCompleted — bloqueia quando ja completed
 *   - completeOnboarding — chama dbCompleteOnboarding
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db/queries/users', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/db/queries/users')>('@/lib/db/queries/users')
  return {
    ...actual,
    setOnboardingStep: vi.fn().mockResolvedValue(undefined),
    completeOnboarding: vi.fn().mockResolvedValue(undefined),
  }
})

import * as userQueries from '@/lib/db/queries/users'

import {
  canAccessStep,
  completeOnboarding,
  getNextStep,
  getPreviousStep,
  markStepCompleted,
} from './onboarding.service'

const USER = '00000000-0000-0000-0000-000000000001'

afterEach(() => {
  vi.clearAllMocks()
})

describe('getNextStep', () => {
  it('perfil -> credits', () => {
    expect(getNextStep('perfil')).toBe('credits')
  })

  it('credits -> completed', () => {
    expect(getNextStep('credits')).toBe('completed')
  })

  it('completed é ponto fixo', () => {
    expect(getNextStep('completed')).toBe('completed')
  })
})

describe('getPreviousStep', () => {
  it('credits -> perfil', () => {
    expect(getPreviousStep('credits')).toBe('perfil')
  })

  it('perfil é ponto fixo (ja é o primeiro)', () => {
    expect(getPreviousStep('perfil')).toBe('perfil')
  })

  it('completed -> credits (volta um passo, sem completar)', () => {
    expect(getPreviousStep('completed')).toBe('credits')
  })
})

describe('canAccessStep', () => {
  it('user em perfil pode acessar perfil', () => {
    expect(canAccessStep('perfil', 'perfil')).toBe(true)
  })

  it('user em perfil NAO pode acessar credits (forward jump)', () => {
    expect(canAccessStep('perfil', 'credits')).toBe(false)
  })

  it('user em credits pode acessar perfil (back nav)', () => {
    expect(canAccessStep('credits', 'perfil')).toBe(true)
  })

  it('user em credits pode acessar credits', () => {
    expect(canAccessStep('credits', 'credits')).toBe(true)
  })

  it('user completed nao pode acessar wizard (wizard fora)', () => {
    expect(canAccessStep('completed', 'perfil')).toBe(false)
    expect(canAccessStep('completed', 'credits')).toBe(false)
  })
})

describe('markStepCompleted', () => {
  it('perfil avanca pra credits', async () => {
    const result = await markStepCompleted(USER, 'perfil')
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.nextStep).toBe('credits')
    expect(userQueries.setOnboardingStep).toHaveBeenCalledWith(USER, 'credits')
    expect(userQueries.completeOnboarding).not.toHaveBeenCalled()
  })

  it('credits finaliza onboarding (chama completeOnboarding)', async () => {
    const result = await markStepCompleted(USER, 'credits')
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.nextStep).toBe('completed')
    expect(userQueries.completeOnboarding).toHaveBeenCalledWith(USER)
    expect(userQueries.setOnboardingStep).not.toHaveBeenCalled()
  })

  it('rejeita quando ja em completed', async () => {
    const result = await markStepCompleted(USER, 'completed')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('ALREADY_COMPLETED')
    expect(userQueries.setOnboardingStep).not.toHaveBeenCalled()
    expect(userQueries.completeOnboarding).not.toHaveBeenCalled()
  })
})

describe('completeOnboarding', () => {
  it('chama dbCompleteOnboarding e retorna ok', async () => {
    const result = await completeOnboarding(USER)
    expect(result.ok).toBe(true)
    expect(userQueries.completeOnboarding).toHaveBeenCalledWith(USER)
  })
})
