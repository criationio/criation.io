-- Sessao 1.6 PR-13c — Funis nomeados.
--
-- Cliente define funis com bundle de critérios (UTM pattern + landing pattern
-- + lista de produtos). Dashboard filtra por funil = aplica todos os critérios
-- de uma vez. Útil quando 1 produto roda em N funis ou N produtos compõem 1
-- jornada unificada.
--
-- Aditiva pura, zero-downtime.

CREATE TABLE IF NOT EXISTS "dashboard_funnels" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "description" text,
  "landing_url_pattern" text,
  "utm_campaign_pattern" text,
  "product_ids" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "is_default" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "dashboard_funnels_workspace_id_idx"
  ON "dashboard_funnels" ("workspace_id") WHERE "deleted_at" IS NULL;
--> statement-breakpoint

-- Apenas 1 default por workspace.
CREATE UNIQUE INDEX IF NOT EXISTS "dashboard_funnels_default_unique"
  ON "dashboard_funnels" ("workspace_id")
  WHERE "is_default" = true AND "deleted_at" IS NULL;
--> statement-breakpoint

ALTER TABLE "dashboard_funnels" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

CREATE POLICY "dashboard_funnels_select" ON "dashboard_funnels"
  FOR SELECT USING (
    "workspace_id" IN (
      SELECT "workspace_id" FROM "workspace_members"
      WHERE "user_id" = auth.uid() AND "is_active" = true
    ) AND "deleted_at" IS NULL
  );
--> statement-breakpoint

CREATE POLICY "dashboard_funnels_insert" ON "dashboard_funnels"
  FOR INSERT WITH CHECK (
    "workspace_id" IN (
      SELECT "workspace_id" FROM "workspace_members"
      WHERE "user_id" = auth.uid() AND "is_active" = true
    )
  );
--> statement-breakpoint

CREATE POLICY "dashboard_funnels_update" ON "dashboard_funnels"
  FOR UPDATE USING (
    "workspace_id" IN (
      SELECT "workspace_id" FROM "workspace_members"
      WHERE "user_id" = auth.uid() AND "is_active" = true
    )
  );
--> statement-breakpoint

CREATE POLICY "dashboard_funnels_delete" ON "dashboard_funnels"
  FOR DELETE USING (
    "workspace_id" IN (
      SELECT "workspace_id" FROM "workspace_members"
      WHERE "user_id" = auth.uid() AND "is_active" = true
    )
  );
