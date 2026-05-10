import { describe, expect, it } from 'vitest'

import { validateKiwifySignature } from './signature'

const SECRET = 'b8c9c3e4-1f5a-4d3a-9d2e-7a6b1c8e2f3a'

function urlWith(token?: string): URL {
  const u = new URL('https://app.criation.io/api/webhooks/gateway/kiwify/abc')
  if (token) u.searchParams.set('token', token)
  return u
}

function headers(init: Record<string, string> = {}): Headers {
  return new Headers(init)
}

describe('validateKiwifySignature', () => {
  describe('Camada 1: query string ?token=', () => {
    it('aceita quando ?token= bate com secret', () => {
      const result = validateKiwifySignature('{}', headers(), urlWith(SECRET), SECRET, {})
      expect(result).toEqual({ valid: true, method: 'payload-token' })
    })

    it('rejeita quando ?token= diverge', () => {
      const result = validateKiwifySignature('{}', headers(), urlWith('wrong'), SECRET, {})
      expect(result.valid).toBe(false)
    })
  })

  describe('Camada 2: header x-kiwify-token', () => {
    it('aceita quando header bate com secret', () => {
      const result = validateKiwifySignature(
        '{}',
        headers({ 'x-kiwify-token': SECRET }),
        urlWith(),
        SECRET,
        {}
      )
      expect(result).toEqual({ valid: true, method: 'hottok-header' })
    })

    it('aceita header com whitespace ao redor', () => {
      const result = validateKiwifySignature(
        '{}',
        headers({ 'x-kiwify-token': `  ${SECRET}  ` }),
        urlWith(),
        SECRET,
        {}
      )
      expect(result.valid).toBe(true)
    })
  })

  describe('Camada 3: body payload.token', () => {
    it('aceita quando body.token bate com secret', () => {
      const result = validateKiwifySignature(
        `{"token":"${SECRET}","webhook_event_type":"compra_aprovada"}`,
        headers(),
        urlWith(),
        SECRET,
        { token: SECRET }
      )
      expect(result).toEqual({ valid: true, method: 'payload-token' })
    })
  })

  describe('Combinacoes', () => {
    it('query + header presentes: passa pela camada 1 (query)', () => {
      const result = validateKiwifySignature(
        '{}',
        headers({ 'x-kiwify-token': SECRET }),
        urlWith(SECRET),
        SECRET,
        {}
      )
      expect(result.valid).toBe(true)
      if (result.valid) expect(result.method).toBe('payload-token')
    })

    it('header presente sem query: passa pela camada 2', () => {
      const result = validateKiwifySignature(
        '{}',
        headers({ 'x-kiwify-token': SECRET }),
        urlWith(),
        SECRET,
        {}
      )
      expect(result.valid).toBe(true)
      if (result.valid) expect(result.method).toBe('hottok-header')
    })
  })

  describe('Falhas globais', () => {
    it('falha quando secret esta vazio', () => {
      const result = validateKiwifySignature('{}', headers(), urlWith(SECRET), '', {})
      expect(result.valid).toBe(false)
      if (!result.valid) expect(result.reason).toMatch(/secret/i)
    })

    it('fail closed quando nenhum lugar tem token', () => {
      const result = validateKiwifySignature('{}', headers(), urlWith(), SECRET, {})
      expect(result.valid).toBe(false)
    })
  })
})
