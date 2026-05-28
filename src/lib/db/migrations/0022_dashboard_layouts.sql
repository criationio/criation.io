-- Sessao 1.6 PR-1 — Dashboard layouts customizaveis.
--
-- Cliente pode salvar multiplas "views" (layouts + filtros) que aparecem como
-- presets no dashboard. user_id NULL = view shared workspace; user_id = X =
-- view privada do user. is_default determina qual view abre por user.
--
-- Aditiva pura. Zero-downtime.

CREATE TABLE IF NOT EXISTS "dashboard_layouts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "user_id" uuid REFERENCES "users"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "is_default" boolean NOT NULL DEFAULT false,
  "layout" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "filters" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "dashboard_layouts_workspace_id_idx"
  ON "dashboard_layouts" ("workspace_id") WHERE "deleted_at" IS NULL;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "dashboard_layouts_user_id_idx"
  ON "dashboard_layouts" ("user_id") WHERE "deleted_at" IS NULL;
--> statement-breakpoint

-- Apenas 1 default por user dentro do mesmo workspace.
-- COALESCE trata user_id NULL (view shared) como sentinel pra unique funcionar.
CREATE UNIQUE INDEX IF NOT EXISTS "dashboard_layouts_default_unique"
  ON "dashboard_layouts" (
    "workspace_id",
    COALESCE("user_id", '00000000-0000-0000-0000-000000000000'::uuid)
  )
  WHERE "is_default" = true AND "deleted_at" IS NULL;
--> statement-breakpoint

ALTER TABLE "dashboard_layouts" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

-- RLS: user le views do(s) workspace(s) em que e membro + suas proprias views privadas.
-- Service role pula RLS (admin jobs).
CREATE POLICY "dashboard_layouts_select" ON "dashboard_layouts"
  FOR SELECT
  USING (
    "workspace_id" IN (
      SELECT "workspace_id" FROM "workspace_members"
      WHERE "user_id" = auth.uid() AND "is_active" = true
    )
    AND ("user_id" IS NULL OR "user_id" = auth.uid())
    AND "deleted_at" IS NULL
  );
--> statement-breakpoint

CREATE POLICY "dashboard_layouts_insert" ON "dashboard_layouts"
  FOR INSERT
  WITH CHECK (
    "workspace_id" IN (
      SELECT "workspace_id" FROM "workspace_members"
      WHERE "user_id" = auth.uid() AND "is_active" = true
    )
    AND ("user_id" IS NULL OR "user_id" = auth.uid())
  );
--> statement-breakpoint

CREATE POLICY "dashboard_layouts_update" ON "dashboard_layouts"
  FOR UPDATE
  USING (
    "workspace_id" IN (
      SELECT "workspace_id" FROM "workspace_members"
      WHERE "user_id" = auth.uid() AND "is_active" = true
    )
    AND ("user_id" IS NULL OR "user_id" = auth.uid())
  );
--> statement-breakpoint

CREATE POLICY "dashboard_layouts_delete" ON "dashboard_layouts"
  FOR DELETE
  USING (
    "workspace_id" IN (
      SELECT "workspace_id" FROM "workspace_members"
      WHERE "user_id" = auth.uid() AND "is_active" = true
    )
    AND ("user_id" IS NULL OR "user_id" = auth.uid())
  );
