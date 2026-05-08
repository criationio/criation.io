-- =============================================
-- Row Level Security Policies — Criation.io
-- Run in Supabase SQL Editor (Drizzle does not manage RLS)
-- =============================================

-- Helper functions
CREATE OR REPLACE FUNCTION get_workspace_id_for_user(p_user_id uuid)
RETURNS uuid AS $$
  SELECT workspace_id FROM workspace_members
  WHERE user_id = p_user_id AND is_active = true
  ORDER BY joined_at ASC LIMIT 1
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Set-returning helper: lista todos os workspace_ids ativos do usuario.
-- SECURITY DEFINER e essencial — bypassa RLS na leitura de workspace_members,
-- evitando recursao infinita quando a propria policy de workspace_members
-- precisa consultar o membership.
CREATE OR REPLACE FUNCTION user_active_workspace_ids(p_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT workspace_id FROM workspace_members
  WHERE user_id = p_user_id AND is_active = true
$$;

-- =============================================
-- Enable RLS on all tables
-- =============================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE pack_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_costs_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE processed_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE meta_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE gateway_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ads ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_creatives ENABLE ROW LEVEL SECURITY;
ALTER TABLE gateway_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE gateway_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE gateway_events_dlq ENABLE ROW LEVEL SECURITY;
ALTER TABLE utm_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE utm_stitching_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE references_lib ENABLE ROW LEVEL SECURITY;
ALTER TABLE capi_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE capi_event_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE click_id_store ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE matched_copy_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE measure_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE claude_request_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliates ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE affiliate_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- =============================================
-- Users: can only see own record
-- =============================================
CREATE POLICY "users_own_record" ON users
  FOR ALL USING (id = auth.uid());

-- =============================================
-- Workspace isolation policy (applied to all workspace_id tables)
-- =============================================

CREATE POLICY "workspace_isolation_workspaces" ON workspaces
  FOR ALL USING (id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND is_active = true
  ));

-- workspace_members nao pode fazer subquery direta em si mesma (recursao
-- infinita do planner). Usa SECURITY DEFINER function `user_active_workspace_ids`
-- pra bypassar a propria policy no lookup. Membro com is_active=false perde
-- visibilidade da row imediatamente porque a function ja filtra is_active=true.
CREATE POLICY "workspace_isolation_workspace_members" ON workspace_members
  FOR ALL USING (workspace_id IN (SELECT user_active_workspace_ids(auth.uid())));

CREATE POLICY "workspace_isolation_workspace_invites" ON workspace_invites
  FOR ALL USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY "workspace_isolation_subscriptions" ON subscriptions
  FOR ALL USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY "workspace_isolation_credit_balances" ON credit_balances
  FOR ALL USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY "workspace_isolation_credit_transactions" ON credit_transactions
  FOR ALL USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY "workspace_isolation_pack_purchases" ON pack_purchases
  FOR ALL USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY "workspace_isolation_meta_connections" ON meta_connections
  FOR ALL USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY "workspace_isolation_google_connections" ON google_connections
  FOR ALL USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY "workspace_isolation_gateway_connections" ON gateway_connections
  FOR ALL USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY "workspace_isolation_campaigns" ON campaigns
  FOR ALL USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY "workspace_isolation_ad_sets" ON ad_sets
  FOR ALL USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY "workspace_isolation_ads" ON ads
  FOR ALL USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY "workspace_isolation_ad_insights" ON ad_insights
  FOR ALL USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY "workspace_isolation_ad_creatives" ON ad_creatives
  FOR ALL USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY "workspace_isolation_gateway_products" ON gateway_products
  FOR ALL USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY "workspace_isolation_gateway_events" ON gateway_events
  FOR ALL USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY "workspace_isolation_gateway_events_dlq" ON gateway_events_dlq
  FOR ALL USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY "workspace_isolation_utm_mappings" ON utm_mappings
  FOR ALL USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY "workspace_isolation_utm_stitching_log" ON utm_stitching_log
  FOR ALL USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY "workspace_isolation_analyses" ON analyses
  FOR ALL USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY "workspace_isolation_analysis_results" ON analysis_results
  FOR ALL USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY "workspace_isolation_references_lib" ON references_lib
  FOR ALL USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY "workspace_isolation_capi_events" ON capi_events
  FOR ALL USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY "workspace_isolation_click_id_store" ON click_id_store
  FOR ALL USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY "workspace_isolation_consent_logs" ON consent_logs
  FOR ALL USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY "workspace_isolation_alert_rules" ON alert_rules
  FOR ALL USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY "workspace_isolation_alerts" ON alerts
  FOR ALL USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY "workspace_isolation_notifications" ON notifications
  FOR ALL USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY "workspace_isolation_learning_signals" ON learning_signals
  FOR ALL USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY "workspace_isolation_matched_copy_patterns" ON matched_copy_patterns
  FOR ALL USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY "workspace_isolation_measure_outcomes" ON measure_outcomes
  FOR ALL USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY "workspace_isolation_affiliates" ON affiliates
  FOR ALL USING (workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND is_active = true
  ));

CREATE POLICY "workspace_isolation_affiliate_referrals" ON affiliate_referrals
  FOR ALL USING (affiliate_id IN (
    SELECT id FROM affiliates WHERE workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND is_active = true
    )
  ));

CREATE POLICY "workspace_isolation_affiliate_commissions" ON affiliate_commissions
  FOR ALL USING (affiliate_id IN (
    SELECT id FROM affiliates WHERE workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND is_active = true
    )
  ));

-- =============================================
-- Public read policies (no auth required)
-- =============================================
CREATE POLICY "pipeline_costs_public_read" ON pipeline_costs
  FOR SELECT USING (true);

CREATE POLICY "credit_packages_public_read" ON credit_packages
  FOR SELECT USING (active = true);

-- =============================================
-- Append-only tables: block UPDATE and DELETE
-- =============================================
CREATE POLICY "credit_transactions_no_update" ON credit_transactions
  FOR UPDATE USING (false);
CREATE POLICY "credit_transactions_no_delete" ON credit_transactions
  FOR DELETE USING (false);

CREATE POLICY "capi_event_log_no_update" ON capi_event_log
  FOR UPDATE USING (false);
CREATE POLICY "capi_event_log_no_delete" ON capi_event_log
  FOR DELETE USING (false);

CREATE POLICY "consent_logs_no_update" ON consent_logs
  FOR UPDATE USING (false);
CREATE POLICY "consent_logs_no_delete" ON consent_logs
  FOR DELETE USING (false);

CREATE POLICY "admin_audit_log_no_update" ON admin_audit_log
  FOR UPDATE USING (false);
CREATE POLICY "admin_audit_log_no_delete" ON admin_audit_log
  FOR DELETE USING (false);

CREATE POLICY "processed_webhook_events_no_update" ON processed_webhook_events
  FOR UPDATE USING (false);
CREATE POLICY "processed_webhook_events_no_delete" ON processed_webhook_events
  FOR DELETE USING (false);

CREATE POLICY "claude_request_logs_no_update" ON claude_request_logs
  FOR UPDATE USING (false);
CREATE POLICY "claude_request_logs_no_delete" ON claude_request_logs
  FOR DELETE USING (false);

-- =============================================
-- Admin tables: service_role only (no anon access)
-- =============================================
CREATE POLICY "prompt_versions_service_only" ON prompt_versions
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "claude_request_logs_service_read" ON claude_request_logs
  FOR SELECT USING (auth.role() = 'service_role');

CREATE POLICY "admin_audit_log_service_only" ON admin_audit_log
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "feature_flags_service_only" ON feature_flags
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "pipeline_costs_history_service_only" ON pipeline_costs_history
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "capi_event_log_service_read" ON capi_event_log
  FOR SELECT USING (auth.role() = 'service_role');

CREATE POLICY "audit_logs_service_only" ON audit_logs
  FOR ALL USING (auth.role() = 'service_role');
