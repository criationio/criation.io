ALTER TABLE "workspace_invites" DROP CONSTRAINT "workspace_invites_workspace_id_workspaces_id_fk";
--> statement-breakpoint
ALTER TABLE "workspace_invites" DROP CONSTRAINT "workspace_invites_invited_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "workspace_members" DROP CONSTRAINT "workspace_members_workspace_id_workspaces_id_fk";
--> statement-breakpoint
ALTER TABLE "workspace_members" DROP CONSTRAINT "workspace_members_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "workspace_members" DROP CONSTRAINT "workspace_members_invited_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "credit_balances" DROP CONSTRAINT "credit_balances_workspace_id_workspaces_id_fk";
--> statement-breakpoint
ALTER TABLE "credit_transactions" DROP CONSTRAINT "credit_transactions_workspace_id_workspaces_id_fk";
--> statement-breakpoint
ALTER TABLE "credit_transactions" DROP CONSTRAINT "credit_transactions_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "credit_transactions" DROP CONSTRAINT "credit_transactions_subscription_id_subscriptions_id_fk";
--> statement-breakpoint
ALTER TABLE "pack_purchases" DROP CONSTRAINT "pack_purchases_workspace_id_workspaces_id_fk";
--> statement-breakpoint
ALTER TABLE "pack_purchases" DROP CONSTRAINT "pack_purchases_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "pack_purchases" DROP CONSTRAINT "pack_purchases_package_id_credit_packages_id_fk";
--> statement-breakpoint
ALTER TABLE "pipeline_costs" DROP CONSTRAINT "pipeline_costs_updated_by_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "pipeline_costs_history" DROP CONSTRAINT "pipeline_costs_history_changed_by_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "subscriptions" DROP CONSTRAINT "subscriptions_workspace_id_workspaces_id_fk";
--> statement-breakpoint
ALTER TABLE "gateway_connections" DROP CONSTRAINT "gateway_connections_workspace_id_workspaces_id_fk";
--> statement-breakpoint
ALTER TABLE "google_connections" DROP CONSTRAINT "google_connections_workspace_id_workspaces_id_fk";
--> statement-breakpoint
ALTER TABLE "meta_connections" DROP CONSTRAINT "meta_connections_workspace_id_workspaces_id_fk";
--> statement-breakpoint
ALTER TABLE "ad_creatives" DROP CONSTRAINT "ad_creatives_workspace_id_workspaces_id_fk";
--> statement-breakpoint
ALTER TABLE "ad_creatives" DROP CONSTRAINT "ad_creatives_ad_id_ads_id_fk";
--> statement-breakpoint
ALTER TABLE "ad_insights" DROP CONSTRAINT "ad_insights_workspace_id_workspaces_id_fk";
--> statement-breakpoint
ALTER TABLE "ad_insights" DROP CONSTRAINT "ad_insights_ad_id_ads_id_fk";
--> statement-breakpoint
ALTER TABLE "ad_sets" DROP CONSTRAINT "ad_sets_workspace_id_workspaces_id_fk";
--> statement-breakpoint
ALTER TABLE "ad_sets" DROP CONSTRAINT "ad_sets_campaign_id_campaigns_id_fk";
--> statement-breakpoint
ALTER TABLE "ads" DROP CONSTRAINT "ads_workspace_id_workspaces_id_fk";
--> statement-breakpoint
ALTER TABLE "ads" DROP CONSTRAINT "ads_ad_set_id_ad_sets_id_fk";
--> statement-breakpoint
ALTER TABLE "campaigns" DROP CONSTRAINT "campaigns_workspace_id_workspaces_id_fk";
--> statement-breakpoint
ALTER TABLE "gateway_events" DROP CONSTRAINT "gateway_events_workspace_id_workspaces_id_fk";
--> statement-breakpoint
ALTER TABLE "gateway_events" DROP CONSTRAINT "gateway_events_connection_id_gateway_connections_id_fk";
--> statement-breakpoint
ALTER TABLE "gateway_events_dlq" DROP CONSTRAINT "gateway_events_dlq_workspace_id_workspaces_id_fk";
--> statement-breakpoint
ALTER TABLE "gateway_products" DROP CONSTRAINT "gateway_products_workspace_id_workspaces_id_fk";
--> statement-breakpoint
ALTER TABLE "gateway_products" DROP CONSTRAINT "gateway_products_connection_id_gateway_connections_id_fk";
--> statement-breakpoint
ALTER TABLE "utm_mappings" DROP CONSTRAINT "utm_mappings_workspace_id_workspaces_id_fk";
--> statement-breakpoint
ALTER TABLE "utm_mappings" DROP CONSTRAINT "utm_mappings_ad_id_ads_id_fk";
--> statement-breakpoint
ALTER TABLE "utm_stitching_log" DROP CONSTRAINT "utm_stitching_log_workspace_id_workspaces_id_fk";
--> statement-breakpoint
ALTER TABLE "utm_stitching_log" DROP CONSTRAINT "utm_stitching_log_gateway_event_id_gateway_events_id_fk";
--> statement-breakpoint
ALTER TABLE "utm_stitching_log" DROP CONSTRAINT "utm_stitching_log_matched_ad_id_ads_id_fk";
--> statement-breakpoint
ALTER TABLE "analyses" DROP CONSTRAINT "analyses_workspace_id_workspaces_id_fk";
--> statement-breakpoint
ALTER TABLE "analyses" DROP CONSTRAINT "analyses_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "analyses" DROP CONSTRAINT "analyses_credit_transaction_id_credit_transactions_id_fk";
--> statement-breakpoint
ALTER TABLE "analysis_results" DROP CONSTRAINT "analysis_results_analysis_id_analyses_id_fk";
--> statement-breakpoint
ALTER TABLE "analysis_results" DROP CONSTRAINT "analysis_results_workspace_id_workspaces_id_fk";
--> statement-breakpoint
ALTER TABLE "references_lib" DROP CONSTRAINT "references_lib_workspace_id_workspaces_id_fk";
--> statement-breakpoint
ALTER TABLE "references_lib" DROP CONSTRAINT "references_lib_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "capi_event_log" DROP CONSTRAINT "capi_event_log_capi_event_id_capi_events_id_fk";
--> statement-breakpoint
ALTER TABLE "capi_events" DROP CONSTRAINT "capi_events_workspace_id_workspaces_id_fk";
--> statement-breakpoint
ALTER TABLE "capi_events" DROP CONSTRAINT "capi_events_gateway_event_id_gateway_events_id_fk";
--> statement-breakpoint
ALTER TABLE "click_id_store" DROP CONSTRAINT "click_id_store_workspace_id_workspaces_id_fk";
--> statement-breakpoint
ALTER TABLE "consent_logs" DROP CONSTRAINT "consent_logs_workspace_id_workspaces_id_fk";
--> statement-breakpoint
ALTER TABLE "consent_logs" DROP CONSTRAINT "consent_logs_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "alert_rules" DROP CONSTRAINT "alert_rules_workspace_id_workspaces_id_fk";
--> statement-breakpoint
ALTER TABLE "alerts" DROP CONSTRAINT "alerts_workspace_id_workspaces_id_fk";
--> statement-breakpoint
ALTER TABLE "alerts" DROP CONSTRAINT "alerts_rule_id_alert_rules_id_fk";
--> statement-breakpoint
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_workspace_id_workspaces_id_fk";
--> statement-breakpoint
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "learning_signals" DROP CONSTRAINT "learning_signals_workspace_id_workspaces_id_fk";
--> statement-breakpoint
ALTER TABLE "learning_signals" DROP CONSTRAINT "learning_signals_analysis_id_analyses_id_fk";
--> statement-breakpoint
ALTER TABLE "matched_copy_patterns" DROP CONSTRAINT "matched_copy_patterns_workspace_id_workspaces_id_fk";
--> statement-breakpoint
ALTER TABLE "measure_outcomes" DROP CONSTRAINT "measure_outcomes_workspace_id_workspaces_id_fk";
--> statement-breakpoint
ALTER TABLE "measure_outcomes" DROP CONSTRAINT "measure_outcomes_analysis_id_analyses_id_fk";
--> statement-breakpoint
ALTER TABLE "admin_audit_log" DROP CONSTRAINT "admin_audit_log_admin_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "claude_request_logs" DROP CONSTRAINT "claude_request_logs_workspace_id_workspaces_id_fk";
--> statement-breakpoint
ALTER TABLE "claude_request_logs" DROP CONSTRAINT "claude_request_logs_prompt_version_id_prompt_versions_id_fk";
--> statement-breakpoint
ALTER TABLE "feature_flags" DROP CONSTRAINT "feature_flags_updated_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "prompt_versions" DROP CONSTRAINT "prompt_versions_deployed_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "affiliate_commissions" DROP CONSTRAINT "affiliate_commissions_affiliate_id_affiliates_id_fk";
--> statement-breakpoint
ALTER TABLE "affiliate_commissions" DROP CONSTRAINT "affiliate_commissions_referral_id_affiliate_referrals_id_fk";
--> statement-breakpoint
ALTER TABLE "affiliate_referrals" DROP CONSTRAINT "affiliate_referrals_affiliate_id_affiliates_id_fk";
--> statement-breakpoint
ALTER TABLE "affiliate_referrals" DROP CONSTRAINT "affiliate_referrals_referred_workspace_id_workspaces_id_fk";
--> statement-breakpoint
ALTER TABLE "affiliates" DROP CONSTRAINT "affiliates_workspace_id_workspaces_id_fk";
--> statement-breakpoint
ALTER TABLE "affiliates" DROP CONSTRAINT "affiliates_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_workspace_id_workspaces_id_fk";
--> statement-breakpoint
ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_actor_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "role" text DEFAULT 'user' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "default_workspace_id" uuid;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "onboarding_step" text DEFAULT 'perfil' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "onboarding_completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_default_workspace_id_workspaces_id_fk" FOREIGN KEY ("default_workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_invites" ADD CONSTRAINT "workspace_invites_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_invites" ADD CONSTRAINT "workspace_invites_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_balances" ADD CONSTRAINT "credit_balances_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pack_purchases" ADD CONSTRAINT "pack_purchases_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pack_purchases" ADD CONSTRAINT "pack_purchases_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pack_purchases" ADD CONSTRAINT "pack_purchases_package_id_credit_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."credit_packages"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pipeline_costs" ADD CONSTRAINT "pipeline_costs_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pipeline_costs_history" ADD CONSTRAINT "pipeline_costs_history_changed_by_user_id_users_id_fk" FOREIGN KEY ("changed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gateway_connections" ADD CONSTRAINT "gateway_connections_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "google_connections" ADD CONSTRAINT "google_connections_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meta_connections" ADD CONSTRAINT "meta_connections_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ad_creatives" ADD CONSTRAINT "ad_creatives_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ad_creatives" ADD CONSTRAINT "ad_creatives_ad_id_ads_id_fk" FOREIGN KEY ("ad_id") REFERENCES "public"."ads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ad_insights" ADD CONSTRAINT "ad_insights_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ad_insights" ADD CONSTRAINT "ad_insights_ad_id_ads_id_fk" FOREIGN KEY ("ad_id") REFERENCES "public"."ads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ad_sets" ADD CONSTRAINT "ad_sets_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ad_sets" ADD CONSTRAINT "ad_sets_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ads" ADD CONSTRAINT "ads_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ads" ADD CONSTRAINT "ads_ad_set_id_ad_sets_id_fk" FOREIGN KEY ("ad_set_id") REFERENCES "public"."ad_sets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gateway_events" ADD CONSTRAINT "gateway_events_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gateway_events" ADD CONSTRAINT "gateway_events_connection_id_gateway_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."gateway_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gateway_events_dlq" ADD CONSTRAINT "gateway_events_dlq_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gateway_products" ADD CONSTRAINT "gateway_products_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gateway_products" ADD CONSTRAINT "gateway_products_connection_id_gateway_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."gateway_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "utm_mappings" ADD CONSTRAINT "utm_mappings_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "utm_mappings" ADD CONSTRAINT "utm_mappings_ad_id_ads_id_fk" FOREIGN KEY ("ad_id") REFERENCES "public"."ads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "utm_stitching_log" ADD CONSTRAINT "utm_stitching_log_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "utm_stitching_log" ADD CONSTRAINT "utm_stitching_log_gateway_event_id_gateway_events_id_fk" FOREIGN KEY ("gateway_event_id") REFERENCES "public"."gateway_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "utm_stitching_log" ADD CONSTRAINT "utm_stitching_log_matched_ad_id_ads_id_fk" FOREIGN KEY ("matched_ad_id") REFERENCES "public"."ads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analyses" ADD CONSTRAINT "analyses_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analyses" ADD CONSTRAINT "analyses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analyses" ADD CONSTRAINT "analyses_credit_transaction_id_credit_transactions_id_fk" FOREIGN KEY ("credit_transaction_id") REFERENCES "public"."credit_transactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analysis_results" ADD CONSTRAINT "analysis_results_analysis_id_analyses_id_fk" FOREIGN KEY ("analysis_id") REFERENCES "public"."analyses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analysis_results" ADD CONSTRAINT "analysis_results_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "references_lib" ADD CONSTRAINT "references_lib_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "references_lib" ADD CONSTRAINT "references_lib_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capi_event_log" ADD CONSTRAINT "capi_event_log_capi_event_id_capi_events_id_fk" FOREIGN KEY ("capi_event_id") REFERENCES "public"."capi_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capi_events" ADD CONSTRAINT "capi_events_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capi_events" ADD CONSTRAINT "capi_events_gateway_event_id_gateway_events_id_fk" FOREIGN KEY ("gateway_event_id") REFERENCES "public"."gateway_events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "click_id_store" ADD CONSTRAINT "click_id_store_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_logs" ADD CONSTRAINT "consent_logs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_logs" ADD CONSTRAINT "consent_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_rules" ADD CONSTRAINT "alert_rules_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_rule_id_alert_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."alert_rules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_signals" ADD CONSTRAINT "learning_signals_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_signals" ADD CONSTRAINT "learning_signals_analysis_id_analyses_id_fk" FOREIGN KEY ("analysis_id") REFERENCES "public"."analyses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matched_copy_patterns" ADD CONSTRAINT "matched_copy_patterns_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "measure_outcomes" ADD CONSTRAINT "measure_outcomes_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "measure_outcomes" ADD CONSTRAINT "measure_outcomes_analysis_id_analyses_id_fk" FOREIGN KEY ("analysis_id") REFERENCES "public"."analyses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_audit_log" ADD CONSTRAINT "admin_audit_log_admin_user_id_users_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claude_request_logs" ADD CONSTRAINT "claude_request_logs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claude_request_logs" ADD CONSTRAINT "claude_request_logs_prompt_version_id_prompt_versions_id_fk" FOREIGN KEY ("prompt_version_id") REFERENCES "public"."prompt_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feature_flags" ADD CONSTRAINT "feature_flags_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompt_versions" ADD CONSTRAINT "prompt_versions_deployed_by_users_id_fk" FOREIGN KEY ("deployed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_commissions" ADD CONSTRAINT "affiliate_commissions_affiliate_id_affiliates_id_fk" FOREIGN KEY ("affiliate_id") REFERENCES "public"."affiliates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_commissions" ADD CONSTRAINT "affiliate_commissions_referral_id_affiliate_referrals_id_fk" FOREIGN KEY ("referral_id") REFERENCES "public"."affiliate_referrals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_referrals" ADD CONSTRAINT "affiliate_referrals_affiliate_id_affiliates_id_fk" FOREIGN KEY ("affiliate_id") REFERENCES "public"."affiliates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_referrals" ADD CONSTRAINT "affiliate_referrals_referred_workspace_id_workspaces_id_fk" FOREIGN KEY ("referred_workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliates" ADD CONSTRAINT "affiliates_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliates" ADD CONSTRAINT "affiliates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "workspace_members_user_active_idx" ON "workspace_members" USING btree ("user_id","is_active") WHERE is_active = true;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_role_check" CHECK ("users"."role" IN ('user', 'admin', 'super_admin'));--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_onboarding_step_check" CHECK ("users"."onboarding_step" IN ('perfil', 'gateway', 'meta', 'utm_check', 'google', 'primeira_analise', 'tour', 'completed'));--> statement-breakpoint
ALTER TABLE "workspace_invites" ADD CONSTRAINT "workspace_invites_role_check" CHECK ("workspace_invites"."role" IN ('owner', 'admin', 'editor', 'viewer'));--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_role_check" CHECK ("workspace_members"."role" IN ('owner', 'admin', 'editor', 'viewer'));