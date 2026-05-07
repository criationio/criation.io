import { type NextRequest, NextResponse } from 'next/server'

import { authLogger } from '@/lib/logger'
import { createServerClient } from '@/lib/supabase/server'

/**
 * GET /api/auth/callback
 *
 * Generic Supabase Auth callback (magic link, password reset).
 * Exchange `code` for session cookie, redirect para `next` ou /dashboard.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  // Defesa contra open-redirect: aceita apenas paths internos.
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard'

  if (!code) {
    authLogger.warn({ event: 'callback_missing_code' }, 'callback hit without code param')
    return NextResponse.redirect(new URL('/login?error=missing_code', origin))
  }

  const supabase = await createServerClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    authLogger.warn({ errCode: error.code }, 'callback exchange failed')
    return NextResponse.redirect(new URL('/login?error=exchange_failed', origin))
  }

  return NextResponse.redirect(new URL(safeNext, origin))
}
