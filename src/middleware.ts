import { type NextRequest, NextResponse } from 'next/server'

import { updateSession } from '@/lib/supabase/middleware'

const APP_DOMAIN = process.env.NEXT_PUBLIC_APP_DOMAIN ?? 'app.criation.io'
const ADMIN_DOMAIN = process.env.NEXT_PUBLIC_ADMIN_DOMAIN ?? 'adm.criation.io'

const PROTECTED_PATHS = ['/dashboard', '/estudio', '/admin', '/configuracoes', '/bem-vindo']

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
