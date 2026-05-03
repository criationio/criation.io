import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

import { workspaces } from './auth'

export const metaConnections = pgTable(
  'meta_connections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    adAccountId: text('ad_account_id').notNull(),
    adAccountName: text('ad_account_name'),
    encryptedAccessToken: text('encrypted_access_token').notNull(),
    encryptedRefreshToken: text('encrypted_refresh_token'),
    tokenExpiresAt: timestamp('token_expires_at', { withTimezone: true }),
    encryptionKeyVersion: text('encryption_key_version').notNull().default('v1'),
    pixelId: text('pixel_id'),
    businessId: text('business_id'),
    status: text('status').notNull().default('active'),
    lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at')
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp('deleted_at'),
  },
  (t) => [
    index('meta_connections_workspace_id_idx').on(t.workspaceId),
    index('meta_connections_status_idx').on(t.status),
  ],
)

export const googleConnections = pgTable(
  'google_connections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    customerId: text('customer_id').notNull(),
    customerName: text('customer_name'),
    encryptedAccessToken: text('encrypted_access_token').notNull(),
    encryptedRefreshToken: text('encrypted_refresh_token'),
    tokenExpiresAt: timestamp('token_expires_at', { withTimezone: true }),
    encryptionKeyVersion: text('encryption_key_version').notNull().default('v1'),
    status: text('status').notNull().default('active'),
    lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at')
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp('deleted_at'),
  },
  (t) => [
    index('google_connections_workspace_id_idx').on(t.workspaceId),
    index('google_connections_status_idx').on(t.status),
  ],
)

export const gatewayConnections = pgTable(
  'gateway_connections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id),
    provider: text('provider').notNull(),
    encryptedCredentials: text('encrypted_credentials').notNull(),
    encryptionKeyVersion: text('encryption_key_version').notNull().default('v1'),
    webhookUrl: text('webhook_url'),
    webhookSecretHash: text('webhook_secret_hash'),
    status: text('status').notNull().default('active'),
    lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at')
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp('deleted_at'),
  },
  (t) => [
    index('gateway_connections_workspace_id_idx').on(t.workspaceId),
    index('gateway_connections_provider_idx').on(t.provider),
    index('gateway_connections_status_idx').on(t.status),
  ],
)
