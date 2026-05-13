import crypto from 'node:crypto'

import { redis } from '@/lib/rate-limit/upstash'

const STATE_TTL_SECONDS = 600 // 10min

const PROVIDER_KEYS = {
  meta: 'oauth:state:meta',
  google: 'oauth:state:google',
} as const

export type OAuthProvider = keyof typeof PROVIDER_KEYS

export interface OAuthStatePayload {
  userId: string
  workspaceId: string
  returnTo: string
  createdAt: number
  /** PKCE code_verifier — obrigatorio pra fluxos com PKCE (Google).
   * Verifier vai no token exchange; challenge SHA-256 ja foi no /auth URL.
   * Meta nao usa PKCE — campo fica undefined nesse fluxo. */
  codeVerifier?: string
}

/**
 * Cria state token para fluxo OAuth. UUID v4 + payload em Upstash com
 * TTL 10min. Token e one-shot — `consume` deleta apos ler. Protege
 * contra CSRF e replay.
 */
export async function generateState(
  provider: OAuthProvider,
  payload: Omit<OAuthStatePayload, 'createdAt'>
): Promise<string> {
  const token = crypto.randomUUID()
  const key = `${PROVIDER_KEYS[provider]}:${token}`
  const value: OAuthStatePayload = { ...payload, createdAt: Date.now() }
  await redis.set(key, JSON.stringify(value), { ex: STATE_TTL_SECONDS })
  return token
}

/**
 * Le e DELETA o state token. Retorna null se nao existir/expirado.
 * One-shot: chamada subsequente com mesmo token retorna null.
 */
export async function consumeState(
  provider: OAuthProvider,
  token: string
): Promise<OAuthStatePayload | null> {
  const key = `${PROVIDER_KEYS[provider]}:${token}`
  const raw = await redis.get<string | OAuthStatePayload>(key)
  if (raw === null) return null
  await redis.del(key)
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as OAuthStatePayload
    } catch {
      return null
    }
  }
  return raw as OAuthStatePayload
}
