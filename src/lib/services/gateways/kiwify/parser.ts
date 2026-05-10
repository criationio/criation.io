import { z } from 'zod'

/**
 * Parser do payload Kiwify webhook.
 *
 * Schema descoberto via smoke E2E (2026-05-10) com TODOS os 10 eventos.
 * Comportamentos observados:
 *
 * - **null em campos opcionais é comum**: `approved_date`, `installments`,
 *   `card_type`, etc vem null em eventos nao-aprovados (PIX, boleto, refused,
 *   chargeback, refunded, subscription_*). Usar `.nullable()` em TUDO.
 *
 * - **Case inconsistente em PII**: `Customer.CPF` (uppercase) em alguns
 *   eventos, `Customer.cpf` (lowercase) em outros. Aceitar ambos.
 *
 * - **Carrinho abandonado e shape ALIEN**: PII no top-level, sem
 *   `webhook_event_type`, sem PascalCase, sem `order_id`, usa
 *   `status: "abandoned"` como discriminador. Schema separado.
 *
 * Por isso o schema principal e MAXIMUM PERMISSIVE (passthrough + nullable
 * everywhere) — qualquer JSON parseable passa. Validacao real fica no
 * normalizer com fallbacks.
 */

// String que tambem aceita null e undefined
const ostr = z.string().nullable().optional()
// Number idem
const onum = z.number().nullable().optional()
// String que tambem aceita number (datas em ms epoch ou ISO/Kiwify)
const odate = z.union([z.string(), z.number()]).nullable().optional()

const customerSchema = z
  .object({
    full_name: ostr,
    first_name: ostr,
    last_name: ostr,
    email: ostr,
    cpf: ostr,
    CPF: ostr,
    cnpj: ostr,
    CNPJ: ostr,
    mobile: ostr,
    phone: ostr,
    instagram: ostr,
    ip: ostr,
    city: ostr,
    state: ostr,
    street: ostr,
    number: ostr,
    complement: ostr,
    neighborhood: ostr,
    zipcode: ostr,
    country: ostr,
  })
  .partial()
  .passthrough()

const productSchema = z
  .object({
    product_id: ostr,
    product_name: ostr,
  })
  .partial()
  .passthrough()

const commissionedStoreSchema = z
  .object({
    id: ostr,
    type: ostr,
    email: ostr,
    value: ostr,
    custom_name: ostr,
    affiliate_id: ostr,
  })
  .partial()
  .passthrough()

const commissionsSchema = z
  .object({
    currency: ostr,
    charge_amount: onum,
    my_commission: onum,
    kiwify_fee: onum,
    settlement_amount: onum,
    product_base_price: onum,
    sale_tax_rate: onum,
    sale_tax_amount: onum,
    deposit_date: ostr,
    estimated_deposit_date: ostr,
    funds_status: ostr,
    kiwify_fee_currency: ostr,
    settlement_amount_currency: ostr,
    product_base_price_currency: ostr,
    commissioned_stores: z.array(commissionedStoreSchema).nullable().optional(),
  })
  .partial()
  .passthrough()

const trackingParametersSchema = z
  .object({
    src: ostr,
    sck: ostr,
    s1: ostr,
    s2: ostr,
    s3: ostr,
    utm_source: ostr,
    utm_medium: ostr,
    utm_campaign: ostr,
    utm_content: ostr,
    utm_term: ostr,
  })
  .partial()
  .passthrough()

const subscriptionPlanSchema = z
  .object({
    id: ostr,
    name: ostr,
    frequency: ostr,
    qty_charges: onum,
  })
  .partial()
  .passthrough()

const subscriptionChargeSchema = z
  .object({
    charge_date: ostr,
    amount: onum,
    status: ostr,
    order_id: ostr,
    card_type: ostr,
    created_at: ostr,
    installments: onum,
    card_last_digits: ostr,
    card_first_digits: ostr,
  })
  .partial()
  .passthrough()

const subscriptionSchema = z
  .object({
    id: ostr,
    status: ostr,
    start_date: ostr,
    next_payment: ostr,
    plan: subscriptionPlanSchema.optional(),
    charges: z
      .object({
        future: z.array(subscriptionChargeSchema).nullable().optional(),
        completed: z.array(subscriptionChargeSchema).nullable().optional(),
      })
      .partial()
      .optional(),
  })
  .partial()
  .passthrough()

/**
 * Schema principal — passa em qualquer payload Kiwify (purchase, subscription,
 * pix/boleto, refused, etc). Cart abandonado tem shape diferente — schema
 * abaixo cobre.
 */
export const kiwifyWebhookSchema = z
  .object({
    // Discriminador principal
    webhook_event_type: ostr,

    // IDs e refs
    order_id: ostr,
    order_ref: ostr,

    // Datas (Kiwify mistura ISO e "YYYY-MM-DD HH:mm" sem TZ + ms epoch)
    created_at: odate,
    updated_at: odate,
    approved_date: odate,
    refunded_at: odate,

    // Status fields (variantes: paid, refused, refunded, chargedback, waiting_payment)
    order_status: ostr,
    sale_type: ostr,
    product_type: ostr,
    payment_method: ostr,
    payment_merchant_id: z.union([z.string(), z.number()]).nullable().optional(),
    installments: onum,
    card_type: ostr,
    card_last4digits: ostr,
    card_rejection_reason: ostr,

    // Boleto/PIX (todos null em outros tipos)
    boleto_URL: ostr,
    boleto_barcode: ostr,
    boleto_expiry_date: ostr,
    pix_code: ostr,
    pix_expiration: ostr,

    store_id: ostr,
    access_url: ostr,
    subscription_id: ostr,

    // Sub-objetos PascalCase
    Customer: customerSchema.optional(),
    Product: productSchema.optional(),
    Commissions: commissionsSchema.optional(),
    Subscription: subscriptionSchema.optional(),
    TrackingParameters: trackingParametersSchema.optional(),

    // Cart abandoned shape — campos top-level (nao redundante com Customer
    // pois cart_abandoned NAO tem Customer object)
    id: ostr, // cart abandoned usa `id` em vez de order_id
    status: ostr, // cart abandoned discriminador (status: 'abandoned')
    name: ostr,
    email: ostr,
    cpf: ostr,
    cnpj: ostr,
    phone: ostr,
    country: ostr,
    product_id: ostr,
    product_name: ostr,
    offer_name: ostr,
    checkout_link: ostr,
    subscription_plan: ostr,
  })
  .passthrough()

export type KiwifyWebhookPayload = z.infer<typeof kiwifyWebhookSchema>

export function parseKiwifyWebhook(rawBody: string): KiwifyWebhookPayload {
  const json = JSON.parse(rawBody) as unknown
  return kiwifyWebhookSchema.parse(json)
}
