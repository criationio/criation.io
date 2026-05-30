import { eq, sql } from 'drizzle-orm'

import { db } from '@/lib/db'
import { users } from '@/lib/db/schema/auth'

/**
 * Conta signups recentes com mesmo IP hash. Usado pelo anti-fraude
 * (D3 da Sessao 1.1) para gerar `fraud_alert_signup_burst` quando
 * >= 3 signups em 24h. Nao bloqueia signup.
 */
export async function countRecentSignupsByIpHash(
  ipHash: string,
  intervalSql: string = '24 hours'
): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users)
    .where(
      sql`${users.signupIpHash} = ${ipHash} AND ${users.createdAt} > NOW() - INTERVAL '${sql.raw(intervalSql)}'`
    )

  return result[0]?.count ?? 0
}

// ============================================================================
// Onboarding (Sessao 1.5)
// ============================================================================

/** Valores do enum users.onboarding_step (CHECK constraint em schema/auth.ts).
 *  Restruct 2026-05-28: wizard simplificado de 7 pra 2 steps visiveis (perfil
 *  + credits). Configuracao das integracoes (gateway/meta/google/etc.) virou
 *  tour interativo no dashboard, nao step de wizard. */
export const ONBOARDING_STEPS = ['perfil', 'credits', 'completed'] as const

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number]

export interface OnboardingState {
  step: OnboardingStep
  completedAt: Date | null
  defaultWorkspaceId: string | null
  profileContext: Record<string, unknown>
}

/**
 * Retorna estado de onboarding do usuario. Usado pelo middleware (via cookie
 * miss) e pelas pages do wizard pra decidir rota.
 *
 * Retorna null se user nao existe (race condition pos-delete de conta).
 */
export async function getOnboardingState(userId: string): Promise<OnboardingState | null> {
  const row = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: {
      onboardingStep: true,
      onboardingCompletedAt: true,
      defaultWorkspaceId: true,
      profileContext: true,
    },
  })

  if (!row) return null

  return {
    step: row.onboardingStep as OnboardingStep,
    completedAt: row.onboardingCompletedAt,
    defaultWorkspaceId: row.defaultWorkspaceId,
    profileContext: (row.profileContext as Record<string, unknown>) ?? {},
  }
}

/**
 * Avanca o step do onboarding. Validacao de transicao (nao pular `perfil`/`meta`)
 * fica no service layer — query e burra.
 */
export async function setOnboardingStep(userId: string, step: OnboardingStep): Promise<void> {
  await db.update(users).set({ onboardingStep: step }).where(eq(users.id, userId))
}

/**
 * Marca onboarding como completo: step='completed' + completed_at=now().
 * Idempotente (re-call nao altera completed_at se ja setado).
 */
export async function completeOnboarding(userId: string): Promise<void> {
  await db
    .update(users)
    .set({
      onboardingStep: 'completed',
      onboardingCompletedAt: sql`COALESCE(${users.onboardingCompletedAt}, NOW())`,
    })
    .where(eq(users.id, userId))
}

/**
 * Persiste perfil estruturado coletado no step `perfil`. Merge raso sobre
 * profileContext existente (preserva chaves antigas se payload nao redeclarar).
 */
export async function setUserProfile(
  userId: string,
  profileContext: Record<string, unknown>
): Promise<void> {
  await db
    .update(users)
    .set({
      profileContext: sql`${users.profileContext} || ${JSON.stringify(profileContext)}::jsonb`,
    })
    .where(eq(users.id, userId))
}

/**
 * Le se o user ja completou/skipou o tour interativo. Idempotente.
 */
export async function getTourCompletedAt(userId: string): Promise<Date | null> {
  const row = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { tourCompletedAt: true },
  })
  return row?.tourCompletedAt ?? null
}

/**
 * Marca tour como completo (chamado pelo finish/skip do react-joyride).
 * Idempotente — re-call nao altera timestamp existente.
 */
export async function markTourCompleted(userId: string): Promise<void> {
  await db
    .update(users)
    .set({
      tourCompletedAt: sql`COALESCE(${users.tourCompletedAt}, NOW())`,
    })
    .where(eq(users.id, userId))
}
