import { z } from 'zod'

/**
 * Parsers do payload bruto Hotmart Postback (v1 form-urlencoded e v2 JSON).
 * Validacao e estrutura — sem PII hashing aqui (acontece no `normalizer.ts`).
 *
 * v2 e o default (ADR-016 dec.1). v1 fica em `legacyParser.ts`.
 */

/**
 * Date flexivel: Hotmart envia ms epoch em alguns eventos e ISO string em
 * outros (ex: `subscription.date_next_charge` em UPDATE_SUBSCRIPTION_CHARGE_DATE).
 * Aceitamos ambos no parser; normalizer converte para ms numero.
 */
const flexibleDate = z.union([z.number(), z.string()])

/** Envelope v2: {id, creation_date, event, version, hottok, data}. */
export const hotmartV2EnvelopeSchema = z
  .object({
    id: z.string().min(1),
    creation_date: flexibleDate,
    event: z.string().min(1),
    version: z.string().min(1),
    hottok: z.string().optional(),
    data: z.record(z.string(), z.unknown()),
  })
  .passthrough()

export type HotmartV2Envelope = z.infer<typeof hotmartV2EnvelopeSchema>

/**
 * Buyer (v2). Plain PII. Plain so vive em memoria do parser ate o normalizer
 * hashear. Marcado opcional porque alguns eventos (CLUB_*) nao tem buyer.
 */
const buyerSchema = z
  .object({
    name: z.string().optional(),
    email: z.string().optional(),
    phone: z.string().optional(),
    document: z.string().optional(),
    checkout_phone: z.string().optional(),
    // Plain IP/UA pra Meta CAPI EMQ (1.4.9). Hotmart inclui em alguns
    // eventos Postback v2 — preserved quando presente, undefined quando ausente.
    ip: z.string().optional(),
    user_agent: z.string().optional(),
    address: z
      .object({
        country: z.string().optional(),
        country_iso: z.string().optional(),
      })
      .partial()
      .optional(),
  })
  .partial()
  // .passthrough() — Hotmart adiciona campos novos sem aviso (ex: geo_location,
  // device_type futuros). Preserva no rawPayload em vez de strip silencioso.
  .passthrough()

const productSchema = z
  .object({
    id: z.union([z.string(), z.number()]).optional(),
    ucode: z.string().optional(),
    name: z.string().optional(),
    has_co_production: z.boolean().optional(),
    is_physical_product: z.boolean().optional(),
  })
  .partial()

const offerSchema = z
  .object({
    code: z.string().optional(),
    key: z.string().optional(),
  })
  .partial()

const priceSchema = z
  .object({
    value: z.number().optional(),
    currency_value: z.string().optional(),
    original_offer_price: z
      .object({
        value: z.number().optional(),
        currency_value: z.string().optional(),
      })
      .partial()
      .optional(),
  })
  .partial()

const paymentSchema = z
  .object({
    type: z.string().optional(),
    method: z.string().optional(),
    installments_number: z.number().int().optional(),
    refusal_reason: z.string().optional(),
  })
  .partial()

const trackingSchema = z
  .object({
    source: z.string().optional(),
    source_sck: z.string().optional(),
    external_code: z.string().optional(),
  })
  .partial()

const originSchema = z
  .object({
    src: z.string().optional(),
    sck: z.string().optional(),
    xcode: z.string().optional(),
  })
  .partial()

const subscriptionSchema = z
  .object({
    subscriber: z.object({ code: z.string().optional() }).partial().optional(),
    plan: z
      .object({
        id: z.union([z.string(), z.number()]).optional(),
        name: z.string().optional(),
        recurrency_period: z.number().optional(),
      })
      .partial()
      .optional(),
    status: z.string().optional(),
    date_next_charge: flexibleDate.optional(),
    old_charge_day: z.number().optional(),
    new_charge_day: z.number().optional(),
  })
  .partial()

const commissionItemSchema = z
  .object({
    value: z.number().optional(),
    source: z.string().optional(),
    currency_value: z.string().optional(),
  })
  .partial()

const affiliationSchema = z
  .object({
    affiliate: z
      .object({
        email: z.string().optional(),
        name: z.string().optional(),
      })
      .partial()
      .optional(),
    source: z.string().optional(),
  })
  .partial()

const purchaseSchema = z
  .object({
    transaction: z.string().optional(),
    order_date: flexibleDate.optional(),
    approved_date: flexibleDate.optional(),
    status: z.string().optional(),
    recurrence_number: z.number().int().optional(),
    is_subscription: z.boolean().optional(),
    product: productSchema.optional(),
    offer: offerSchema.optional(),
    price: priceSchema.optional(),
    payment: paymentSchema.optional(),
    tracking: trackingSchema.optional(),
    origin: originSchema.optional(),
    checkout_country: z
      .object({
        iso: z.string().optional(),
        name: z.string().optional(),
      })
      .partial()
      .optional(),
    commissions: z.array(commissionItemSchema).optional(),
  })
  .partial()
  .passthrough()

/** Data shape (v2) — campos chave que normalizamos. */
export const hotmartV2DataSchema = z
  .object({
    buyer: buyerSchema.optional(),
    product: productSchema.optional(),
    purchase: purchaseSchema.optional(),
    subscription: subscriptionSchema.optional(),
    affiliations: z.array(affiliationSchema).optional(),
  })
  .partial()
  .passthrough()

export type HotmartV2Data = z.infer<typeof hotmartV2DataSchema>

export interface ParsedHotmartV2 {
  envelope: HotmartV2Envelope
  data: HotmartV2Data
}

export function parseV2(rawBody: string): ParsedHotmartV2 {
  const json = JSON.parse(rawBody) as unknown
  const envelope = hotmartV2EnvelopeSchema.parse(json)
  const data = hotmartV2DataSchema.parse(envelope.data)
  return { envelope, data }
}

/**
 * Detecta se o payload e v1 ou v2 inspecionando shape sem fazer parse completo.
 * v1 e form-urlencoded; v2 e JSON com envelope estruturado.
 */
export function detectHotmartVersion(rawBody: string, headers: Headers): 'v1' | 'v2' | 'unknown' {
  const contentType = headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    try {
      const obj = JSON.parse(rawBody) as Record<string, unknown>
      if (typeof obj.id === 'string' && typeof obj.event === 'string' && obj.data) return 'v2'
    } catch {
      // fallthrough
    }
  }
  if (contentType.includes('application/x-www-form-urlencoded')) return 'v1'
  // Sem content-type confiavel: heuristica
  if (rawBody.startsWith('{')) return 'v2'
  if (rawBody.includes('=') && rawBody.includes('&')) return 'v1'
  return 'unknown'
}
