CREATE TABLE "gateway_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"connection_id" uuid NOT NULL,
	"subscriber_code" text NOT NULL,
	"plan_id" text,
	"product_id" text,
	"status" text NOT NULL,
	"accession_date" timestamp with time zone,
	"end_accession_date" timestamp with time zone,
	"next_charge_date" timestamp with time zone,
	"current_recurrence" integer DEFAULT 1 NOT NULL,
	"cancellation_reason" text,
	"monthly_value_cents" integer,
	"currency" text DEFAULT 'BRL',
	"origin" jsonb,
	"identified_visitor_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "gateway_subscriptions_workspace_conn_subscriber_unique" UNIQUE("workspace_id","connection_id","subscriber_code")
);
--> statement-breakpoint
ALTER TABLE "gateway_connections" ADD COLUMN "webhook_secret" text;--> statement-breakpoint
ALTER TABLE "gateway_connections" ADD COLUMN "api_credentials" jsonb;--> statement-breakpoint
ALTER TABLE "gateway_connections" ADD COLUMN "webhook_version" text DEFAULT 'v2';--> statement-breakpoint
ALTER TABLE "gateway_connections" ADD COLUMN "provider_subaccount_id" text;--> statement-breakpoint
ALTER TABLE "gateway_connections" ADD COLUMN "last_webhook_event_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "gateway_connections" ADD COLUMN "last_webhook_event_id" text;--> statement-breakpoint
ALTER TABLE "gateway_connections" ADD COLUMN "webhook_failures_24h" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "gateway_events" ADD COLUMN "provider_event_version" text;--> statement-breakpoint
ALTER TABLE "gateway_events" ADD COLUMN "recurrence_number" integer;--> statement-breakpoint
ALTER TABLE "gateway_events" ADD COLUMN "subscriber_code" text;--> statement-breakpoint
ALTER TABLE "gateway_events" ADD COLUMN "subscription_status" text;--> statement-breakpoint
ALTER TABLE "gateway_events" ADD COLUMN "plan_id" text;--> statement-breakpoint
ALTER TABLE "gateway_events" ADD COLUMN "payment_method" text;--> statement-breakpoint
ALTER TABLE "gateway_events" ADD COLUMN "installments_number" integer;--> statement-breakpoint
ALTER TABLE "gateway_events" ADD COLUMN "fee_cents" integer;--> statement-breakpoint
ALTER TABLE "gateway_events" ADD COLUMN "producer_net_cents" integer;--> statement-breakpoint
ALTER TABLE "gateway_events" ADD COLUMN "commission_affiliate_cents" integer;--> statement-breakpoint
ALTER TABLE "gateway_events" ADD COLUMN "affiliate_email_hash" text;--> statement-breakpoint
ALTER TABLE "gateway_events" ADD COLUMN "affiliate_source" text;--> statement-breakpoint
ALTER TABLE "gateway_events" ADD COLUMN "origin" jsonb;--> statement-breakpoint
ALTER TABLE "gateway_events" ADD COLUMN "external_code" text;--> statement-breakpoint
ALTER TABLE "gateway_events" ADD COLUMN "buyer_country" text;--> statement-breakpoint
ALTER TABLE "gateway_events" ADD COLUMN "buyer_document_hash" text;--> statement-breakpoint
ALTER TABLE "gateway_events" ADD COLUMN "creation_date_ms" bigint;--> statement-breakpoint
ALTER TABLE "gateway_events" ADD COLUMN "allocation_status" text DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "gateway_events" ADD COLUMN "allocation_idempotency_key" text;--> statement-breakpoint
ALTER TABLE "gateway_products" ADD COLUMN "ucode" text;--> statement-breakpoint
ALTER TABLE "gateway_products" ADD COLUMN "format" text;--> statement-breakpoint
ALTER TABLE "gateway_products" ADD COLUMN "is_subscription" boolean;--> statement-breakpoint
ALTER TABLE "gateway_products" ADD COLUMN "warranty_days" integer;--> statement-breakpoint
ALTER TABLE "gateway_products" ADD COLUMN "default_currency" text;--> statement-breakpoint
ALTER TABLE "gateway_subscriptions" ADD CONSTRAINT "gateway_subscriptions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gateway_subscriptions" ADD CONSTRAINT "gateway_subscriptions_connection_id_gateway_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."gateway_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "gateway_subscriptions_workspace_id_idx" ON "gateway_subscriptions" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "gateway_subscriptions_connection_id_idx" ON "gateway_subscriptions" USING btree ("connection_id");--> statement-breakpoint
CREATE INDEX "gateway_subscriptions_status_idx" ON "gateway_subscriptions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "gateway_subscriptions_next_charge_active_idx" ON "gateway_subscriptions" USING btree ("next_charge_date") WHERE status = 'ACTIVE';--> statement-breakpoint
CREATE UNIQUE INDEX "gateway_connections_workspace_provider_active_unique" ON "gateway_connections" USING btree ("workspace_id","provider") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "gateway_events_subscriber_code_idx" ON "gateway_events" USING btree ("subscriber_code");--> statement-breakpoint
CREATE INDEX "gateway_events_external_code_idx" ON "gateway_events" USING btree ("external_code");