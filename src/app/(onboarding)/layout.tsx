import { redirect } from 'next/navigation'

import { Toaster } from '@/components/ui/sonner'
import { getOnboardingState } from '@/lib/db/queries/users'
import { getUser } from '@/lib/supabase/server'

/**
 * Layout do onboarding (Sessao 1.5, restruct 2026-05-28).
 *
 * Wizard simplificado pra 2 steps visiveis (`perfil` + `credits`). Sem
 * progress bar — 2 dots fica feio e a sequencia perfil -> credits e auto
 * explicativa. Configuracao mais profunda (gateways/meta/google/utm/etc)
 * virou tour interativo no dashboard, nao step de wizard.
 */
export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser()
  if (!user) {
    redirect('/login')
  }

  const state = await getOnboardingState(user.id)
  if (state?.step === 'completed') {
    // Via rota de recuperação (não direto pro /dashboard): ela reconstrói o
    // cookie `criation_onboarding_done` antes do middleware reavaliar, evitando
    // o loop dashboard↔bem-vindo quando o cookie sumiu (domínio novo/cookies
    // limpos/expiração).
    redirect('/api/onboarding/enter')
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-bg)] text-[var(--color-fg)]">
      <header className="flex h-14 items-center border-b border-[var(--color-border)] bg-[var(--color-bg-muted)] px-6">
        <span className="flex items-center gap-2 text-sm font-semibold tracking-tight">
          <span
            className="flex h-6 w-6 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-accent)] text-[10px] font-bold text-[var(--color-fg-on-accent)]"
            aria-hidden
          >
            C
          </span>
          Criation
        </span>
      </header>

      <main className="flex flex-1 flex-col items-center px-4 py-10">
        <div className="w-full max-w-2xl">{children}</div>
      </main>

      <Toaster position="bottom-right" richColors />
    </div>
  )
}
