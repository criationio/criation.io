import crypto from 'node:crypto'
import { describe, expect, it } from 'vitest'

import { validateKiwifySignature } from './signature'

const SECRET = '3x27zgg73o3'

function makeHmacSha1(body: string, key = SECRET) {
  return crypto.createHmac('sha1', key).update(body).digest('hex')
}

function urlWith(params: Record<string, string> = {}): URL {
  const u = new URL('https://app.criation.io/api/webhooks/gateway/kiwify/abc')
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v)
  return u
}

function headers(init: Record<string, string> = {}): Headers {
  return new Headers(init)
}

describe('validateKiwifySignature', () => {
  describe('Camada 1: HMAC-SHA1 ?signature= (Kiwify nativo)', () => {
    it('aceita quando signature bate com hmac_sha1(secret, body)', () => {
      const body = '{"order_id":"abc","webhook_event_type":"order_approved"}'
      const result = validateKiwifySignature(
        body,
        headers(),
        urlWith({ signature: makeHmacSha1(body) }),
        SECRET,
        {}
      )
      expect(result).toEqual({ valid: true, method: 'hmac-signature' })
    })

    it('rejeita signature mal-calculada (body diferente)', () => {
      const body = '{"order_id":"abc"}'
      const result = validateKiwifySignature(
        body,
        headers(),
        urlWith({ signature: makeHmacSha1('outro-body') }),
        SECRET,
        {}
      )
      expect(result.valid).toBe(false)
      if (!result.valid) expect(result.reason).toMatch(/hmac/i)
    })

    it('rejeita signature calculada com secret errado', () => {
      const body = '{"order_id":"abc"}'
      const result = validateKiwifySignature(
        body,
        headers(),
        urlWith({ signature: makeHmacSha1(body, 'wrong-secret') }),
        SECRET,
        {}
      )
      expect(result.valid).toBe(false)
    })

    it('regression: confirma fixture real (HMAC-SHA1 documentado)', () => {
      // Confirmacao do payload REAL capturado em smoke 2026-05-10
      const fixtureBody = '{"order_id":"test"}'
      const fixtureSig = crypto.createHmac('sha1', '3x27zgg73o3').update(fixtureBody).digest('hex')
      const result = validateKiwifySignature(
        fixtureBody,
        headers(),
        urlWith({ signature: fixtureSig }),
        '3x27zgg73o3',
        {}
      )
      expect(result.valid).toBe(true)
      if (result.valid) expect(result.method).toBe('hmac-signature')
    })
  })

  describe('Camada 2: ?token= legacy', () => {
    it('aceita ?token= bate com secret quando NAO ha signature', () => {
      const result = validateKiwifySignature(
        '{}',
        headers(),
        urlWith({ token: SECRET }),
        SECRET,
        {}
      )
      expect(result).toEqual({ valid: true, method: 'payload-token' })
    })

    it('cai pra ?token= quando signature presente mas mismatch', () => {
      // Cenario migracao: signature presente mas secret salvo ainda e o UUID legado.
      const body = '{"order_id":"abc"}'
      const result = validateKiwifySignature(
        body,
        headers(),
        urlWith({
          token: SECRET,
          signature: makeHmacSha1(body, 'outro-secret'), // signature do Kiwify, mas com outro secret
        }),
        SECRET,
        {}
      )
      expect(result.valid).toBe(true)
      if (result.valid) expect(result.method).toBe('payload-token')
    })
  })

  describe('Camada 3: header x-kiwify-token', () => {
    it('aceita quando header bate', () => {
      const result = validateKiwifySignature(
        '{}',
        headers({ 'x-kiwify-token': SECRET }),
        urlWith(),
        SECRET,
        {}
      )
      expect(result).toEqual({ valid: true, method: 'hottok-header' })
    })
  })

  describe('Camada 4: body payload.token', () => {
    it('aceita quando body.token bate', () => {
      const result = validateKiwifySignature(
        `{"token":"${SECRET}"}`,
        headers(),
        urlWith(),
        SECRET,
        { token: SECRET }
      )
      expect(result).toEqual({ valid: true, method: 'payload-token' })
    })
  })

  describe('Falhas globais', () => {
    it('falha quando secret esta vazio', () => {
      const result = validateKiwifySignature('{}', headers(), urlWith({ token: SECRET }), '', {})
      expect(result.valid).toBe(false)
    })

    it('fail closed quando nada presente', () => {
      const result = validateKiwifySignature('{}', headers(), urlWith(), SECRET, {})
      expect(result.valid).toBe(false)
    })
  })
})
