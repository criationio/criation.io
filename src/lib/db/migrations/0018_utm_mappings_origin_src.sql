-- Fase B / TD-087 — Origin.src strategy pra UTM Stitcher.
-- Permite admin mapear codigo de afiliado (Hotmart Sparkle `origin.src`) pra
-- ad/campaign quando UTMs nao vem preenchidas na venda (cenario afiliado).
-- Aditiva pura — coluna nullable, index parcial. Zero-downtime.

ALTER TABLE "utm_mappings" ADD COLUMN "origin_src" text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "utm_mappings_origin_src_idx" ON "utm_mappings" ("workspace_id", "origin_src") WHERE origin_src IS NOT NULL;
