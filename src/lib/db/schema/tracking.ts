import { decimal, index, integer, jsonb, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

import { users, workspaces } from './auth'
import { gatewayEvents } from './gateway'

export const capiEvents = pgTable(
  'capi_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    gatewayEventId: uuid('gateway_event_id').references(() => gatewayEvents.id),
    provider: text('provider').notNull(),
    eventName: text('event_name').notNull(),
    eventId: text('event_id').notNull(),
    eventTime: timestamp('event_time', { withTimezone: true }).notNull(),
    userData: jsonb('user_data'),
    customData: jsonb('custom_data'),
    status: text('status').notNull().default('pending'),
    responseData: jsonb('response_data'),
    eventMatchQuality: decimal('event_match_quality', { precision: 4, scale: 2 }),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('capi_events_workspace_id_idx').on(t.workspaceId),
    index('capi_events_status_idx').on(t.status),
    unique('capi_events_workspace_provider_event_unique').on(t.workspaceId, t.provider, t.eventId),
  ],
)

export const capiEventLog = pgTable(
  'capi_event_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    capiEventId: uuid('capi_event_id')
      .notNull()
      .references(() => capiEvents.id),
    attempt: integer('attempt').notNull().default(1),
    requestPayload: jsonb('request_payload'),
    responsePayload: jsonb('response_payload'),
    httpStatus: integer('http_status'),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [index('capi_event_log_capi_event_id_idx').on(t.capiEventId)],
)

export const clickIdStore = pgTable(
  'click_id_store',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    fbclid: text('fbclid'),
    gclid: text('gclid'),
    ttclid: text('ttclid'),
    msclkid: text('msclkid'),
    landingUrl: text('landing_url'),
    userAgentHash: text('user_agent_hash'),
    ipHash: text('ip_hash'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('click_id_store_workspace_id_idx').on(t.workspaceId),
    index('click_id_store_expires_at_idx').on(t.expiresAt),
    index('click_id_store_fbclid_idx').on(t.fbclid).where(sql`fbclid IS NOT NULL`),
    index('click_id_store_gclid_idx').on(t.gclid).where(sql`gclid IS NOT NULL`),
  ],
)

export const consentLogs = pgTable(
  'consent_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id').references(() => workspaces.id),
    userId: uuid('user_id').references(() => users.id),
    sessionId: text('session_id'),
    consentModeV2: jsonb('consent_mode_v2').notNull(),
    ipHash: text('ip_hash'),
    userAgentHash: text('user_agent_hash'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('consent_logs_workspace_id_idx').on(t.workspaceId),
    index('consent_logs_user_id_idx').on(t.userId),
    index('consent_logs_created_at_idx').on(t.createdAt),
  ],
)
