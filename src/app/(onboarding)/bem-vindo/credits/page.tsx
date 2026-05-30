import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { Sparkles } from 'lucide-react'

import { db } from '@/lib/db'
import { getBalanceForWorkspace } from '@/lib/db/queries/credits'
import { getOnboardingState } from '@/lib/db/queries/users'
import { workspaceMembers } from '@/lib/db/schema/auth'
import { canAccessStep } from '@/lib/services/onboarding.service'
import { getUser } from '@/lib/supabase/server'

import { EnterPlatformButton } from './enter-platform-button'

function daysUntil(date: Date | null | undefined): number | null {
  if (!date) return null
  const ms = date.getTime() - Date.now()
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)))
}

/**
 * Step 2/2 — credits. Tela celebratoria com saldo recem-alocado (50 creditos
 * signup_bonus, validos por 90d). CTA "Acessar plataforma" marca onboarding
 * completo + redireciona /dashboard onde o tour interativo (react-joyride)
 * dispara automaticamente.
 *
 * Sem skip — esta tela so existe pra contextualizar o presente. User precisa
 * passar pra entrar na plataforma.
 */
export default async function CreditsStepPage() {
  const user = await getUser()
  if (!user) redirect('/login')

  const state = await getOnboardingState(user.id)
  if (!state) redirect('/login')
  if (state.step === 'completed') redirect('/dashboard')

  if (!canAccessStep(state.step, 'credits')) {
    // user ainda no perfil — empurra pro form
    redirect('/bem-vindo/perfil')
  }

  // Resolve workspace pra pegar balance.
  const membership = await db.query.workspaceMembers.findFirst({
    where: eq(workspaceMembers.userId, user.id),
    columns: { workspaceId: true },
  })
  const balance = membership ? await getBalanceForWorkspace(membership.workspaceId) : null
  const signupBalance = balance?.signupBalance ?? 50
  const expiresAt = balance?.signupExpiresAt
  const expiresInDays = daysUntil(expiresAt) ?? 90

  return (
    <div className="text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-accent)]/10 text-[var(--color-accent)]">
        <Sparkles className="h-8 w-8" />
      </div>

      <h1 className="mt-6 text-3xl font-semibold tracking-tight">
        Você ganhou <span className="text-[var(--color-accent)]">{signupBalance} créditos</span>
      </h1>
      <p className="mx-auto mt-3 max-w-md text-sm text-[var(--color-fg-muted)]">
        Suficiente pra você explorar o produto sem compromisso. Vão expirar em{' '}
        <strong>{expiresInDays} dias</strong> — tempo de sobra pra testar tudo.
      </p>

      <div className="mt-8 inline-flex items-baseline gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-5 py-3">
        <span className="text-xs text-[var(--color-fg-subtle)]">Saldo</span>
        <span className="text-2xl font-semibold tabular-nums">{signupBalance}</span>
        <span className="text-xs text-[var(--color-fg-subtle)]">créditos</span>
      </div>

      <p className="mx-auto mt-6 max-w-md text-sm text-[var(--color-fg-muted)]">
        Quando você entrar na plataforma, um tour rápido vai te mostrar onde configurar suas
        integrações e começar.
      </p>

      <div className="mt-8 flex justify-center">
        <EnterPlatformButton />
      </div>
    </div>
  )
}
