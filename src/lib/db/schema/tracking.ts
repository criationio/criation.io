import {
  boolean,
  decimal,
  index,
  integer,
  jsonb,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

import { users, workspaces } from './auth'

/**
 * Log auditorial de envios CAPI (Meta + Google) — Sessao 1.4.9.
 *
 * Particionada mensal por `event_time` via migration manual
 * (`0013_capi_events_meta_deltas.sql`). Schema aqui descreve o parent;
 * Drizzle-kit nao gera PARTITION BY — task daily cria M+3 antes do mes virar.
 *
 * Colunas Meta P1 (audit Meta 2026-05): IP/UA em claro pra dedup Meta,
 * fbp/fbc em claro (NUNCA hashed), external_id_hash separado pra indexacao,
 * data_processing_options jsonb + _country/_state pra LDU, pixel_id pra
 * multi-pixel cliente, partner_agent=criation-io-v1 pra Events Manager,
 * test_event_code pra modo teste, ctwa_clid/messaging_channel pra CTWA.
 *
 * Colunas Google P1 (audit Google 2026-05) entram em 1.4.9.B junto com
 * `google_connections` expandida + `google_conversion_action_mappings`.
 */
export const capiEvents = pgTable(
  'capi_events',
  {
    id: uuid('id').notNull().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    /** Soft FK pra gateway_events (sem REFERENCES — gateway_events nao e
     * particionada mas evitamos cross-cluster FK pra consistencia futura). */
    gatewayEventId: uuid('gateway_event_id'),
    /** 'meta' | 'google' (1.4.9.B) */
    provider: text('provider').notNull(),
    eventName: text('event_name').notNull(),
    /** UUID v4 — mesmo `event_id` enviado pra Meta CAPI + Pixel cliente +
     * Google EC permite dedup cross-channel (Meta dedupa por event_id,
     * Google dedupa por order_id). */
    eventId: text('event_id').notNull(),
    /** Partition key — TIMESTAMPTZ do evento original (nao do envio). */
    eventTime: timestamp('event_time', { withTimezone: true }).notNull(),
    userData: jsonb('user_data'),
    customData: jsonb('custom_data'),
    /** 'pending' | 'sent' | 'failed' | 'skipped' (consent denied) */
    status: text('status').notNull().default('pending'),
    responseData: jsonb('response_data'),
    /** EMQ retornado pelo Events Manager (ou puxado via Dataset Quality API). */
    eventMatchQuality: decimal('event_match_quality', { precision: 4, scale: 2 }),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),

    // Meta P1 deltas (1.4.9) ---------------------------------------------------

    /** URL onde evento aconteceu — obrigatorio quando action_source='website'. */
    eventSourceUrl: text('event_source_url'),
    /** Enum-like: 'website' | 'system_generated' | 'business_messaging' | 'app'. */
    actionSource: text('action_source'),
    /** IP em claro — Meta dedupa por IP. Capturado do webhook gateway ou
     * tracking_events.client_ip (em casos onde temos plain IP, nao apenas hash). */
    clientIpAddress: text('client_ip_address'),
    /** UA em claro. */
    clientUserAgent: text('client_user_agent'),
    /** Cookie Meta `_fbc` formatado `fb.1.{ts}.{fbclid}`. NUNCA hashear. */
    fbc: text('fbc'),
    /** Cookie Meta `_fbp` formatado `fb.1.{ts}.{random}`. NUNCA hashear. */
    fbp: text('fbp'),
    /** SHA-256 do external_id resolvido — separado de user_data jsonb pra
     * indexacao + dashboard analitico ("eventos por buyer"). */
    externalIdHash: text('external_id_hash'),
    /** ['LDU'] quando LDU ativo (consent denied + EEA-like). */
    dataProcessingOptions: jsonb('data_processing_options'),
    /** 0 = Meta geolocalize. 1 = forcar US. */
    dataProcessingOptionsCountry: smallint('data_processing_options_country'),
    /** 0 = Meta geolocalize. 1000 = forcar US/CA-todos-estados. */
    dataProcessingOptionsState: smallint('data_processing_options_state'),
    /** True quando consent_state.ad_storage='denied' (mesmo enviando LDU). */
    optOut: boolean('opt_out').notNull().default(false),
    /** ID do Pixel Meta que recebeu (cliente pode ter multiplos). */
    pixelId: text('pixel_id'),
    /** Identifica nossa app no Events Manager — default 'criation-io-v1'. */
    partnerAgent: text('partner_agent'),
    /** Quando workspace esta em modo teste, vai no payload. */
    testEventCode: text('test_event_code'),
    /** Janela de atribuicao usada — '1d_click' | '7d_click' | etc. */
    attributionWindow: text('attribution_window'),
    /** Preenchido por job futuro consultando Dataset Quality API.
     * 'unique' | 'duplicate_with_pixel' | 'unknown'. */
    dedupStatus: text('dedup_status'),
    /** CTWA support: 'whatsapp' quando action_source='business_messaging'. */
    messagingChannel: text('messaging_channel'),
    /** Click-to-WhatsApp click ID — diferencial BR. */
    ctwaClid: text('ctwa_clid'),

    // Google P1 deltas (1.4.9.B / ADR-015) ------------------------------------

    /** Google Ads customer_id que recebeu (= operatingAccount.accountId). */
    googleCustomerId: text('google_customer_id'),
    /** Conversion_action_id Google (= productDestinationId). Renomeado de
     * conversion_action_resource_name por ADR-015 (vocabulario Data Manager API). */
    googleProductDestinationId: text('google_product_destination_id'),
    /** Click ID enviado em adIdentifiers (gclid/gbraid/wbraid). */
    googleClickIdUsed: text('google_click_id_used'),
    /** Tipo: 'gclid' | 'gbraid' | 'wbraid' | 'none'. */
    googleClickIdType: text('google_click_id_type'),
    /** Quantos user_identifiers (email/phone/address) foram embutidos. */
    googleUserIdentifiersCount: integer('google_user_identifiers_count'),
    /** consent.adUserData: 'CONSENT_GRANTED' | 'CONSENT_DENIED' | 'CONSENT_UNSPECIFIED'. */
    googleConsentAdUserData: text('google_consent_ad_user_data'),
    /** consent.adPersonalization: idem. */
    googleConsentAdPersonalization: text('google_consent_ad_personalization'),
    /** Order ID (= transactionId no payload — dedup com pixel client-side). */
    googleOrderId: text('google_order_id'),
    /** requestId da resposta Data Manager API (rastreio em Diagnostic Report). */
    googleRequestId: text('google_request_id'),
    /** True quando envio foi em modo teste (validateOnly=true). */
    googleValidateOnly: boolean('google_validate_only').notNull().default(false),
    /** Header login-customer-id usado quando MCC. */
    googleLoginCustomerId: text('google_login_customer_id'),
  },
  (t) => [
    // Indexes propagam pra todas particoes. PK composta (event_time, id) e
    // UNIQUE (workspace_id, provider, event_id, event_time) criadas na migration
    // manual — Drizzle nao gera particionamento nem PK com partition key.
    index('capi_events_workspace_status_idx').on(t.workspaceId, t.status, t.eventTime),
    index('capi_events_workspace_pixel_idx').on(t.workspaceId, t.pixelId, t.eventTime),
    index('capi_events_external_id_hash_idx').on(t.externalIdHash),
    index('capi_events_dedup_status_idx').on(t.workspaceId, t.dedupStatus, t.eventTime),
    index('capi_events_google_customer_idx').on(t.workspaceId, t.googleCustomerId, t.eventTime),
    unique('capi_events_workspace_provider_event_unique').on(
      t.workspaceId,
      t.provider,
      t.eventId,
      t.eventTime
    ),
  ]
)

/**
 * Log de tentativas HTTP por `capi_events` row. Append-only (RLS no_update +
 * no_delete). Service role only — RLS bloqueia SELECT exceto pra service_role.
 *
 * Soft FK pra `capi_events` (sem REFERENCES — capi_events e particionada e
 * Postgres nao aceita FK pra particionada sem partition key no PK do
 * referenciado). Consistencia garantida via service code.
 */
export const capiEventLog = pgTable(
  'capi_event_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    capiEventId: uuid('capi_event_id').notNull(),
    attempt: integer('attempt').notNull().default(1),
    requestPayload: jsonb('request_payload'),
    responsePayload: jsonb('response_payload'),
    httpStatus: integer('http_status'),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('capi_event_log_capi_event_id_idx').on(t.capiEventId)]
)

export const clickIdStore = pgTable(
  'click_id_store',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
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
    index('click_id_store_fbclid_idx')
      .on(t.fbclid)
      .where(sql`fbclid IS NOT NULL`),
    index('click_id_store_gclid_idx')
      .on(t.gclid)
      .where(sql`gclid IS NOT NULL`),
  ]
)

export const consentLogs = pgTable(
  'consent_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id').references(() => workspaces.id, {
      onDelete: 'cascade',
    }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
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
  ]
)

/**
 * Visitor identity store (Sessao 1.4.A / ADR-014).
 * `visitor_id` e UUID v4 gerado client-side (cookie `_cio_vid`, 90d).
 *
 * Atribuicao: `first_*` colunas capturam o primeiro toque (atribuicao
 * first-touch); `last_*` capturam o ultimo toque (last-touch — modelo
 * default no dashboard). Multi-touch attribution e Fase 3.
 *
 * `identified_*` preenchido quando `window.criation('identify', email)` roda
 * (API existe na 1.4.A) ou quando matching com `gateway_events` rola via
 * UTM Stitcher 2.0 (1.4.B).
 */
export const trackingVisitors = pgTable(
  'tracking_visitors',
  {
    visitorId: text('visitor_id').primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
    // First-touch
    firstUtmSource: text('first_utm_source'),
    firstUtmMedium: text('first_utm_medium'),
    firstUtmCampaign: text('first_utm_campaign'),
    firstUtmContent: text('first_utm_content'),
    firstUtmTerm: text('first_utm_term'),
    // Last-touch (default no dashboard)
    lastUtmSource: text('last_utm_source'),
    lastUtmMedium: text('last_utm_medium'),
    lastUtmCampaign: text('last_utm_campaign'),
    lastUtmContent: text('last_utm_content'),
    lastUtmTerm: text('last_utm_term'),
    // Click IDs (preserva primeiro toque + ultimo)
    firstClickId: text('first_click_id'),
    firstClickIdType: text('first_click_id_type'),
    lastClickId: text('last_click_id'),
    lastClickIdType: text('last_click_id_type'),
    firstReferrer: text('first_referrer'),
    // Identificacao (1.4.A: via identify() | 1.4.B: via matching real)
    identifiedBuyerEmailHash: text('identified_buyer_email_hash'),
    identifiedAt: timestamp('identified_at', { withTimezone: true }),
    totalEvents: integer('total_events').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index('tracking_visitors_workspace_last_seen_idx').on(t.workspaceId, t.lastSeenAt),
    index('tracking_visitors_identified_idx')
      .on(t.identifiedBuyerEmailHash)
      .where(sql`identified_buyer_email_hash IS NOT NULL`),
  ]
)

/**
 * Browser events ingested via `/api/v1/track` (Sessao 1.4.A / ADR-014).
 * PARTITION BY RANGE (event_ts) mensal — particoes filhas
 * `tracking_events_YYYY_MM`. Task daily (1.4.A.6) cria M+3 antes do mes virar.
 *
 * `event_id` gerado client-side (UUID v4). Dedup defensivo via UNIQUE
 * (workspace_id, event_id, event_ts) — sendBeacon retry tem mesmo payload.
 *
 * Mesmo `event_id` e enviado pra Meta CAPI (fanout 1.4.9) permitindo
 * deduplicacao cross-channel se cliente ainda mantem Pixel legado.
 *
 * NOTA Drizzle: tabela e particionada no Postgres (PARTITION BY RANGE event_ts).
 * Drizzle-kit nao suporta declaracao de particionamento — schema aqui descreve
 * apenas o parent table. Migration manual em `0009_tracking_cdp.sql`.
 */
export const trackingEvents = pgTable(
  'tracking_events',
  {
    id: uuid('id').notNull().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    visitorId: text('visitor_id').notNull(),
    eventId: text('event_id').notNull(),
    eventName: text('event_name').notNull(),
    eventTs: timestamp('event_ts', { withTimezone: true }).notNull(),
    // PII hashed server-side (HMAC-com-salt — usado por dashboard analytics + dedup)
    clientIpHash: text('client_ip_hash'),
    clientUserAgentHash: text('client_user_agent_hash'),
    // Plain IP/UA pra Meta CAPI EMQ (1.4.9). LGPD: retention 30d via TD-108.
    // Drizzle representa `inet` como string; Postgres valida formato.
    clientIpAddress: text('client_ip_address'),
    clientUserAgent: text('client_user_agent'),
    // Contexto da pagina
    pageUrl: text('page_url'),
    pageTitle: text('page_title'),
    referrer: text('referrer'),
    utms: jsonb('utms')
      .notNull()
      .default(sql`'{}'::jsonb`),
    // Click IDs e identidade publicitaria
    fbp: text('fbp'),
    fbc: text('fbc'),
    fbclid: text('fbclid'),
    gclid: text('gclid'),
    ttclid: text('ttclid'),
    msclkid: text('msclkid'),
    ctwaClid: text('ctwa_clid'),
    wbraid: text('wbraid'),
    gbraid: text('gbraid'),
    // Google Ads source/PMax (audit Google 2026-05 §3, adicionados em 1.4.9.B)
    gadSource: text('gad_source'),
    srsltid: text('srsltid'),
    // Consent Mode v2 (ad_storage, analytics_storage, ad_user_data, ad_personalization)
    consentState: jsonb('consent_state'),
    // Dados do evento (value, currency, content_ids, etc — passa pro fanout CAPI)
    customData: jsonb('custom_data'),
    // Matching com gateway (preenchido na 1.4.B)
    matchedBuyerEmailHash: text('matched_buyer_email_hash'),
    matchedAt: timestamp('matched_at', { withTimezone: true }),
    // Fanout status (preenchido na 1.4.9)
    fanoutMetaStatus: text('fanout_meta_status').notNull().default('pending'),
    fanoutMetaSentAt: timestamp('fanout_meta_sent_at', { withTimezone: true }),
    fanoutMetaError: text('fanout_meta_error'),
    fanoutGoogleStatus: text('fanout_google_status').notNull().default('pending'),
    fanoutGoogleSentAt: timestamp('fanout_google_sent_at', { withTimezone: true }),
    fanoutGoogleError: text('fanout_google_error'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // PK e UNIQUE includem event_ts (partition key) — Drizzle nao gera
    // automaticamente, mas indexes auxiliares sim. Migration manual cria PK
    // (event_ts, id) e UNIQUE (workspace_id, event_id, event_ts).
    index('tracking_events_workspace_ts_idx').on(t.workspaceId, t.eventTs),
    index('tracking_events_visitor_ts_idx').on(t.visitorId, t.eventTs),
    index('tracking_events_workspace_event_name_idx').on(t.workspaceId, t.eventName, t.eventTs),
    index('tracking_events_pending_meta_idx')
      .on(t.workspaceId, t.eventTs)
      .where(sql`fanout_meta_status = 'pending'`),
    index('tracking_events_pending_google_idx')
      .on(t.workspaceId, t.eventTs)
      .where(sql`fanout_google_status = 'pending'`),
    index('tracking_events_matched_buyer_idx')
      .on(t.workspaceId, t.matchedBuyerEmailHash, t.eventTs)
      .where(sql`matched_buyer_email_hash IS NOT NULL`),
  ]
)
