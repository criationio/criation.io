import { describe, expect, it } from 'vitest'

import { channelsToSqlFilter, utmSourceToChannel } from './channel-mapping'

describe('utmSourceToChannel', () => {
  it('mapeia variantes de meta', () => {
    expect(utmSourceToChannel('fb')).toBe('meta')
    expect(utmSourceToChannel('facebook')).toBe('meta')
    expect(utmSourceToChannel('Facebook')).toBe('meta')
    expect(utmSourceToChannel('ig')).toBe('meta')
    expect(utmSourceToChannel('instagram')).toBe('meta')
    expect(utmSourceToChannel('META')).toBe('meta')
  })

  it('mapeia variantes de google', () => {
    expect(utmSourceToChannel('google')).toBe('google')
    expect(utmSourceToChannel('gads')).toBe('google')
    expect(utmSourceToChannel('youtube')).toBe('google')
    expect(utmSourceToChannel('YT')).toBe('google')
  })

  it('mapeia whatsapp', () => {
    expect(utmSourceToChannel('whatsapp')).toBe('whatsapp')
    expect(utmSourceToChannel('wa')).toBe('whatsapp')
    expect(utmSourceToChannel('WPP')).toBe('whatsapp')
  })

  it('mapeia email', () => {
    expect(utmSourceToChannel('email')).toBe('email')
    expect(utmSourceToChannel('mailchimp')).toBe('email')
    expect(utmSourceToChannel('newsletter')).toBe('email')
  })

  it('mapeia organic', () => {
    expect(utmSourceToChannel('organic')).toBe('organic')
    expect(utmSourceToChannel('seo')).toBe('organic')
  })

  it('NULL/vazio → direct', () => {
    expect(utmSourceToChannel(null)).toBe('direct')
    expect(utmSourceToChannel('')).toBe('direct')
    expect(utmSourceToChannel('   ')).toBe('direct')
    expect(utmSourceToChannel('(none)')).toBe('direct')
  })

  it('source desconhecido → other (nao confunde com direct)', () => {
    expect(utmSourceToChannel('tiktok')).toBe('other')
    expect(utmSourceToChannel('reddit')).toBe('other')
    expect(utmSourceToChannel('afiliados')).toBe('other')
  })
})

describe('channelsToSqlFilter', () => {
  it('vazio → vazio (no filter)', () => {
    expect(channelsToSqlFilter([])).toEqual({ sources: [], includeNull: false })
  })

  it('meta sozinho → lista todas patterns de meta', () => {
    const { sources, includeNull } = channelsToSqlFilter(['meta'])
    expect(includeNull).toBe(false)
    expect(sources).toContain('fb')
    expect(sources).toContain('facebook')
    expect(sources).toContain('ig')
    expect(sources).toContain('instagram')
  })

  it('direct → includeNull true, sem sources', () => {
    expect(channelsToSqlFilter(['direct'])).toEqual({ sources: [], includeNull: true })
  })

  it('meta + direct → sources de meta + includeNull', () => {
    const { sources, includeNull } = channelsToSqlFilter(['meta', 'direct'])
    expect(includeNull).toBe(true)
    expect(sources.length).toBeGreaterThan(0)
  })

  it('canal desconhecido ignorado silenciosamente', () => {
    const { sources, includeNull } = channelsToSqlFilter(['ufo'])
    expect(sources).toEqual([])
    expect(includeNull).toBe(false)
  })
})
