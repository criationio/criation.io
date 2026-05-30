-- Sessao 1.5 restruct — onboarding wizard simplificado pra 3 steps
-- (perfil -> credits -> completed). Steps antigos (gateway/meta/utm_check/
-- google/primeira_analise/tour) viram tour stops no dashboard, nao steps
-- de wizard. CHECK constraint atualizada.
--
-- Pre-flight: qualquer row em estado obsoleto rebaixa pra 'perfil' (rollback
-- seguro — user passa pelo perfil de novo, sem perda de dados).

UPDATE "users"
SET "onboarding_step" = 'perfil'
WHERE "onboarding_step" IN ('gateway', 'meta', 'utm_check', 'google', 'primeira_analise', 'tour');
--> statement-breakpoint

ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_onboarding_step_check";
--> statement-breakpoint

ALTER TABLE "users" ADD CONSTRAINT "users_onboarding_step_check"
  CHECK ("onboarding_step" IN ('perfil', 'credits', 'completed'));
