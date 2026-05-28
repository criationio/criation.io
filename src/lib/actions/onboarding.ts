'use server'

import { revalidatePath } from 'next/cache'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

import { withCorrelatedAction } from '@/lib/correlation'
import { db } from '@/lib/db'
import { getOnboardingState, setUserProfile, type OnboardingStep } from '@/lib/db/queries/users'
import { users, workspaceMembers } from '@/lib/db/schema/auth'
import { authLogger } from '@/lib/logger'
import { getClientIp } from '@/lib/security/client-ip'
import { hashIp } from '@/lib/security/hash'
import {
  completeOnboarding as svcCompleteOnboarding,
  markStepCompleted,
} from '@/lib/services/onboarding.service'
import { getUser } from '@/lib/supabase/server'

/**
 * Server Actions do wizard /bem-vindo (Sessao 1.5, restruct 2026-05-28).
 *
 * Apenas 2 actions com side-effects: `submitProfile` (form do perfil) e
 * `enterPlatform` (CTA da tela de credits). Wizard reduzido a 2 steps
 * visiveis; configuracao mais profunda virou tour interativo no dashboard.
 *
 * Pattern thin controller: valida via Zod, delega ao service, retorna shape
 * discriminado. Cookie `criation_onboarding_done` setado no momento que step
 * vira `completed` — middleware le pra gatear rotas protegidas.
 */

export type OnboardingActionResult =
  | { ok: true; nextStep: OnboardingStep; redirectTo: string }
  | {
      ok: false
      error: {
        code: 'UNAUTHORIZED' | 'INVALID' | 'ALREADY_COMPLETED' | 'INTERNAL'
        message: string
      }
    }

const ONBOARDING_COOKIE = 'criation_onboarding_done'
const COOKIE_MAX_AGE_S = 60 * 60 * 24 * 365

async function resolveSession(): Promise<{
  userId: string
  workspaceId: string | null
  ipHash: string | null
} | null> {
  const user = await getUser()
  if (!user) return null

  const userRow = await db.query.users.findFirst({ where: eq(users.id, user.id) })
  let workspaceId = userRow?.defaultWorkspaceId ?? null
  if (!workspaceId) {
    const membership = await db.query.workspaceMembers.findFirst({
      where: eq(workspaceMembers.userId, user.id),
    })
    workspaceId = membership?.workspaceId ?? null
  }

  const headersList = await headers()
  const ip = getClientIp(headersList)
  const ipHash = ip === 'unknown' ? null : hashIp(ip)

  return { userId: user.id, workspaceId, ipHash }
}

function stepToPath(step: OnboardingStep): string {
  if (step === 'completed') return '/dashboard'
  if (step === 'credits') return '/bem-vindo/credits'
  return `/bem-vindo/${step}`
}

async function setCompletedCookie(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(ONBOARDING_COOKIE, '1', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: COOKIE_MAX_AGE_S,
  })
}

// ---------------------------------------------------------------------------
// submitProfile — step `perfil` -> avanca pra `credits`
// ---------------------------------------------------------------------------

const GATEWAY_OPTIONS = [
  'hotmart',
  'kiwify',
  'eduzz',
  'monetizze',
  'ticto',
  'cakto',
  'outro',
  'nenhum',
] as const

const MONTHLY_REVENUE_OPTIONS = ['lt100k', '100k_300k', '300k_1m', '1m_5m', 'gt5m'] as const

const MONTHLY_AD_SPEND_OPTIONS = ['lt10k', '10k_50k', '50k_100k', '100k_300k', 'gt300k'] as const

const profileSchema = z.object({
  name: z.string().trim().min(1, 'Nome obrigatorio').max(200),
  niche: z.string().trim().max(100).optional(),
  gateways: z.array(z.enum(GATEWAY_OPTIONS)).max(GATEWAY_OPTIONS.length).optional(),
  monthlyRevenue: z.enum(MONTHLY_REVENUE_OPTIONS).optional(),
  monthlyAdSpend: z.enum(MONTHLY_AD_SPEND_OPTIONS).optional(),
})

function emptyToUndefined(v: FormDataEntryValue | null): string | undefined {
  if (typeof v !== 'string') return undefined
  const trimmed = v.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

export async function submitProfile(
  _prev: OnboardingActionResult | null,
  formData: FormData
): Promise<OnboardingActionResult> {
  return withCorrelatedAction(async () => {
    const session = await resolveSession()
    if (!session) return { ok: false, error: { code: 'UNAUTHORIZED', message: 'Sessao expirou' } }

    const rawGateways = formData
      .getAll('gateways')
      .filter((v): v is string => typeof v === 'string')
    const parsed = profileSchema.safeParse({
      name: emptyToUndefined(formData.get('name')),
      niche: emptyToUndefined(formData.get('niche')),
      gateways: rawGateways.length > 0 ? rawGateways : undefined,
      monthlyRevenue: emptyToUndefined(formData.get('monthlyRevenue')),
      monthlyAdSpend: emptyToUndefined(formData.get('monthlyAdSpend')),
    })
    if (!parsed.success) {
      return {
        ok: false,
        error: { code: 'INVALID', message: parsed.error.issues[0]?.message ?? 'invalido' },
      }
    }

    const state = await getOnboardingState(session.userId)
    if (!state)
      return { ok: false, error: { code: 'UNAUTHORIZED', message: 'User nao encontrado' } }
    if (state.step === 'completed') {
      return { ok: false, error: { code: 'ALREADY_COMPLETED', message: 'Onboarding ja concluido' } }
    }

    const { name, ...rest } = parsed.data
    await db.update(users).set({ name }).where(eq(users.id, session.userId))
    await setUserProfile(session.userId, rest)

    const result = await markStepCompleted(session.userId, state.step)
    if (!result.ok) {
      return { ok: false, error: { code: 'INTERNAL', message: result.error.message } }
    }

    if (result.data.nextStep === 'completed') await setCompletedCookie()

    revalidatePath('/bem-vindo')
    return {
      ok: true,
      nextStep: result.data.nextStep,
      redirectTo: stepToPath(result.data.nextStep),
    }
  })
}

// ---------------------------------------------------------------------------
// enterPlatform — step `credits` -> `completed`, redirect /dashboard
// ---------------------------------------------------------------------------

/**
 * CTA da tela de credits ("Acessar plataforma"). Marca onboarding completo,
 * seta cookie pro middleware liberar rotas protegidas, redireciona dashboard.
 *
 * Idempotente em re-call: se user ja em `completed`, segue pra dashboard sem
 * efeito colateral adicional.
 */
export async function enterPlatform(): Promise<never> {
  const session = await resolveSession()
  if (!session) redirect('/login')

  await svcCompleteOnboarding(session.userId)
  await setCompletedCookie()

  authLogger.info(
    { userId: session.userId, event: 'onboarding_completed' },
    'user entered platform from credits screen'
  )

  revalidatePath('/bem-vindo')
  redirect('/dashboard')
}
