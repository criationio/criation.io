import { describe, expect, it } from 'vitest'

import { isMetaLiteral, normalizeUtm, normalizeUtmSet } from './utm-normalizer'

describe('normalizeUtm', () => {
  it('returns null for null/undefined/empty', () => {
    expect(normalizeUtm(null)).toBeNull()
    expect(normalizeUtm(undefined)).toBeNull()
    expect(normalizeUtm('')).toBeNull()
    expect(normalizeUtm('   ')).toBeNull()
  })

  it('lowercases', () => {
    expect(normalizeUtm('Black Friday')).toBe('black-friday')
    expect(normalizeUtm('FACEBOOK')).toBe('facebook')
  })

  it('strips diacritics', () => {
    expect(normalizeUtm('promoção')).toBe('promocao')
    expect(normalizeUtm('São Paulo')).toBe('sao-paulo')
    expect(normalizeUtm('Café Black Friday')).toBe('cafe-black-friday')
  })

  it('unifies separators (hyphen, underscore, space, multiple)', () => {
    expect(normalizeUtm('black-friday-2026')).toBe('black-friday-2026')
    expect(normalizeUtm('black_friday_2026')).toBe('black-friday-2026')
    expect(normalizeUtm('black friday 2026')).toBe('black-friday-2026')
    expect(normalizeUtm('Black___Friday   2026')).toBe('black-friday-2026')
    expect(normalizeUtm('black--friday')).toBe('black-friday')
  })

  it('trims leading/trailing whitespace and separators', () => {
    expect(normalizeUtm('  black-friday  ')).toBe('black-friday')
    expect(normalizeUtm('-black-friday-')).toBe('black-friday')
    expect(normalizeUtm('___black___friday___')).toBe('black-friday')
  })

  it('handles complex real-world cases', () => {
    expect(normalizeUtm('Black Friday 2026 - VSL Mulheres 30s')).toBe(
      'black-friday-2026-vsl-mulheres-30s'
    )
    expect(normalizeUtm('webinar_jan26 | bonus pack')).toBe('webinar-jan26-|-bonus-pack')
  })

  it('returns null when input contains Meta literal placeholder', () => {
    expect(normalizeUtm('{{campaign.name}}')).toBeNull()
    expect(normalizeUtm('Black Friday {{ad.id}}')).toBeNull()
    expect(normalizeUtm('{{adset.name}}')).toBeNull()
  })

  it('preserves unicode letters that are not diacritics', () => {
    expect(normalizeUtm('façade')).toBe('facade')
    expect(normalizeUtm('北京')).toBe('北京')
  })
})

describe('isMetaLiteral', () => {
  it('detects placeholders', () => {
    expect(isMetaLiteral('{{campaign.name}}')).toBe(true)
    expect(isMetaLiteral('{{ad.id}}')).toBe(true)
    expect(isMetaLiteral('algo com {{ad.name}} no meio')).toBe(true)
  })

  it('returns false for normal strings', () => {
    expect(isMetaLiteral('Black Friday')).toBe(false)
    expect(isMetaLiteral('')).toBe(false)
    expect(isMetaLiteral(null)).toBe(false)
    expect(isMetaLiteral(undefined)).toBe(false)
  })

  it('does not false-positive on isolated braces', () => {
    expect(isMetaLiteral('{not a placeholder}')).toBe(false)
    expect(isMetaLiteral('{{')).toBe(false)
    expect(isMetaLiteral('}}')).toBe(false)
  })
})

describe('normalizeUtmSet', () => {
  it('normalizes all 5 fields independently', () => {
    expect(
      normalizeUtmSet({
        source: 'Facebook',
        medium: 'CPC',
        campaign: 'Black Friday',
        content: 'VSL Mulheres',
        term: 'palavra-chave',
      })
    ).toEqual({
      source: 'facebook',
      medium: 'cpc',
      campaign: 'black-friday',
      content: 'vsl-mulheres',
      term: 'palavra-chave',
      hasMetaLiteral: false,
    })
  })

  it('flags hasMetaLiteral when any field has placeholder', () => {
    const result = normalizeUtmSet({
      source: 'facebook',
      campaign: '{{campaign.name}}',
    })
    expect(result.campaign).toBeNull()
    expect(result.hasMetaLiteral).toBe(true)
  })

  it('handles missing fields gracefully', () => {
    expect(normalizeUtmSet({ campaign: 'Black Friday' })).toEqual({
      source: null,
      medium: null,
      campaign: 'black-friday',
      content: null,
      term: null,
      hasMetaLiteral: false,
    })
  })
})
