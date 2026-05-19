-- 0007_utm_stitcher_fields.sql — UTM Stitcher schema deltas (Sessao 1.4.8 / ADR-020)
--
-- Aditivo zero-downtime:
--  - gateway_events: 6 colunas de match (strategy, matched_*, confidence, stitched_at)
--  - campaigns: 5 colunas de aggregates (revenue 30d/total, attributed_count, roas, last_stitched)
--  - 2 indices: matched_campaign + parcial unmatched (dashboard de nao atribuidas)
--
-- Drizzle-kit nao gera por causa de snapshot stale pos-0006 (rename gateway_connections → connections).
-- Aplicado manualmente via Supabase MCP. Snapshot regenerado em proxima session.

-- gateway_events match fields ----------------------------------------------------

ALTER TABLE gateway_events
  ADD COLUMN IF NOT EXISTS match_strategy text NOT NULL DEFAULT 'unmatched',
  ADD COLUMN IF NOT EXISTS matched_campaign_id uuid,
  ADD COLUMN IF NOT EXISTS matched_ad_set_id uuid,
  ADD COLUMN IF NOT EXISTS matched_ad_id uuid,
  ADD COLUMN IF NOT EXISTS match_confidence numeric(5,4),
  ADD COLUMN IF NOT EXISTS stitched_at timestamptz;

ALTER TABLE gateway_events
  ADD CONSTRAINT gateway_events_matched_campaign_fk
    FOREIGN KEY (matched_campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS gateway_events_matched_campaign_idx
  ON gateway_events (matched_campaign_id);

CREATE INDEX IF NOT EXISTS gateway_events_unmatched_idx
  ON gateway_events (workspace_id, created_at)
  WHERE match_strategy = 'unmatched';

-- campaigns aggregates ----------------------------------------------------------

ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS revenue_gross_cents_30d integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS revenue_gross_cents_total bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS attributed_orders_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS roas_real numeric(10,4),
  ADD COLUMN IF NOT EXISTS last_stitched_at timestamptz;

-- workspaces.utm_convention -----------------------------------------------------
-- Convencao declarativa do cliente. Stitcher perfect match nao depende disso
-- (sempre tenta), mas UI usa pra alertas (UTM literal `{{ad.name}}` detectado
-- vira erro acionavel) e tracking-script futuro recomenda URL parameters Meta.

ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS utm_convention jsonb NOT NULL DEFAULT
    '{"usesCampaignNamePlaceholder": true, "usesAdSetNameAsTerm": false, "usesAdNameAsContent": false}'::jsonb;

-- Drop tabela orfa utm_stitching_log --------------------------------------------
-- Criada em sessoes anteriores (ADR-005) mas nunca recebeu INSERT. Stitcher
-- atual persiste resultado direto em gateway_events.match_strategy/stitched_at.
-- Auditoria historica de mudancas fica em TD futuro se precisar.

DROP TABLE IF EXISTS utm_stitching_log;
