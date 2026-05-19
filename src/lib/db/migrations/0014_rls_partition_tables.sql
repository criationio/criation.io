-- 0014_rls_partition_tables.sql — RLS nas particoes filhas (defensive)
--
-- Postgres NAO propaga RLS de parent partitioned table pras particoes filhas.
-- Se alguem query direto `FROM tracking_events_2026_05` (service_role,
-- raw psql, etc), bypassa o workspace_isolation do parent.
--
-- Esta migration:
--  1. Corrige bug pre-existente nas particoes de tracking_events (1.4.A —
--     migration 0009 enabled RLS so no parent).
--  2. Aplica mesmo padrao defensivo nas particoes recem-criadas de
--     capi_events (1.4.9 — migration 0013).
--
-- Convencao: a task daily que cria partitions futuras (`create-tracking-
-- partition` + extensao pra capi_events em 1.4.9) precisa replicar esse
-- ENABLE RLS + CREATE POLICY pra cada nova particao mensal.

-- 1. tracking_events partitions (fix retroativo) ---------------------------

ALTER TABLE tracking_events_2026_05 ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracking_events_2026_06 ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracking_events_2026_07 ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workspace_isolation_tracking_events ON tracking_events_2026_05;
CREATE POLICY workspace_isolation_tracking_events ON tracking_events_2026_05
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

DROP POLICY IF EXISTS workspace_isolation_tracking_events ON tracking_events_2026_06;
CREATE POLICY workspace_isolation_tracking_events ON tracking_events_2026_06
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

DROP POLICY IF EXISTS workspace_isolation_tracking_events ON tracking_events_2026_07;
CREATE POLICY workspace_isolation_tracking_events ON tracking_events_2026_07
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- 2. capi_events partitions ------------------------------------------------

ALTER TABLE capi_events_2026_05 ENABLE ROW LEVEL SECURITY;
ALTER TABLE capi_events_2026_06 ENABLE ROW LEVEL SECURITY;
ALTER TABLE capi_events_2026_07 ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workspace_isolation_capi_events ON capi_events_2026_05;
CREATE POLICY workspace_isolation_capi_events ON capi_events_2026_05
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

DROP POLICY IF EXISTS workspace_isolation_capi_events ON capi_events_2026_06;
CREATE POLICY workspace_isolation_capi_events ON capi_events_2026_06
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

DROP POLICY IF EXISTS workspace_isolation_capi_events ON capi_events_2026_07;
CREATE POLICY workspace_isolation_capi_events ON capi_events_2026_07
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );
