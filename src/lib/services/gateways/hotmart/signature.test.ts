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
  describe('HOTTOK no payload (camada 1)', () => {
    it('aceita quando payload.hottok bate com o secret', () => {
      const result = validateHotmartSignature(
        '{"hottok":"super-secret-hottok-12345"}',
        headers(),
        SECRET,
        { hottok: SECRET }
      )
      expect(result).toEqual({ valid: true, method: 'payload-token' })
    })

    it('rejeita quando payload.hottok diverge do secret e nao ha header', () => {
      const result = validateHotmartSignature('{"hottok":"wrong-token"}', headers(), SECRET, {
        hottok: 'wrong-token',
      })
      expect(result.valid).toBe(false)
    })
  })

  describe('HMAC header (camada 2)', () => {
    it('aceita quando x-hotmart-signature bate com hmac(raw_body, secret)', () => {
      const body = '{"id":"abc","event":"PURCHASE_APPROVED","data":{}}'
      const result = validateHotmartSignature(
        body,
        headers({ 'x-hotmart-signature': makeHmac(body) }),
        SECRET,
        {}
      )
      expect(result).toEqual({ valid: true, method: 'hmac-header' })
    })

    it('aceita o header alternativo x-hotmart-hottok com mesmo HMAC', () => {
      const body = '{"id":"def"}'
      const result = validateHotmartSignature(
        body,
        headers({ 'x-hotmart-hottok': makeHmac(body) }),
        SECRET,
        {}
      )
      expect(result.valid).toBe(true)
    })

    it('rejeita signature mismatch quando body foi re-stringified (regression)', () => {
      // Body original do Hotmart vem com whitespace pretty-printed em algumas
      // contas. JSON.parse + JSON.stringify remove o whitespace, mudando o
      // body byte-a-byte. HMAC original nao bate.
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

  describe('falhas globais', () => {
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
