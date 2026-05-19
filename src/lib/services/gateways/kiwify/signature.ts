import crypto from 'node:crypto'

import type { SignatureValidationResult } from '../types'

/**
 * Validacao Kiwify (ADR-017 dec.2 — revisado pos-descoberta E2E 2026-05-10).
 *
 * Kiwify ENVIA dois parametros na query string em todo webhook:
 * - `?token=...` — preserva o que o consumidor colocou na URL configurada
 * - `?signature=<hex>` — **HMAC-SHA1(token_kiwify, raw_body) hex lowercase**
 *
 * Algoritmo confirmado empiricamente: 100% match em smoke real com
 * `hmac_sha1('3x27zgg73o3', raw_body) === 'ad7b65cd5adaed9f9786e76b243e779cc299579f'`.
 *
 * **Camadas (em ordem de prioridade):**
 *   1. **HMAC-SHA1 query `?signature=`** — primario. Nao depende de query
 *      string preservation (validamos hash do body, nao token plain).
 *   2. **Token plain `?token=`** — legacy/compat. Frágil mas funciona quando
 *      cliente colou nosso UUID na URL. Mantido durante migracao.
 *   3. **Header `x-kiwify-token`** — fallback inferido (nao observado em prod
 *      mas possivel em variantes/contas).
 *
 * Recomendacao UX: cliente cola TOKEN KIWIFY (gerado no painel Kiwify) no
 * nosso wizard. Salvamos como `webhookSecret`. Camada 1 valida via HMAC.
 * URL configurada na Kiwify fica limpa (sem `?token=`).
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

  // Camada 1: HMAC-SHA1 do raw body (Kiwify nativo, descoberto E2E)
  const signatureParam = url.searchParams.get('signature')
  if (signatureParam) {
    const expected = crypto.createHmac('sha1', webhookSecret).update(rawBody).digest('hex')
    if (constantTimeEqual(signatureParam.trim().toLowerCase(), expected.toLowerCase())) {
      return { valid: true, method: 'hmac-signature' }
    }
    // Signature presente mas nao bate — pode ser que o secret salvo seja o
    // UUID nosso legado (pre-migracao). Cai pras camadas seguintes.
  }

  // Camada 2: query string ?token= (legacy/compat com fluxo pre-2026-05-10)
  const queryToken = url.searchParams.get('token')
  if (queryToken && constantTimeEqual(queryToken.trim(), webhookSecret)) {
    return { valid: true, method: 'payload-token' }
  }

  // Camada 3: header x-kiwify-token (fallback nao observado em prod)
  const headerToken = headers.get('x-kiwify-token')
  if (headerToken && constantTimeEqual(headerToken.trim(), webhookSecret)) {
    return { valid: true, method: 'hottok-header' }
  }

  // Camada 4: body payload.token
  if (payload.token && constantTimeEqual(payload.token.trim(), webhookSecret)) {
    return { valid: true, method: 'payload-token' }
  }

  if (signatureParam) return { valid: false, reason: 'hmac signature mismatch' }
  if (queryToken) return { valid: false, reason: 'query token mismatch' }
  if (headerToken) return { valid: false, reason: 'header token mismatch' }
  if (payload.token) return { valid: false, reason: 'body token mismatch' }
  return { valid: false, reason: 'no token or signature present' }
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
