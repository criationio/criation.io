-- Sessao 1.5 PR-1 — Profile context coletado no step `perfil` do onboarding wizard.
-- Shape inicial: { niche?, ticket?, adSpend?, ... }. Permissivo por design (jsonb)
-- pra evoluir sem nova migration. Validado via Zod no submitProfile action.
-- Consumido a partir de 1.9 (Estudio Quick) pra personalizar prompts Claude.
--
-- Aditiva pura: coluna NOT NULL com default '{}'::jsonb. Zero-downtime.
-- Rows existentes ganham '{}' automaticamente via DEFAULT.

ALTER TABLE "users" ADD COLUMN "profile_context" jsonb NOT NULL DEFAULT '{}'::jsonb;
