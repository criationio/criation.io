import crypto from 'node:crypto'
import { describe, expect, it } from 'vitest'

import { validateEduzzSignature } from './signature'

const SECRET = 'eduzz-secret-key-abc123'

function makeHmac(body: string, key = SECRET) {
  return crypto.createHmac('sha256', key).update(body).digest('hex')
}

function headers(init: Record<string, string> = {}): Headers {
  return new Headers(init)
}

describe('validateEduzzSignature', () => {
  it('aceita HMAC-SHA256 valido em x-signature header', () => {
    const body = '{"id":"abc","event":"myeduzz.invoice_paid","data":{},"sentDate":"2026-05-10T..."}'
    const result = validateEduzzSignature(body, headers({ 'x-signature': makeHmac(body) }), SECRET)
    expect(result).toEqual({ valid: true, method: 'hmac-signature' })
  })

  it('rejeita signature errada', () => {
    const body = '{"id":"abc"}'
    const result = validateEduzzSignature(
      body,
      headers({ 'x-signature': makeHmac(body, 'wrong-key') }),
      SECRET
    )
    expect(result.valid).toBe(false)
  })

  it('rejeita quando header ausente', () => {
    const result = validateEduzzSignature('{}', headers(), SECRET)
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.reason).toMatch(/header/i)
  })

  it('rejeita body diferente (tamper)', () => {
    const original = '{"id":"abc"}'
    const tampered = '{"id":"abc","tampered":true}'
    const result = validateEduzzSignature(
      tampered,
      headers({ 'x-signature': makeHmac(original) }),
      SECRET
    )
    expect(result.valid).toBe(false)
  })

  it('aceita signature com whitespace', () => {
    const body = '{}'
    const result = validateEduzzSignature(
      body,
      headers({ 'x-signature': `  ${makeHmac(body)}  ` }),
      SECRET
    )
    expect(result.valid).toBe(true)
  })

  it('rejeita quando secret esta vazio', () => {
    const result = validateEduzzSignature('{}', headers({ 'x-signature': makeHmac('{}') }), '')
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.reason).toMatch(/secret/i)
  })
})
