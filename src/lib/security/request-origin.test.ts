import { describe, expect, it } from 'vitest'

import { isAllowedOrigin } from './request-origin'

describe('isAllowedOrigin — allowlist accepts', () => {
  it('accepts localhost on dev port', () => {
    expect(isAllowedOrigin('http://localhost:3000')).toBe(true)
  })

  it('accepts localhost on any port (vite/storybook)', () => {
    expect(isAllowedOrigin('http://localhost:5173')).toBe(true)
  })

  it('accepts 127.0.0.1 loopback', () => {
    expect(isAllowedOrigin('http://127.0.0.1:3000')).toBe(true)
  })

  it('accepts criation.io apex', () => {
    expect(isAllowedOrigin('https://criation.io')).toBe(true)
  })

  it('accepts app.criation.io subdomain', () => {
    expect(isAllowedOrigin('https://app.criation.io')).toBe(true)
  })

  it('accepts adm.criation.io subdomain', () => {
    expect(isAllowedOrigin('https://adm.criation.io')).toBe(true)
  })

  it('accepts Vercel preview matching project pattern', () => {
    expect(
      isAllowedOrigin('https://criation-io-feat-auth-1-1-criationios-projects.vercel.app')
    ).toBe(true)
  })

  it('accepts NEXT_PUBLIC_APP_URL fallback when injected', () => {
    expect(isAllowedOrigin('https://staging.example.com', 'staging.example.com')).toBe(true)
  })
})

describe('isAllowedOrigin — allowlist rejects', () => {
  it('rejects unknown domain', () => {
    expect(isAllowedOrigin('https://evil.com')).toBe(false)
  })

  it('rejects substring trap (criation.io appears in path)', () => {
    expect(isAllowedOrigin('https://evil.com/criation.io')).toBe(false)
  })

  it('rejects suffix trap (subdomain ends with criation.io but is not subdomain)', () => {
    expect(isAllowedOrigin('https://app.criation.io.evil.com')).toBe(false)
  })

  it('rejects prefix trap (host starts with criation.io but is not the apex)', () => {
    expect(isAllowedOrigin('https://criation.io.evil.com')).toBe(false)
  })

  it('rejects Vercel domain outside team scope', () => {
    expect(isAllowedOrigin('https://criation-x.vercel.app')).toBe(false)
  })

  it('rejects Vercel domain with different team', () => {
    expect(isAllowedOrigin('https://criation-foo-other-team.vercel.app')).toBe(false)
  })

  it('rejects unparseable origin', () => {
    expect(isAllowedOrigin('not-a-url')).toBe(false)
  })

  it('rejects ftp protocol', () => {
    expect(isAllowedOrigin('ftp://criation.io')).toBe(false)
  })

  it('rejects criation.io with non-default port (defense in depth)', () => {
    expect(isAllowedOrigin('https://criation.io:8443')).toBe(false)
  })

  it('rejects NEXT_PUBLIC_APP_URL fallback when host differs', () => {
    expect(isAllowedOrigin('https://other.example.com', 'staging.example.com')).toBe(false)
  })

  it('rejects when no fallback hostname is provided and origin not in static list', () => {
    expect(isAllowedOrigin('https://staging.example.com', null)).toBe(false)
  })
})
