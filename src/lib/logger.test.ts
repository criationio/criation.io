import pino from 'pino'
import { describe, expect, it } from 'vitest'

import { REDACT_PATHS } from './logger'

/**
 * Tests de redaction PII. Usa REDACT_PATHS exportado do logger.ts pra
 * garantir que test e source nao divergem.
 */

function makeTestLogger(): { logger: pino.Logger; messages: Array<Record<string, unknown>> } {
  const messages: Array<Record<string, unknown>> = []
  const stream = {
    write(msg: string) {
      messages.push(JSON.parse(msg))
    },
  }
  const logger = pino({ redact: [...REDACT_PATHS] }, stream)
  return { logger, messages }
}

describe('logger redact — generic PII (1- e 2-level wildcards)', () => {
  it('redacta email/password/token em path level 1', () => {
    const { logger, messages } = makeTestLogger()
    logger.info({ user: { email: 'a@b.com', password: 'secret', token: 'tk' } }, 'test')
    expect(messages[0]!.user).toEqual({
      email: '[Redacted]',
      password: '[Redacted]',
      token: '[Redacted]',
    })
  })

  it('preserva chaves NAO-PII no mesmo nivel', () => {
    const { logger, messages } = makeTestLogger()
    logger.info({ user: { id: 'abc', email: 'a@b.com' } }, 'test')
    expect(messages[0]!.user).toEqual({ id: 'abc', email: '[Redacted]' })
  })
})

describe('logger redact — hashed PII (1.4.9)', () => {
  it('redacta hashes de email/phone/document mesmo que sejam SHA-256', () => {
    const { logger, messages } = makeTestLogger()
    const hash = 'a'.repeat(64)
    logger.info(
      {
        event: {
          matched_buyer_email_hash: hash,
          customer_email_hash: hash,
          customer_phone_hash: hash,
          external_id_hash: hash,
        },
      },
      'test'
    )
    const ev = messages[0]!.event as Record<string, string>
    expect(ev.matched_buyer_email_hash).toBe('[Redacted]')
    expect(ev.customer_email_hash).toBe('[Redacted]')
    expect(ev.customer_phone_hash).toBe('[Redacted]')
    expect(ev.external_id_hash).toBe('[Redacted]')
  })
})

describe('logger redact — plain IP/UA (1.4.9 step 5)', () => {
  it('redacta client_ip_address + client_user_agent', () => {
    const { logger, messages } = makeTestLogger()
    logger.info(
      { event: { client_ip_address: '203.0.113.45', client_user_agent: 'Mozilla/5.0' } },
      'test'
    )
    const ev = messages[0]!.event as Record<string, string>
    expect(ev.client_ip_address).toBe('[Redacted]')
    expect(ev.client_user_agent).toBe('[Redacted]')
  })

  it('redacta fbp/fbc Facebook cookies', () => {
    const { logger, messages } = makeTestLogger()
    logger.info({ event: { fbp: 'fb.1.123.456', fbc: 'fb.1.789.IwAR' } }, 'test')
    const ev = messages[0]!.event as Record<string, string>
    expect(ev.fbp).toBe('[Redacted]')
    expect(ev.fbc).toBe('[Redacted]')
  })
})

describe('logger redact — Meta CAPI payload deep paths', () => {
  it('redacta data[*].user_data fields no shape Meta CAPI v25.0', () => {
    const { logger, messages } = makeTestLogger()
    logger.info(
      {
        data: [
          {
            event_name: 'Purchase',
            event_time: 1747057530,
            user_data: {
              em: ['hash1', 'hash2'],
              ph: ['hash3'],
              external_id: ['composite-hash'],
              client_ip_address: '203.0.113.45',
              client_user_agent: 'Mozilla/5.0',
              fbp: 'fb.1.123.456',
              fbc: 'fb.1.789.IwAR',
            },
          },
        ],
      },
      'capi: outgoing payload'
    )
    const item = (messages[0]!.data as Array<Record<string, unknown>>)[0]!
    const ud = item.user_data as Record<string, string>
    expect(item.event_name).toBe('Purchase') // preservado
    expect(item.event_time).toBe(1747057530) // preservado
    expect(ud.em).toBe('[Redacted]')
    expect(ud.ph).toBe('[Redacted]')
    expect(ud.external_id).toBe('[Redacted]')
    expect(ud.client_ip_address).toBe('[Redacted]')
    expect(ud.client_user_agent).toBe('[Redacted]')
    expect(ud.fbp).toBe('[Redacted]')
    expect(ud.fbc).toBe('[Redacted]')
  })

  it('preserva custom_data (value, currency, order_id) no Meta payload', () => {
    const { logger, messages } = makeTestLogger()
    logger.info(
      {
        data: [
          {
            event_name: 'Purchase',
            user_data: { em: ['hash'] },
            custom_data: { value: 197, currency: 'BRL', order_id: 'ord-123' },
          },
        ],
      },
      'test'
    )
    const item = (messages[0]!.data as Array<Record<string, unknown>>)[0]!
    expect(item.custom_data).toEqual({ value: 197, currency: 'BRL', order_id: 'ord-123' })
  })
})

describe('logger redact — Google Data Manager payload deep paths (1.4.9.B step 13)', () => {
  it('redacta events[*].userData.userIdentifiers[*].{emailAddress, phoneNumber, address.*}', () => {
    const { logger, messages } = makeTestLogger()
    logger.info(
      {
        events: [
          {
            eventSource: 'WEB',
            transactionId: 'tx-123',
            conversionValue: 197,
            currency: 'BRL',
            adIdentifiers: { gclid: 'Cj0KCQjw...' },
            userData: {
              userIdentifiers: [
                { emailAddress: 'sha256hex-email' },
                { phoneNumber: 'sha256hex-phone' },
                {
                  address: {
                    givenName: 'sha256hex-first',
                    familyName: 'sha256hex-last',
                    city: 'sha256hex-city',
                    regionCode: 'BR-SP',
                    postalCode: '01310-100',
                  },
                },
              ],
            },
            consent: { adUserData: 'CONSENT_GRANTED', adPersonalization: 'CONSENT_GRANTED' },
          },
        ],
      },
      'google fanout: outgoing payload'
    )
    const event = (messages[0]!.events as Array<Record<string, unknown>>)[0]!

    // Identifiers PII redacted
    const ids = (event.userData as Record<string, unknown>).userIdentifiers as Array<
      Record<string, unknown>
    >
    expect(ids[0]!.emailAddress).toBe('[Redacted]')
    expect(ids[1]!.phoneNumber).toBe('[Redacted]')
    const addr = ids[2]!.address as Record<string, string>
    expect(addr.givenName).toBe('[Redacted]')
    expect(addr.familyName).toBe('[Redacted]')
    expect(addr.city).toBe('[Redacted]')
    expect(addr.regionCode).toBe('[Redacted]')
    expect(addr.postalCode).toBe('[Redacted]')

    // adIdentifiers PII redacted
    expect((event.adIdentifiers as Record<string, string>).gclid).toBe('[Redacted]')

    // Non-PII preservado
    expect(event.transactionId).toBe('tx-123')
    expect(event.conversionValue).toBe(197)
    expect(event.currency).toBe('BRL')
    expect(event.eventSource).toBe('WEB')
    expect(event.consent).toEqual({
      adUserData: 'CONSENT_GRANTED',
      adPersonalization: 'CONSENT_GRANTED',
    })
  })

  it('redacta gbraid/wbraid (iOS-only click IDs) tambem', () => {
    const { logger, messages } = makeTestLogger()
    logger.info(
      {
        events: [
          { adIdentifiers: { gbraid: 'gbraid-token-1' } },
          { adIdentifiers: { wbraid: 'wbraid-token-2' } },
        ],
      },
      'test'
    )
    const events = messages[0]!.events as Array<Record<string, unknown>>
    expect((events[0]!.adIdentifiers as Record<string, string>).gbraid).toBe('[Redacted]')
    expect((events[1]!.adIdentifiers as Record<string, string>).wbraid).toBe('[Redacted]')
  })
})
