import crypto from 'node:crypto'

import { eq } from 'drizzle-orm'

import { db } from '@/lib/db'
import { users, workspaceMembers, workspaces } from '@/lib/db/schema/auth'
import { auditLogs } from '@/lib/db/schema/audit'
import { countRecentSignupsByIpHash } from '@/lib/db/queries/users'
import { authLogger } from '@/lib/logger'
import { createServerClient } from '@/lib/supabase/server'

import { AUTH_ERROR_CODES, AuthError, type AuthOutcome } from '@/lib/errors/auth'

import { env } from '@/env'

export interface SignupContext {
  ipHash: string | null
  userAgentHash: string | null
  fingerprint: string | null
}

export interface SignupResult {
  userId: string
  workspaceId: string
}

function workspaceSlug(email: string): string {
  const local = (email.split('@')[0] ?? 'user')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .slice(0, 30)
  const suffix = crypto.randomBytes(4).toString('hex')
  return `${local}-${suffix}`
}

function callbackUrl(path: string): string {
  const base = env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  return `${base.replace(/\/$/, '')}${path}`
}

/**
 * Signup com email/senha. Cria auth.users via Supabase, mirror em
 * public.users com hashes anti-fraude, cria workspace + workspace_members
 * (role owner), e verifica padrao de fraude (>=3 signups do mesmo IP em
 * 24h gera audit_logs.fraud_alert_signup_burst — nao bloqueia).
 *
 * Email de verificacao e disparado pelo proprio Supabase Auth com
 * redirect para /api/auth/callback/verify-email.
 */
export async function signupWithPassword(input: {
  email: string
  password: string
  signupContext: SignupContext
}): Promise<AuthOutcome<SignupResult>> {
  const { email, password, signupContext } = input
  const supabase = await createServerClient()

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: callbackUrl('/api/auth/callback/verify-email'),
    },
  })

  if (error) {
    // Supabase emite varios codes; mapeamos os mais comuns.
    if (
      error.code === 'user_already_exists' ||
      error.message.toLowerCase().includes('already registered')
    ) {
      return {
        ok: false,
        error: { code: AUTH_ERROR_CODES.EMAIL_TAKEN, message: 'email ja cadastrado' },
      }
    }
    if (error.code === 'weak_password') {
      return {
        ok: false,
        error: { code: AUTH_ERROR_CODES.WEAK_PASSWORD, message: error.message },
      }
    }
    authLogger.error({ errCode: error.code, errStatus: error.status }, 'supabase signup failed')
    throw new AuthError(AUTH_ERROR_CODES.INTERNAL, 'falha no signup')
  }

  const authUser = data.user
  if (!authUser) {
    throw new AuthError(AUTH_ERROR_CODES.INTERNAL, 'supabase nao retornou user')
  }
  const userId = authUser.id

  const result = await db.transaction(async (tx) => {
    await tx
      .insert(users)
      .values({
        id: userId,
        email,
        signupIpHash: signupContext.ipHash,
        signupUserAgentHash: signupContext.userAgentHash,
        signupFingerprint: signupContext.fingerprint,
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          signupIpHash: signupContext.ipHash,
          signupUserAgentHash: signupContext.userAgentHash,
          signupFingerprint: signupContext.fingerprint,
          updatedAt: new Date(),
        },
      })

    const [workspace] = await tx
      .insert(workspaces)
      .values({
        name: email,
        slug: workspaceSlug(email),
      })
      .returning()

    if (!workspace) {
      throw new AuthError(AUTH_ERROR_CODES.INTERNAL, 'workspace insert nao retornou row')
    }

    await tx.insert(workspaceMembers).values({
      workspaceId: workspace.id,
      userId,
      role: 'owner',
      joinedAt: new Date(),
    })

    return { userId, workspaceId: workspace.id }
  })

  // Anti-fraud (D3): nao bloqueia, apenas registra alerta.
  if (signupContext.ipHash) {
    try {
      const count = await countRecentSignupsByIpHash(signupContext.ipHash)
      if (count >= 3) {
        await db.insert(auditLogs).values({
          eventType: 'fraud_alert_signup_burst',
          actorUserId: userId,
          ipHash: signupContext.ipHash,
          payload: { count, workspaceId: result.workspaceId },
        })
        authLogger.warn({ count }, 'signup burst detected')
      }
    } catch (err) {
      // Fraud check nao deve quebrar signup. Loga e segue.
      authLogger.error({ err }, 'fraud check failed')
    }
  }

  return { ok: true, data: result }
}

/**
 * Login email/senha. Erro generico ao caller — nao revela se email
 * existe. Trata `email_not_confirmed` separado pois UX precisa
 * direcionar para reenvio do link.
 */
export async function loginWithPassword(input: {
  email: string
  password: string
}): Promise<AuthOutcome<{ userId: string }>> {
  const supabase = await createServerClient()
  const { data, error } = await supabase.auth.signInWithPassword(input)

  if (error) {
    if (error.code === 'email_not_confirmed') {
      return {
        ok: false,
        error: { code: AUTH_ERROR_CODES.EMAIL_NOT_VERIFIED, message: 'verifique seu email' },
      }
    }
    return {
      ok: false,
      error: { code: AUTH_ERROR_CODES.INVALID_CREDENTIALS, message: 'email ou senha incorretos' },
    }
  }

  if (!data.user) {
    throw new AuthError(AUTH_ERROR_CODES.INTERNAL, 'login nao retornou user')
  }

  return { ok: true, data: { userId: data.user.id } }
}

/**
 * Magic link para login (nao para signup). `shouldCreateUser: false`
 * impede que magic link vire backdoor sem anti-fraude.
 */
export async function sendMagicLink(input: { email: string }): Promise<AuthOutcome<void>> {
  const supabase = await createServerClient()
  const { error } = await supabase.auth.signInWithOtp({
    email: input.email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: callbackUrl('/api/auth/callback'),
    },
  })

  if (error) {
    // Ainda assim retornamos sucesso para nao vazar existencia do email.
    authLogger.warn({ errCode: error.code }, 'magic link request error (silent)')
  }

  return { ok: true, data: undefined }
}

/**
 * Solicita reset de senha. Sempre retorna sucesso para nao vazar
 * existencia do email.
 */
export async function requestPasswordReset(input: { email: string }): Promise<AuthOutcome<void>> {
  const supabase = await createServerClient()
  const { error } = await supabase.auth.resetPasswordForEmail(input.email, {
    redirectTo: callbackUrl('/redefinir-senha'),
  })

  if (error) {
    authLogger.warn({ errCode: error.code }, 'reset request error (silent)')
  }

  return { ok: true, data: undefined }
}

/**
 * Aplica nova senha. Requer sessao ativa via cookie (callback de reset
 * popula a sessao antes de redirecionar para esta acao).
 */
export async function updatePassword(input: { password: string }): Promise<AuthOutcome<void>> {
  const supabase = await createServerClient()
  const { error } = await supabase.auth.updateUser({ password: input.password })

  if (error) {
    if (error.code === 'weak_password') {
      return {
        ok: false,
        error: { code: AUTH_ERROR_CODES.WEAK_PASSWORD, message: error.message },
      }
    }
    if (error.code === 'session_not_found' || error.status === 401) {
      return {
        ok: false,
        error: { code: AUTH_ERROR_CODES.TOKEN_EXPIRED, message: 'link expirado' },
      }
    }
    throw new AuthError(AUTH_ERROR_CODES.INTERNAL, 'falha ao atualizar senha')
  }

  return { ok: true, data: undefined }
}

export async function signOut(): Promise<AuthOutcome<void>> {
  const supabase = await createServerClient()
  await supabase.auth.signOut()
  return { ok: true, data: undefined }
}

/**
 * Marca email_verified_at em public.users. Chamado no callback de
 * verify-email apos Supabase confirmar o email.
 */
export async function markEmailVerified(userId: string): Promise<void> {
  await db.update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.id, userId))
}
