'use server'

import { headers } from 'next/headers'

import { AUTH_ERROR_CODES, type AuthOutcome } from '@/lib/errors/auth'
import {
  loginLimiter,
  magicLinkLimiter,
  resetLimiter,
  signupLimiter,
} from '@/lib/rate-limit/upstash'
import { getClientIp } from '@/lib/security/client-ip'
import { hashIp, hashUserAgent } from '@/lib/security/hash'
import { getRequestOrigin } from '@/lib/security/request-origin'
import {
  loginWithPassword,
  requestPasswordReset,
  sendMagicLink,
  signOut,
  signupWithPassword,
  updatePassword,
} from '@/lib/services/auth.service'
import {
  loginSchema,
  magicLinkSchema,
  resetPasswordSchema,
  resetRequestSchema,
  signupSchema,
} from '@/lib/validators/auth'
import { authLogger } from '@/lib/logger'

export type ActionResult = AuthOutcome<{ redirectTo?: string; message?: string }>

async function getRequestContext(): Promise<{
  ip: string
  ipHash: string | null
  userAgentHash: string | null
}> {
  const headersList = await headers()
  const ip = getClientIp(headersList)
  const ua = headersList.get('user-agent')
  return {
    ip,
    ipHash: ip === 'unknown' ? null : hashIp(ip),
    userAgentHash: ua ? hashUserAgent(ua) : null,
  }
}

function rateLimitResult(retryAfterSeconds: number): ActionResult {
  return {
    ok: false,
    error: {
      code: AUTH_ERROR_CODES.RATE_LIMITED,
      message: `aguarde ${retryAfterSeconds}s antes de tentar novamente`,
    },
  }
}

function zodErrorToShape(
  issues: readonly { readonly path: readonly PropertyKey[]; readonly message: string }[]
): ActionResult {
  const first = issues[0]
  const fieldKey = first?.path[0]
  const error: { code: string; message: string; field?: string } = {
    code: 'VALIDATION',
    message: first?.message ?? 'dados invalidos',
  }
  if (typeof fieldKey === 'string') {
    error.field = fieldKey
  }
  return { ok: false, error }
}

export async function signupAction(formData: FormData): Promise<ActionResult> {
  // Honeypot — silent reject para enganar bots.
  const honey = formData.get('honeypot')
  if (typeof honey === 'string' && honey.length > 0) {
    authLogger.warn({ event: 'honeypot_triggered' }, 'silent signup rejection')
    return { ok: true, data: { redirectTo: '/verificar-email' } }
  }

  const ctx = await getRequestContext()

  // Rate limit por IP.
  const limit = await signupLimiter.limit(`ip:${ctx.ip}`)
  if (!limit.success) {
    return rateLimitResult(Math.ceil((limit.reset - Date.now()) / 1000))
  }

  const parsed = signupSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    fingerprint: formData.get('fingerprint') ?? undefined,
  })
  if (!parsed.success) return zodErrorToShape(parsed.error.issues)

  const origin = await getRequestOrigin()

  const result = await signupWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
    origin,
    signupContext: {
      ipHash: ctx.ipHash,
      userAgentHash: ctx.userAgentHash,
      fingerprint: parsed.data.fingerprint ?? null,
    },
  })

  if (!result.ok) return result
  return { ok: true, data: { redirectTo: '/verificar-email' } }
}

export async function loginAction(formData: FormData): Promise<ActionResult> {
  const ctx = await getRequestContext()

  const limit = await loginLimiter.limit(`ip:${ctx.ip}`)
  if (!limit.success) {
    return rateLimitResult(Math.ceil((limit.reset - Date.now()) / 1000))
  }

  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })
  if (!parsed.success) return zodErrorToShape(parsed.error.issues)

  const result = await loginWithPassword(parsed.data)
  if (!result.ok) return result
  return { ok: true, data: { redirectTo: '/dashboard' } }
}

export async function requestMagicLinkAction(formData: FormData): Promise<ActionResult> {
  const ctx = await getRequestContext()

  const limit = await magicLinkLimiter.limit(`ip:${ctx.ip}`)
  if (!limit.success) {
    return rateLimitResult(Math.ceil((limit.reset - Date.now()) / 1000))
  }

  const parsed = magicLinkSchema.safeParse({ email: formData.get('email') })
  if (!parsed.success) return zodErrorToShape(parsed.error.issues)

  const origin = await getRequestOrigin()
  await sendMagicLink({ email: parsed.data.email, origin })
  return {
    ok: true,
    data: { message: 'Se o email existir, voce vai receber um link em alguns minutos.' },
  }
}

export async function requestPasswordResetAction(formData: FormData): Promise<ActionResult> {
  const ctx = await getRequestContext()

  const limit = await resetLimiter.limit(`ip:${ctx.ip}`)
  if (!limit.success) {
    return rateLimitResult(Math.ceil((limit.reset - Date.now()) / 1000))
  }

  const parsed = resetRequestSchema.safeParse({ email: formData.get('email') })
  if (!parsed.success) return zodErrorToShape(parsed.error.issues)

  const origin = await getRequestOrigin()
  await requestPasswordReset({ email: parsed.data.email, origin })
  return {
    ok: true,
    data: { message: 'Se o email existir, voce vai receber um link em alguns minutos.' },
  }
}

export async function updatePasswordAction(formData: FormData): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse({
    password: formData.get('password'),
    passwordConfirm: formData.get('passwordConfirm'),
  })
  if (!parsed.success) return zodErrorToShape(parsed.error.issues)

  const result = await updatePassword({ password: parsed.data.password })
  if (!result.ok) return result
  return { ok: true, data: { redirectTo: '/login?reset=ok' } }
}

export async function signOutAction(): Promise<ActionResult> {
  await signOut()
  return { ok: true, data: { redirectTo: '/login' } }
}
