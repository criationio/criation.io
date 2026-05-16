import { type NextRequest, NextResponse } from 'next/server'

import { initiateGoogleConnect } from '@/lib/actions/google-connections'

/**
 * Entry point do fluxo OAuth Google. UI (card em /configuracoes/conexoes)
 * linka pra cá; este handler chama a server action que gera state+PKCE+authUrl
 * e redireciona o user pro consent screen do Google.
 *
 * Query params:
 *   - returnTo: rota pós-OAuth (default: /configuracoes/google/conversoes)
 */
export async function GET(request: NextRequest): Promise<Response> {
  const returnTo = request.nextUrl.searchParams.get('returnTo') ?? undefined
  const result = await initiateGoogleConnect(returnTo ? { returnTo } : undefined)

  if (!result.ok) {
    const errUrl = new URL('/configuracoes/conexoes', request.url)
    errUrl.searchParams.set('googleError', result.error.code)
    return NextResponse.redirect(errUrl, { status: 303 })
  }

  if (!result.redirectUrl) {
    const errUrl = new URL('/configuracoes/conexoes', request.url)
    errUrl.searchParams.set('googleError', 'INTERNAL')
    return NextResponse.redirect(errUrl, { status: 303 })
  }

  return NextResponse.redirect(result.redirectUrl, { status: 303 })
}
