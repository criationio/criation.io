-- Sessao 1.4.9.C — drop click_id_store (tabela legacy v0.5 observer mode).
-- Substituida por colunas em tracking_events (fbclid/gclid/ttclid/msclkid/wbraid/gbraid)
-- + tracking_visitors (first/last_click_id/_type) desde ADR-014 (Criation as CDP).
-- Zero writers/readers em src/ — confirmado em audit pre-drop.
--
-- Single-PR vs zero-downtime 3-PR (CLAUDE.md regra 16): regra 16 so aplica
-- com dual-write ativo. Aqui nada escreve/le ha sessoes, drop e seguro.

DROP INDEX IF EXISTS "click_id_store_workspace_id_idx";
DROP INDEX IF EXISTS "click_id_store_expires_at_idx";
DROP INDEX IF EXISTS "click_id_store_fbclid_idx";
DROP INDEX IF EXISTS "click_id_store_gclid_idx";

DROP TABLE IF EXISTS "click_id_store";
