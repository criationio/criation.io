import { eq } from 'drizzle-orm'
import { type NextRequest, NextResponse } from 'next/server'

import { db } from '@/lib/db'
import { workspaceMembers } from '@/lib/db/schema/auth'
import { authLogger } from '@/lib/logger'
import { allocate } from '@/lib/services/credit.service'
import { markEmailVerified } from '@/lib/services/auth.service'
import { createServerClient } from '@/lib/supabase/server'

/**
 * GET /api/auth/callback/verify-email
 *
 * Handler do link de verificacao de email.
 *
 * Sequencia:
 *  1. Exchange `code` -> session (Supabase marca email_confirmed_at internamente)
 *  2. markEmailVerified em public.users
 *  3. allocate 50 creditos signup_bonus, expires_at NOW+90d
 *     idempotencyKey = 'signup_bonus_<userId>' (allocate retorna idempotent
 *     se chamado novamente para o mesmo user)
 *  4. Redirect /bem-vindo
 */
const SIGNUP_BONUS_AMOUNT = 50
const SIGNUP_BONUS_DAYS = 90

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (!code) {
    authLogger.warn({ event: 'verify_email_missing_code' }, 'verify-email hit without code')
    return NextResponse.redirect(new URL('/login?error=missing_code', origin))
  }

  const supabase = await createServerClient()
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
  if (exchangeError) {
    authLogger.warn({ errCode: exchangeError.code }, 'verify-email exchange failed')
    return NextResponse.redirect(new URL('/login?error=verify_failed', origin))
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(new URL('/login?error=verify_failed', origin))
  }

  await markEmailVerified(user.id)

  const member = await db.query.workspaceMembers.findFirst({
    where: eq(workspaceMembers.userId, user.id),
    columns: { workspaceId: true },
  })

  if (!member) {
    authLogger.error({ userId: user.id }, 'workspace not found for verified user')
    return NextResponse.redirect(new URL('/login?error=missing_workspace', origin))
  }

  const expiresAt = new Date(Date.now() + SIGNUP_BONUS_DAYS * 24 * 60 * 60 * 1000)
  await allocate(member.workspaceId, SIGNUP_BONUS_AMOUNT, 'signup_bonus', expiresAt, {
    idempotencyKey: `signup_bonus_${user.id}`,
    userId: user.id,
    metadata: { trigger: 'email_verification' },
  })

  return NextResponse.redirect(new URL('/bem-vindo', origin))
}
