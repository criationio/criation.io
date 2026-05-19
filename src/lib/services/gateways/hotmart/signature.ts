import crypto from 'node:crypto'

import type { SignatureValidationResult } from '../types'

/**
 * Validacao tri-camada da assinatura Hotmart Postback v2 (ADR-016 dec.2 +
 * descobertas do smoke test E2E em sandbox real, 2026-05-09).
 *
 * Hotmart envia o HOTTOK por DOIS canais coexistentes (mesmo evento pode
 * vir com payload OU header, ou os dois):
 *
 *   1. **HOTTOK no payload** (`payload.hottok`): campo no JSON v2 (e v1
 *      legacy). Quando presente, comparamos PLAIN com o secret salvo.
 *   2. **HOTTOK no header** (`x-hotmart-hottok`): mesmo HOTTOK em PLAIN,
 *      enviado em todos webhooks v2 (descoberto no smoke real). Eventos
 *      como `PURCHASE_OUT_OF_SHOPPING_CART` chegam apenas com este header
 *      (sem `hottok` no body).
 *   3. **HMAC** (`x-hotmart-signature`): assinatura HMAC-SHA256 do raw body
 *      com o HOTTOK como secret. Opt-in em algumas contas; fallback para
 *      contas que ativarem assinatura criptografica.
 *
 * Aceita se QUALQUER UM dos tres bate. Fail closed se nenhum valida.
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

  // Camada 1: HOTTOK no payload (presente em v1 e v2 quando body tem campo)
  if (payload.hottok && constantTimeEqual(payload.hottok, webhookSecret)) {
    return { valid: true, method: 'payload-token' }
  }

  // Camada 2: x-hotmart-hottok header — HOTTOK em PLAIN (nao HMAC).
  // Sempre presente em webhooks v2 reais. Eventos como OUT_OF_SHOPPING_CART
  // chegam so com header, sem `hottok` no body.
  const hottokHeader = headers.get('x-hotmart-hottok')
  if (hottokHeader && constantTimeEqual(hottokHeader.trim(), webhookSecret)) {
    return { valid: true, method: 'hottok-header' }
  }

  // Camada 3: x-hotmart-signature — HMAC-SHA256 do raw body. Opt-in.
  const sigHeader = headers.get('x-hotmart-signature')
  if (sigHeader) {
    const expected = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex')
    if (constantTimeEqual(sigHeader.trim().toLowerCase(), expected.toLowerCase())) {
      return { valid: true, method: 'hmac-signature' }
    }
    return { valid: false, reason: 'hmac signature mismatch' }
  }

  if (payload.hottok) return { valid: false, reason: 'payload hottok mismatch' }
  if (hottokHeader) return { valid: false, reason: 'hottok header mismatch' }
  return { valid: false, reason: 'no signature present' }
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
