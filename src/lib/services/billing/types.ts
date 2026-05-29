/**
 * Tipos do billing da Criation (merchant — Asaas/Stripe). Distinto dos gateways
 * do cliente (Hotmart/Kiwify). Sessão 1.12.
 */

export type BillingProvider = 'asaas' | 'stripe'

export type BillingEventType =
  | 'subscription_activated' // 1ª cobrança / assinatura criada+confirmada
  | 'invoice_paid' // ciclo recorrente pago
  | 'pack_purchased' // compra avulsa (overage) confirmada
  | 'charge_refunded' // estorno/chargeback → rollback dos créditos
  | 'subscription_canceled' // cancelamento (NÃO revoga créditos do ciclo)
  | 'ignored' // evento que não acionamos

/**
 * Evento normalizado — saída de `parseEvent` de qualquer adapter. O webhook
 * route só dedup+enfileira; o task `process-billing-event` consome isto.
 */
export interface BillingEvent {
  provider: BillingProvider
  type: BillingEventType
  /** ID do evento no provider — chave de dedup (processed_webhook_events). */
  externalEventId: string
  /** Workspace alvo — de metadata/externalReference ou resolvido por lookup. */
  workspaceId: string | null
  planId: string | null
  packSku: string | null
  amountCents: number | null
  currency: string | null
  providerCustomerId: string | null
  providerSubscriptionId: string | null
  /** Fatura/pagamento — base da idempotencyKey do allocate/refund. */
  invoiceId: string | null
  paymentId: string | null
  /** Fim do ciclo (assinatura) — expiração do bucket subscription. */
  cycleEndsAt: Date | null
  raw?: unknown
}

export interface CreateCustomerInput {
  workspaceId: string
  name: string
  email: string
  cpfCnpj?: string
}

export interface CreateSubscriptionInput {
  workspaceId: string
  userId: string
  planId: string
  providerCustomerId: string
  billingType: 'PIX' | 'CREDIT_CARD' | 'BOLETO'
  /** Token do cartão (tokenizado no checkout transparente) quando CREDIT_CARD. */
  creditCardToken?: string
  /** Idempotency-Key — previne cobrança duplicada em retry. */
  idempotencyKey: string
}

export interface CreateSubscriptionResult {
  providerSubscriptionId: string
  status: string
  /** Pix: dados pra renderizar QR/copia-e-cola no checkout (1.13). */
  pix?: { encodedImage?: string; payload?: string } | null
  /** Boleto/fatura: URL pra renderizar (1.13). */
  invoiceUrl?: string | null
}

export interface BillingAdapter {
  readonly provider: BillingProvider
  createCustomer(input: CreateCustomerInput): Promise<{ providerCustomerId: string }>
  createSubscription(input: CreateSubscriptionInput): Promise<CreateSubscriptionResult>
  cancelSubscription(providerSubscriptionId: string, idempotencyKey: string): Promise<void>
  changePlan(
    providerSubscriptionId: string,
    newPlanId: string,
    idempotencyKey: string
  ): Promise<void>
  refund(paymentId: string, amountCents: number | undefined, idempotencyKey: string): Promise<void>
  /** Valida a assinatura/secret do webhook. Fail closed. */
  validateWebhook(rawBody: string, headers: Headers): boolean
  /** Normaliza o payload cru pra BillingEvent. */
  parseEvent(rawBody: string): BillingEvent
}
