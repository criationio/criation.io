-- 0015_plain_ip_ua_for_capi.sql — Plain IP/UA pra CAPI EMQ (Sessao 1.4.9)
--
-- Audit Meta §3 (2026-05): EMQ trava em ~5 sem IP+UA em claro no payload
-- CAPI. tracking_events (1.4.A) e gateway_events (1.4.5-7) so guardavam
-- HMAC-hashed (LGPD-safe by default). Meta nao consegue fazer match com
-- hash nosso — precisa do plain pra dedup com sinal do Pixel browser.
--
-- Decisao: adicionar plain IP/UA nullable em ambas. Hash continua
-- existindo (usado por dashboard analytics + dedup interno). Plain e
-- usado SO pelo CAPI adapter (1.4.9). LGPD: retention 30d via job
-- futuro (TD-108 — purge plain, manter hash).
--
-- Migration aditiva zero-downtime — colunas nullable, sem backfill
-- (tracking_events/capi_events vazios em prod; gateway_events legado
-- nunca tera plain — degrade graceful no fanout via opcionalidade Meta).
--
-- Postgres: ALTER TABLE em parent particionada propaga pras particoes
-- filhas automaticamente (verificado em Postgres 17).

ALTER TABLE tracking_events ADD COLUMN IF NOT EXISTS client_ip_address inet;
ALTER TABLE tracking_events ADD COLUMN IF NOT EXISTS client_user_agent text;

ALTER TABLE gateway_events ADD COLUMN IF NOT EXISTS client_ip_address inet;
ALTER TABLE gateway_events ADD COLUMN IF NOT EXISTS client_user_agent text;

COMMENT ON COLUMN tracking_events.client_ip_address IS
  'Plain IP do buyer pra Meta CAPI EMQ (1.4.9). Capturado de req headers no /api/v1/track. LGPD: retention 30d via TD-108. Coexiste com client_ip_hash (HMAC-salt) usado pelo dashboard.';

COMMENT ON COLUMN tracking_events.client_user_agent IS
  'Plain UA do buyer pra Meta CAPI EMQ (1.4.9). Capturado de req headers no /api/v1/track. LGPD: retention 30d via TD-108. Coexiste com client_user_agent_hash.';

COMMENT ON COLUMN gateway_events.client_ip_address IS
  'Plain IP do buyer no checkout — extraido do webhook payload Hotmart/Kiwify/Eduzz quando presente (buyer.ip ou customer.ip). LGPD: retention 30d via TD-108.';

COMMENT ON COLUMN gateway_events.client_user_agent IS
  'Plain UA do buyer no checkout — extraido do webhook payload quando presente. LGPD: retention 30d via TD-108.';
