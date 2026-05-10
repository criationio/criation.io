import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

import { workspaces } from './auth'

/**
 * Conexao OAuth do Meta. Uma por workspace (constraint UNIQUE).
 * Lista de ad accounts da conexao vive em `meta_ad_accounts` (1:N).
 *
 * Decisoes em ADR-013:
 * - Marketing API v25.0 (default, per-tenant override via marketing_api_version)
 * - granted_scopes registra escopos REALMENTE concedidos
 * - System User Token preferido (is_system_user_token=true, nao expira)
 * - business_verification_status + verified_domains capturados pos-OAuth
 * - partner_agent identifica nossa app no Events Manager
 */
export const metaConnections = pgTable(
  'meta_connections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    /** @deprecated A partir de ADR-013 a lista de ad accounts vive em
     * `meta_ad_accounts` (1:N). Manter aqui como nullable para
     * compatibilidade ate purge no proximo zero-downtime PR. */
    adAccountId: text('ad_account_id'),
    /** @deprecated ver adAccountId */
    adAccountName: text('ad_account_name'),
    encryptedAccessToken: text('encrypted_access_token').notNull(),
    encryptedRefreshToken: text('encrypted_refresh_token'),
    tokenExpiresAt: timestamp('token_expires_at', { withTimezone: true }),
    encryptionKeyVersion: text('encryption_key_version').notNull().default('v1'),
    // Identidade do owner Meta
    metaUserId: text('meta_user_id'),
    metaUserName: text('meta_user_name'),
    metaUserEmail: text('meta_user_email'),
    // System User Token (preferido, nao expira)
    systemUserId: text('system_user_id'),
    isSystemUserToken: boolean('is_system_user_token').notNull().default(false),
    // Scopes e tier
    grantedScopes: jsonb('granted_scopes'),
    accessTier: text('access_tier').notNull().default('standard'),
    // Pixel default e business default
    pixelId: text('pixel_id'),
    businessId: text('business_id'),
    // Verificacao de business e dominios (capturada do BM)
    businessVerificationStatus: text('business_verification_status')
      .notNull()
      .default('not_started'),
    verifiedDomains: jsonb('verified_domains'),
    // Versao API e identificador da nossa app
    marketingApiVersion: text('marketing_api_version').notNull().default('v25.0'),
    partnerAgent: text('partner_agent').notNull().default('criation-io-v1'),
    // Refresh tracking
    lastTokenRefreshAt: timestamp('last_token_refresh_at', { withTimezone: true }),
    tokenRefreshFailures: integer('token_refresh_failures').notNull().default(0),
    // Test events
    testEventCode: text('test_event_code'),
    // Status e sync
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
    unique('meta_connections_workspace_id_unique').on(t.workspaceId),
    index('meta_connections_status_idx').on(t.status),
    index('meta_connections_token_expires_idx').on(t.tokenExpiresAt),
  ]
)

/**
 * Ad accounts ligados a uma meta_connection. 1:N — cliente Agency
 * tem multiplos ad accounts (teste, prod, espelho). Um marcado como
 * default por conexao (is_default=true).
 */
export const metaAdAccounts = pgTable(
  'meta_ad_accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    connectionId: uuid('connection_id')
      .notNull()
      .references(() => metaConnections.id, { onDelete: 'cascade' }),
    adAccountId: text('ad_account_id').notNull(),
    adAccountName: text('ad_account_name'),
    businessId: text('business_id'),
    currency: text('currency'),
    timezoneName: text('timezone_name'),
    accountStatus: integer('account_status'),
    isDefault: boolean('is_default').notNull().default(false),
    lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at')
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp('deleted_at'),
  },
  (t) => [
    unique('meta_ad_accounts_connection_account_unique').on(t.connectionId, t.adAccountId),
    index('meta_ad_accounts_connection_id_idx').on(t.connectionId),
    index('meta_ad_accounts_default_idx').on(t.connectionId, t.isDefault),
  ]
)

/**
 * Data Deletion Callback do Meta — webhook obrigatorio para apps
 * com permissoes que envolvem PII. Recebe signed_request HMAC com
 * app_scoped_user_id e devemos retornar confirmation_code.
 *
 * Sem este endpoint + tabela, App Review do Meta e negado.
 *
 * Stub na 1.3: validar signed_request, INSERT, retornar confirmation_code.
 * Processamento real (purge de PII associada) entra em 3.13.5 (DPIA).
 */
export const metaDataDeletionRequests = pgTable(
  'meta_data_deletion_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    appScopedUserId: text('app_scoped_user_id').notNull(),
    signedRequestPayload: jsonb('signed_request_payload').notNull(),
    confirmationCode: text('confirmation_code').notNull(),
    status: text('status').notNull().default('pending'),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('meta_data_deletion_app_scoped_user_idx').on(t.appScopedUserId),
    index('meta_data_deletion_status_idx').on(t.status),
    unique('meta_data_deletion_confirmation_unique').on(t.confirmationCode),
  ]
)

export const googleConnections = pgTable(
  'google_connections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
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
  ]
)

/**
 * Conexao a um gateway de pagamento (Hotmart, Kiwify, Eduzz, Monetizze, Ticto).
 * 1:N por workspace — cliente pode ter Hotmart e Kiwify simultaneamente.
 *
 * Decisoes em ADR-016 (Hotmart-first, template para os demais):
 * - `webhookSecret` em PLAIN cifrado (necessario pra HMAC). `webhookSecretHash`
 *   esta deprecated e sai em PR (b)/(c) na 1.4.6 (TD-048).
 * - `apiCredentials jsonb` carrega `{client_id, encrypted_client_secret, sandbox, basic_token?}`.
 * - `webhookVersion` permite suportar v1 legado e v2 simultaneamente.
 * - `providerSubaccountId` capturado na primeira chamada API (ex: Hotmart producer_id).
 * - Telemetria de webhook (lastWebhookEventAt/Id, failures24h) alimenta UI de saude.
 */
export const gatewayConnections = pgTable(
  'gateway_connections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(),
    encryptedCredentials: text('encrypted_credentials').notNull(),
    encryptionKeyVersion: text('encryption_key_version').notNull().default('v1'),
    webhookUrl: text('webhook_url'),
    /** @deprecated Substituido por `webhookSecret` (plain cifrado). HMAC nao funciona
     * com hash. Remover em PR (b)/(c) na 1.4.6 — TD-048. */
    webhookSecretHash: text('webhook_secret_hash'),
    /** Webhook secret em PLAIN, cifrado via `encrypt()` (decryptable). Necessario
     * para validar HMAC `x-hotmart-signature` contra raw body. */
    webhookSecret: text('webhook_secret'),
    /** `{client_id, encrypted_client_secret, sandbox: bool, basic_token?: string}`.
     * `encrypted_client_secret` cifrado individualmente via `encrypt()`. */
    apiCredentials: jsonb('api_credentials'),
    /** Versao do webhook configurada pelo cliente. Hotmart: 'v1' | 'v2' (default 'v2'). */
    webhookVersion: text('webhook_version').default('v2'),
    /** ID interno do provider (ex: Hotmart producer_id). Capturado na 1a chamada REST. */
    providerSubaccountId: text('provider_subaccount_id'),
    /** Timestamp do ultimo webhook recebido com sucesso (telemetria de saude). */
    lastWebhookEventAt: timestamp('last_webhook_event_at', { withTimezone: true }),
    /** ID do ultimo webhook event (debug + dedup hint). */
    lastWebhookEventId: text('last_webhook_event_id'),
    /** Contador de falhas em janela 24h — alerta cliente se webhook quebrar. */
    webhookFailures24h: integer('webhook_failures_24h').notNull().default(0),
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
    // UNIQUE parcial: 1 conexao ativa por (workspace, provider). Permite multiplas
    // soft-deleted (rehistoria de conexoes anteriores).
    uniqueIndex('gateway_connections_workspace_provider_active_unique')
      .on(t.workspaceId, t.provider)
      .where(sql`deleted_at IS NULL`),
  ]
)
