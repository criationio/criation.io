import { NextResponse } from 'next/server'

import { getOnboardingState } from '@/lib/db/queries/users'
import { getUser } from '@/lib/supabase/server'

const ONBOARDING_COOKIE = 'criation_onboarding_done'
const COOKIE_MAX_AGE_S = 60 * 60 * 24 * 365

/**
 * Recuperação do cookie de onboarding (fix do loop dashboard↔bem-vindo).
 *
 * O middleware usa o cookie `criation_onboarding_done` como fonte de verdade
 * (Edge não roda Drizzle). Quando o cookie some (domínio novo, cookies limpos,
 * expiração) mas o banco diz `completed`, ocorria loop: /dashboard → /bem-vindo
 * → /dashboard. Esta rota (Node runtime, lê o banco) reconstrói o cookie a
 * partir do estado real e redireciona pro destino certo.
 *
 * `(onboarding)/layout` manda usuários `completed` pra cá em vez de direto pro
 * /dashboard, garantindo que o cookie seja restaurado antes do middleware
 * reavaliar.
 */
export async function GET(request: Request) {
  const user = await getUser()
  if (!user) return NextResponse.redirect(new URL('/login', request.url))

  const state = await getOnboardingState(user.id)

  if (state?.step === 'completed') {
    const res = NextResponse.redirect(new URL('/dashboard', request.url))
    res.cookies.set(ONBOARDING_COOKIE, '1', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: COOKIE_MAX_AGE_S,
    })
    return res
  }

  // Ainda não concluiu → segue no wizard (sem setar o cookie).
  return NextResponse.redirect(new URL('/bem-vindo/perfil', request.url))
}
