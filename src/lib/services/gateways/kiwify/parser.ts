import { z } from 'zod'

/**
 * Parser do payload Kiwify webhook.
 *
 * **Schema REAL do webhook (descoberto via smoke E2E em 2026-05-10):**
 * Difere SIGNIFICATIVAMENTE do schema REST `/v1/sales/{id}`. Webhook usa:
 *
 * - PascalCase nas chaves de top-level: `Customer`, `Product`, `Commissions`,
 *   `Subscription`, `TrackingParameters`.
 * - Discriminador `webhook_event_type` em **inglês** (`order_approved`,
 *   `order_rejected`, `order_refunded`, `pix_created`, etc) — NAO os nomes
 *   pt-br da API REST de criacao (`compra_aprovada`, etc). Adapter aceita
 *   ambos via mapping bilingual no normalizer.
 * - `Commissions.charge_amount` (em vez de `payment.charge_amount`).
 * - `Customer.full_name`, `Customer.cnpj`/`cpf`, `Customer.mobile`,
 *   `Customer.ip`, `Customer.city/state/zipcode`.
 * - `TrackingParameters.s1/s2/s3/sck/src/utm_*` (em vez de `tracking`).
 *
 * Schema permissivo com `passthrough` — Kiwify pode mudar shape sem aviso.
 */

const customerSchema = z
  .object({
    full_name: z.string().optional(),
    first_name: z.string().optional(),
    email: z.string().optional(),
    cpf: z.string().optional(),
    cnpj: z.string().optional(),
    mobile: z.string().optional(),
    instagram: z.string().optional(),
    ip: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    street: z.string().optional(),
    number: z.string().optional(),
    complement: z.string().optional(),
    neighborhood: z.string().optional(),
    zipcode: z.string().optional(),
  })
  .partial()
  .passthrough()

const productSchema = z
  .object({
    product_id: z.string().optional(),
    product_name: z.string().optional(),
  })
  .partial()
  .passthrough()

const commissionedStoreSchema = z
  .object({
    id: z.string().optional(),
    type: z.string().optional(),
    email: z.string().optional(),
    value: z.string().optional(),
    custom_name: z.string().optional(),
    affiliate_id: z.string().optional(),
  })
  .partial()
  .passthrough()

const commissionsSchema = z
  .object({
    currency: z.string().optional(),
    charge_amount: z.number().optional(),
    my_commission: z.number().optional(),
    kiwify_fee: z.number().optional(),
    settlement_amount: z.number().optional(),
    product_base_price: z.number().optional(),
    sale_tax_rate: z.number().optional(),
    sale_tax_amount: z.number().optional(),
    deposit_date: z.string().nullable().optional(),
    estimated_deposit_date: z.string().nullable().optional(),
    funds_status: z.string().nullable().optional(),
    kiwify_fee_currency: z.string().optional(),
    settlement_amount_currency: z.string().optional(),
    product_base_price_currency: z.string().optional(),
    commissioned_stores: z.array(commissionedStoreSchema).optional(),
  })
  .partial()
  .passthrough()

const trackingParametersSchema = z
  .object({
    src: z.string().nullable().optional(),
    sck: z.string().nullable().optional(),
    s1: z.string().nullable().optional(),
    s2: z.string().nullable().optional(),
    s3: z.string().nullable().optional(),
    utm_source: z.string().nullable().optional(),
    utm_medium: z.string().nullable().optional(),
    utm_campaign: z.string().nullable().optional(),
    utm_content: z.string().nullable().optional(),
    utm_term: z.string().nullable().optional(),
  })
  .partial()
  .passthrough()

const subscriptionPlanSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().optional(),
    frequency: z.string().optional(),
    qty_charges: z.number().optional(),
  })
  .partial()
  .passthrough()

const subscriptionChargeSchema = z
  .object({
    charge_date: z.string().optional(),
    amount: z.number().optional(),
    status: z.string().optional(),
    order_id: z.string().optional(),
    card_type: z.string().optional(),
    created_at: z.string().optional(),
    installments: z.number().optional(),
    card_last_digits: z.string().optional(),
    card_first_digits: z.string().optional(),
  })
  .partial()
  .passthrough()

const subscriptionSchema = z
  .object({
    id: z.string().optional(),
    status: z.string().optional(),
    start_date: z.string().optional(),
    next_payment: z.string().optional(),
    plan: subscriptionPlanSchema.optional(),
    charges: z
      .object({
        future: z.array(subscriptionChargeSchema).optional(),
        completed: z.array(subscriptionChargeSchema).optional(),
      })
      .partial()
      .optional(),
  })
  .partial()
  .passthrough()

/**
 * Schema completo. Kiwify pode adicionar/remover campos sem aviso —
 * tudo opcional + passthrough generoso.
 */
export const kiwifyWebhookSchema = z
  .object({
    /** Discriminador de evento — nomes em ingles (order_approved, etc). */
    webhook_event_type: z.string().optional(),

    /** UUID da venda — chave de idempotencia */
    order_id: z.string().optional(),
    order_ref: z.string().optional(),

    /** Datas (Kiwify usa formato "YYYY-MM-DD HH:mm" sem TZ + tambem ISO no Subscription) */
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
    approved_date: z.string().optional(),
    refunded_at: z.string().nullable().optional(),

    /** Status, type, payment */
    order_status: z.string().optional(),
    sale_type: z.string().optional(),
    product_type: z.string().optional(),
    payment_method: z.string().optional(),
    payment_merchant_id: z.union([z.string(), z.number()]).optional(),
    installments: z.number().optional(),
    card_type: z.string().optional(),
    card_last4digits: z.string().optional(),
    card_rejection_reason: z.string().nullable().optional(),

    /** Boleto/PIX */
    boleto_URL: z.string().nullable().optional(),
    boleto_barcode: z.string().nullable().optional(),
    boleto_expiry_date: z.string().nullable().optional(),
    pix_code: z.string().nullable().optional(),
    pix_expiration: z.string().nullable().optional(),

    /** Identificadores extras */
    store_id: z.string().optional(),
    access_url: z.string().nullable().optional(),
    subscription_id: z.string().nullable().optional(),

    /** Sub-objetos (PascalCase) */
    Customer: customerSchema.optional(),
    Product: productSchema.optional(),
    Commissions: commissionsSchema.optional(),
    Subscription: subscriptionSchema.optional(),
    TrackingParameters: trackingParametersSchema.optional(),
  })
  .passthrough()

export type KiwifyWebhookPayload = z.infer<typeof kiwifyWebhookSchema>

export function parseKiwifyWebhook(rawBody: string): KiwifyWebhookPayload {
  const json = JSON.parse(rawBody) as unknown
  return kiwifyWebhookSchema.parse(json)
}
