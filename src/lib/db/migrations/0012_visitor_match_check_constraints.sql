-- 0012_visitor_match_check_constraints.sql — Audit fixes B7 + A3 (Sessao 1.4.B post-audit)
--
-- CHECK constraints aditivos zero-downtime:
--  - visitor_match_strategy: enum fechado incluindo 'reverse_email' (audit A3) e 'unmatched'
--  - visitor_match_confidence: range [0, 1] (rejeita -0.5 ou 1.5 acidental)
--
-- Padrao zero-downtime: ADD CONSTRAINT NOT VALID + VALIDATE separado. Em volume MVP
-- (zero rows existentes na 1.4.B porque a feature acabou de subir) o VALIDATE e
-- instantaneo. Padrao mantido pra futuras migrations onde matter.

ALTER TABLE gateway_events
  ADD CONSTRAINT gateway_events_visitor_match_strategy_check
    CHECK (visitor_match_strategy IS NULL OR visitor_match_strategy IN (
      'deterministic_xcode',
      'clickid',
      'utm_recency',
      'reverse_email',
      'unmatched'
    )) NOT VALID;

ALTER TABLE gateway_events
  VALIDATE CONSTRAINT gateway_events_visitor_match_strategy_check;

ALTER TABLE gateway_events
  ADD CONSTRAINT gateway_events_visitor_match_confidence_check
    CHECK (visitor_match_confidence IS NULL OR (visitor_match_confidence >= 0 AND visitor_match_confidence <= 1)) NOT VALID;

ALTER TABLE gateway_events
  VALIDATE CONSTRAINT gateway_events_visitor_match_confidence_check;

COMMENT ON CONSTRAINT gateway_events_visitor_match_strategy_check ON gateway_events IS
  'Enum fechado das 4 estrategias do matcher (1.4.B): deterministic_xcode|clickid|utm_recency|reverse_email + sentinel unmatched. Audit fix A3.';
