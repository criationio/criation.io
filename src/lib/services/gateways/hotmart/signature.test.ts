import crypto from 'node:crypto'
import { describe, expect, it } from 'vitest'

import { validateHotmartSignature } from './signature'

const SECRET = 'super-secret-hottok-12345'

function makeHmac(body: string, secret = SECRET) {
  return crypto.createHmac('sha256', secret).update(body).digest('hex')
}

function headers(init: Record<string, string> = {}): Headers {
  return new Headers(init)
}

describe('validateHotmartSignature', () => {
  describe('Camada 1: HOTTOK no payload', () => {
    it('aceita quando payload.hottok bate com o secret', () => {
      const result = validateHotmartSignature(
        '{"hottok":"super-secret-hottok-12345"}',
        headers(),
        SECRET,
        { hottok: SECRET }
      )
      expect(result).toEqual({ valid: true, method: 'payload-token' })
    })

    it('rejeita quando payload.hottok diverge e nao ha header', () => {
      const result = validateHotmartSignature('{"hottok":"wrong-token"}', headers(), SECRET, {
        hottok: 'wrong-token',
      })
      expect(result.valid).toBe(false)
    })
  })

  describe('Camada 2: x-hotmart-hottok header (HOTTOK plain)', () => {
    it('aceita quando header bate com secret', () => {
      const result = validateHotmartSignature(
        '{"id":"abc"}',
        headers({ 'x-hotmart-hottok': SECRET }),
        SECRET,
        {}
      )
      expect(result).toEqual({ valid: true, method: 'hottok-header' })
    })

    it('aceita header com whitespace ao redor (trim)', () => {
      const result = validateHotmartSignature(
        '{}',
        headers({ 'x-hotmart-hottok': `  ${SECRET}  ` }),
        SECRET,
        {}
      )
      expect(result.valid).toBe(true)
    })

    it('NAO confunde HOTTOK header com HMAC (regression do bug 401)', () => {
      // Antes do fix, o header era tratado como HMAC do raw body. Como
      // hmac(SECRET, body) != SECRET, a validacao falhava em todos os
      // eventos sem `hottok` no payload (ex: OUT_OF_SHOPPING_CART).
      const body = '{"id":"abc","event":"PURCHASE_OUT_OF_SHOPPING_CART"}'
      const result = validateHotmartSignature(
        body,
        headers({ 'x-hotmart-hottok': SECRET }),
        SECRET,
        {}
      )
      expect(result.valid).toBe(true)
      if (result.valid) expect(result.method).toBe('hottok-header')
    })

    it('rejeita header errado', () => {
      const result = validateHotmartSignature(
        '{}',
        headers({ 'x-hotmart-hottok': 'wrong-token' }),
        SECRET,
        {}
      )
      expect(result.valid).toBe(false)
    })
  })

  describe('Camada 3: x-hotmart-signature header (HMAC)', () => {
    it('aceita quando hmac(raw_body, secret) bate', () => {
      const body = '{"id":"abc","event":"PURCHASE_APPROVED","data":{}}'
      const result = validateHotmartSignature(
        body,
        headers({ 'x-hotmart-signature': makeHmac(body) }),
        SECRET,
        {}
      )
      expect(result).toEqual({ valid: true, method: 'hmac-signature' })
    })

    it('rejeita signature mismatch quando body foi re-stringified (regression)', () => {
      const original = '{\n  "id": "abc",\n  "data": { "v": 1 }\n}'
      const restringified = JSON.stringify(JSON.parse(original))
      expect(restringified).not.toBe(original)
      const hmacOriginal = makeHmac(original)
      const result = validateHotmartSignature(
        restringified,
        headers({ 'x-hotmart-signature': hmacOriginal }),
        SECRET,
        {}
      )
      expect(result.valid).toBe(false)
    })

    it('rejeita HMAC computado com secret errado', () => {
      const body = '{"id":"abc"}'
      const result = validateHotmartSignature(
        body,
        headers({ 'x-hotmart-signature': makeHmac(body, 'wrong-secret') }),
        SECRET,
        {}
      )
      expect(result.valid).toBe(false)
    })
  })

  describe('Combinacoes', () => {
    it('payload + header presentes: passa pela camada 1', () => {
      const result = validateHotmartSignature(
        '{}',
        headers({ 'x-hotmart-hottok': SECRET }),
        SECRET,
        { hottok: SECRET }
      )
      expect(result.valid).toBe(true)
      if (result.valid) expect(result.method).toBe('payload-token')
    })

    it('header hottok presente sem payload: passa pela camada 2', () => {
      const result = validateHotmartSignature(
        '{}',
        headers({ 'x-hotmart-hottok': SECRET }),
        SECRET,
        {}
      )
      expect(result.valid).toBe(true)
      if (result.valid) expect(result.method).toBe('hottok-header')
    })
  })

  describe('Falhas globais', () => {
    it('falha quando secret esta vazio', () => {
      const result = validateHotmartSignature('{}', headers(), '', { hottok: 'x' })
      expect(result.valid).toBe(false)
      if (!result.valid) expect(result.reason).toMatch(/secret/i)
    })

    it('falha closed quando nao ha hottok no payload nem header', () => {
      const result = validateHotmartSignature('{}', headers(), SECRET, {})
      expect(result.valid).toBe(false)
    })
  })
})
