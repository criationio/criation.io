import pino from 'pino'
import { describe, expect, it } from 'vitest'

/**
 * Tests de redaction PII no pino logger.
 *
 * Em vez de testar o logger exportado (que tem destino stdout), criamos
 * uma instancia equivalente com o MESMO redactPaths apontando pra stream
 * em-memoria. Garante que a config esteja correta sem acoplar com runtime.
 *
 * Pra simplificar a manutencao, o array de paths e duplicado aqui — se
 * adicionar/remover paths em logger.ts, atualizar aqui. Trade-off aceito:
 * importar a constante exigiria expor o array e quebrar encapsulamento
 * do logger.ts.
 */

const REDACT_PATHS = [
  '*.email',
  '*.password',
  '*.token',
  '*.matched_buyer_email_hash',
  '*.customer_email_hash',
  '*.customer_phone_hash',
  '*.external_id_hash',
  '*.client_ip_address',
  '*.client_user_agent',
  '*.fbp',
  '*.fbc',
  'data[*].user_data.em',
  'data[*].user_data.ph',
  'data[*].user_data.external_id',
  'data[*].user_data.client_ip_address',
  'data[*].user_data.client_user_agent',
  'data[*].user_data.fbc',
  'data[*].user_data.fbp',
]

function makeTestLogger(): { logger: pino.Logger; messages: Array<Record<string, unknown>> } {
  const messages: Array<Record<string, unknown>> = []
  const stream = {
    write(msg: string) {
      messages.push(JSON.parse(msg))
    },
  }
  const logger = pino({ redact: REDACT_PATHS }, stream)
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
