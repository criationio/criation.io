import crypto from 'node:crypto'

import type { SignatureValidationResult } from '../types'

/**
 * Validacao dual-mode da assinatura Hotmart Postback v2 (ADR-016 dec.2).
 *
 * Hotmart envia assinatura por DOIS canais coexistentes (doc oficial e vaga;
 * comunidade reporta inconsistencia entre contas):
 *
 *   1. **HOTTOK no payload**: campo `hottok` no JSON. Comparamos com o secret
 *      armazenado em `gateway_connections.webhook_secret` (cifrado plain).
 *   2. **HMAC header**: `x-hotmart-signature` ou `x-hotmart-hottok` =
 *      `hmac_sha256(secret, raw_body).digest('hex')`.
 *
 * Validamos AMBOS quando presentes; aceita se qualquer um bate. Se nenhum bate,
 * fail closed.
 *
 * **Atencao**: HMAC e validado contra o RAW body (string exata recebida no
 * `req.text()`), NUNCA contra `JSON.stringify(parsed)`. Causa #1 de signature
 * mismatch em integracoes Node — JSON re-stringified perde whitespace e ordem.
 */
export function validateHotmartSignature(
  rawBody: string,
  headers: Headers,
  webhookSecret: string,
  payload: { hottok?: string | undefined }
): SignatureValidationResult {
  if (!webhookSecret) {
    return { valid: false, reason: 'webhook secret missing' }
  }

  // Camada 1: HOTTOK no payload (presente em v1 e v2)
  if (payload.hottok && constantTimeEqual(payload.hottok, webhookSecret)) {
    return { valid: true, method: 'payload-token' }
  }

  // Camada 2: HMAC header (v2 moderno, opt-in em algumas contas)
  const sigHeader = headers.get('x-hotmart-signature') ?? headers.get('x-hotmart-hottok')
  if (sigHeader) {
    const expected = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex')
    if (constantTimeEqual(sigHeader.trim().toLowerCase(), expected.toLowerCase())) {
      return { valid: true, method: 'hmac-header' }
    }
    return { valid: false, reason: 'hmac mismatch' }
  }

  return { valid: false, reason: payload.hottok ? 'hottok mismatch' : 'no signature present' }
}

/**
 * `crypto.timingSafeEqual` exige Buffers do mesmo tamanho. Wrapper que
 * normaliza e e safe para inputs de tamanhos diferentes (retorna false sem
 * throw, em tempo constante).
 */
function constantTimeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8')
  const bufB = Buffer.from(b, 'utf8')
  if (bufA.length !== bufB.length) {
    // Dummy comparison de tamanho igual para nao vazar info via timing.
    crypto.timingSafeEqual(bufA, Buffer.alloc(bufA.length))
    return false
  }
  return crypto.timingSafeEqual(bufA, bufB)
}
