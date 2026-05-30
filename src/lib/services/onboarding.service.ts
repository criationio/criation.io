import {
  completeOnboarding as dbCompleteOnboarding,
  ONBOARDING_STEPS,
  setOnboardingStep,
  type OnboardingStep,
} from '@/lib/db/queries/users'

/**
 * Service de onboarding (Sessao 1.5, restruct 2026-05-28).
 *
 * Wizard de 2 steps visiveis (`perfil` -> `credits` -> `completed`). Nenhum
 * step e pulavel — credits e celebracao com 1 CTA, perfil precisa do nome.
 * Configuracao de integracoes (gateway/meta/google/etc) virou tour interativo
 * no dashboard, fora do escopo do service.
 */

export type OnboardingError =
  | { code: 'INVALID_TRANSITION'; message: string }
  | { code: 'ALREADY_COMPLETED'; message: string }

export type OnboardingResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: OnboardingError }

/**
 * Retorna o proximo step na ordem canonica. `completed` e ponto fixo.
 */
export function getNextStep(current: OnboardingStep): OnboardingStep {
  const idx = ONBOARDING_STEPS.indexOf(current)
  if (idx === -1 || idx === ONBOARDING_STEPS.length - 1) return 'completed'
  return ONBOARDING_STEPS[idx + 1]!
}

/**
 * Retorna o step anterior na ordem canonica. `perfil` retorna ele mesmo
 * (ponto fixo do inicio). Util pro botao "Voltar" no wizard.
 */
export function getPreviousStep(current: OnboardingStep): OnboardingStep {
  const idx = ONBOARDING_STEPS.indexOf(current)
  if (idx <= 0) return 'perfil'
  return ONBOARDING_STEPS[idx - 1]!
}

/**
 * Pode acessar pageStep dado que o user esta atualmente em userStep?
 * Regra: navegacao retrocedente sempre permitida (back button + URL bookmark);
 * forward jump bloqueado. Usado pelos page guards do wizard.
 */
export function canAccessStep(userStep: OnboardingStep, pageStep: OnboardingStep): boolean {
  if (userStep === 'completed') return false // ja completou — wizard fora
  const userIdx = ONBOARDING_STEPS.indexOf(userStep)
  const pageIdx = ONBOARDING_STEPS.indexOf(pageStep)
  if (userIdx === -1 || pageIdx === -1) return false
  return pageIdx <= userIdx
}

/**
 * Avanca o step do usuario do `currentStep` pro proximo. Idempotente — se
 * o user ja esta num step adiante (race condition de double-submit), nao
 * regride.
 *
 * Retorna o step pra onde foi (util pra page Server Component decidir redirect).
 */
export async function markStepCompleted(
  userId: string,
  currentStep: OnboardingStep
): Promise<OnboardingResult<{ nextStep: OnboardingStep }>> {
  if (currentStep === 'completed') {
    return { ok: false, error: { code: 'ALREADY_COMPLETED', message: 'Onboarding ja concluido' } }
  }

  const nextStep = getNextStep(currentStep)

  if (nextStep === 'completed') {
    await dbCompleteOnboarding(userId)
  } else {
    await setOnboardingStep(userId, nextStep)
  }

  return { ok: true, data: { nextStep } }
}

/**
 * Marca onboarding completo (chamado pelo CTA "Acessar plataforma" da tela
 * de credits). Idempotente.
 */
export async function completeOnboarding(userId: string): Promise<OnboardingResult> {
  await dbCompleteOnboarding(userId)
  return { ok: true, data: undefined }
}
