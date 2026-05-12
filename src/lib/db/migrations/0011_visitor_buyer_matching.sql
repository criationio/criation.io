-- 0011_visitor_buyer_matching.sql — Visitor↔Buyer matching (Sessao 1.4.B / ADR-014)
--
-- Aditivo zero-downtime:
--  - gateway_events: 4 colunas pra matching com tracking_visitors/tracking_events
--  - 1 indice parcial (matched visitors) pra dashboard "vendas com jornada conhecida"
--  - 1 indice parcial pra worker reverso (1.4.9 fanout vai usar matched_visitor_id)
--
-- Drizzle-kit nao gera porque snapshot stale pos-rename de connections (mesmo
-- motivo das migrations 0007-0010). Aplicado via Supabase apply_migration.
-- Source-of-truth no git history.

-- 1. gateway_events: visitor matching fields ----------------------------------

ALTER TABLE gateway_events
  ADD COLUMN IF NOT EXISTS matched_visitor_id text,
  ADD COLUMN IF NOT EXISTS visitor_match_strategy text,
  ADD COLUMN IF NOT EXISTS visitor_match_confidence numeric(5,4),
  ADD COLUMN IF NOT EXISTS visitor_matched_at timestamptz;

COMMENT ON COLUMN gateway_events.matched_visitor_id IS
  'tracking_visitors.visitor_id correlacionado com este gateway event (1.4.B). Soft FK — visitor pode ser apagado por LGPD/erasure mas o gateway_event permanece.';

COMMENT ON COLUMN gateway_events.visitor_match_strategy IS
  'Estrategia que resolveu o match: deterministic_xcode (1.0) | clickid (0.9) | utm_recency (0.7) | unmatched (NULL match).';

COMMENT ON COLUMN gateway_events.visitor_match_confidence IS
  'Score 0-1 do match. 1.0 deterministic, 0.9 clickid 7d, 0.7 utm+recency 24h.';

COMMENT ON COLUMN gateway_events.visitor_matched_at IS
  'Timestamp da resolucao. NULL = nao processado pelo matcher ainda. Idempotencia checa este campo.';

-- 2. Indices ------------------------------------------------------------------

-- Dashboard "vendas com jornada conhecida" (matched visitors).
CREATE INDEX IF NOT EXISTS gateway_events_matched_visitor_idx
  ON gateway_events (workspace_id, matched_visitor_id, created_at DESC)
  WHERE matched_visitor_id IS NOT NULL;

-- Worker reverso (1.4.9 fanout): pegar gateway_events pendentes de visitor match.
-- Cobre re-tentativas quando matcher rodou e nao achou na primeira passada
-- (ex: tracking event chegou DEPOIS do gateway event).
CREATE INDEX IF NOT EXISTS gateway_events_pending_visitor_match_idx
  ON gateway_events (workspace_id, created_at)
  WHERE visitor_matched_at IS NULL;

-- Lookup reverso: dado um buyer_email, achar gateway events. Ja existe
-- gateway_events_workspace_id_idx mas precisamos especifico pro matching reverso
-- disparado por process-tracking-event quando vem identify_email.
CREATE INDEX IF NOT EXISTS gateway_events_customer_email_idx
  ON gateway_events (workspace_id, customer_email_hash, created_at DESC)
  WHERE customer_email_hash IS NOT NULL;
