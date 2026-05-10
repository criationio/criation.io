import {
  bigint,
  boolean,
  decimal,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

import { workspaces } from './auth'
import { ads, campaigns as campaignsRef } from './campaigns'
import { connections } from './connections'

export const gatewayProducts = pgTable(
  'gateway_products',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    connectionId: uuid('connection_id')
      .notNull()
      .references(() => connections.id, { onDelete: 'cascade' }),
    providerProductId: text('provider_product_id').notNull(),
    name: text('name').notNull(),
    priceCents: integer('price_cents'),
    productType: text('product_type'),
    mappedToInternalId: text('mapped_to_internal_id'),
    /** Hotmart product.ucode (UUID alternativo) — usado em URLs publicas e Club. */
    ucode: text('ucode'),
    /** Hotmart product.format: EBOOK | ONLINE_COURSE | EVENT | SOFTWARE | ... */
    format: text('format'),
    /** Se o produto e assinatura recorrente (Hotmart `is_subscription`). */
    isSubscription: boolean('is_subscription'),
    /** Janela de garantia em dias — afeta `PURCHASE_COMPLETE` (libera receita liquida). */
    warrantyDays: integer('warranty_days'),
    /** Moeda principal do produto: BRL | USD | EUR | MXN. */
    defaultCurrency: text('default_currency'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at')
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index('gateway_products_workspace_id_idx').on(t.workspaceId),
    index('gateway_products_connection_id_idx').on(t.connectionId),
    unique('gateway_products_workspace_conn_provider_unique').on(
      t.workspaceId,
      t.connectionId,
      t.providerProductId
    ),
  ]
)

export const gatewayEvents = pgTable(
  'gateway_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    connectionId: uuid('connection_id')
      .notNull()
      .references(() => connections.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(),
    eventType: text('event_type').notNull(),
    providerEventId: text('provider_event_id').notNull(),
    /** Versao do payload do provider (Hotmart: '1.0.0' | '2.0.0'). */
    providerEventVersion: text('provider_event_version'),
    productId: text('product_id'),
    amountCents: integer('amount_cents'),
    currency: text('currency').default('BRL'),
    /** Hotmart: 1 = primeira compra; 2+ = renovacao de subscription (mesmo subscriber_code). */
    recurrenceNumber: integer('recurrence_number'),
    /** Hotmart: subscriber.code — chave persistente da subscription (sobrevive a renewals). */
    subscriberCode: text('subscriber_code'),
    /** Estado da subscription no momento do evento: ACTIVE | CANCELLED | OVERDUE | DELAYED. */
    subscriptionStatus: text('subscription_status'),
    /** Hotmart: plan.id da assinatura. */
    planId: text('plan_id'),
    /** CREDIT_CARD | PIX | BILLET | PAYPAL | OTHER. */
    paymentMethod: text('payment_method'),
    /** Numero de parcelas (cartao). */
    installmentsNumber: integer('installments_number'),
    /** Taxa cobrada pelo gateway (ex: Hotmart marketplace fee). */
    feeCents: integer('fee_cents'),
    /** Valor liquido recebido pelo produtor (apos taxas e comissoes). */
    producerNetCents: integer('producer_net_cents'),
    /** Valor pago ao afiliado nessa venda (se houver). */
    commissionAffiliateCents: integer('commission_affiliate_cents'),
    /** Hash do email do afiliado (LGPD). */
    affiliateEmailHash: text('affiliate_email_hash'),
    /** Origem do afiliado: 'SPARKLE' (Hotmart Sparkle) | 'EXTERNAL' | null. */
    affiliateSource: text('affiliate_source'),
    /** Hotmart origin object: {src, sck, xcode} cru — base do matching visitor->buyer. */
    origin: jsonb('origin'),
    /** Hotmart tracking.external_code — nosso visitor_id quando injetamos via xcode. */
    externalCode: text('external_code'),
    /** ISO-2 do pais do checkout (BR | US | MX | ...). Hotmart vende multi-country. */
    buyerCountry: text('buyer_country'),
    customerEmailHash: text('customer_email_hash'),
    customerPhoneHash: text('customer_phone_hash'),
    /** Hash de CPF/CNPJ (LGPD-sensitive). */
    buyerDocumentHash: text('buyer_document_hash'),
    /** creation_date raw em ms epoch (Hotmart usa ms; preservar para auditoria). */
    creationDateMs: bigint('creation_date_ms', { mode: 'number' }),
    /** Status de alocacao de creditos: 'pending' | 'allocated' | 'revoked' | 'failed' | 'backfill_skipped'. */
    allocationStatus: text('allocation_status').default('pending'),
    /** Idempotency key usada em creditService.allocate/revoke. Para v2 = event.id; v1 = sha256 sintetico. */
    allocationIdempotencyKey: text('allocation_idempotency_key'),
    utmSource: text('utm_source'),
    utmMedium: text('utm_medium'),
    utmCampaign: text('utm_campaign'),
    utmContent: text('utm_content'),
    utmTerm: text('utm_term'),
    fbclid: text('fbclid'),
    gclid: text('gclid'),
    ttclid: text('ttclid'),
    /** UTM Stitcher result (1.4.8). 'unmatched' default ate stitch rodar.
     * Valores: 'perfect' | 'manual' | 'meta_literal' | 'unmatched'. */
    matchStrategy: text('match_strategy').notNull().default('unmatched'),
    matchedCampaignId: uuid('matched_campaign_id').references(() => campaignsRef.id, {
      onDelete: 'set null',
    }),
    matchedAdSetId: uuid('matched_ad_set_id'),
    matchedAdId: uuid('matched_ad_id'),
    /** Confidence score do match. 1.0 perfect/manual; reservado pra fuzzy futuro (TD-082). */
    matchConfidence: decimal('match_confidence', { precision: 5, scale: 4 }),
    stitchedAt: timestamp('stitched_at', { withTimezone: true }),
    rawPayload: jsonb('raw_payload').notNull(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('gateway_events_workspace_id_idx').on(t.workspaceId),
    unique('gateway_events_workspace_provider_event_unique').on(
      t.workspaceId,
      t.provider,
      t.providerEventId
    ),
    index('gateway_events_event_type_idx').on(t.eventType),
    index('gateway_events_processed_at_idx')
      .on(t.processedAt)
      .where(sql`processed_at IS NULL`),
    index('gateway_events_subscriber_code_idx').on(t.subscriberCode),
    index('gateway_events_external_code_idx').on(t.externalCode),
    index('gateway_events_matched_campaign_idx').on(t.matchedCampaignId),
    // Index parcial pra dashboard "vendas nao atribuidas"
    index('gateway_events_unmatched_idx')
      .on(t.workspaceId, t.createdAt)
      .where(sql`match_strategy = 'unmatched'`),
  ]
)

/**
 * Estado materializado de subscriptions (1 row por subscriber_code).
 * Atualizado por `processGatewayEventTask` em cada PURCHASE_APPROVED / CANCELLATION.
 *
 * Por que tabela separada vs derivar de gateway_events:
 * - Dashboard MRR/churn precisa de leitura barata (sem scan + group by).
 * - `origin` snapshot da venda inicial permite atribuir renovacoes a campanha original.
 * - `identifiedVisitorId` fecha o loop visitor->buyer permanente.
 *
 * ADR-016 dec.6.
 */
export const gatewaySubscriptions = pgTable(
  'gateway_subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    connectionId: uuid('connection_id')
      .notNull()
      .references(() => connections.id, { onDelete: 'cascade' }),
    /** Hotmart subscriber.code — chave persistente, sobrevive a renewals. */
    subscriberCode: text('subscriber_code').notNull(),
    planId: text('plan_id'),
    productId: text('product_id'),
    /** ACTIVE | CANCELLED | OVERDUE | DELAYED | INACTIVE | STARTED. */
    status: text('status').notNull(),
    accessionDate: timestamp('accession_date', { withTimezone: true }),
    endAccessionDate: timestamp('end_accession_date', { withTimezone: true }),
    nextChargeDate: timestamp('next_charge_date', { withTimezone: true }),
    currentRecurrence: integer('current_recurrence').notNull().default(1),
    cancellationReason: text('cancellation_reason'),
    monthlyValueCents: integer('monthly_value_cents'),
    currency: text('currency').default('BRL'),
    /** Snapshot do origin {src, sck, xcode} da VENDA INICIAL. Renovacoes herdam. */
    origin: jsonb('origin'),
    /** Visitor_id capturado via xcode na venda inicial. Permanente. */
    identifiedVisitorId: text('identified_visitor_id'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at')
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    unique('gateway_subscriptions_workspace_conn_subscriber_unique').on(
      t.workspaceId,
      t.connectionId,
      t.subscriberCode
    ),
    index('gateway_subscriptions_workspace_id_idx').on(t.workspaceId),
    index('gateway_subscriptions_connection_id_idx').on(t.connectionId),
    index('gateway_subscriptions_status_idx').on(t.status),
    // Indice parcial: jobs de polling/dunning so olham ativas com renovacao proxima
    index('gateway_subscriptions_next_charge_active_idx')
      .on(t.nextChargeDate)
      .where(sql`status = 'ACTIVE'`),
  ]
)

export const gatewayEventsDlq = pgTable(
  'gateway_events_dlq',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id').references(() => workspaces.id, {
      onDelete: 'cascade',
    }),
    provider: text('provider').notNull(),
    rawPayload: jsonb('raw_payload').notNull(),
    errorMessage: text('error_message'),
    retryCount: integer('retry_count').notNull().default(0),
    lastRetryAt: timestamp('last_retry_at', { withTimezone: true }),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('gateway_events_dlq_workspace_id_idx').on(t.workspaceId),
    index('gateway_events_dlq_resolved_at_idx')
      .on(t.resolvedAt)
      .where(sql`resolved_at IS NULL`),
  ]
)

export const utmMappings = pgTable(
  'utm_mappings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    utmSource: text('utm_source'),
    utmMedium: text('utm_medium'),
    utmCampaign: text('utm_campaign'),
    utmContent: text('utm_content'),
    utmTerm: text('utm_term'),
    adId: uuid('ad_id').references(() => ads.id, { onDelete: 'set null' }),
    confidenceScore: decimal('confidence_score', { precision: 5, scale: 4 }),
    strategy: text('strategy'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at')
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index('utm_mappings_workspace_id_idx').on(t.workspaceId),
    index('utm_mappings_ad_id_idx').on(t.adId),
  ]
)
