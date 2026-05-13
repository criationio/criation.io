-- 0016_google_data_manager.sql — Google fanout via Data Manager API (Sessao 1.4.9.B)
--
-- ADR-015 (2026-05-13): fanout Google via Data Manager API (POST /v1/events:ingest),
-- nao ConversionUploadService.UploadClickConversions (Google Ads API). Spike concluido
-- mostrou que Criation cai sob restricao de 2-fev-2026 como new developer, Google
-- explicitamente desencoraja novas integracoes em UploadClickConversions, e Customer
-- Match Fase 3 obrigatoriamente usa Data Manager API.
--
-- Schema deltas:
--  1. google_connections: 16 colunas P1 + deprecate customer_id/customer_name
--  2. google_ads_accounts: NEW (1:N de google_connections, multi-customer Agency)
--  3. google_conversion_action_mappings: NEW (event_name Criation -> product_destination_id Google)
--  4. tracking_events: + gad_source, srsltid (audit Google 2026-05 §3)
--  5. capi_events: + 11 colunas Google (audit §3 revisado por ADR-015 §10)
--
-- Aditiva zero-downtime — colunas nullable, defaults, sem backfill (tabelas Google
-- vazias em prod, exceto google_connections que tem schema minimo legado a estender).
--
-- Postgres: ALTER TABLE em parent particionada propaga pras particoes filhas
-- automaticamente (capi_events particoes 2026_05/06/07 herdam as colunas novas).

-- 1. google_connections: extend com 16 colunas P1 ---------------------------

ALTER TABLE google_connections
  ADD COLUMN IF NOT EXISTS granted_scopes jsonb,
  ADD COLUMN IF NOT EXISTS granted_data_manager_scope boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS granted_ads_scope boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS manager_customer_id text,
  ADD COLUMN IF NOT EXISTS login_customer_id_header text,
  ADD COLUMN IF NOT EXISTS ads_api_version text NOT NULL DEFAULT 'v24',
  ADD COLUMN IF NOT EXISTS data_manager_api_version text NOT NULL DEFAULT 'v1',
  ADD COLUMN IF NOT EXISTS oauth_client_verification_status text NOT NULL DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS google_user_id text,
  ADD COLUMN IF NOT EXISTS google_user_email text,
  ADD COLUMN IF NOT EXISTS google_user_name text,
  ADD COLUMN IF NOT EXISTS last_token_refresh_at timestamptz,
  ADD COLUMN IF NOT EXISTS token_refresh_failures integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refresh_token_invalidated_at timestamptz,
  ADD COLUMN IF NOT EXISTS partner_agent text NOT NULL DEFAULT 'criation-io-v1',
  ADD COLUMN IF NOT EXISTS test_account_flag boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS test_mode boolean NOT NULL DEFAULT false;

-- workspace_id UNIQUE (paridade com meta_connections, evita duplicate connections
-- por workspace ativo). Soft-delete via deleted_at — UNIQUE parcial nao garante
-- isso aqui ainda; manter index existente e validar em app-level por enquanto.

-- Index defensivo para query "active google_connection" comum no fanout.
CREATE INDEX IF NOT EXISTS google_connections_active_idx
  ON google_connections (workspace_id, status)
  WHERE deleted_at IS NULL;

COMMENT ON COLUMN google_connections.customer_id IS
  'DEPRECATED desde ADR-015. Multi-customer Agency vive em google_ads_accounts (1:N). Manter como nullable ate purge no proximo zero-downtime PR.';
COMMENT ON COLUMN google_connections.customer_name IS
  'DEPRECATED desde ADR-015. Ver customer_id.';
COMMENT ON COLUMN google_connections.granted_data_manager_scope IS
  'True se OAuth callback retornou auth/datamanager em scope. Sem isso, fanout Data Manager API falha 100%.';
COMMENT ON COLUMN google_connections.granted_ads_scope IS
  'True se OAuth callback retornou auth/adwords em scope. Necessario pra metadata calls (listAccessibleCustomers + conversion_action query).';
COMMENT ON COLUMN google_connections.data_manager_api_version IS
  'Versao Data Manager API (default v1). Per-tenant override permite ramp-up de proxima major sem migrate global.';
COMMENT ON COLUMN google_connections.ads_api_version IS
  'Versao Google Ads API REST (default v24). Usada SOMENTE para metadata (listAccessibleCustomers, conversion_action query). Fanout vai por Data Manager API.';
COMMENT ON COLUMN google_connections.partner_agent IS
  'Identifica nossa app — default global criation-io-v1. Audit pelos sistemas Google.';
COMMENT ON COLUMN google_connections.test_mode IS
  'Quando true, fanout envia validateOnly=true no payload Data Manager API. Equivalente a test_event_code da Meta.';
COMMENT ON COLUMN google_connections.test_account_flag IS
  'True quando connection esta atrelada a test account MCC (audit visual no wizard — testa antes de prod).';
COMMENT ON COLUMN google_connections.refresh_token_invalidated_at IS
  'Setado quando job de refresh recebe invalid_grant (user revogou ou 6m inatividade). UI mostra needs_reauth.';

-- 2. google_ads_accounts — NEW (1:N de google_connections) -----------------

CREATE TABLE IF NOT EXISTS google_ads_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES google_connections(id) ON DELETE CASCADE,
  -- customer_id do Google Ads (string numerica, ex: "1234567890")
  customer_id text NOT NULL,
  customer_descriptive_name text,
  -- Quando managed por MCC, manager_customer_id = MCC parent. Sem isso, header
  -- login-customer-id nas chamadas Ads API REST nao funciona.
  manager_customer_id text,
  -- Header login-customer-id pra Google Ads API REST (= manager_customer_id
  -- quando MCC, ou customer_id quando standalone).
  login_customer_id text,
  currency_code text,
  time_zone text,
  -- Google Ads account_status (1=enabled, 2=cancelled, etc).
  status integer,
  is_test_account boolean NOT NULL DEFAULT false,
  is_manager boolean NOT NULL DEFAULT false,
  -- Marcado pelo wizard pos-OAuth — qual conta usar por default no fanout.
  is_default boolean NOT NULL DEFAULT false,
  -- Cache de conversion_actions ativas da conta (preenchido no OAuth callback).
  -- Formato: [{id, name, type, category, resource_name}]
  conversion_actions jsonb,
  last_sync_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (connection_id, customer_id)
);

CREATE INDEX IF NOT EXISTS google_ads_accounts_connection_id_idx
  ON google_ads_accounts (connection_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS google_ads_accounts_default_idx
  ON google_ads_accounts (connection_id, is_default)
  WHERE is_default = true AND deleted_at IS NULL;

ALTER TABLE google_ads_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_isolation_google_ads_accounts" ON google_ads_accounts
  FOR ALL USING (
    connection_id IN (
      SELECT id FROM google_connections
      WHERE workspace_id IN (
        SELECT workspace_id FROM workspace_members
        WHERE user_id = auth.uid() AND is_active = true
      )
    )
  );

COMMENT ON TABLE google_ads_accounts IS
  'Google Ads customer accounts acessiveis via google_connection. 1:N — cliente Agency tem multiplos customers (test/prod/espelhos). Populado no OAuth callback via listAccessibleCustomers + customer_client query. ADR-015.';
COMMENT ON COLUMN google_ads_accounts.customer_id IS
  'Google Ads customer_id (string numerica, ex 1234567890). Usado em destinations[].operatingAccount.accountId do payload Data Manager API.';
COMMENT ON COLUMN google_ads_accounts.login_customer_id IS
  'Header login-customer-id pra Google Ads API REST. = manager_customer_id quando MCC, = customer_id quando standalone. Sem isso, calls Ads API REST falham.';
COMMENT ON COLUMN google_ads_accounts.conversion_actions IS
  'Cache de conversion_actions ENABLED da conta. Atualizado no OAuth callback e em refresh manual via wizard.';

-- 3. google_conversion_action_mappings — NEW -------------------------------
--
-- Sem este mapping, fanout falha 100% — Data Manager API exige
-- productDestinationId (= conversion_action_id Google) em cada event.
-- Cliente configura no wizard /configuracoes/google/conversoes: cada
-- event_name Criation (page_view, purchase, lead, etc) → qual
-- conversion_action Google receber.

CREATE TABLE IF NOT EXISTS google_conversion_action_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  google_ads_account_id uuid NOT NULL REFERENCES google_ads_accounts(id) ON DELETE CASCADE,
  -- Nome do evento Criation: 'page_view' | 'purchase' | 'lead' | etc.
  -- Default catalog vive em src/lib/services/capi/event-mapping.ts.
  internal_event_name text NOT NULL,
  -- = conversion_action_id Google (string numerica). Usado em
  -- destinations[].productDestinationId do payload Data Manager API.
  product_destination_id text NOT NULL,
  -- Snapshot do nome da conversion_action no momento do mapping (debug + UI).
  conversion_action_name text,
  -- 'UPLOAD_CALLS' | 'UPLOAD_CLICKS' | 'WEBPAGE' | etc.
  conversion_action_type text,
  -- True quando primary mapping pro event_name (1 default por workspace/account/event).
  is_primary boolean NOT NULL DEFAULT false,
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (workspace_id, google_ads_account_id, internal_event_name)
);

CREATE INDEX IF NOT EXISTS google_conv_mapping_workspace_event_idx
  ON google_conversion_action_mappings (workspace_id, internal_event_name)
  WHERE deleted_at IS NULL AND is_enabled = true;

CREATE INDEX IF NOT EXISTS google_conv_mapping_account_idx
  ON google_conversion_action_mappings (google_ads_account_id)
  WHERE deleted_at IS NULL;

ALTER TABLE google_conversion_action_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_isolation_google_conv_mappings" ON google_conversion_action_mappings
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

COMMENT ON TABLE google_conversion_action_mappings IS
  'Mapeia event_name Criation -> conversion_action Google (product_destination_id na vocabulario Data Manager API). Sem mapping ativo para um event_name, fanout pula o evento + log skip_reason. ADR-015.';
COMMENT ON COLUMN google_conversion_action_mappings.product_destination_id IS
  'Conversion_action_id Google (numerico). Renomeado de conversion_action_resource_name pelo ADR-015 — vocabulario Data Manager API.';
COMMENT ON COLUMN google_conversion_action_mappings.is_primary IS
  'Wizard exibe 1 default por (workspace, account, event_name). Multi-mapping (mesmo event -> N conversion_actions) suportado mas raro.';

-- 4. tracking_events: + gad_source, srsltid --------------------------------
--
-- Audit Google 2026-05 §3: alem de gclid/wbraid/gbraid (ja em 1.4.A), Google
-- expoe gad_source (origem Performance Max/DV360/AdSense) e srsltid (Search
-- Results Listing Token, Performance Max). Ambos opcionais — quando presentes
-- aumentam atribuicao no Google Ads.
--
-- ALTER em parent particionada propaga pra todas particoes filhas (Postgres 17).

ALTER TABLE tracking_events
  ADD COLUMN IF NOT EXISTS gad_source text,
  ADD COLUMN IF NOT EXISTS srsltid text;

COMMENT ON COLUMN tracking_events.gad_source IS
  'Google Ads source (1=Google Search, 2=Google Search Partner, 5=YouTube, 7=DV360, etc). Capturado de query param ?gad_source=N pelo criation-tracking.js. Audit Google 2026-05 §3.';
COMMENT ON COLUMN tracking_events.srsltid IS
  'Search Results Listing Token (Performance Max). Capturado de query param ?srsltid pelo criation-tracking.js. Audit Google 2026-05 §3.';

-- 5. capi_events: + 11 colunas Google --------------------------------------
--
-- ADR-015 §10 revisou audit Google §3:
--   - REMOVIDO: google_conversion_action_resource_name (renomeado abaixo)
--   - NOVO: google_request_id (requestId retorno Data Manager API)
--   - NOVO: google_validate_only (flag se foi modo teste)
--
-- ALTER propaga pras particoes 2026_05/06/07 automaticamente.

ALTER TABLE capi_events
  ADD COLUMN IF NOT EXISTS google_customer_id text,
  ADD COLUMN IF NOT EXISTS google_product_destination_id text,
  ADD COLUMN IF NOT EXISTS google_click_id_used text,
  ADD COLUMN IF NOT EXISTS google_click_id_type text,
  ADD COLUMN IF NOT EXISTS google_user_identifiers_count integer,
  ADD COLUMN IF NOT EXISTS google_consent_ad_user_data text,
  ADD COLUMN IF NOT EXISTS google_consent_ad_personalization text,
  ADD COLUMN IF NOT EXISTS google_order_id text,
  ADD COLUMN IF NOT EXISTS google_request_id text,
  ADD COLUMN IF NOT EXISTS google_validate_only boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS google_login_customer_id text;

-- Index for "all events sent to customer X" admin query.
CREATE INDEX IF NOT EXISTS capi_events_google_customer_idx
  ON capi_events (workspace_id, google_customer_id, event_time DESC)
  WHERE provider = 'google' AND google_customer_id IS NOT NULL;

COMMENT ON COLUMN capi_events.google_customer_id IS
  'Google Ads customer_id que recebeu o evento (= operatingAccount.accountId no payload Data Manager API).';
COMMENT ON COLUMN capi_events.google_product_destination_id IS
  'Conversion_action_id Google que recebeu (= productDestinationId no payload Data Manager API). Renomeado de conversion_action_resource_name por ADR-015.';
COMMENT ON COLUMN capi_events.google_click_id_used IS
  'Click ID enviado em adIdentifiers (gclid, gbraid, ou wbraid — primeiro disponivel na fallback ladder).';
COMMENT ON COLUMN capi_events.google_click_id_type IS
  'Tipo do click_id enviado: gclid | gbraid | wbraid | none.';
COMMENT ON COLUMN capi_events.google_user_identifiers_count IS
  'Quantos user_identifiers foram embutidos em events[].userData (email, phone, address — quanto mais, melhor match rate).';
COMMENT ON COLUMN capi_events.google_consent_ad_user_data IS
  'Consent.adUserData enviado: CONSENT_GRANTED | CONSENT_DENIED | CONSENT_UNSPECIFIED.';
COMMENT ON COLUMN capi_events.google_consent_ad_personalization IS
  'Consent.adPersonalization enviado: CONSENT_GRANTED | CONSENT_DENIED | CONSENT_UNSPECIFIED.';
COMMENT ON COLUMN capi_events.google_order_id IS
  'Order ID do gateway_event (Google dedupa com pixel client-side via transaction_id que recebe este valor).';
COMMENT ON COLUMN capi_events.google_request_id IS
  'requestId retornado pela Data Manager API. Usado pra rastrear no Diagnostic Report Google.';
COMMENT ON COLUMN capi_events.google_validate_only IS
  'True quando o envio foi feito em modo teste (validateOnly=true). Eventos validados nao geram conversao real.';
COMMENT ON COLUMN capi_events.google_login_customer_id IS
  'Header login-customer-id usado na chamada Data Manager API quando MCC.';
