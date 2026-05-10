import { describe, expect, it } from 'vitest'

import { hashEmail } from '@/lib/security/hash'

import { parseV1 } from './legacyParser'
import { normalizeV1, normalizeV2 } from './normalizer'
import { parseV2 } from './parser'

const PURCHASE_APPROVED_FIXTURE = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  creation_date: 1715000000000, // ms epoch
  event: 'PURCHASE_APPROVED',
  version: '2.0.0',
  hottok: 'secret',
  data: {
    buyer: {
      name: 'Buyer Name',
      email: 'BUYER@example.com',
      phone: '11987654321',
      document: '123.456.789-10',
      address: { country_iso: 'BR' },
    },
    product: { id: 12345, name: 'Curso Teste', ucode: 'abc-uuid' },
    purchase: {
      transaction: 'HP19842736455232',
      order_date: 1715000000000,
      status: 'APPROVED',
      recurrence_number: 1,
      product: { id: 12345, name: 'Curso Teste' },
      offer: { code: 'n82b9jqz' },
      price: { value: 49.9, currency_value: 'BRL' },
      payment: { type: 'CREDIT_CARD', installments_number: 3 },
      tracking: {
        source: 'fb_ads',
        source_sck: 'campanha-x',
        external_code: 'visitor-abc-123',
      },
      origin: {
        src: 'fb_ads',
        sck: 'campanha-x',
        xcode: 'visitor-abc-123',
      },
      checkout_country: { iso: 'BR' },
      commissions: [
        { source: 'PRODUCER', value: 39.92 },
        { source: 'MARKETPLACE', value: 9.98 },
      ],
    },
    subscription: {
      subscriber: { code: 'SUB-XYZ' },
      plan: { id: 999, name: 'Plano Mensal' },
      status: 'ACTIVE',
    },
  },
}

describe('normalizeV2', () => {
  it('mapeia campos chave do PURCHASE_APPROVED', () => {
    const parsed = parseV2(JSON.stringify(PURCHASE_APPROVED_FIXTURE))
    const n = normalizeV2(parsed)

    expect(n.provider).toBe('hotmart')
    expect(n.providerEventId).toBe('550e8400-e29b-41d4-a716-446655440000')
    expect(n.providerEventVersion).toBe('2.0.0')
    expect(n.eventType).toBe('PURCHASE_APPROVED')
    expect(n.amountCents).toBe(4990)
    expect(n.currency).toBe('BRL')
    expect(n.productId).toBe('12345')
    expect(n.productName).toBe('Curso Teste')
    expect(n.offerId).toBe('n82b9jqz')
    expect(n.subscriberCode).toBe('SUB-XYZ')
    expect(n.recurrenceNumber).toBe(1)
    expect(n.planId).toBe('999')
    expect(n.paymentMethod).toBe('CREDIT_CARD')
    expect(n.installmentsNumber).toBe(3)
    expect(n.feeCents).toBe(998) // 9.98 * 100
    expect(n.producerNetCents).toBe(3992)
    expect(n.buyerCountry).toBe('BR')
    expect(n.subscriptionStatus).toBe('ACTIVE')
  })

  it('hasheia PII inline e nao expoe plain', () => {
    const parsed = parseV2(JSON.stringify(PURCHASE_APPROVED_FIXTURE))
    const n = normalizeV2(parsed)

    expect(n.buyerEmailHash).toBe(hashEmail('BUYER@example.com'))
    expect(n.buyerEmailHash).not.toContain('@')
    expect(n.buyerPhoneHash).toMatch(/^[0-9a-f]{64}$/)
    expect(n.buyerDocumentHash).toBeDefined()

    // rawPayload nao deve conter plain PII
    const stringified = JSON.stringify(n.rawPayload)
    expect(stringified).not.toContain('BUYER@example.com')
    expect(stringified).not.toContain('123.456.789-10')
    expect(stringified).not.toContain('11987654321')
    expect(stringified).toContain('[REDACTED]')
  })

  it('converte creation_date ms epoch em Date UTC', () => {
    const parsed = parseV2(JSON.stringify(PURCHASE_APPROVED_FIXTURE))
    const n = normalizeV2(parsed)
    expect(n.occurredAtMs).toBe(1715000000000)
    expect(n.occurredAt).toEqual(new Date(1715000000000))
  })

  it('preserva attribution.origin e externalCode', () => {
    const parsed = parseV2(JSON.stringify(PURCHASE_APPROVED_FIXTURE))
    const n = normalizeV2(parsed)
    expect(n.attribution.origin).toEqual({
      src: 'fb_ads',
      sck: 'campanha-x',
      xcode: 'visitor-abc-123',
    })
    expect(n.attribution.externalCode).toBe('visitor-abc-123')
  })

  it('idempotencyKey == event.id em v2', () => {
    const parsed = parseV2(JSON.stringify(PURCHASE_APPROVED_FIXTURE))
    const n = normalizeV2(parsed)
    expect(n.allocationIdempotencyKey).toBe('550e8400-e29b-41d4-a716-446655440000')
  })

  it('renovacao: recurrence_number > 1 vem corretamente', () => {
    const renewal = structuredClone(PURCHASE_APPROVED_FIXTURE)
    renewal.id = 'renewal-evt-001'
    renewal.data.purchase.recurrence_number = 2
    const parsed = parseV2(JSON.stringify(renewal))
    const n = normalizeV2(parsed)
    expect(n.recurrenceNumber).toBe(2)
  })

  it('UNKNOWN para evento nao mapeado', () => {
    const exotic = structuredClone(PURCHASE_APPROVED_FIXTURE)
    exotic.event = 'EXOTIC_NEW_EVENT'
    const parsed = parseV2(JSON.stringify(exotic))
    const n = normalizeV2(parsed)
    expect(n.eventType).toBe('UNKNOWN')
  })
})

describe('normalizeV1', () => {
  it('mapeia v1 form-urlencoded para shape interno', () => {
    const body =
      'transaction=HP123&status=APPROVED&prod=12345&prod_price=29.90&currency=BRL&email=plain@test.com&doc=12345678910&src=fb&sck=cmp1'
    const parsed = parseV1(body)
    const n = normalizeV1(parsed)

    expect(n.provider).toBe('hotmart')
    expect(n.providerEventVersion).toBe('1.0.0')
    expect(n.eventType).toBe('PURCHASE_APPROVED')
    expect(n.amountCents).toBe(2990)
    expect(n.currency).toBe('BRL')
    expect(n.productId).toBe('12345')
    expect(n.allocationIdempotencyKey).toBe(parsed.syntheticEventId)
    expect(n.attribution.origin).toEqual({ src: 'fb', sck: 'cmp1' })
  })

  it('redacta PII do payload v1', () => {
    const body = 'transaction=HP123&status=APPROVED&email=plain@test.com&doc=12345678910'
    const parsed = parseV1(body)
    const n = normalizeV1(parsed)
    const s = JSON.stringify(n.rawPayload)
    expect(s).not.toContain('plain@test.com')
    expect(s).not.toContain('12345678910')
    expect(s).toContain('[REDACTED]')
  })
})
