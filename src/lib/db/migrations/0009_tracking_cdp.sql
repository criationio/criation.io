-- 0009_tracking_cdp.sql — Criation CDP core (Sessao 1.4.A / ADR-014)
--
-- Aditivo zero-downtime:
--  - connections: nova coluna `config jsonb` (reusavel pra todas verticais)
--  - tracking_visitors: flat table (visitor_id PK text gerado client-side)
--  - tracking_events: PARTITION BY RANGE (event_ts) mensal + 3 particoes iniciais
--    (2026-05, 2026-06, 2026-07) — task daily cria M+3 antes do mes virar.
--
-- Drizzle-kit nao gera particionamento. Aplicado via Supabase apply_migration.
-- Este arquivo serve como source-of-truth no git history.

-- 1. connections.config (aditivo, reusavel) -----------------------------------

ALTER TABLE connections
  ADD COLUMN IF NOT EXISTS config jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN connections.config IS
  'Per-connection config (origin allowlist, install date, custom settings). Reusavel por todas verticais (gateway, analytics, crm).';

-- 2. tracking_visitors (flat) ------------------------------------------------

CREATE TABLE IF NOT EXISTS tracking_visitors (
  visitor_id text PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  -- UTMs de primeiro toque (atribuicao first-touch)
  first_utm_source text,
  first_utm_medium text,
  first_utm_campaign text,
  first_utm_content text,
  first_utm_term text,
  -- UTMs de ultimo toque (atribuicao last-touch — modelo default)
  last_utm_source text,
  last_utm_medium text,
  last_utm_campaign text,
  last_utm_content text,
  last_utm_term text,
  -- Click IDs (primeiro toque que trouxe o visitor)
  first_click_id text,
  first_click_id_type text,
  last_click_id text,
  last_click_id_type text,
  first_referrer text,
  -- Identificacao (1.4.B faz matching real; aqui so persiste se identify() rolou)
  identified_buyer_email_hash text,
  identified_at timestamptz,
  -- Counter pra dashboards rapidos
  total_events integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tracking_visitors_workspace_last_seen_idx
  ON tracking_visitors (workspace_id, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS tracking_visitors_identified_idx
  ON tracking_visitors (identified_buyer_email_hash)
  WHERE identified_buyer_email_hash IS NOT NULL;

ALTER TABLE tracking_visitors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workspace_isolation_tracking_visitors ON tracking_visitors;
CREATE POLICY workspace_isolation_tracking_visitors ON tracking_visitors
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- 3. tracking_events (PARTITION BY RANGE event_ts) ---------------------------

CREATE TABLE IF NOT EXISTS tracking_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  visitor_id text NOT NULL,
  -- event_id e gerado client-side (UUIDv4) pra dedup cross-channel
  -- (mesmo event_id em tracking_events + capi_events futuro = Meta deduplica)
  event_id text NOT NULL,
  event_name text NOT NULL,
  event_ts timestamptz NOT NULL,
  -- PII hashed server-side
  client_ip_hash text,
  client_user_agent_hash text,
  -- Contexto da pagina
  page_url text,
  page_title text,
  referrer text,
  -- UTMs como jsonb pra acomodar parametros custom (utm_source_platform, etc)
  utms jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Click IDs e cookies de identidade publicitaria
  fbp text,
  fbc text,
  fbclid text,
  gclid text,
  ttclid text,
  msclkid text,
  ctwa_clid text,
  wbraid text,
  gbraid text,
  -- Consent Mode v2 (4 sinais: ad_storage, analytics_storage, ad_user_data, ad_personalization)
  consent_state jsonb,
  -- Dados do evento (value, currency, content_ids, etc — passa pro CAPI fanout)
  custom_data jsonb,
  -- Visitor↔Buyer matching (preenchido na 1.4.B quando gateway entrega Purchase)
  matched_buyer_email_hash text,
  matched_at timestamptz,
  -- Fanout status (preenchido na 1.4.9 pelo sender)
  fanout_meta_status text NOT NULL DEFAULT 'pending',
  fanout_meta_sent_at timestamptz,
  fanout_meta_error text,
  fanout_google_status text NOT NULL DEFAULT 'pending',
  fanout_google_sent_at timestamptz,
  fanout_google_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- PK composta inclui partition key (requisito Postgres)
  PRIMARY KEY (event_ts, id),
  -- Dedup defensivo: mesmo event_id reenviado pelo sendBeacon nao duplica
  -- (event_ts e gerado no browser, entao retry tem mesmo ts)
  UNIQUE (workspace_id, event_id, event_ts)
) PARTITION BY RANGE (event_ts);

-- Indexes na partition parent — cascateiam para todas particoes.
-- Query dominante: dashboard filtra por workspace + intervalo de tempo.
CREATE INDEX IF NOT EXISTS tracking_events_workspace_ts_idx
  ON tracking_events (workspace_id, event_ts DESC);

-- Query secundaria: trazer historico do visitor (1.4.B matching).
CREATE INDEX IF NOT EXISTS tracking_events_visitor_ts_idx
  ON tracking_events (visitor_id, event_ts DESC);

-- Query analitica: contagem de eventos por tipo.
CREATE INDEX IF NOT EXISTS tracking_events_workspace_event_name_idx
  ON tracking_events (workspace_id, event_name, event_ts DESC);

-- Worker fanout: pegar pending pra Meta CAPI (1.4.9).
CREATE INDEX IF NOT EXISTS tracking_events_pending_meta_idx
  ON tracking_events (workspace_id, event_ts)
  WHERE fanout_meta_status = 'pending';

-- Worker fanout: pegar pending pra Google EC (1.4.9).
CREATE INDEX IF NOT EXISTS tracking_events_pending_google_idx
  ON tracking_events (workspace_id, event_ts)
  WHERE fanout_google_status = 'pending';

-- Query 1.4.B matching: visitors identificados por email.
CREATE INDEX IF NOT EXISTS tracking_events_matched_buyer_idx
  ON tracking_events (workspace_id, matched_buyer_email_hash, event_ts DESC)
  WHERE matched_buyer_email_hash IS NOT NULL;

ALTER TABLE tracking_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workspace_isolation_tracking_events ON tracking_events;
CREATE POLICY workspace_isolation_tracking_events ON tracking_events
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- 4. Particoes iniciais (3 meses rolling) ------------------------------------
-- Task daily `create-tracking-partition` (1.4.A.6) cria M+3 antes do mes virar.

CREATE TABLE IF NOT EXISTS tracking_events_2026_05 PARTITION OF tracking_events
  FOR VALUES FROM ('2026-05-01 00:00:00+00') TO ('2026-06-01 00:00:00+00');

CREATE TABLE IF NOT EXISTS tracking_events_2026_06 PARTITION OF tracking_events
  FOR VALUES FROM ('2026-06-01 00:00:00+00') TO ('2026-07-01 00:00:00+00');

CREATE TABLE IF NOT EXISTS tracking_events_2026_07 PARTITION OF tracking_events
  FOR VALUES FROM ('2026-07-01 00:00:00+00') TO ('2026-08-01 00:00:00+00');

-- 5. Comentarios documentais ------------------------------------------------

COMMENT ON TABLE tracking_events IS
  'Browser events ingested via /api/v1/track (Sessao 1.4.A / ADR-014). Particionada mensal por event_ts. Append-only via service_role.';

COMMENT ON TABLE tracking_visitors IS
  'Visitor identity store (1.4.A). first_/last_utm via 1st-touch/last-touch attribution. identified_* preenchido quando window.criation(identify) roda (1.4.A) + matching real (1.4.B).';

COMMENT ON COLUMN tracking_events.event_id IS
  'UUID v4 gerado client-side. Usado para dedup cross-channel (mesmo event_id permite Meta CAPI dedup com Pixel legado coexistente).';

COMMENT ON COLUMN tracking_events.fanout_meta_status IS
  'Preenchido pelo fanout sender (1.4.9). Valores: pending | sent | failed | skipped (consent denied).';
