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

/**
 * Conexao OAuth Google. Uma por workspace.
 * Lista de customer accounts vive em `google_ads_accounts` (1:N).
 *
 * Decisoes em ADR-015:
 *  - Fanout via Data Manager API (POST /v1/events:ingest) — campos
 *    `data_manager_api_version`, `granted_data_manager_scope` rastreiam.
 *  - Metadata via Google Ads API REST `v24` — campo `ads_api_version`.
 *  - 3 sensitive scopes pedidos na MESMA consent screen: auth/datamanager
 *    + auth/adwords + auth/cloud-platform. Bools `granted_*_scope` validam.
 *  - `customer_id`/`customer_name` ficam @deprecated (multi-customer Agency
 *    vive em `google_ads_accounts`).
 *  - `test_mode=true` => validateOnly=true no payload Data Manager API
 *    (equivalente Meta `test_event_code`).
 *  - `refresh_token_invalidated_at` => UI mostra needs_reauth.
 */
export const googleConnections = pgTable(
  'google_connections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    /** @deprecated Multi-customer Agency vive em google_ads_accounts (1:N). */
    customerId: text('customer_id'),
    /** @deprecated ver customerId */
    customerName: text('customer_name'),
    encryptedAccessToken: text('encrypted_access_token').notNull(),
    encryptedRefreshToken: text('encrypted_refresh_token'),
    tokenExpiresAt: timestamp('token_expires_at', { withTimezone: true }),
    encryptionKeyVersion: text('encryption_key_version').notNull().default('v1'),
    // Scopes capturados no OAuth callback
    grantedScopes: jsonb('granted_scopes'),
    grantedDataManagerScope: boolean('granted_data_manager_scope').notNull().default(false),
    grantedAdsScope: boolean('granted_ads_scope').notNull().default(false),
    // Identidade Google
    googleUserId: text('google_user_id'),
    googleUserEmail: text('google_user_email'),
    googleUserName: text('google_user_name'),
    // MCC routing
    managerCustomerId: text('manager_customer_id'),
    loginCustomerIdHeader: text('login_customer_id_header'),
    // API versions (per-tenant override)
    adsApiVersion: text('ads_api_version').notNull().default('v24'),
    dataManagerApiVersion: text('data_manager_api_version').notNull().default('v1'),
    // OAuth client verification (Google review timeline 2-6 semanas)
    oauthClientVerificationStatus: text('oauth_client_verification_status')
      .notNull()
      .default('unverified'),
    partnerAgent: text('partner_agent').notNull().default('criation-io-v1'),
    // Test account / test mode
    testAccountFlag: boolean('test_account_flag').notNull().default(false),
    testMode: boolean('test_mode').notNull().default(false),
    // Refresh tracking
    lastTokenRefreshAt: timestamp('last_token_refresh_at', { withTimezone: true }),
    tokenRefreshFailures: integer('token_refresh_failures').notNull().default(0),
    refreshTokenInvalidatedAt: timestamp('refresh_token_invalidated_at', { withTimezone: true }),
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
    unique('google_connections_workspace_id_unique').on(t.workspaceId),
    index('google_connections_status_idx').on(t.status),
    index('google_connections_active_idx')
      .on(t.workspaceId, t.status)
      .where(sql`deleted_at IS NULL`),
  ]
)

/**
 * Customer accounts acessiveis via google_connection (1:N).
 * Cliente Agency tem multiplos customers (test/prod/espelhos).
 *
 * Populado no OAuth callback via Google Ads API REST:
 *   - listAccessibleCustomers => lista de customers
 *   - SELECT customer_client.* FROM customer_client (per MCC)
 *   - SELECT conversion_action.* FROM conversion_action WHERE status='ENABLED'
 *     => cache em conversion_actions jsonb
 *
 * ADR-015.
 */
export const googleAdsAccounts = pgTable(
  'google_ads_accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    connectionId: uuid('connection_id')
      .notNull()
      .references(() => googleConnections.id, { onDelete: 'cascade' }),
    /** Google Ads customer_id (string numerica, ex "1234567890") */
    customerId: text('customer_id').notNull(),
    customerDescriptiveName: text('customer_descriptive_name'),
    /** MCC parent quando managed; null quando standalone */
    managerCustomerId: text('manager_customer_id'),
    /** Header login-customer-id pra Google Ads API REST */
    loginCustomerId: text('login_customer_id'),
    currencyCode: text('currency_code'),
    timeZone: text('time_zone'),
    /** Google Ads account_status (1=enabled, 2=cancelled, etc) */
    status: integer('status'),
    isTestAccount: boolean('is_test_account').notNull().default(false),
    isManager: boolean('is_manager').notNull().default(false),
    isDefault: boolean('is_default').notNull().default(false),
    /** Cache de conversion_actions ENABLED: [{id, name, type, category, resource_name}] */
    conversionActions: jsonb('conversion_actions'),
    lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at')
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp('deleted_at'),
  },
  (t) => [
    unique('google_ads_accounts_connection_customer_unique').on(t.connectionId, t.customerId),
    index('google_ads_accounts_connection_id_idx')
      .on(t.connectionId)
      .where(sql`deleted_at IS NULL`),
    index('google_ads_accounts_default_idx')
      .on(t.connectionId, t.isDefault)
      .where(sql`is_default = true AND deleted_at IS NULL`),
  ]
)

/**
 * Mapeia event_name Criation -> conversion_action Google.
 * Sem mapping ativo pra um event_name, fanout pula + log skip_reason.
 *
 * `product_destination_id` = conversion_action_id Google (numerico).
 * Renomeado de `conversion_action_resource_name` pelo ADR-015 — vocabulario
 * Data Manager API.
 *
 * Wizard /configuracoes/google/conversoes faz CRUD.
 */
export const googleConversionActionMappings = pgTable(
  'google_conversion_action_mappings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    googleAdsAccountId: uuid('google_ads_account_id')
      .notNull()
      .references(() => googleAdsAccounts.id, { onDelete: 'cascade' }),
    /** Event name Criation: page_view | purchase | lead | etc. */
    internalEventName: text('internal_event_name').notNull(),
    /** = conversion_action_id Google. Usado em destinations[].productDestinationId. */
    productDestinationId: text('product_destination_id').notNull(),
    conversionActionName: text('conversion_action_name'),
    /** 'UPLOAD_CALLS' | 'UPLOAD_CLICKS' | 'WEBPAGE' | etc. */
    conversionActionType: text('conversion_action_type'),
    isPrimary: boolean('is_primary').notNull().default(false),
    isEnabled: boolean('is_enabled').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at')
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp('deleted_at'),
  },
  (t) => [
    unique('google_conv_mapping_workspace_account_event_unique').on(
      t.workspaceId,
      t.googleAdsAccountId,
      t.internalEventName
    ),
    index('google_conv_mapping_workspace_event_idx')
      .on(t.workspaceId, t.internalEventName)
      .where(sql`deleted_at IS NULL AND is_enabled = true`),
    index('google_conv_mapping_account_idx')
      .on(t.googleAdsAccountId)
      .where(sql`deleted_at IS NULL`),
  ]
)

/**
 * Meta-tabela de conexoes externas (gateway, CRM, email, ad network, etc).
 * Substitui a antiga `gateway_connections` — agora `connections` aceita
 * qualquer tipo via coluna `type`. 1:N por workspace.
 *
 * Tabelas especificas por vertical (gateway_events, crm_contacts futuro,
 * email_lists futuro) referenciam via `connection_id` FK.
 *
 * Decisoes em ADR-016/017/018:
 * - `webhookSecret` em PLAIN cifrado (necessario pra HMAC).
 * - `apiCredentials jsonb` flexivel por provider.
 * - `webhookVersion`, `providerSubaccountId` opcionais (nem todo provider usa).
 * - Telemetria (lastWebhookEventAt/Id, failures24h) compartilhada — alimenta
 *   UI de health badge (pending/active/failing/stale).
 */
export const connections = pgTable(
  'connections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    /** Categoria da integracao: 'gateway' | 'crm' | 'email' | 'ad_network' |
     * 'analytics' | 'helpdesk' | 'communication'. Default 'gateway' (legado). */
    type: text('type').notNull().default('gateway'),
    provider: text('provider').notNull(),
    /** Nullable: CDP/analytics nao tem credenciais (origin allowlist via
     * `config`). Gateways/Meta enforce required em app-level. */
    encryptedCredentials: text('encrypted_credentials'),
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
    /** Per-connection config livre. Origin allowlist (analytics), prefs (gateway),
     * install metadata (CDP). Reusavel por todas verticais. ADR-014. */
    config: jsonb('config')
      .notNull()
      .default(sql`'{}'::jsonb`),
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
    index('connections_workspace_id_idx').on(t.workspaceId),
    index('connections_provider_idx').on(t.provider),
    index('connections_type_idx').on(t.type),
    index('connections_status_idx').on(t.status),
    // UNIQUE parcial: 1 conexao ativa por (workspace, type, provider). Permite
    // multiplas soft-deleted + cliente pode ter ex: gateway:hotmart + crm:hotmart
    // futuramente sem colisao (caso improvavel mas defensivo).
    uniqueIndex('connections_workspace_type_provider_active_unique')
      .on(t.workspaceId, t.type, t.provider)
      .where(sql`deleted_at IS NULL`),
  ]
)
