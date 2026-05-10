-- ADR-019: Meta-tabela connections + adapters por vertical
--
-- Renomeia gateway_connections -> connections e adiciona coluna `type`
-- discriminadora ('gateway' | 'crm' | 'email' | 'ad_network' | 'analytics' |
-- 'helpdesk' | 'communication').
--
-- Aplicado manualmente via Supabase MCP em 2026-05-10. Este arquivo serve
-- como source-of-truth no git history (nao re-executar — o estado ja esta
-- no banco). Drizzle-kit nao gera RENAME automaticamente porque exige
-- prompt interativo.
--
-- 7 connections existentes preservadas (UUIDs intactos, webhooks ativos
-- continuam funcionando). Todas com `type='gateway'` automaticamente.

ALTER TABLE gateway_connections RENAME TO connections;
--> statement-breakpoint
ALTER TABLE connections ADD COLUMN type text NOT NULL DEFAULT 'gateway';
--> statement-breakpoint

-- Renomeia indexes pra match novo nome de tabela
ALTER INDEX gateway_connections_workspace_id_idx RENAME TO connections_workspace_id_idx;
--> statement-breakpoint
ALTER INDEX gateway_connections_provider_idx RENAME TO connections_provider_idx;
--> statement-breakpoint
ALTER INDEX gateway_connections_status_idx RENAME TO connections_status_idx;
--> statement-breakpoint

-- Index novo no type
CREATE INDEX connections_type_idx ON connections (type);
--> statement-breakpoint

-- Drop UNIQUE antigo (workspace, provider) + recria com (workspace, type, provider)
-- — permite ex: gateway:hotmart + crm:hotmart simultaneos no futuro
ALTER INDEX gateway_connections_workspace_provider_active_unique
  RENAME TO connections_workspace_provider_active_unique_legacy;
--> statement-breakpoint
DROP INDEX connections_workspace_provider_active_unique_legacy;
--> statement-breakpoint
CREATE UNIQUE INDEX connections_workspace_type_provider_active_unique
  ON connections (workspace_id, type, provider) WHERE deleted_at IS NULL;
--> statement-breakpoint

-- Renomeia constraints pra cosmetica consistente
ALTER TABLE connections RENAME CONSTRAINT gateway_connections_pkey TO connections_pkey;
--> statement-breakpoint
ALTER TABLE connections RENAME CONSTRAINT
  gateway_connections_workspace_id_workspaces_id_fk TO connections_workspace_id_workspaces_id_fk;
--> statement-breakpoint

-- RLS policy (drop antigo + cria novo com mesmo conteudo)
DROP POLICY IF EXISTS workspace_isolation_gateway_connections ON connections;
--> statement-breakpoint
CREATE POLICY "workspace_isolation_connections" ON connections
  FOR ALL USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND is_active = true
  ));
