import { describe, expect, it } from 'vitest'

import { ingestEventSchema } from './tracking'

// UUID v4 valido (variant nibble = 8/9/a/b)
const WORKSPACE_ID = '11111111-1111-4111-8111-111111111111'

function makeValid(overrides: Record<string, unknown> = {}) {
  return {
    workspace_id: WORKSPACE_ID,
    visitor_id: 'vid-abcdefgh',
    event_id: 'evt-abcdefgh',
    event_name: 'page_view',
    event_ts: 1747000000000,
    ...overrides,
  }
}

describe('ingestEventSchema', () => {
  it('aceita payload minimo valido', () => {
    const result = ingestEventSchema.safeParse(makeValid())
    expect(result.success).toBe(true)
  })

  it('aceita event_ts como ISO 8601', () => {
    const result = ingestEventSchema.safeParse(makeValid({ event_ts: '2026-05-12T15:30:00.000Z' }))
    expect(result.success).toBe(true)
  })

  it('rejeita workspace_id que nao e UUID', () => {
    const result = ingestEventSchema.safeParse(makeValid({ workspace_id: 'not-a-uuid' }))
    expect(result.success).toBe(false)
  })

  it('rejeita visitor_id muito curto (< 8 chars)', () => {
    const result = ingestEventSchema.safeParse(makeValid({ visitor_id: 'short' }))
    expect(result.success).toBe(false)
  })

  it('rejeita event_id muito curto', () => {
    const result = ingestEventSchema.safeParse(makeValid({ event_id: 'short' }))
    expect(result.success).toBe(false)
  })

  it('rejeita event_name vazio', () => {
    const result = ingestEventSchema.safeParse(makeValid({ event_name: '' }))
    expect(result.success).toBe(false)
  })

  it('aceita campos opcionais (utms, click IDs, consent, custom_data)', () => {
    const result = ingestEventSchema.safeParse(
      makeValid({
        page_url: 'https://cliente.com/oferta?fbclid=ABC',
        referrer: 'https://google.com/',
        utms: {
          utm_source: 'fb',
          utm_campaign: 'oferta_x',
          utm_random_custom: 'whatever',
        },
        fbclid: 'ABC123',
        gclid: undefined,
        fbp: 'fb.1.123.abc',
        consent: { ad_storage: 'granted', analytics_storage: 'denied' },
        custom_data: { value: 497, currency: 'BRL' },
      })
    )
    expect(result.success).toBe(true)
  })

  it('aceita identify_email valido', () => {
    const result = ingestEventSchema.safeParse(
      makeValid({ identify_email: 'comprador@example.com' })
    )
    expect(result.success).toBe(true)
  })

  it('rejeita identify_email malformado', () => {
    const result = ingestEventSchema.safeParse(makeValid({ identify_email: 'nao-eh-email' }))
    expect(result.success).toBe(false)
  })

  it('passa por campos desconhecidos (.loose)', () => {
    const result = ingestEventSchema.safeParse(
      makeValid({ algum_campo_novo_do_script: 'valor', outro: 42 })
    )
    expect(result.success).toBe(true)
  })

  it('aceita consent com valores desconhecidos via .loose', () => {
    // ad_storage so aceita granted|denied, mas outras keys passam
    const result = ingestEventSchema.safeParse(
      makeValid({
        consent: {
          ad_storage: 'granted',
          functionality_storage: 'granted', // extra signal, valido por .loose
        },
      })
    )
    expect(result.success).toBe(true)
  })

  it('rejeita consent.ad_storage com valor invalido', () => {
    const result = ingestEventSchema.safeParse(makeValid({ consent: { ad_storage: 'maybe' } }))
    expect(result.success).toBe(false)
  })
})
