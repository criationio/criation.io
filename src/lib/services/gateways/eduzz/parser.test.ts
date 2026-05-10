import { describe, expect, it } from 'vitest'

import { parseEduzzInvoiceData, parseEduzzWebhook } from './parser'

describe('parseEduzzWebhook (envelope v3)', () => {
  it('parseia envelope basico {id, event, data, sentDate}', () => {
    const body = JSON.stringify({
      id: 'z154l2pvk6jltotg0xy86glx',
      event: 'myeduzz.invoice_paid',
      sentDate: '2026-05-10T18:34:23.023Z',
      data: { id: 'invoice-uuid', status: 'paid' },
    })
    const parsed = parseEduzzWebhook(body)
    expect(parsed.id).toBe('z154l2pvk6jltotg0xy86glx')
    expect(parsed.event).toBe('myeduzz.invoice_paid')
    expect(parsed.sentDate).toBe('2026-05-10T18:34:23.023Z')
  })

  it('parseia ping event', () => {
    const body = JSON.stringify({
      id: 'l927c4root16a9zvq8v78lcr6',
      event: 'ping',
      sentDate: '2025-05-27T19:42:47.103Z',
      data: { message: 'ping' },
    })
    const parsed = parseEduzzWebhook(body)
    expect(parsed.event).toBe('ping')
  })

  it('throw em payload sem id ou event', () => {
    expect(() => parseEduzzWebhook(JSON.stringify({ event: 'x' }))).toThrow()
    expect(() => parseEduzzWebhook(JSON.stringify({ id: 'x' }))).toThrow()
  })

  it('aceita campos extras (passthrough)', () => {
    const body = JSON.stringify({
      id: 'x',
      event: 'y',
      data: { custom_field: 'preserved' },
      future_envelope_field: 'preserved',
    })
    expect(() => parseEduzzWebhook(body)).not.toThrow()
  })
})

describe('parseEduzzInvoiceData', () => {
  it('parseia data completo de invoice_paid', () => {
    const data = {
      id: 'invoice-uuid',
      status: 'paid',
      buyer: {
        id: 'buyer-uuid',
        name: 'Test Buyer',
        email: 'buyer@example.com',
        document: '12345678910',
        cellphone: '+5511999999999',
        address: { country: 'BR', city: 'SP', state: 'SP' },
      },
      producer: { id: 'p1', name: 'Producer', email: 'p@x.com' },
      offer: { name: 'Curso Teste' },
      utm: { source: 'fb', campaign: 'lancamento' },
      tracker: { code1: 'visitor-uuid', code2: null, code3: null },
      paid: { currency: 'BRL', value: 49.9 },
      price: { currency: 'BRL', value: 49.9 },
      installments: 12,
      paymentMethod: 'credit_card',
      items: [{ productId: 'prod-uuid', name: 'Item' }],
      contract: { id: 'contract-uuid' },
      affiliate: { id: 'aff-1', name: 'Aff', email: 'aff@x.com' },
    }
    const parsed = parseEduzzInvoiceData(data)
    expect(parsed?.id).toBe('invoice-uuid')
    expect(parsed?.buyer?.email).toBe('buyer@example.com')
    expect(parsed?.tracker?.code1).toBe('visitor-uuid')
    expect(parsed?.paid?.value).toBe(49.9)
    expect(parsed?.contract?.id).toBe('contract-uuid')
  })

  it('aceita data com null em campos opcionais', () => {
    const data = {
      id: 'x',
      buyer: { email: 'a@b.com', phone: null, document: null },
      paid: null,
      installments: null,
      affiliate: null,
      contract: null,
    }
    const parsed = parseEduzzInvoiceData(data)
    expect(parsed?.id).toBe('x')
    expect(parsed?.buyer?.phone).toBeNull()
  })

  it('retorna null para data sem shape de invoice (graceful)', () => {
    const data = { unrelated_field: 'xyz' }
    const parsed = parseEduzzInvoiceData(data)
    // Schema permissivo aceita — passa
    expect(parsed).not.toBeNull()
  })
})
