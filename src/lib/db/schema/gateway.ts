import { decimal, index, integer, jsonb, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

import { workspaces } from './auth'
import { ads } from './campaigns'
import { gatewayConnections } from './connections'

export const gatewayProducts = pgTable(
  'gateway_products',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    connectionId: uuid('connection_id')
      .notNull()
      .references(() => gatewayConnections.id),
    providerProductId: text('provider_product_id').notNull(),
    name: text('name').notNull(),
    priceCents: integer('price_cents'),
    productType: text('product_type'),
    mappedToInternalId: text('mapped_to_internal_id'),
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
      t.providerProductId,
    ),
  ],
)

export const gatewayEvents = pgTable(
  'gateway_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    connectionId: uuid('connection_id')
      .notNull()
      .references(() => gatewayConnections.id),
    provider: text('provider').notNull(),
    eventType: text('event_type').notNull(),
    providerEventId: text('provider_event_id').notNull(),
    productId: text('product_id'),
    amountCents: integer('amount_cents'),
    currency: text('currency').default('BRL'),
    customerEmailHash: text('customer_email_hash'),
    customerPhoneHash: text('customer_phone_hash'),
    utmSource: text('utm_source'),
    utmMedium: text('utm_medium'),
    utmCampaign: text('utm_campaign'),
    utmContent: text('utm_content'),
    utmTerm: text('utm_term'),
    fbclid: text('fbclid'),
    gclid: text('gclid'),
    ttclid: text('ttclid'),
    rawPayload: jsonb('raw_payload').notNull(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('gateway_events_workspace_id_idx').on(t.workspaceId),
    unique('gateway_events_workspace_provider_event_unique').on(
      t.workspaceId,
      t.provider,
      t.providerEventId,
    ),
    index('gateway_events_event_type_idx').on(t.eventType),
    index('gateway_events_processed_at_idx')
      .on(t.processedAt)
      .where(sql`processed_at IS NULL`),
  ],
)

export const gatewayEventsDlq = pgTable(
  'gateway_events_dlq',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id').references(() => workspaces.id),
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
  ],
)

export const utmMappings = pgTable(
  'utm_mappings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    utmSource: text('utm_source'),
    utmMedium: text('utm_medium'),
    utmCampaign: text('utm_campaign'),
    utmContent: text('utm_content'),
    utmTerm: text('utm_term'),
    adId: uuid('ad_id').references(() => ads.id),
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
  ],
)

export const utmStitchingLog = pgTable(
  'utm_stitching_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    gatewayEventId: uuid('gateway_event_id')
      .notNull()
      .references(() => gatewayEvents.id),
    matchedAdId: uuid('matched_ad_id').references(() => ads.id),
    strategyUsed: text('strategy_used'),
    confidence: decimal('confidence', { precision: 5, scale: 4 }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('utm_stitching_log_workspace_id_idx').on(t.workspaceId),
    index('utm_stitching_log_gateway_event_id_idx').on(t.gatewayEventId),
  ],
)
