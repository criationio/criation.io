import { NextRequest, NextResponse } from 'next/server'

const APP_DOMAIN = process.env.NEXT_PUBLIC_APP_DOMAIN ?? 'app.criation.io'
const ADMIN_DOMAIN = process.env.NEXT_PUBLIC_ADMIN_DOMAIN ?? 'adm.criation.io'

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') ?? ''
  const { pathname } = request.nextUrl

  const response = NextResponse.next()
  const correlationId = crypto.randomUUID()
  response.headers.set('x-correlation-id', correlationId)
  request.headers.set('x-correlation-id', correlationId)

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
