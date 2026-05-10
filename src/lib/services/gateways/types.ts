/**
 * Tipos compartilhados do adapter pattern de gateways de pagamento.
 *
 * Genericos para Hotmart (1.4.5), Kiwify (1.4.6), Eduzz/Monetizze/Ticto (1.4.7).
 * Cada provider implementa `GatewayAdapter` em sua propria pasta filha de
 * `src/lib/services/gateways/`.
 *
 * ADR-016 documenta as decisoes de plataforma Hotmart que motivaram este shape.
 */

export type GatewayProvider = 'hotmart' | 'kiwify' | 'eduzz' | 'monetizze' | 'ticto'

/**
 * Tipos canonicos internos. Adapters mapeiam eventos do provider para estes
 * valores. Manter pequeno: apenas eventos com efeito de billing/atribuicao.
 */
export type NormalizedEventType =
  | 'PURCHASE_APPROVED'
  | 'PURCHASE_COMPLETE'
  | 'PURCHASE_REFUNDED'
  | 'PURCHASE_CHARGEBACK'
  | 'PURCHASE_CANCELED'
  | 'PURCHASE_BILLET_PRINTED'
  | 'PURCHASE_DELAYED'
  | 'PURCHASE_EXPIRED'
  | 'PURCHASE_OUT_OF_SHOPPING_CART'
  | 'PURCHASE_REFUND_REQUESTED'
  | 'SUBSCRIPTION_CANCELLATION'
  | 'SUBSCRIPTION_REACTIVATED'
  | 'SWITCH_PLAN'
  | 'UPDATE_SUBSCRIPTION_CHARGE_DATE'
  | 'CLUB_FIRST_ACCESS'
  | 'CLUB_MODULE_COMPLETED'
  | 'UNKNOWN'

export type PaymentMethod = 'CREDIT_CARD' | 'PIX' | 'BILLET' | 'PAYPAL' | 'OTHER'

export type SubscriptionStatus =
  | 'ACTIVE'
  | 'INACTIVE'
  | 'CANCELLED'
  | 'OVERDUE'
  | 'DELAYED'
  | 'STARTED'

export type AffiliateSource = 'SPARKLE' | 'EXTERNAL'

export interface NormalizedAttribution {
  /** UTMs do checkout. Pode estar parcial ou ausente. */
  utms?:
    | {
        source?: string | undefined
        medium?: string | undefined
        campaign?: string | undefined
        term?: string | undefined
        content?: string | undefined
      }
    | undefined
  /** Tracking proprietario do gateway (Hotmart: src/sck/xcode). */
  origin?:
    | {
        src?: string | undefined
        sck?: string | undefined
        xcode?: string | undefined
      }
    | undefined
  /** `tracking.external_code` no Hotmart. Quando o cliente injetou nosso
   * visitor_id via xcode, este campo carrega. Base do matching deterministico. */
  externalCode?: string | undefined
  /** Click IDs nativos. Hotmart NAO captura — Kiwify/Eduzz podem. */
  fbclid?: string | undefined
  gclid?: string | undefined
  ttclid?: string | undefined
}

/**
 * Evento normalizado emitido por adapter.parseWebhook + adapter.normalizeEvent.
 * E o shape canonico que `processGatewayEventTask` consome — independente de provider.
 *
 * PII (email/phone/document) chega JA HASHADA. Plain so vive em memoria do
 * parser, antes do hashing inline.
 */
export interface NormalizedGatewayEvent {
  provider: GatewayProvider
  /** Identificador unico do evento no provider. Hotmart v2 = UUID; v1 = sha256
   * sintetico (transaction + status + creation_date). Usado em UNIQUE constraint
   * `gateway_events(workspace, provider, provider_event_id)`. */
  providerEventId: string
  /** Versao do payload (Hotmart: '1.0.0' | '2.0.0'). */
  providerEventVersion: string
  eventType: NormalizedEventType
  /** Quando o evento ocorreu no gateway (epoch convertido). UTC. */
  occurredAt: Date
  /** Mesmo timestamp em ms epoch raw (Hotmart usa ms; preservar para auditoria). */
  occurredAtMs: number

  // Money — sempre cents
  amountCents: number
  feeCents?: number | undefined
  producerNetCents?: number | undefined
  currency: string

  // Product / subscription
  productId: string
  productName?: string | undefined
  offerId?: string | undefined
  subscriberCode?: string | undefined
  subscriptionStatus?: SubscriptionStatus | undefined
  recurrenceNumber?: number | undefined
  planId?: string | undefined
  paymentMethod?: PaymentMethod | undefined
  installmentsNumber?: number | undefined
  buyerCountry?: string | undefined

  // Buyer (PII pre-hashed; plain nunca aqui)
  buyerEmailHash: string
  buyerPhoneHash?: string | undefined
  buyerDocumentHash?: string | undefined

  // Affiliate
  affiliateEmailHash?: string | undefined
  affiliateSource?: AffiliateSource | undefined
  commissionAffiliateCents?: number | undefined

  // Attribution (loose — adapters preenchem o que conseguem)
  attribution: NormalizedAttribution

  // Idempotency + raw
  /** Chave de idempotencia para creditService.allocate/revoke. Para v2 = providerEventId. */
  allocationIdempotencyKey: string
  /** Payload original PII-redacted (email/phone/document removidos ou hasheados). */
  rawPayload: Record<string, unknown>
}

/**
 * Estado de subscription materializado em `gateway_subscriptions`.
 * Atualizado pelo processGatewayEventTask em PURCHASE_APPROVED + CANCELLATION.
 */
export interface NormalizedSubscription {
  provider: GatewayProvider
  subscriberCode: string
  planId?: string | undefined
  productId?: string | undefined
  status: SubscriptionStatus
  accessionDate?: Date | undefined
  endAccessionDate?: Date | undefined
  nextChargeDate?: Date | undefined
  currentRecurrence: number
  cancellationReason?: string | undefined
  monthlyValueCents?: number | undefined
  currency: string
  /** Snapshot do origin da venda inicial. Renovacoes herdam. */
  origin?: NormalizedAttribution['origin']
  identifiedVisitorId?: string | undefined
}

export interface NormalizedProduct {
  provider: GatewayProvider
  providerProductId: string
  name: string
  ucode?: string | undefined
  format?: string | undefined
  isSubscription?: boolean | undefined
  warrantyDays?: number | undefined
  defaultCurrency?: string | undefined
  priceCents?: number | undefined
}

/**
 * Credenciais especificas por provider (discriminated union).
 * Adapter recebe apenas o shape relevante para si.
 *
 * Hotmart MVP precisa apenas de `hottok` (HMAC do webhook). Os campos OAuth
 * (clientId/clientSecret) sao opcionais e so exigidos quando o adapter
 * implementar `fetchAccessToken` (backfill historico, fora do MVP).
 */
export type GatewayCredentials =
  | {
      provider: 'hotmart'
      hottok: string
      sandbox: boolean
      clientId?: string | undefined
      clientSecret?: string | undefined
      basicToken?: string | undefined
    }
  | { provider: 'kiwify'; apiKey: string; webhookSecret: string }
  | { provider: 'eduzz'; publicKey: string; apiKey: string; webhookSecret: string }
  | { provider: 'monetizze'; apiKey: string; webhookSecret: string }
  | { provider: 'ticto'; apiKey: string; webhookSecret: string }

export interface GatewayAccessToken {
  token: string
  expiresAt: Date
}

export type SignatureValidationResult =
  | { valid: true; method: 'payload-token' | 'hmac-header' }
  | { valid: false; reason: string }

/**
 * Interface comum de todos os adapters. Implementacoes vivem em pastas filhas
 * (src/lib/services/gateways/hotmart/, kiwify/, etc).
 *
 * **MVP (Sessao 1.4.5):** apenas as 3 funcoes pure sao OBRIGATORIAS
 * (validateSignature, parseWebhook, normalizeEvent). Adapters podem ignorar
 * as funcoes opcionais e expor capacidades reduzidas.
 *
 * **Pos-MVP:** quando precisar de backfill historico, sync de subscription
 * state ou catalogo de produtos via REST API, implementar as variantes
 * fetch*. Mantemos opcionais aqui para nao quebrar adapters MVP-only.
 */
export interface GatewayAdapter {
  readonly provider: GatewayProvider

  /**
   * Valida assinatura/secret do webhook. Recebe o RAW body (string exata,
   * nao re-stringified) — necessario para HMAC.
   */
  validateSignature(
    rawBody: string,
    headers: Headers,
    creds: { webhookSecret: string }
  ): SignatureValidationResult

  /**
   * Parse do body bruto para shape tipado interno. Lanca em payload mal-formado.
   */
  parseWebhook(rawBody: string, headers: Headers): unknown

  /**
   * Converte parsed payload em NormalizedGatewayEvent. **Hashea PII inline**
   * (email/phone/document) antes de devolver — o caller persiste o resultado
   * sem nunca ver plain.
   */
  normalizeEvent(parsed: unknown): NormalizedGatewayEvent

  /**
   * (Opcional) Troca credenciais por access token. Cache em memoria + Redis.
   * Hotmart MVP nao usa — adicionar quando backfill historico voltar.
   */
  fetchAccessToken?(creds: GatewayCredentials, workspaceId: string): Promise<GatewayAccessToken>

  /** (Opcional) Iterador async de vendas historicas. Para backfill. */
  fetchSalesHistory?(creds: GatewayCredentials, since: Date): AsyncIterable<NormalizedGatewayEvent>

  /** (Opcional) Lista subscriptions ativas via REST. */
  fetchSubscriptions?(creds: GatewayCredentials): AsyncIterable<NormalizedSubscription>

  /** (Opcional) Lista produtos via REST. */
  fetchProducts?(creds: GatewayCredentials): AsyncIterable<NormalizedProduct>
}
