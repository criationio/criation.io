import { z } from 'zod'

/**
 * Parser do payload Eduzz Webhook v3.
 *
 * Envelope padrao: `{ id, event, data, sentDate }`. `event` no formato
 * `app.action` (ex: `myeduzz.invoice_paid`, `sun.cart_abandoned`).
 *
 * `data` varia por evento — schema permissivo com passthrough para tolerar
 * mudancas. Normalizer extrai campos chave.
 *
 * Audit: docs/audits/EDUZZ_API_2026-05.md §3.
 */

const ostr = z.string().nullable().optional()
const onum = z.number().nullable().optional()

const moneySchema = z
  .object({
    currency: ostr,
    value: onum,
  })
  .partial()
  .passthrough()

const buyerSchema = z
  .object({
    id: ostr,
    name: ostr,
    document: ostr,
    email: ostr,
    phone: ostr,
    phone2: ostr,
    cellphone: ostr,
    // Plain IP/UA pra Meta CAPI EMQ (1.4.9). Eduzz inclui buyer.ip em
    // alguns webhooks v3 — preserved quando presente.
    ip: ostr,
    user_agent: ostr,
    address: z
      .object({
        street: ostr,
        number: ostr,
        neighborhood: ostr,
        complement: ostr,
        city: ostr,
        state: ostr,
        country: ostr,
        zipCode: ostr,
      })
      .partial()
      .passthrough()
      .optional(),
  })
  .partial()
  .passthrough()

const producerSchema = z
  .object({
    id: ostr,
    name: ostr,
    email: ostr,
    originSecret: ostr,
  })
  .partial()
  .passthrough()

const utmSchema = z
  .object({
    source: ostr,
    campaign: ostr,
    medium: ostr,
    content: ostr,
    term: ostr,
  })
  .partial()
  .passthrough()

const trackerSchema = z
  .object({
    code1: ostr,
    code2: ostr,
    code3: ostr,
  })
  .partial()
  .passthrough()

const itemSchema = z
  .object({
    productId: ostr,
    name: ostr,
    parentId: ostr,
    refundPeriod: z.object({ durationType: ostr, value: onum }).partial().optional(),
    price: moneySchema.optional(),
    coupon: z
      .object({ id: ostr, key: ostr, discount: moneySchema.optional() })
      .partial()
      .optional(),
    partnerId: ostr,
    billingType: ostr,
    skuReference: ostr,
  })
  .partial()
  .passthrough()

const affiliateSchema = z
  .object({
    id: ostr,
    name: ostr,
    email: ostr,
  })
  .partial()
  .passthrough()

const contractSchema = z
  .object({
    id: ostr,
    isUnlimitedInstallments: z.boolean().optional(),
  })
  .partial()
  .passthrough()

const chargebackSchema = z
  .object({
    status: ostr,
    createdAt: ostr,
    limitDate: ostr,
    finishedAt: ostr,
  })
  .partial()
  .passthrough()

/**
 * Schema do `data` para eventos invoice_*. Eventos contract_* usam shape
 * mais simples mas o schema cobre via passthrough.
 */
const eduzzInvoiceDataSchema = z
  .object({
    id: ostr,
    status: ostr,
    buyer: buyerSchema.optional(),
    producer: producerSchema.optional(),
    offer: z.object({ name: ostr }).partial().passthrough().optional(),
    utm: utmSchema.optional(),
    tracker: trackerSchema.optional(),
    createdAt: ostr,
    dueDate: ostr,
    paidAt: ostr,
    barcode: ostr,
    price: moneySchema.nullable().optional(),
    paid: moneySchema.nullable().optional(),
    orderBump: z
      .object({
        has: z.boolean().optional(),
        isMainSale: z.boolean().optional(),
        mainSaleId: onum,
      })
      .partial()
      .passthrough()
      .optional(),
    installments: onum,
    items: z.array(itemSchema).nullable().optional(),
    totalItems: onum,
    billetUrl: ostr,
    checkoutUrl: ostr,
    bankslipUrl: ostr,
    affiliate: affiliateSchema.nullable().optional(),
    paymentMethod: ostr,
    transaction: z.object({ id: ostr, key: ostr }).partial().passthrough().nullable().optional(),
    chargeback: chargebackSchema.nullable().optional(),
    bankSlipInstallment: z
      .object({ installmentNumber: onum, totalInstallments: onum })
      .partial()
      .passthrough()
      .nullable()
      .optional(),
    contract: contractSchema.nullable().optional(),
    student: buyerSchema.nullable().optional(),
    payment: z.object({ method: ostr, details: ostr }).partial().passthrough().optional(),
  })
  .partial()
  .passthrough()

/** Envelope completo Eduzz v3 — qualquer evento (`{id, event, data, sentDate}`). */
export const eduzzWebhookSchema = z
  .object({
    id: z.string().min(1),
    event: z.string().min(1),
    sentDate: ostr,
    // data pode ter shape variado dependendo do evento — passthrough generoso
    data: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough()

export type EduzzWebhookEnvelope = z.infer<typeof eduzzWebhookSchema>
export type EduzzInvoiceData = z.infer<typeof eduzzInvoiceDataSchema>

export function parseEduzzWebhook(rawBody: string): EduzzWebhookEnvelope {
  const json = JSON.parse(rawBody) as unknown
  return eduzzWebhookSchema.parse(json)
}

/**
 * Parse seguro do `data` interpretando como invoice (com fallback). Eventos
 * que nao sao invoice (contract_*, ping, sun.*) podem ter shape diferente —
 * o schema e suficientemente permissivo para nao throw.
 */
export function parseEduzzInvoiceData(data: unknown): EduzzInvoiceData | null {
  const result = eduzzInvoiceDataSchema.safeParse(data)
  return result.success ? result.data : null
}
