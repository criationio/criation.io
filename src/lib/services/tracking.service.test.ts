import { describe, expect, it } from 'vitest'

import { extractClientIp, matchOrigin, pickPrimaryClickIdFromEvent } from './tracking.service'

describe('extractClientIp', () => {
  it('le X-Forwarded-For (primeira entry e o IP real do cliente)', () => {
    const h = new Headers({ 'x-forwarded-for': '203.0.113.5, 70.41.3.18, 150.172.238.178' })
    expect(extractClientIp(h)).toBe('203.0.113.5')
  })

  it('faz fallback pra X-Real-IP quando XFF ausente', () => {
    const h = new Headers({ 'x-real-ip': '198.51.100.42' })
    expect(extractClientIp(h)).toBe('198.51.100.42')
  })

  it('retorna null quando nem XFF nem XRI presentes', () => {
    const h = new Headers()
    expect(extractClientIp(h)).toBeNull()
  })

  it('trima espacos da entry XFF', () => {
    const h = new Headers({ 'x-forwarded-for': '   203.0.113.5  , 70.41.3.18  ' })
    expect(extractClientIp(h)).toBe('203.0.113.5')
  })
})

describe('pickPrimaryClickIdFromEvent', () => {
  it('prioriza fbclid acima de gclid', () => {
    const result = pickPrimaryClickIdFromEvent({ fbclid: 'FB', gclid: 'GC' })
    expect(result).toEqual({ id: 'FB', type: 'fbclid' })
  })

  it('prioriza gclid quando fbclid ausente', () => {
    const result = pickPrimaryClickIdFromEvent({ gclid: 'GC', ttclid: 'TT' })
    expect(result).toEqual({ id: 'GC', type: 'gclid' })
  })

  it('aceita ctwaClid (camelCase do schema Drizzle)', () => {
    const result = pickPrimaryClickIdFromEvent({ ctwaClid: 'CTWA' })
    expect(result).toEqual({ id: 'CTWA', type: 'ctwa_clid' })
  })

  it('retorna null quando nenhum click id presente', () => {
    expect(pickPrimaryClickIdFromEvent({})).toBeNull()
  })

  it('ordem de prioridade completa: fb > gc > tt > ms > ctwa > wb > gb', () => {
    expect(pickPrimaryClickIdFromEvent({ wbraid: 'W', gbraid: 'G' })).toEqual({
      id: 'W',
      type: 'wbraid',
    })
    expect(pickPrimaryClickIdFromEvent({ gbraid: 'G' })).toEqual({ id: 'G', type: 'gbraid' })
  })
})

describe('matchOrigin', () => {
  describe('host exato', () => {
    it('aceita host identico', () => {
      expect(matchOrigin('app.cliente.com', 'app.cliente.com')).toBe(true)
    })
    it('rejeita host diferente', () => {
      expect(matchOrigin('app.cliente.com', 'evil.com')).toBe(false)
    })
  })

  describe('host bare (acerta subdomains)', () => {
    it('cliente.com acerta cliente.com', () => {
      expect(matchOrigin('cliente.com', 'cliente.com')).toBe(true)
    })
    it('cliente.com acerta www.cliente.com', () => {
      expect(matchOrigin('cliente.com', 'www.cliente.com')).toBe(true)
    })
    it('cliente.com acerta app.cliente.com', () => {
      expect(matchOrigin('cliente.com', 'app.cliente.com')).toBe(true)
    })
    it('cliente.com NAO acerta evilcliente.com (defesa contra suffix attack)', () => {
      expect(matchOrigin('cliente.com', 'evilcliente.com')).toBe(false)
    })
  })

  describe('wildcard subdomain *.cliente.com', () => {
    it('aceita app.cliente.com', () => {
      expect(matchOrigin('*.cliente.com', 'app.cliente.com')).toBe(true)
    })
    it('aceita api.cliente.com', () => {
      expect(matchOrigin('*.cliente.com', 'api.cliente.com')).toBe(true)
    })
    it('rejeita cliente.com (root, nao subdomain)', () => {
      expect(matchOrigin('*.cliente.com', 'cliente.com')).toBe(false)
    })
    it('rejeita evil.com', () => {
      expect(matchOrigin('*.cliente.com', 'evil.com')).toBe(false)
    })
  })

  describe('normalizacao', () => {
    it('strip protocolo http://', () => {
      expect(matchOrigin('http://cliente.com', 'cliente.com')).toBe(true)
    })
    it('strip protocolo https://', () => {
      expect(matchOrigin('https://cliente.com', 'cliente.com')).toBe(true)
    })
    it('strip trailing slash', () => {
      expect(matchOrigin('cliente.com/', 'cliente.com')).toBe(true)
    })
    it('case insensitive (entry maiuscula vs lowercase host)', () => {
      expect(matchOrigin('CLIENTE.COM', 'cliente.com')).toBe(true)
    })
    it('rejeita entry vazia', () => {
      expect(matchOrigin('   ', 'cliente.com')).toBe(false)
    })
  })
})
