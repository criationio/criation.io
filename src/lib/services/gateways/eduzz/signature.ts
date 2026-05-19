import crypto from 'node:crypto'

import type { SignatureValidationResult } from '../types'

/**
 * Validacao Eduzz Webhook v3 (ADR-018).
 *
 * Eduzz documenta UMA forma oficial — HMAC-SHA256 do raw body, com a chave
 * secreta gerada pelo cliente em `integrations.eduzz.com/webhook/configs`.
 *
 *   signature = hmac_sha256(secret, raw_body).hex()
 *
 * Header: `x-signature` (lowercase hex).
 *
 * Sem fallbacks (Eduzz e claro, diferente de Hotmart/Kiwify que tem
 * variacoes nao documentadas). Fail closed em qualquer mismatch.
 */
export function validateEduzzSignature(
  rawBody: string,
  headers: Headers,
  webhookSecret: string
): SignatureValidationResult {
  if (!webhookSecret) {
    return { valid: false, reason: 'webhook secret missing' }
  }

  const sigHeader = headers.get('x-signature')
  if (!sigHeader) {
    return { valid: false, reason: 'x-signature header missing' }
  }

  const expected = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex')

  if (constantTimeEqual(sigHeader.trim().toLowerCase(), expected.toLowerCase())) {
    return { valid: true, method: 'hmac-signature' }
  }

  return { valid: false, reason: 'hmac signature mismatch' }
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
