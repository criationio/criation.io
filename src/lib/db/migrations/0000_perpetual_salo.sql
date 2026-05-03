CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"avatar_url" text,
	"signup_ip_hash" text,
	"signup_user_agent_hash" text,
	"signup_fingerprint" text,
	"email_verified_at" timestamp with time zone,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "workspace_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"email" text NOT NULL,
	"role" text NOT NULL,
	"token" text NOT NULL,
	"invited_by" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "workspace_invites_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "workspace_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text NOT NULL,
	"invited_by" uuid,
	"joined_at" timestamp with time zone,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "workspace_members_workspace_user_unique" UNIQUE("workspace_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"plan_id" text DEFAULT 'free' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "workspaces_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "credit_balances" (
	"workspace_id" uuid PRIMARY KEY NOT NULL,
	"balance" integer DEFAULT 0 NOT NULL,
	"signup_balance" integer DEFAULT 0 NOT NULL,
	"signup_expires_at" timestamp with time zone,
	"subscription_balance" integer DEFAULT 0 NOT NULL,
	"subscription_expires_at" timestamp with time zone,
	"pack_balance" integer DEFAULT 0 NOT NULL,
	"admin_balance" integer DEFAULT 0 NOT NULL,
	"admin_expires_at" timestamp with time zone,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_packages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sku" text NOT NULL,
	"name" text NOT NULL,
	"credits" integer NOT NULL,
	"price_brl_cents" integer NOT NULL,
	"price_usd_cents" integer,
	"validity_days" integer DEFAULT 60 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "credit_packages_sku_unique" UNIQUE("sku")
);
--> statement-breakpoint
CREATE TABLE "credit_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid,
	"type" text NOT NULL,
	"source" text NOT NULL,
	"amount" integer NOT NULL,
	"analysis_id" text,
	"pipeline_id" text,
	"pack_purchase_id" uuid,
	"subscription_id" uuid,
	"idempotency_key" text,
	"reason" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "credit_transactions_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "pack_purchases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"package_id" uuid NOT NULL,
	"credits_granted" integer NOT NULL,
	"credits_remaining" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"payment_provider" text NOT NULL,
	"payment_id" text NOT NULL,
	"amount_paid_cents" integer NOT NULL,
	"currency" text DEFAULT 'BRL' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"activated_at" timestamp with time zone,
	"expired_at" timestamp with time zone,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pipeline_costs" (
	"pipeline_id" text PRIMARY KEY NOT NULL,
	"cost_credits" integer NOT NULL,
	"estimated_real_cost_brl" numeric(10, 2),
	"description" text,
	"active" boolean DEFAULT true NOT NULL,
	"effective_from" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by_user_id" uuid
);
--> statement-breakpoint
CREATE TABLE "pipeline_costs_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pipeline_id" text NOT NULL,
	"cost_credits" integer NOT NULL,
	"effective_from" timestamp with time zone NOT NULL,
	"effective_until" timestamp with time zone,
	"changed_by_user_id" uuid,
	"reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "processed_webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"event_id" text NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "processed_webhook_events_provider_event_unique" UNIQUE("provider","event_id")
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"plan_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"payment_provider" text NOT NULL,
	"provider_subscription_id" text,
	"provider_customer_id" text,
	"credits_per_cycle" integer DEFAULT 0 NOT NULL,
	"current_cycle_credits_remaining" integer DEFAULT 0 NOT NULL,
	"current_cycle_started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"current_cycle_ends_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cancellation_scheduled_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_workspace_id_unique" UNIQUE("workspace_id")
);
--> statement-breakpoint
CREATE TABLE "gateway_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"encrypted_credentials" text NOT NULL,
	"encryption_key_version" text DEFAULT 'v1' NOT NULL,
	"webhook_url" text,
	"webhook_secret_hash" text,
	"status" text DEFAULT 'active' NOT NULL,
	"last_sync_at" timestamp with time zone,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "google_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"customer_id" text NOT NULL,
	"customer_name" text,
	"encrypted_access_token" text NOT NULL,
	"encrypted_refresh_token" text,
	"token_expires_at" timestamp with time zone,
	"encryption_key_version" text DEFAULT 'v1' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"last_sync_at" timestamp with time zone,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "meta_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"ad_account_id" text NOT NULL,
	"ad_account_name" text,
	"encrypted_access_token" text NOT NULL,
	"encrypted_refresh_token" text,
	"token_expires_at" timestamp with time zone,
	"encryption_key_version" text DEFAULT 'v1' NOT NULL,
	"pixel_id" text,
	"business_id" text,
	"status" text DEFAULT 'active' NOT NULL,
	"last_sync_at" timestamp with time zone,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "ad_creatives" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"ad_id" uuid,
	"provider_creative_id" text,
	"type" text,
	"title" text,
	"body" text,
	"video_url" text,
	"thumbnail_url" text,
	"duration_seconds" integer,
	"provider_data" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ad_insights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"ad_id" uuid NOT NULL,
	"date" date NOT NULL,
	"impressions" integer DEFAULT 0 NOT NULL,
	"clicks" integer DEFAULT 0 NOT NULL,
	"spend_cents" integer DEFAULT 0 NOT NULL,
	"reach" integer DEFAULT 0,
	"frequency" numeric(10, 4),
	"ctr" numeric(10, 6),
	"cpc_cents" integer,
	"cpm_cents" integer,
	"hook_rate" numeric(10, 4),
	"hold_rate_15s" numeric(10, 4),
	"hold_rate_30s" numeric(10, 4),
	"video_views" integer DEFAULT 0,
	"provider_data" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ad_insights_workspace_ad_date_unique" UNIQUE("workspace_id","ad_id","date")
);
--> statement-breakpoint
CREATE TABLE "ad_sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"provider_id" text NOT NULL,
	"name" text NOT NULL,
	"status" text NOT NULL,
	"targeting" jsonb,
	"provider_data" jsonb,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ad_sets_workspace_campaign_provider_unique" UNIQUE("workspace_id","campaign_id","provider_id")
);
--> statement-breakpoint
CREATE TABLE "ads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"ad_set_id" uuid NOT NULL,
	"provider_id" text NOT NULL,
	"name" text NOT NULL,
	"status" text NOT NULL,
	"creative_id" text,
	"provider_data" jsonb,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ads_workspace_adset_provider_unique" UNIQUE("workspace_id","ad_set_id","provider_id")
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"provider_id" text NOT NULL,
	"name" text NOT NULL,
	"status" text NOT NULL,
	"objective" text,
	"daily_budget_cents" integer,
	"lifetime_budget_cents" integer,
	"start_time" timestamp with time zone,
	"end_time" timestamp with time zone,
	"provider_data" jsonb,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "campaigns_workspace_provider_id_unique" UNIQUE("workspace_id","provider","provider_id")
);
--> statement-breakpoint
CREATE TABLE "gateway_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"connection_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"event_type" text NOT NULL,
	"provider_event_id" text NOT NULL,
	"product_id" text,
	"amount_cents" integer,
	"currency" text DEFAULT 'BRL',
	"customer_email_hash" text,
	"customer_phone_hash" text,
	"utm_source" text,
	"utm_medium" text,
	"utm_campaign" text,
	"utm_content" text,
	"utm_term" text,
	"fbclid" text,
	"gclid" text,
	"ttclid" text,
	"raw_payload" jsonb NOT NULL,
	"processed_at" timestamp with time zone,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "gateway_events_workspace_provider_event_unique" UNIQUE("workspace_id","provider","provider_event_id")
);
--> statement-breakpoint
CREATE TABLE "gateway_events_dlq" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"provider" text NOT NULL,
	"raw_payload" jsonb NOT NULL,
	"error_message" text,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"last_retry_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gateway_products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"connection_id" uuid NOT NULL,
	"provider_product_id" text NOT NULL,
	"name" text NOT NULL,
	"price_cents" integer,
	"product_type" text,
	"mapped_to_internal_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "gateway_products_workspace_conn_provider_unique" UNIQUE("workspace_id","connection_id","provider_product_id")
);
--> statement-breakpoint
CREATE TABLE "utm_mappings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"utm_source" text,
	"utm_medium" text,
	"utm_campaign" text,
	"utm_content" text,
	"utm_term" text,
	"ad_id" uuid,
	"confidence_score" numeric(5, 4),
	"strategy" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "utm_stitching_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"gateway_event_id" uuid NOT NULL,
	"matched_ad_id" uuid,
	"strategy_used" text,
	"confidence" numeric(5, 4),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analyses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"pipeline_id" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"input_type" text NOT NULL,
	"input_url" text,
	"input_text" text,
	"video_duration_seconds" integer,
	"credits_consumed" integer DEFAULT 0 NOT NULL,
	"credit_transaction_id" uuid,
	"trigger_job_id" text,
	"error_message" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analysis_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"analysis_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"pipeline_id" text NOT NULL,
	"result_data" jsonb NOT NULL,
	"model_used" text,
	"input_tokens" integer,
	"output_tokens" integer,
	"processing_time_ms" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "analysis_results_analysis_id_unique" UNIQUE("analysis_id")
);
--> statement-breakpoint
CREATE TABLE "references_lib" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"url" text,
	"thumbnail_url" text,
	"notes" text,
	"tags" text[],
	"created_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "capi_event_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"capi_event_id" uuid NOT NULL,
	"attempt" integer DEFAULT 1 NOT NULL,
	"request_payload" jsonb,
	"response_payload" jsonb,
	"http_status" integer,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "capi_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"gateway_event_id" uuid,
	"provider" text NOT NULL,
	"event_name" text NOT NULL,
	"event_id" text NOT NULL,
	"event_time" timestamp with time zone NOT NULL,
	"user_data" jsonb,
	"custom_data" jsonb,
	"status" text DEFAULT 'pending' NOT NULL,
	"response_data" jsonb,
	"event_match_quality" numeric(4, 2),
	"sent_at" timestamp with time zone,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "capi_events_workspace_provider_event_unique" UNIQUE("workspace_id","provider","event_id")
);
--> statement-breakpoint
CREATE TABLE "click_id_store" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"fbclid" text,
	"gclid" text,
	"ttclid" text,
	"msclkid" text,
	"landing_url" text,
	"user_agent_hash" text,
	"ip_hash" text,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consent_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"user_id" uuid,
	"session_id" text,
	"consent_mode_v2" jsonb NOT NULL,
	"ip_hash" text,
	"user_agent_hash" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alert_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"config" jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"rule_id" uuid,
	"type" text NOT NULL,
	"severity" text DEFAULT 'info' NOT NULL,
	"title" text NOT NULL,
	"message" text,
	"data" jsonb,
	"read_at" timestamp with time zone,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"data" jsonb,
	"channel" text DEFAULT 'in_app' NOT NULL,
	"read_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learning_signals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"analysis_id" uuid,
	"signal_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "matched_copy_patterns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"niche" text,
	"pattern_type" text NOT NULL,
	"pattern_data" jsonb NOT NULL,
	"performance_score" numeric(5, 4),
	"sample_size" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "measure_outcomes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"analysis_id" uuid NOT NULL,
	"measured_at" timestamp with time zone NOT NULL,
	"metric_type" text NOT NULL,
	"value_before" numeric(10, 4),
	"value_after" numeric(10, 4),
	"improvement_pct" numeric(10, 4),
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_user_id" uuid NOT NULL,
	"action" text NOT NULL,
	"target_type" text,
	"target_id" text,
	"payload" jsonb,
	"ip_hash" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "claude_request_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"analysis_id" uuid,
	"pipeline_id" text,
	"model" text NOT NULL,
	"input_tokens" integer NOT NULL,
	"output_tokens" integer NOT NULL,
	"latency_ms" integer,
	"cost_usd" numeric(10, 6),
	"prompt_version_id" uuid,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feature_flags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"rollout_percentage" integer DEFAULT 0,
	"config" jsonb,
	"updated_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "feature_flags_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "prompt_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pipeline_id" text NOT NULL,
	"version" text NOT NULL,
	"system_prompt" text NOT NULL,
	"user_prompt_template" text,
	"model" text NOT NULL,
	"max_tokens" integer,
	"temperature" numeric(3, 2),
	"status" text DEFAULT 'draft' NOT NULL,
	"canary_percentage" integer DEFAULT 0,
	"deployed_by" uuid,
	"deployed_at" timestamp with time zone,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "prompt_versions_pipeline_version_unique" UNIQUE("pipeline_id","version")
);
--> statement-breakpoint
CREATE TABLE "affiliate_commissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"affiliate_id" uuid NOT NULL,
	"referral_id" uuid NOT NULL,
	"subscription_payment_id" text,
	"amount_cents" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"approved_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "affiliate_referrals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"affiliate_id" uuid NOT NULL,
	"referred_workspace_id" uuid NOT NULL,
	"referral_code" text NOT NULL,
	"converted_at" timestamp with time zone,
	"first_payment_at" timestamp with time zone,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "affiliates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"referral_code" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"commission_rate" numeric(5, 4) DEFAULT '0.20' NOT NULL,
	"total_earned_cents" integer DEFAULT 0 NOT NULL,
	"total_paid_cents" integer DEFAULT 0 NOT NULL,
	"payout_method" text,
	"payout_details" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "affiliates_referral_code_unique" UNIQUE("referral_code")
);
--> statement-breakpoint
ALTER TABLE "workspace_invites" ADD CONSTRAINT "workspace_invites_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_invites" ADD CONSTRAINT "workspace_invites_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_balances" ADD CONSTRAINT "credit_balances_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pack_purchases" ADD CONSTRAINT "pack_purchases_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pack_purchases" ADD CONSTRAINT "pack_purchases_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pack_purchases" ADD CONSTRAINT "pack_purchases_package_id_credit_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."credit_packages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pipeline_costs" ADD CONSTRAINT "pipeline_costs_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pipeline_costs_history" ADD CONSTRAINT "pipeline_costs_history_changed_by_user_id_users_id_fk" FOREIGN KEY ("changed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gateway_connections" ADD CONSTRAINT "gateway_connections_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "google_connections" ADD CONSTRAINT "google_connections_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meta_connections" ADD CONSTRAINT "meta_connections_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ad_creatives" ADD CONSTRAINT "ad_creatives_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ad_creatives" ADD CONSTRAINT "ad_creatives_ad_id_ads_id_fk" FOREIGN KEY ("ad_id") REFERENCES "public"."ads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ad_insights" ADD CONSTRAINT "ad_insights_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ad_insights" ADD CONSTRAINT "ad_insights_ad_id_ads_id_fk" FOREIGN KEY ("ad_id") REFERENCES "public"."ads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ad_sets" ADD CONSTRAINT "ad_sets_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ad_sets" ADD CONSTRAINT "ad_sets_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ads" ADD CONSTRAINT "ads_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ads" ADD CONSTRAINT "ads_ad_set_id_ad_sets_id_fk" FOREIGN KEY ("ad_set_id") REFERENCES "public"."ad_sets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gateway_events" ADD CONSTRAINT "gateway_events_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gateway_events" ADD CONSTRAINT "gateway_events_connection_id_gateway_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."gateway_connections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gateway_events_dlq" ADD CONSTRAINT "gateway_events_dlq_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gateway_products" ADD CONSTRAINT "gateway_products_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gateway_products" ADD CONSTRAINT "gateway_products_connection_id_gateway_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."gateway_connections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "utm_mappings" ADD CONSTRAINT "utm_mappings_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "utm_mappings" ADD CONSTRAINT "utm_mappings_ad_id_ads_id_fk" FOREIGN KEY ("ad_id") REFERENCES "public"."ads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "utm_stitching_log" ADD CONSTRAINT "utm_stitching_log_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "utm_stitching_log" ADD CONSTRAINT "utm_stitching_log_gateway_event_id_gateway_events_id_fk" FOREIGN KEY ("gateway_event_id") REFERENCES "public"."gateway_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "utm_stitching_log" ADD CONSTRAINT "utm_stitching_log_matched_ad_id_ads_id_fk" FOREIGN KEY ("matched_ad_id") REFERENCES "public"."ads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analyses" ADD CONSTRAINT "analyses_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analyses" ADD CONSTRAINT "analyses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analyses" ADD CONSTRAINT "analyses_credit_transaction_id_credit_transactions_id_fk" FOREIGN KEY ("credit_transaction_id") REFERENCES "public"."credit_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analysis_results" ADD CONSTRAINT "analysis_results_analysis_id_analyses_id_fk" FOREIGN KEY ("analysis_id") REFERENCES "public"."analyses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analysis_results" ADD CONSTRAINT "analysis_results_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "references_lib" ADD CONSTRAINT "references_lib_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "references_lib" ADD CONSTRAINT "references_lib_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capi_event_log" ADD CONSTRAINT "capi_event_log_capi_event_id_capi_events_id_fk" FOREIGN KEY ("capi_event_id") REFERENCES "public"."capi_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capi_events" ADD CONSTRAINT "capi_events_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "capi_events" ADD CONSTRAINT "capi_events_gateway_event_id_gateway_events_id_fk" FOREIGN KEY ("gateway_event_id") REFERENCES "public"."gateway_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "click_id_store" ADD CONSTRAINT "click_id_store_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_logs" ADD CONSTRAINT "consent_logs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_logs" ADD CONSTRAINT "consent_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_rules" ADD CONSTRAINT "alert_rules_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_rule_id_alert_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."alert_rules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_signals" ADD CONSTRAINT "learning_signals_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_signals" ADD CONSTRAINT "learning_signals_analysis_id_analyses_id_fk" FOREIGN KEY ("analysis_id") REFERENCES "public"."analyses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matched_copy_patterns" ADD CONSTRAINT "matched_copy_patterns_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "measure_outcomes" ADD CONSTRAINT "measure_outcomes_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "measure_outcomes" ADD CONSTRAINT "measure_outcomes_analysis_id_analyses_id_fk" FOREIGN KEY ("analysis_id") REFERENCES "public"."analyses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_audit_log" ADD CONSTRAINT "admin_audit_log_admin_user_id_users_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claude_request_logs" ADD CONSTRAINT "claude_request_logs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claude_request_logs" ADD CONSTRAINT "claude_request_logs_prompt_version_id_prompt_versions_id_fk" FOREIGN KEY ("prompt_version_id") REFERENCES "public"."prompt_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feature_flags" ADD CONSTRAINT "feature_flags_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompt_versions" ADD CONSTRAINT "prompt_versions_deployed_by_users_id_fk" FOREIGN KEY ("deployed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_commissions" ADD CONSTRAINT "affiliate_commissions_affiliate_id_affiliates_id_fk" FOREIGN KEY ("affiliate_id") REFERENCES "public"."affiliates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_commissions" ADD CONSTRAINT "affiliate_commissions_referral_id_affiliate_referrals_id_fk" FOREIGN KEY ("referral_id") REFERENCES "public"."affiliate_referrals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_referrals" ADD CONSTRAINT "affiliate_referrals_affiliate_id_affiliates_id_fk" FOREIGN KEY ("affiliate_id") REFERENCES "public"."affiliates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_referrals" ADD CONSTRAINT "affiliate_referrals_referred_workspace_id_workspaces_id_fk" FOREIGN KEY ("referred_workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliates" ADD CONSTRAINT "affiliates_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliates" ADD CONSTRAINT "affiliates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "workspace_invites_workspace_id_idx" ON "workspace_invites" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "workspace_invites_email_idx" ON "workspace_invites" USING btree ("email");--> statement-breakpoint
CREATE INDEX "workspace_members_workspace_id_idx" ON "workspace_members" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "workspace_members_user_id_idx" ON "workspace_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "credit_balances_expiry_idx" ON "credit_balances" USING btree ("signup_expires_at","subscription_expires_at","admin_expires_at") WHERE balance > 0;--> statement-breakpoint
CREATE INDEX "credit_packages_active_idx" ON "credit_packages" USING btree ("active") WHERE active = true;--> statement-breakpoint
CREATE INDEX "credit_transactions_workspace_created_idx" ON "credit_transactions" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "credit_transactions_analysis_id_idx" ON "credit_transactions" USING btree ("analysis_id") WHERE analysis_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX "pack_purchases_workspace_active_idx" ON "pack_purchases" USING btree ("workspace_id","expires_at") WHERE status = 'active' AND credits_remaining > 0;--> statement-breakpoint
CREATE INDEX "pipeline_costs_history_pipeline_id_idx" ON "pipeline_costs_history" USING btree ("pipeline_id");--> statement-breakpoint
CREATE INDEX "subscriptions_status_idx" ON "subscriptions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "subscriptions_provider_sub_id_idx" ON "subscriptions" USING btree ("provider_subscription_id");--> statement-breakpoint
CREATE INDEX "gateway_connections_workspace_id_idx" ON "gateway_connections" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "gateway_connections_provider_idx" ON "gateway_connections" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "gateway_connections_status_idx" ON "gateway_connections" USING btree ("status");--> statement-breakpoint
CREATE INDEX "google_connections_workspace_id_idx" ON "google_connections" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "google_connections_status_idx" ON "google_connections" USING btree ("status");--> statement-breakpoint
CREATE INDEX "meta_connections_workspace_id_idx" ON "meta_connections" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "meta_connections_status_idx" ON "meta_connections" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ad_creatives_workspace_id_idx" ON "ad_creatives" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "ad_creatives_ad_id_idx" ON "ad_creatives" USING btree ("ad_id");--> statement-breakpoint
CREATE INDEX "ad_insights_workspace_id_idx" ON "ad_insights" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "ad_insights_ad_id_idx" ON "ad_insights" USING btree ("ad_id");--> statement-breakpoint
CREATE INDEX "ad_insights_date_idx" ON "ad_insights" USING btree ("date");--> statement-breakpoint
CREATE INDEX "ad_sets_workspace_id_idx" ON "ad_sets" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "ad_sets_campaign_id_idx" ON "ad_sets" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "ad_sets_status_idx" ON "ad_sets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ads_workspace_id_idx" ON "ads" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "ads_ad_set_id_idx" ON "ads" USING btree ("ad_set_id");--> statement-breakpoint
CREATE INDEX "ads_status_idx" ON "ads" USING btree ("status");--> statement-breakpoint
CREATE INDEX "campaigns_workspace_id_idx" ON "campaigns" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "campaigns_status_idx" ON "campaigns" USING btree ("status");--> statement-breakpoint
CREATE INDEX "campaigns_last_synced_at_idx" ON "campaigns" USING btree ("last_synced_at");--> statement-breakpoint
CREATE INDEX "gateway_events_workspace_id_idx" ON "gateway_events" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "gateway_events_event_type_idx" ON "gateway_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "gateway_events_processed_at_idx" ON "gateway_events" USING btree ("processed_at") WHERE processed_at IS NULL;--> statement-breakpoint
CREATE INDEX "gateway_events_dlq_workspace_id_idx" ON "gateway_events_dlq" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "gateway_events_dlq_resolved_at_idx" ON "gateway_events_dlq" USING btree ("resolved_at") WHERE resolved_at IS NULL;--> statement-breakpoint
CREATE INDEX "gateway_products_workspace_id_idx" ON "gateway_products" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "gateway_products_connection_id_idx" ON "gateway_products" USING btree ("connection_id");--> statement-breakpoint
CREATE INDEX "utm_mappings_workspace_id_idx" ON "utm_mappings" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "utm_mappings_ad_id_idx" ON "utm_mappings" USING btree ("ad_id");--> statement-breakpoint
CREATE INDEX "utm_stitching_log_workspace_id_idx" ON "utm_stitching_log" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "utm_stitching_log_gateway_event_id_idx" ON "utm_stitching_log" USING btree ("gateway_event_id");--> statement-breakpoint
CREATE INDEX "analyses_workspace_id_idx" ON "analyses" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "analyses_user_id_idx" ON "analyses" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "analyses_status_idx" ON "analyses" USING btree ("status");--> statement-breakpoint
CREATE INDEX "analyses_pipeline_id_idx" ON "analyses" USING btree ("pipeline_id");--> statement-breakpoint
CREATE INDEX "analyses_created_at_idx" ON "analyses" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "analysis_results_workspace_id_idx" ON "analysis_results" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "references_lib_workspace_id_idx" ON "references_lib" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "references_lib_type_idx" ON "references_lib" USING btree ("type");--> statement-breakpoint
CREATE INDEX "references_lib_created_by_idx" ON "references_lib" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "capi_event_log_capi_event_id_idx" ON "capi_event_log" USING btree ("capi_event_id");--> statement-breakpoint
CREATE INDEX "capi_events_workspace_id_idx" ON "capi_events" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "capi_events_status_idx" ON "capi_events" USING btree ("status");--> statement-breakpoint
CREATE INDEX "click_id_store_workspace_id_idx" ON "click_id_store" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "click_id_store_expires_at_idx" ON "click_id_store" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "click_id_store_fbclid_idx" ON "click_id_store" USING btree ("fbclid") WHERE fbclid IS NOT NULL;--> statement-breakpoint
CREATE INDEX "click_id_store_gclid_idx" ON "click_id_store" USING btree ("gclid") WHERE gclid IS NOT NULL;--> statement-breakpoint
CREATE INDEX "consent_logs_workspace_id_idx" ON "consent_logs" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "consent_logs_user_id_idx" ON "consent_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "consent_logs_created_at_idx" ON "consent_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "alert_rules_workspace_id_idx" ON "alert_rules" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "alert_rules_type_idx" ON "alert_rules" USING btree ("type");--> statement-breakpoint
CREATE INDEX "alert_rules_enabled_idx" ON "alert_rules" USING btree ("enabled");--> statement-breakpoint
CREATE INDEX "alerts_workspace_id_idx" ON "alerts" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "alerts_read_at_idx" ON "alerts" USING btree ("read_at") WHERE read_at IS NULL;--> statement-breakpoint
CREATE INDEX "alerts_severity_idx" ON "alerts" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "alerts_created_at_idx" ON "alerts" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "notifications_workspace_id_idx" ON "notifications" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "notifications_user_id_idx" ON "notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notifications_read_at_idx" ON "notifications" USING btree ("read_at") WHERE read_at IS NULL;--> statement-breakpoint
CREATE INDEX "notifications_created_at_idx" ON "notifications" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "learning_signals_workspace_id_idx" ON "learning_signals" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "learning_signals_analysis_id_idx" ON "learning_signals" USING btree ("analysis_id");--> statement-breakpoint
CREATE INDEX "learning_signals_signal_type_idx" ON "learning_signals" USING btree ("signal_type");--> statement-breakpoint
CREATE INDEX "matched_copy_patterns_workspace_id_idx" ON "matched_copy_patterns" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "matched_copy_patterns_niche_idx" ON "matched_copy_patterns" USING btree ("niche");--> statement-breakpoint
CREATE INDEX "matched_copy_patterns_pattern_type_idx" ON "matched_copy_patterns" USING btree ("pattern_type");--> statement-breakpoint
CREATE INDEX "measure_outcomes_workspace_id_idx" ON "measure_outcomes" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "measure_outcomes_analysis_id_idx" ON "measure_outcomes" USING btree ("analysis_id");--> statement-breakpoint
CREATE INDEX "measure_outcomes_metric_type_idx" ON "measure_outcomes" USING btree ("metric_type");--> statement-breakpoint
CREATE INDEX "measure_outcomes_measured_at_idx" ON "measure_outcomes" USING btree ("measured_at");--> statement-breakpoint
CREATE INDEX "admin_audit_log_admin_user_id_idx" ON "admin_audit_log" USING btree ("admin_user_id");--> statement-breakpoint
CREATE INDEX "admin_audit_log_action_idx" ON "admin_audit_log" USING btree ("action");--> statement-breakpoint
CREATE INDEX "admin_audit_log_target_type_idx" ON "admin_audit_log" USING btree ("target_type");--> statement-breakpoint
CREATE INDEX "admin_audit_log_created_at_idx" ON "admin_audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "claude_request_logs_workspace_id_idx" ON "claude_request_logs" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "claude_request_logs_pipeline_id_idx" ON "claude_request_logs" USING btree ("pipeline_id");--> statement-breakpoint
CREATE INDEX "claude_request_logs_created_at_idx" ON "claude_request_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "claude_request_logs_model_idx" ON "claude_request_logs" USING btree ("model");--> statement-breakpoint
CREATE INDEX "prompt_versions_pipeline_id_idx" ON "prompt_versions" USING btree ("pipeline_id");--> statement-breakpoint
CREATE INDEX "prompt_versions_status_idx" ON "prompt_versions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "affiliate_commissions_affiliate_id_idx" ON "affiliate_commissions" USING btree ("affiliate_id");--> statement-breakpoint
CREATE INDEX "affiliate_commissions_status_idx" ON "affiliate_commissions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "affiliate_commissions_created_at_idx" ON "affiliate_commissions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "affiliate_referrals_affiliate_id_idx" ON "affiliate_referrals" USING btree ("affiliate_id");--> statement-breakpoint
CREATE INDEX "affiliate_referrals_referred_workspace_id_idx" ON "affiliate_referrals" USING btree ("referred_workspace_id");--> statement-breakpoint
CREATE INDEX "affiliates_user_id_idx" ON "affiliates" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "affiliates_status_idx" ON "affiliates" USING btree ("status");