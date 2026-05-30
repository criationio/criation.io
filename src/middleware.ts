import { type NextRequest, NextResponse } from 'next/server'

import { updateSession } from '@/lib/supabase/middleware'

const APP_DOMAIN = process.env.NEXT_PUBLIC_APP_DOMAIN ?? 'app.criation.io'
const ADMIN_DOMAIN = process.env.NEXT_PUBLIC_ADMIN_DOMAIN ?? 'adm.criation.io'

const PROTECTED_PATHS = ['/dashboard', '/estudio', '/admin', '/configuracoes', '/bem-vindo']

/**
 * Cookie setado pelo Server Action `completeTour` (e por outras transicoes
 * pra step `completed`). Quando ausente em rota protegida fora de
 * /bem-vindo, middleware redireciona pro wizard. Cookie e fonte de verdade
 * deliberada — middleware roda em Edge runtime onde Drizzle/postgres-js nao
 * funciona; query DB ficaria caro/quebraria. PR-3 (actions) seta; signOut
 * limpa; page Server Component faz fallback se cookie perdido.
 */
const ONBOARDING_DONE_COOKIE = 'criation_onboarding_done'

function isProtected(pathname: string): boolean {
  return PROTECTED_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

export async function middleware(request: NextRequest) {
  const { response, user } = await updateSession(request)

  const correlationId = crypto.randomUUID()
  response.headers.set('x-correlation-id', correlationId)
  request.headers.set('x-correlation-id', correlationId)

  const hostname = request.headers.get('host') ?? ''
  const { pathname } = request.nextUrl

  // Auth gates: nao logado -> /login; logado mas nao verificado -> /verificar-email.
  // /bem-vindo permitido para verificados (ja redirecionados do callback).
  if (isProtected(pathname)) {
    if (!user) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }
    if (!user.email_confirmed_at && pathname !== '/verificar-email') {
      const url = request.nextUrl.clone()
      url.pathname = '/verificar-email'
      return NextResponse.redirect(url)
    }

    // Onboarding gate: usuario verificado tentando rota protegida fora de
    // /bem-vindo + sem cookie de onboarding completo -> wizard.
    //
    // Whitelist subpastas de `/configuracoes/gateways/*/connect` — wizards de
    // conexao de gateway sao subrotinas do step `gateway` do onboarding e
    // precisam ser acessiveis antes do cookie estar setado. Mesma logica
    // poderia aplicar a /configuracoes/meta-vindo e /configuracoes/google
    // futuros — sem isso o GatewayPicker quebra (round-trip silencioso pro
    // wizard quando user clica no card).
    const onboardingDone = request.cookies.get(ONBOARDING_DONE_COOKIE)?.value === '1'
    const isOnboardingAllowed =
      pathname.startsWith('/bem-vindo') ||
      /^\/configuracoes\/gateways\/[^/]+\/connect/.test(pathname)
    if (!onboardingDone && user.email_confirmed_at && !isOnboardingAllowed) {
      const url = request.nextUrl.clone()
      url.pathname = '/bem-vindo'
      return NextResponse.redirect(url)
    }
  }

  if (hostname.startsWith(APP_DOMAIN.split('.')[0] ?? 'app')) {
    const appHost = hostname.includes(APP_DOMAIN)
    if (appHost && !pathname.startsWith('/(app)') && !pathname.startsWith('/api')) {
      const url = request.nextUrl.clone()
      url.pathname = `/(app)${pathname}`
      return NextResponse.rewrite(url, { headers: response.headers })
    }
  }

  if (hostname.startsWith(ADMIN_DOMAIN.split('.')[0] ?? 'adm')) {
    const adminHost = hostname.includes(ADMIN_DOMAIN)
    if (adminHost && !pathname.startsWith('/(admin)') && !pathname.startsWith('/api')) {
      const url = request.nextUrl.clone()
      url.pathname = `/(admin)${pathname}`
      return NextResponse.rewrite(url, { headers: response.headers })
    }
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
