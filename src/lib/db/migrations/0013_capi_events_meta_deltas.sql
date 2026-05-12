-- 0013_capi_events_meta_deltas.sql — CAPI fanout schema (Sessao 1.4.9)
--
-- Drop+recreate seguro: capi_events nunca foi populada (grep mostra zero
-- writers/readers ate aqui). Sessao 1.4.9 inicia o fanout — esta migration
-- prepara a estrutura final particionada com colunas Meta P1.
--
-- Decisoes:
--  - PARTITION BY RANGE (event_time) mensal — espelha tracking_events
--    (mesma razao: tabela explode em 6 meses sem particao). Particoes
--    iniciais 2026-05/06/07; task daily (ex `create-tracking-partition`
--    estendida) cria M+3 antes do mes virar.
--  - PK composta (event_time, id) — Postgres exige partition key no PK.
--  - UNIQUE inclui event_time — dedup defensivo cross-channel
--    (mesmo event_id reenviado em retry tem mesmo event_time).
--  - capi_event_log com SOFT FK pra capi_events (sem REFERENCES) —
--    Postgres nao aceita FK pra particionada sem partition key no PK
--    referenciado. Consistencia via service code.
--  - Colunas Google P1 entram em 1.4.9.B (audit Google §3) — esta
--    migration cobre so Meta P1.
--
-- Drizzle-kit nao gera PARTITION BY. Aplicado via supabase apply_migration.

-- 1. Safety check: garante zero rows antes de drop -------------------------

DO $$
BEGIN
  IF (SELECT COUNT(*) FROM capi_events) > 0 THEN
    RAISE EXCEPTION 'capi_events has % rows — particionamento requer migracao manual de dados',
      (SELECT COUNT(*) FROM capi_events);
  END IF;
END $$;

-- 2. Drop tabelas legadas --------------------------------------------------
-- capi_event_log cai junto via CASCADE (FK constraint pra capi_events.id).

DROP TABLE IF EXISTS capi_event_log CASCADE;
DROP TABLE IF EXISTS capi_events CASCADE;

-- 3. capi_events particionada ----------------------------------------------

CREATE TABLE capi_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  -- Soft FK pra gateway_events (sem REFERENCES — consistencia via service code).
  gateway_event_id uuid,
  -- 'meta' | 'google' (1.4.9.B)
  provider text NOT NULL,
  event_name text NOT NULL,
  -- UUID v4 — dedup cross-channel (mesmo event_id em CAPI + Pixel + Google EC).
  event_id text NOT NULL,
  -- Partition key: timestamptz do evento original (nao do envio).
  event_time timestamptz NOT NULL,
  user_data jsonb,
  custom_data jsonb,
  -- 'pending' | 'sent' | 'failed' | 'skipped' (consent denied)
  status text NOT NULL DEFAULT 'pending',
  response_data jsonb,
  -- EMQ retornado pelo Events Manager ou puxado via Dataset Quality API.
  event_match_quality numeric(4, 2),
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),

  -- Meta P1 deltas (audit Meta 2026-05) ------------------------------------

  -- URL onde evento aconteceu — obrigatorio quando action_source='website'.
  event_source_url text,
  -- 'website' | 'system_generated' | 'business_messaging' | 'app'
  action_source text,
  -- IP em claro (Postgres INET type — valida IPv4/IPv6 syntax). Meta dedupa
  -- por IP. Capturado do webhook gateway ou tracking_events (em casos onde
  -- temos plain, nao apenas hash). Drizzle representa como string.
  client_ip_address inet,
  -- UA em claro.
  client_user_agent text,
  -- Cookie Meta `_fbc` formato `fb.1.{ts}.{fbclid}`. NUNCA hashear.
  fbc text,
  -- Cookie Meta `_fbp` formato `fb.1.{ts}.{random}`. NUNCA hashear.
  fbp text,
  -- SHA-256 do external_id resolvido — separado de user_data jsonb pra
  -- indexacao + dashboard analitico.
  external_id_hash text,
  -- ['LDU'] quando LDU ativo (consent denied + EEA-like).
  data_processing_options jsonb,
  -- 0 = Meta geolocalize. 1 = forcar US.
  data_processing_options_country smallint,
  -- 0 = Meta geolocalize. 1000 = forcar todos os estados US.
  data_processing_options_state smallint,
  -- True quando consent_state.ad_storage='denied' (mesmo se enviar LDU).
  opt_out boolean NOT NULL DEFAULT false,
  -- ID do Pixel Meta que recebeu (cliente pode ter multiplos).
  pixel_id text,
  -- Identifica nossa app no Events Manager — default 'criation-io-v1'.
  partner_agent text,
  -- Modo teste — quando setado, vai no payload Meta.
  test_event_code text,
  -- Janela de atribuicao usada — '1d_click' | '7d_click' | etc.
  attribution_window text,
  -- Preenchido por job futuro via Dataset Quality API.
  -- 'unique' | 'duplicate_with_pixel' | 'unknown'.
  dedup_status text,
  -- CTWA support: 'whatsapp' quando action_source='business_messaging'.
  messaging_channel text,
  -- Click-to-WhatsApp click ID — diferencial BR.
  ctwa_clid text,

  -- PK composta inclui partition key (requisito Postgres).
  PRIMARY KEY (event_time, id),
  -- Dedup defensivo: retry com mesmo event_id+event_time nao duplica.
  UNIQUE (workspace_id, provider, event_id, event_time)
) PARTITION BY RANGE (event_time);

-- Indexes propagam pra todas particoes.
-- Query dominante: worker fanout filtra pending por workspace+tempo.
CREATE INDEX capi_events_workspace_status_idx
  ON capi_events (workspace_id, status, event_time DESC);

-- Query analitica: eventos por pixel (multi-pixel workspace).
CREATE INDEX capi_events_workspace_pixel_idx
  ON capi_events (workspace_id, pixel_id, event_time DESC)
  WHERE pixel_id IS NOT NULL;

-- Query "todos eventos do buyer X" (admin debug + dashboard).
CREATE INDEX capi_events_external_id_hash_idx
  ON capi_events (external_id_hash)
  WHERE external_id_hash IS NOT NULL;

-- Query job dedup status (Dataset Quality API consumer).
CREATE INDEX capi_events_dedup_status_idx
  ON capi_events (workspace_id, dedup_status, event_time DESC)
  WHERE dedup_status IS NOT NULL;

-- 4. RLS capi_events -------------------------------------------------------

ALTER TABLE capi_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_isolation_capi_events" ON capi_events
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- 5. capi_event_log (append-only, soft FK) ---------------------------------

CREATE TABLE capi_event_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Soft FK pra capi_events (sem REFERENCES — capi_events e particionada).
  capi_event_id uuid NOT NULL,
  attempt integer NOT NULL DEFAULT 1,
  request_payload jsonb,
  response_payload jsonb,
  http_status integer,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX capi_event_log_capi_event_id_idx
  ON capi_event_log (capi_event_id);

-- 6. RLS capi_event_log ----------------------------------------------------

ALTER TABLE capi_event_log ENABLE ROW LEVEL SECURITY;

-- Append-only via service role.
CREATE POLICY "capi_event_log_no_update" ON capi_event_log
  FOR UPDATE USING (false);

CREATE POLICY "capi_event_log_no_delete" ON capi_event_log
  FOR DELETE USING (false);

CREATE POLICY "capi_event_log_service_read" ON capi_event_log
  FOR SELECT USING (auth.role() = 'service_role');

-- 7. Particoes iniciais (3 meses rolling) ----------------------------------
-- Task daily (a estender da `create-tracking-partition`) cria M+3 antes do
-- mes virar. Pattern espelha tracking_events.

CREATE TABLE capi_events_2026_05 PARTITION OF capi_events
  FOR VALUES FROM ('2026-05-01 00:00:00+00') TO ('2026-06-01 00:00:00+00');

CREATE TABLE capi_events_2026_06 PARTITION OF capi_events
  FOR VALUES FROM ('2026-06-01 00:00:00+00') TO ('2026-07-01 00:00:00+00');

CREATE TABLE capi_events_2026_07 PARTITION OF capi_events
  FOR VALUES FROM ('2026-07-01 00:00:00+00') TO ('2026-08-01 00:00:00+00');

-- 8. Comentarios documentais ----------------------------------------------

COMMENT ON TABLE capi_events IS
  'Log auditorial de envios CAPI (Meta + Google). Particionada mensal por event_time. Append via service_role. Sessao 1.4.9 (Meta) + 1.4.9.B (Google EC).';

COMMENT ON TABLE capi_event_log IS
  'Log de tentativas HTTP por capi_events row. Append-only via RLS (no_update + no_delete). Service role only.';

COMMENT ON COLUMN capi_events.event_id IS
  'UUID v4 — dedup cross-channel. Mesmo event_id enviado pra Meta CAPI + Pixel cliente (Meta dedupa) + Google EC (Google dedupa por order_id).';

COMMENT ON COLUMN capi_events.fbp IS
  'Cookie Meta _fbp em claro (fb.1.{ts}.{random}). NUNCA hashear. Gerado pelo criation-tracking.js v2.1+ quando Pixel cliente ausente.';

COMMENT ON COLUMN capi_events.fbc IS
  'Cookie Meta _fbc em claro (fb.1.{ts}.{fbclid}). NUNCA hashear. Gerado pelo criation-tracking.js v2.1+ quando fbclid presente e Pixel ausente.';

COMMENT ON COLUMN capi_events.external_id_hash IS
  'SHA-256 do external_id resolvido. Pre-match: sha256(workspace_id+visitor_id). Pos-match: sha256(workspace_id+matched_buyer_email_hash). Re-fanout retroativo eleva EMQ.';

COMMENT ON COLUMN capi_events.data_processing_options IS
  '[LDU] quando consent_state.ad_storage=denied + EEA-like. Meta-only — Google usa consent field separado.';

COMMENT ON COLUMN capi_events.pixel_id IS
  'ID do Meta Pixel que recebeu o evento. Cliente pode ter multiplos (default em meta_connections.pixel_id; override em wizard de eventos).';

COMMENT ON COLUMN capi_events.partner_agent IS
  'Identifica nossa app no Events Manager. Default global criation-io-v1 (override per-workspace via meta_connections.partner_agent).';
