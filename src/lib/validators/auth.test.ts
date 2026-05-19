import { describe, expect, it } from 'vitest'

import { loginSchema, magicLinkSchema, resetPasswordSchema, signupSchema } from './auth'

describe('signupSchema', () => {
  it('accepts valid input', () => {
    const result = signupSchema.safeParse({
      email: 'TEST@example.com',
      password: 'abcdef1234',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.email).toBe('test@example.com') // lowercased + trimmed
    }
  })

  it('rejects password without digit', () => {
    const result = signupSchema.safeParse({
      email: 'a@b.com',
      password: 'abcdefghij',
    })
    expect(result.success).toBe(false)
  })

  it('rejects password without letter', () => {
    const result = signupSchema.safeParse({
      email: 'a@b.com',
      password: '1234567890',
    })
    expect(result.success).toBe(false)
  })

  it('rejects password under 10 chars', () => {
    const result = signupSchema.safeParse({
      email: 'a@b.com',
      password: 'abc1',
    })
    expect(result.success).toBe(false)
  })

  it('rejects honeypot non-empty', () => {
    const result = signupSchema.safeParse({
      email: 'a@b.com',
      password: 'abcdef1234',
      honeypot: 'bot-filled',
    })
    expect(result.success).toBe(false)
  })

  it('accepts when honeypot is empty string', () => {
    const result = signupSchema.safeParse({
      email: 'a@b.com',
      password: 'abcdef1234',
      honeypot: '',
    })
    expect(result.success).toBe(true)
  })

  it('accepts optional fingerprint', () => {
    const result = signupSchema.safeParse({
      email: 'a@b.com',
      password: 'abcdef1234',
      fingerprint: 'visitor-id-123',
    })
    expect(result.success).toBe(true)
  })

  it('rejects fingerprint over max length', () => {
    const result = signupSchema.safeParse({
      email: 'a@b.com',
      password: 'abcdef1234',
      fingerprint: 'x'.repeat(200),
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid email', () => {
    const result = signupSchema.safeParse({
      email: 'not-an-email',
      password: 'abcdef1234',
    })
    expect(result.success).toBe(false)
  })
})

describe('loginSchema', () => {
  it('accepts and lowercases email', () => {
    const result = loginSchema.safeParse({
      email: 'A@B.com',
      password: 'anything',
    })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.email).toBe('a@b.com')
  })

  it('rejects empty password', () => {
    const result = loginSchema.safeParse({ email: 'a@b.com', password: '' })
    expect(result.success).toBe(false)
  })
})

describe('magicLinkSchema', () => {
  it('lowercases email', () => {
    const result = magicLinkSchema.safeParse({ email: 'X@Y.com' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.email).toBe('x@y.com')
  })
})

describe('resetPasswordSchema', () => {
  it('rejects when passwords do not match', () => {
    const result = resetPasswordSchema.safeParse({
      password: 'abcdef1234',
      passwordConfirm: 'differs1234',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === 'passwordConfirm')).toBe(true)
    }
  })

  it('accepts when passwords match', () => {
    const result = resetPasswordSchema.safeParse({
      password: 'abcdef1234',
      passwordConfirm: 'abcdef1234',
    })
    expect(result.success).toBe(true)
  })
})
