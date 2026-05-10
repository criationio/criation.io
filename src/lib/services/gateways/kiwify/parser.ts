import { z } from 'zod'

/**
 * Parser do payload Kiwify webhook.
 *
 * Kiwify NAO tem versionamento explicito do webhook payload (sem campo `version`
 * igual Hotmart v2). Usamos schema permissivo com `passthrough` para tolerar
 * mudancas futuras sem quebrar.
 *
 * Discriminador de evento: `webhook_event_type` (string, valores em audit §3).
 *
 * Schema completo de venda em `docs/audits/KIWIFY_API_2026-05.md` §4.
 */

const customerSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().optional(),
    email: z.string().optional(),
    cpf: z.string().optional(),
    cnpj: z.string().optional(),
    mobile: z.string().optional(),
    instagram: z.string().optional(),
    country: z.string().optional(),
    address: z
      .object({
        street: z.string().optional(),
        number: z.string().optional(),
        complement: z.string().optional(),
        neighborhood: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        zipcode: z.string().optional(),
      })
      .partial()
      .optional(),
  })
  .partial()
  .passthrough()

const productSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().optional(),
  })
  .partial()
  .passthrough()

const paymentSchema = z
  .object({
    charge_amount: z.number().optional(),
    charge_currency: z.string().optional(),
    net_amount: z.number().optional(),
    settlement_amount: z.number().optional(),
    settlement_currency: z.string().optional(),
    fee: z.number().optional(),
    fee_currency: z.string().optional(),
    sale_tax_rate: z.number().optional(),
    sale_tax_amount: z.number().optional(),
    product_base_price: z.number().optional(),
    product_base_currency: z.string().optional(),
  })
  .partial()
  .passthrough()

const trackingSchema = z
  .object({
    src: z.string().nullable().optional(),
    sck: z.string().nullable().optional(),
    utm_source: z.string().nullable().optional(),
    utm_medium: z.string().nullable().optional(),
    utm_campaign: z.string().nullable().optional(),
    utm_content: z.string().nullable().optional(),
    utm_term: z.string().nullable().optional(),
    s1: z.string().nullable().optional(),
    s2: z.string().nullable().optional(),
    s3: z.string().nullable().optional(),
  })
  .partial()
  .passthrough()

const affiliateCommissionSchema = z
  .object({
    name: z.string().optional(),
    document: z.string().optional(),
    email: z.string().optional(),
    amount: z.number().optional(),
  })
  .partial()
  .passthrough()

/**
 * Schema do payload completo. Todos os campos sao opcionais com passthrough
 * — Kiwify pode enviar shape variado dependendo do evento (ex: pix_gerado
 * nao tem `payment.fee` final).
 */
export const kiwifyWebhookSchema = z
  .object({
    /** Discriminador principal — vem em payload.webhook_event_type ou .event */
    webhook_event_type: z.string().optional(),
    event: z.string().optional(),

    /** UUID da venda — chave de idempotencia */
    order_id: z.string().optional(),
    id: z.string().optional(),
    reference: z.string().optional(),

    /** Token (camada 3 de validacao) */
    token: z.string().optional(),

    /** Datas (ISO 8601 ou ms epoch) */
    created_at: z.union([z.string(), z.number()]).optional(),
    updated_at: z.union([z.string(), z.number()]).optional(),
    approved_date: z.union([z.string(), z.number()]).optional(),

    /** Status da venda no momento do evento */
    status: z.string().optional(),

    /** Method (credit_card | pix | boleto | paypal) */
    payment_method: z.string().optional(),

    /** Renovacao aponta pra venda inicial via parent_order_id */
    parent_order_id: z.string().nullable().optional(),

    /** Tipo: product | event | subscription */
    type: z.string().optional(),
    sale_type: z.string().optional(),

    /** Money — multi-moeda nativa */
    net_amount: z.number().optional(),
    currency: z.string().optional(),

    installments: z.number().optional(),
    card_last_digits: z.string().optional(),
    card_type: z.string().optional(),
    card_rejection_reason: z.string().nullable().optional(),
    boleto_url: z.string().nullable().optional(),
    refunded_at: z.union([z.string(), z.number()]).nullable().optional(),

    /** Sub-objetos */
    customer: customerSchema.optional(),
    product: productSchema.optional(),
    payment: paymentSchema.optional(),
    tracking: trackingSchema.optional(),
    affiliate_commission: affiliateCommissionSchema.optional(),
    revenue_partners: z.array(z.unknown()).optional(),

    /** Subscription state (quando vem em renovacao/cancelamento) */
    subscription: z
      .object({
        id: z.string().optional(),
        start_date: z.union([z.string(), z.number()]).optional(),
        next_payment: z.union([z.string(), z.number()]).optional(),
        status: z.string().optional(),
        plan: z
          .object({
            id: z.string().optional(),
            name: z.string().optional(),
          })
          .partial()
          .optional(),
      })
      .partial()
      .passthrough()
      .optional(),
  })
  .passthrough()

export type KiwifyWebhookPayload = z.infer<typeof kiwifyWebhookSchema>

export function parseKiwifyWebhook(rawBody: string): KiwifyWebhookPayload {
  const json = JSON.parse(rawBody) as unknown
  return kiwifyWebhookSchema.parse(json)
}
