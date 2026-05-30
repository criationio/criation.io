import { redirect } from 'next/navigation'

import { getOnboardingState } from '@/lib/db/queries/users'
import { getUser } from '@/lib/supabase/server'

/**
 * Index `/bem-vindo` — redireciona pra step atual do user. Acessada quando
 * middleware detecta `criation_onboarding_done=0` ou ausente e o usuario
 * tentou rota protegida.
 */
export default async function OnboardingIndexPage() {
  const user = await getUser()
  if (!user) redirect('/login')

  const state = await getOnboardingState(user.id)
  if (!state) redirect('/login')

  if (state.step === 'completed') redirect('/dashboard')

  redirect(`/bem-vindo/${state.step}`)
}
