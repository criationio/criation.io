import { headers } from 'next/headers'

import { env } from '@/env'
import { AUTH_ERROR_CODES, AuthError } from '@/lib/errors/auth'

const VERCEL_PREVIEW_RE = /^criation-[a-z0-9-]+-criationios-projects\.vercel\.app$/

function getAppUrlHostname(): string | null {
  if (!env.NEXT_PUBLIC_APP_URL) return null
  try {
    return new URL(env.NEXT_PUBLIC_APP_URL).hostname
  } catch {
    return null
  }
}

/**
 * Verifica se um origin string e aceito pelo allowlist. Pure function
 * — recebe `appUrlHostname` opcional para evitar leitura de env em
 * testes; default le do env.NEXT_PUBLIC_APP_URL.
 *
 * Allowlist:
 *   1. localhost / 127.0.0.1 (dev) — qualquer porta
 *   2. criation-*-criationios-projects.vercel.app (Vercel preview deploys)
 *   3. criation.io e subdominios *.criation.io (prod)
 *   4. NEXT_PUBLIC_APP_URL hostname (fallback explicito)
 *
 * Defesa contra Host header injection: parse via new URL(), comparacao
 * de hostname (nao substring), porta default obrigatoria fora de localhost.
 */
export function isAllowedOrigin(
  origin: string,
  appUrlHostname: string | null = getAppUrlHostname()
): boolean {
  let url: URL
  try {
    url = new URL(origin)
  } catch {
    return false
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false

  const hostname = url.hostname

  // 1. localhost / loopback — qualquer porta aceita.
  if (hostname === 'localhost' || hostname === '127.0.0.1') return true

  // Fora de localhost: porta deve ser default.
  if (url.port !== '') return false

  // 2. Vercel preview deploys do team criationios-projects.
  if (VERCEL_PREVIEW_RE.test(hostname)) return true

  // 3. Dominio prod + subdominios.
  if (hostname === 'criation.io' || hostname.endsWith('.criation.io')) return true

  // 4. Fallback explicito via NEXT_PUBLIC_APP_URL.
  if (appUrlHostname && hostname === appUrlHostname) return true

  return false
}

/**
 * Resolve o origin do request atual a partir de headers HTTP. Usado
 * em Server Actions e Route Handlers para gerar URLs de callback
 * absolutas (Supabase Auth emailRedirectTo / redirectTo).
 *
 * Throws AuthError(MISSING_HOST_HEADER) se nao houver Host.
 * Throws AuthError(UNTRUSTED_ORIGIN) se Host nao bater no allowlist
 * — defesa contra Host header injection que poderia direcionar links
 * de email para dominio do atacante.
 */
export async function getRequestOrigin(): Promise<string> {
  const h = await headers()
  const hostRaw = h.get('x-forwarded-host') ?? h.get('host')
  if (!hostRaw) {
    throw new AuthError(AUTH_ERROR_CODES.MISSING_HOST_HEADER, 'Host header required')
  }
  const host = (hostRaw.split(',')[0] ?? '').trim()
  if (!host) {
    throw new AuthError(AUTH_ERROR_CODES.MISSING_HOST_HEADER, 'Host header required')
  }

  const protoHeader = h.get('x-forwarded-proto')
  const protoFirst = protoHeader ? (protoHeader.split(',')[0] ?? '').trim() : ''
  const proto =
    protoFirst !== ''
      ? protoFirst
      : host.startsWith('localhost') || host.startsWith('127.')
        ? 'http'
        : 'https'

  const origin = `${proto}://${host}`
  if (!isAllowedOrigin(origin)) {
    throw new AuthError(AUTH_ERROR_CODES.UNTRUSTED_ORIGIN, `Origin ${origin} not allowed`)
  }
  return origin
}
