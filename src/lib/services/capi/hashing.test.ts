import { describe, expect, it } from 'vitest'

import {
  hashForGoogle,
  hashForGoogleDataManager,
  hashForMeta,
  normalizeCity,
  normalizeCountryCode,
  normalizeDateOfBirth,
  normalizeExternalId,
  normalizeGender,
  normalizeName,
  normalizePhoneGoogle,
  normalizePhoneMeta,
  normalizeStateCode,
  normalizeZip,
  sha256Hex,
} from './hashing'

describe('sha256Hex', () => {
  it('produz hash lowercase hex de 64 chars', () => {
    const h = sha256Hex('test')
    expect(h).toHaveLength(64)
    expect(h).toMatch(/^[0-9a-f]{64}$/)
  })

  it('e deterministico pra mesmo input', () => {
    expect(sha256Hex('foo')).toBe(sha256Hex('foo'))
  })

  it('produz hashes diferentes pra inputs diferentes', () => {
    expect(sha256Hex('foo')).not.toBe(sha256Hex('bar'))
  })

  it('hash conhecido do email canonical Meta', () => {
    // 'test@example.com' → SHA-256 lowercase hex
    expect(sha256Hex('test@example.com')).toBe(
      '973dfe463ec85785f5f95af5ba3906eedb2d931c24e69824a89ea65dba4e813b'
    )
  })
})

describe('normalizeName', () => {
  it('lowercase + trim + remove espacos', () => {
    expect(normalizeName('  JoãO  ')).toBe('joão')
  })

  it('preserva diacritos UTF-8 (Meta accept)', () => {
    expect(normalizeName('María José')).toBe('maríajosé')
    expect(normalizeName('François')).toBe('françois')
    expect(normalizeName('Açúcar Çelik')).toBe('açúcarçelik')
  })

  it('remove digitos', () => {
    expect(normalizeName('John123')).toBe('john')
  })

  it('remove pontuacao', () => {
    expect(normalizeName("O'Brien-Smith")).toBe('obriensmith')
    expect(normalizeName('Jr.')).toBe('jr')
  })

  it('retorna null pra empty/whitespace/null', () => {
    expect(normalizeName('')).toBeNull()
    expect(normalizeName('   ')).toBeNull()
    expect(normalizeName(null)).toBeNull()
    expect(normalizeName(undefined)).toBeNull()
  })

  it('retorna null se sobra so digits/pontuacao', () => {
    expect(normalizeName('123!!')).toBeNull()
  })
})

describe('normalizeDateOfBirth', () => {
  it('extrai 8 digitos de ISO date', () => {
    expect(normalizeDateOfBirth('1990-01-15')).toBe('19900115')
  })

  it('extrai 8 digitos de formato BR DD/MM/YYYY', () => {
    // Nota: extrai mas mantem ordem do input — caller deve passar ISO
    expect(normalizeDateOfBirth('15/01/1990')).toBe('15011990')
  })

  it('aceita ja-normalizado YYYYMMDD', () => {
    expect(normalizeDateOfBirth('19900115')).toBe('19900115')
  })

  it('retorna null se nao tem exatamente 8 digitos', () => {
    expect(normalizeDateOfBirth('1990-1-15')).toBeNull() // 7 digitos
    expect(normalizeDateOfBirth('199001151')).toBeNull() // 9 digitos
    expect(normalizeDateOfBirth('abc')).toBeNull()
    expect(normalizeDateOfBirth('')).toBeNull()
  })
})

describe('normalizeGender', () => {
  it('mapeia variantes EN/PT pra primeiro char', () => {
    expect(normalizeGender('Female')).toBe('f')
    expect(normalizeGender('feminino')).toBe('f')
    expect(normalizeGender('Male')).toBe('m')
    expect(normalizeGender('masculino')).toBe('m')
    expect(normalizeGender('F')).toBe('f')
    expect(normalizeGender('m')).toBe('m')
  })

  it('retorna null pra non-binary ou desconhecido', () => {
    expect(normalizeGender('other')).toBeNull()
    expect(normalizeGender('non-binary')).toBeNull()
    expect(normalizeGender('x')).toBeNull()
    expect(normalizeGender('')).toBeNull()
    expect(normalizeGender(null)).toBeNull()
  })
})

describe('normalizeCity', () => {
  it('preserva diacritos BR', () => {
    expect(normalizeCity('São Paulo')).toBe('sãopaulo')
    expect(normalizeCity('Brasília')).toBe('brasília')
    expect(normalizeCity('Belém')).toBe('belém')
  })

  it('remove pontuacao + espacos', () => {
    expect(normalizeCity('New York')).toBe('newyork')
    expect(normalizeCity('Rio de Janeiro')).toBe('riodejaneiro')
    expect(normalizeCity('Saint-Tropez')).toBe('sainttropez')
  })

  it('retorna null pra empty', () => {
    expect(normalizeCity('')).toBeNull()
    expect(normalizeCity('  ')).toBeNull()
    expect(normalizeCity('123')).toBeNull() // so digits
  })
})

describe('normalizeStateCode', () => {
  it('aceita abreviacao 2-letter', () => {
    expect(normalizeStateCode('SP')).toBe('sp')
    expect(normalizeStateCode('rj')).toBe('rj')
    expect(normalizeStateCode(' MG ')).toBe('mg')
  })

  it('rejeita nome completo ou input longo', () => {
    expect(normalizeStateCode('Sao Paulo')).toBeNull()
    expect(normalizeStateCode('Rio de Janeiro')).toBeNull()
  })

  it('rejeita 1-char ou nao-letras', () => {
    expect(normalizeStateCode('S')).toBeNull()
    expect(normalizeStateCode('12')).toBeNull()
    expect(normalizeStateCode('')).toBeNull()
    expect(normalizeStateCode(null)).toBeNull()
  })
})

describe('normalizeZip', () => {
  it('BR: strip pontuacao + lowercase', () => {
    expect(normalizeZip('01310-100')).toBe('01310100')
    expect(normalizeZip('01310100')).toBe('01310100')
    expect(normalizeZip('  01310-100  ')).toBe('01310100')
  })

  it('US: primeiros 5 digitos', () => {
    expect(normalizeZip('90210-1234', 'us')).toBe('90210')
    expect(normalizeZip('90210', 'us')).toBe('90210')
  })

  it('US: rejeita se menos de 5 digitos', () => {
    expect(normalizeZip('9021', 'us')).toBeNull()
    expect(normalizeZip('abc', 'us')).toBeNull()
  })

  it('country code case-insensitive', () => {
    expect(normalizeZip('90210-1234', 'US')).toBe('90210')
  })

  it('retorna null pra empty', () => {
    expect(normalizeZip('')).toBeNull()
    expect(normalizeZip(null)).toBeNull()
  })
})

describe('normalizeCountryCode', () => {
  it('aceita 2-letter ISO lowercase', () => {
    expect(normalizeCountryCode('BR')).toBe('br')
    expect(normalizeCountryCode('us')).toBe('us')
    expect(normalizeCountryCode(' Gb ')).toBe('gb')
  })

  it('rejeita nome completo (precisa pre-normalizar)', () => {
    expect(normalizeCountryCode('Brazil')).toBeNull()
    expect(normalizeCountryCode('United States')).toBeNull()
  })

  it('rejeita 1-char ou nao-letras', () => {
    expect(normalizeCountryCode('B')).toBeNull()
    expect(normalizeCountryCode('1B')).toBeNull()
    expect(normalizeCountryCode('')).toBeNull()
  })
})

describe('normalizeExternalId', () => {
  it('lowercase + trim mas preserva chars especiais', () => {
    expect(normalizeExternalId('WS-123-abc')).toBe('ws-123-abc')
    expect(normalizeExternalId('  UUID-X-Y-Z  ')).toBe('uuid-x-y-z')
    expect(normalizeExternalId('user@workspace')).toBe('user@workspace')
  })

  it('retorna null pra empty/whitespace', () => {
    expect(normalizeExternalId('')).toBeNull()
    expect(normalizeExternalId('   ')).toBeNull()
    expect(normalizeExternalId(null)).toBeNull()
  })
})

describe('normalizePhoneMeta (sem +)', () => {
  it('adiciona codigo BR 55 pra movel sem prefix', () => {
    expect(normalizePhoneMeta('11999998888')).toBe('5511999998888')
  })

  it('adiciona codigo BR 55 pra fixo sem prefix', () => {
    expect(normalizePhoneMeta('1130001234')).toBe('551130001234')
  })

  it('strip mascara BR completa', () => {
    expect(normalizePhoneMeta('(11) 99999-8888')).toBe('5511999998888')
    expect(normalizePhoneMeta('+55 (11) 99999-8888')).toBe('5511999998888')
  })

  it('preserva codigo pais quando ja vem com +', () => {
    expect(normalizePhoneMeta('+5511999998888')).toBe('5511999998888')
    expect(normalizePhoneMeta('+14155551234')).toBe('14155551234')
  })

  it('retorna null pra empty', () => {
    expect(normalizePhoneMeta('')).toBeNull()
    expect(normalizePhoneMeta('   ')).toBeNull()
    expect(normalizePhoneMeta(null)).toBeNull()
  })
})

describe('normalizePhoneGoogle (com +)', () => {
  it('adiciona + pra phone E.164 sem prefix', () => {
    expect(normalizePhoneGoogle('11999998888')).toBe('+5511999998888')
  })

  it('preserva + quando ja existe', () => {
    expect(normalizePhoneGoogle('+5511999998888')).toBe('+5511999998888')
  })

  it('strip mascara mas adiciona +', () => {
    expect(normalizePhoneGoogle('(11) 99999-8888')).toBe('+5511999998888')
  })

  it('retorna null pra empty', () => {
    expect(normalizePhoneGoogle('')).toBeNull()
    expect(normalizePhoneGoogle(null)).toBeNull()
  })
})

describe('hashForMeta.email', () => {
  it('normaliza + sha256 lowercase hex', () => {
    const h = hashForMeta.email('Test@EXAMPLE.com')
    expect(h).toBe(sha256Hex('test@example.com'))
  })

  it('match canonical Meta exemplo joao@example.com', () => {
    // SHA-256('joao@example.com') = ...
    const h = hashForMeta.email('  JOAO@example.COM  ')
    expect(h).toBe(sha256Hex('joao@example.com'))
  })

  it('retorna null pra empty', () => {
    expect(hashForMeta.email('')).toBeNull()
    expect(hashForMeta.email(null)).toBeNull()
    expect(hashForMeta.email('   ')).toBeNull()
  })
})

describe('hashForMeta.phone vs hashForGoogle.phone', () => {
  it('Meta hash difere de Google hash pro MESMO phone (sem + vs com +)', () => {
    const phone = '+5511999998888'
    const metaH = hashForMeta.phone(phone)
    const googleH = hashForGoogle.phone(phone)
    expect(metaH).not.toBe(googleH)
  })

  it('Meta hash bate com sha256 do E.164 sem +', () => {
    expect(hashForMeta.phone('+55 (11) 99999-8888')).toBe(sha256Hex('5511999998888'))
  })

  it('Google hash bate com sha256 do E.164 com +', () => {
    expect(hashForGoogle.phone('+55 (11) 99999-8888')).toBe(sha256Hex('+5511999998888'))
  })

  it('retorna null pra empty em ambos', () => {
    expect(hashForMeta.phone('')).toBeNull()
    expect(hashForGoogle.phone(null)).toBeNull()
  })
})

describe('hashForMeta.firstName / lastName', () => {
  it('hash bate com sha256 do nome normalizado (diacritos preservados)', () => {
    expect(hashForMeta.firstName('João')).toBe(sha256Hex('joão'))
    expect(hashForMeta.lastName('SILVA')).toBe(sha256Hex('silva'))
  })

  it('retorna null pra nome invalido', () => {
    expect(hashForMeta.firstName('')).toBeNull()
    expect(hashForMeta.firstName('123!!')).toBeNull()
  })
})

describe('hashForMeta.dateOfBirth', () => {
  it('hash do YYYYMMDD', () => {
    expect(hashForMeta.dateOfBirth('1990-01-15')).toBe(sha256Hex('19900115'))
  })

  it('retorna null se nao tem 8 digitos', () => {
    expect(hashForMeta.dateOfBirth('bad')).toBeNull()
  })
})

describe('hashForMeta.gender', () => {
  it('hash do single char f/m', () => {
    expect(hashForMeta.gender('Female')).toBe(sha256Hex('f'))
    expect(hashForMeta.gender('M')).toBe(sha256Hex('m'))
  })

  it('null pra outros', () => {
    expect(hashForMeta.gender('other')).toBeNull()
  })
})

describe('hashForMeta.city / state / country', () => {
  it('city preserva diacritos BR', () => {
    expect(hashForMeta.city('São Paulo')).toBe(sha256Hex('sãopaulo'))
  })

  it('state aceita so 2-letter', () => {
    expect(hashForMeta.state('SP')).toBe(sha256Hex('sp'))
    expect(hashForMeta.state('Sao Paulo')).toBeNull()
  })

  it('country aceita so 2-letter ISO', () => {
    expect(hashForMeta.country('BR')).toBe(sha256Hex('br'))
    expect(hashForMeta.country('Brazil')).toBeNull()
  })
})

describe('hashForMeta.zip (BR vs US)', () => {
  it('BR: hash do CEP sem pontuacao', () => {
    expect(hashForMeta.zip('01310-100')).toBe(sha256Hex('01310100'))
  })

  it('US: hash dos primeiros 5 digitos', () => {
    expect(hashForMeta.zip('90210-1234', 'us')).toBe(sha256Hex('90210'))
  })

  it('null pra zip invalido', () => {
    expect(hashForMeta.zip('')).toBeNull()
    expect(hashForMeta.zip('123', 'us')).toBeNull()
  })
})

describe('hashForMeta.externalId', () => {
  it('hash do uuid lowercase trim', () => {
    expect(hashForMeta.externalId('  UUID-ABC-123  ')).toBe(sha256Hex('uuid-abc-123'))
  })

  it('null pra empty', () => {
    expect(hashForMeta.externalId('')).toBeNull()
  })
})

describe('hashForGoogle — equivalencia com Meta onde aplicavel', () => {
  it('email: identico ao Meta', () => {
    expect(hashForGoogle.email('test@example.com')).toBe(hashForMeta.email('test@example.com'))
  })

  it('externalId: identico ao Meta', () => {
    expect(hashForGoogle.externalId('user-123')).toBe(hashForMeta.externalId('user-123'))
  })

  it('firstName/lastName: identico ao Meta', () => {
    expect(hashForGoogle.firstName('João')).toBe(hashForMeta.firstName('João'))
    expect(hashForGoogle.lastName('Silva')).toBe(hashForMeta.lastName('Silva'))
  })

  it('zip BR: identico ao Meta', () => {
    expect(hashForGoogle.zip('01310-100')).toBe(hashForMeta.zip('01310-100'))
  })

  it('country: identico ao Meta', () => {
    expect(hashForGoogle.country('BR')).toBe(hashForMeta.country('BR'))
  })
})

describe('hashForGoogleDataManager — semantica Data Manager API (1.4.9.B / ADR-015)', () => {
  describe('email', () => {
    it('produz mesmo hash que hashForMeta.email', () => {
      const e = 'test@example.com'
      expect(hashForGoogleDataManager.email(e)).toBe(hashForMeta.email(e))
    })

    it('lowercase + trim antes de hash', () => {
      expect(hashForGoogleDataManager.email('  TEST@Example.com  ')).toBe(
        sha256Hex('test@example.com')
      )
    })

    it('null/empty retorna null', () => {
      expect(hashForGoogleDataManager.email(null)).toBeNull()
      expect(hashForGoogleDataManager.email('')).toBeNull()
    })
  })

  describe('phone', () => {
    it('mantem + no E.164 antes de hash (diferente do Meta)', () => {
      expect(hashForGoogleDataManager.phone('+5511999998888')).toBe(sha256Hex('+5511999998888'))
    })

    it('normaliza format BR pra E.164 com +', () => {
      expect(hashForGoogleDataManager.phone('+55 (11) 99999-8888')).toBe(
        sha256Hex('+5511999998888')
      )
    })

    it('input invalido retorna null', () => {
      expect(hashForGoogleDataManager.phone(null)).toBeNull()
      expect(hashForGoogleDataManager.phone('abc')).toBeNull()
    })
  })

  describe('givenName / familyName', () => {
    it('hashes preservando diacritos PT-BR', () => {
      expect(hashForGoogleDataManager.givenName('João')).toBe(sha256Hex('joão'))
      expect(hashForGoogleDataManager.familyName('Silva')).toBe(sha256Hex('silva'))
    })

    it('remove digits/pontuacao/espacos', () => {
      expect(hashForGoogleDataManager.givenName('Maria José 2!')).toBe(sha256Hex('mariajosé'))
    })

    it('null retorna null', () => {
      expect(hashForGoogleDataManager.givenName(null)).toBeNull()
      expect(hashForGoogleDataManager.familyName('')).toBeNull()
    })
  })

  describe('streetAddress', () => {
    it('hashes lowercase + collapse whitespace, preserva digits', () => {
      expect(hashForGoogleDataManager.streetAddress('  Rua Augusta, 123  ')).toBe(
        sha256Hex('rua augusta, 123')
      )
    })

    it('null retorna null', () => {
      expect(hashForGoogleDataManager.streetAddress(null)).toBeNull()
    })
  })

  describe('city', () => {
    it('hashes lowercase + preserva diacritos, remove espacos', () => {
      expect(hashForGoogleDataManager.city('São Paulo')).toBe(sha256Hex('sãopaulo'))
    })

    it('mesmo hash que hashForMeta.city', () => {
      expect(hashForGoogleDataManager.city('São Paulo')).toBe(hashForMeta.city('São Paulo'))
    })
  })

  describe('regionCode — PLAIN alpha-2 UPPERCASE (NAO hashed)', () => {
    it('retorna uppercase alpha-2', () => {
      expect(hashForGoogleDataManager.regionCode('br')).toBe('BR')
      expect(hashForGoogleDataManager.regionCode('US')).toBe('US')
      expect(hashForGoogleDataManager.regionCode('  pt  ')).toBe('PT')
    })

    it('rejeita input nao-alpha-2', () => {
      expect(hashForGoogleDataManager.regionCode('Brazil')).toBeNull()
      expect(hashForGoogleDataManager.regionCode('B1')).toBeNull()
      expect(hashForGoogleDataManager.regionCode('')).toBeNull()
    })
  })

  describe('postalCode — PLAIN (NAO hashed)', () => {
    it('BR (default): mantem digits + hifen, strip espacos', () => {
      expect(hashForGoogleDataManager.postalCode('01310-100')).toBe('01310-100')
      expect(hashForGoogleDataManager.postalCode('  01310 100 ')).toBe('01310100')
    })

    it('US: primeiros 5 digitos', () => {
      expect(hashForGoogleDataManager.postalCode('94045-1234', 'US')).toBe('94045')
      expect(hashForGoogleDataManager.postalCode('94045', 'US')).toBe('94045')
    })

    it('US com <5 digitos retorna null', () => {
      expect(hashForGoogleDataManager.postalCode('123', 'US')).toBeNull()
    })

    it('null retorna null', () => {
      expect(hashForGoogleDataManager.postalCode(null)).toBeNull()
    })
  })

  describe('NAO confunde regionCode/postalCode com versao Meta', () => {
    it('regionCode em Data Manager API e PLAIN; Meta country e HASHED', () => {
      const dm = hashForGoogleDataManager.regionCode('BR')
      const meta = hashForMeta.country('BR')
      expect(dm).toBe('BR')
      expect(meta).toBe(sha256Hex('br'))
      expect(dm).not.toBe(meta)
    })

    it('postalCode em Data Manager API e PLAIN; Meta zp e HASHED', () => {
      const dm = hashForGoogleDataManager.postalCode('01310-100')
      const meta = hashForMeta.zip('01310-100')
      expect(dm).toBe('01310-100')
      // hashForMeta.zip strip pontuacao no normalizer
      expect(meta).toBe(sha256Hex('01310100'))
      expect(dm).not.toBe(meta)
    })
  })
})
