import { type NextRequest, NextResponse } from 'next/server'

import { AUTH_ERROR_CODES } from '@/lib/errors/auth'
import { signupLimiter } from '@/lib/rate-limit/upstash'
import { getClientIp } from '@/lib/security/client-ip'
import { hashIp, hashUserAgent } from '@/lib/security/hash'
import { signupWithPassword } from '@/lib/services/auth.service'
import { signupSchema } from '@/lib/validators/auth'
import { authLogger } from '@/lib/logger'

/**
 * POST /api/auth/signup
 *
 * Wrapper publico para clientes nao-Next (futuro: extension, mobile).
 * Mesma logica que signupAction (Server Action), mas com transporte
 * HTTP idempotente. Em producao o caminho default e via Server Action.
 */
export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  const ua = request.headers.get('user-agent')

  const limit = await signupLimiter.limit(`ip:${ip}`)
  if (!limit.success) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: AUTH_ERROR_CODES.RATE_LIMITED,
          retryAfterSeconds: Math.ceil((limit.reset - Date.now()) / 1000),
        },
      },
      { status: 429 }
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: 'INVALID_JSON', message: 'json invalido' } },
      { status: 400 }
    )
  }

  // Honeypot — silent ok.
  const honey = (body as Record<string, unknown> | null)?.honeypot
  if (typeof honey === 'string' && honey.length > 0) {
    authLogger.warn({ event: 'honeypot_triggered' }, 'silent signup rejection (api)')
    return NextResponse.json({ ok: true, data: { redirectTo: '/verificar-email' } })
  }

  const parsed = signupSchema.safeParse(body)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    const fieldKey = first?.path[0]
    const error: { code: string; message: string; field?: string } = {
      code: 'VALIDATION',
      message: first?.message ?? 'dados invalidos',
    }
    if (typeof fieldKey === 'string') {
      error.field = fieldKey
    }
    return NextResponse.json({ ok: false, error }, { status: 400 })
  }

  const result = await signupWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
    signupContext: {
      ipHash: ip === 'unknown' ? null : hashIp(ip),
      userAgentHash: ua ? hashUserAgent(ua) : null,
      fingerprint: parsed.data.fingerprint ?? null,
    },
  })

  if (!result.ok) {
    return NextResponse.json(result, { status: 400 })
  }

  return NextResponse.json({ ok: true, data: { redirectTo: '/verificar-email' } })
}
