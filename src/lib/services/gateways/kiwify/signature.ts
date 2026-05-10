import crypto from 'node:crypto'

import type { SignatureValidationResult } from '../types'

/**
 * Validacao tri-camada do token Kiwify (ADR-017 dec.2).
 *
 * Diferente do Hotmart, Kiwify NAO usa HMAC. O cliente define um `token`
 * arbitrario na criacao do webhook (recomendamos UUIDv4 — gerado pelo
 * nosso wizard). Kiwify entrega o mesmo token em todo webhook inbound,
 * mas a doc oficial nao especifica ONDE (query string vs header vs body).
 *
 * Camadas (em ordem de prioridade — comparacao plain, sem HMAC):
 *
 *   1. **Query string** `?token=xxx` — padrao reportado pela comunidade
 *   2. **Header** `x-kiwify-token` — fallback comum
 *   3. **Body** `payload.token` — alguns providers fazem isso
 *
 * Aceita o primeiro que bate. Fail closed se nenhum.
 *
 * Smoke test E2E em Kiwify real vai confirmar onde o token chega de fato;
 * se for sempre query string, podemos simplificar no futuro.
 */
export function validateKiwifySignature(
  rawBody: string,
  headers: Headers,
  url: URL,
  webhookSecret: string,
  payload: { token?: string | undefined }
): SignatureValidationResult {
  if (!webhookSecret) {
    return { valid: false, reason: 'webhook secret missing' }
  }

  // Camada 1: query string ?token=
  const queryToken = url.searchParams.get('token')
  if (queryToken && constantTimeEqual(queryToken.trim(), webhookSecret)) {
    return { valid: true, method: 'payload-token' }
  }

  // Camada 2: header x-kiwify-token
  const headerToken = headers.get('x-kiwify-token')
  if (headerToken && constantTimeEqual(headerToken.trim(), webhookSecret)) {
    return { valid: true, method: 'hottok-header' }
  }

  // Camada 3: body payload.token
  if (payload.token && constantTimeEqual(payload.token.trim(), webhookSecret)) {
    return { valid: true, method: 'payload-token' }
  }

  // No-op para evitar warning de variavel nao usada (rawBody pode ser usado em futura camada HMAC opt-in)
  void rawBody

  if (queryToken) return { valid: false, reason: 'query token mismatch' }
  if (headerToken) return { valid: false, reason: 'header token mismatch' }
  if (payload.token) return { valid: false, reason: 'body token mismatch' }
  return { valid: false, reason: 'no token present' }
}

function constantTimeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8')
  const bufB = Buffer.from(b, 'utf8')
  if (bufA.length !== bufB.length) {
    crypto.timingSafeEqual(bufA, Buffer.alloc(bufA.length))
    return false
  }
  return crypto.timingSafeEqual(bufA, bufB)
}
