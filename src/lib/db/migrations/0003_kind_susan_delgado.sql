CREATE TABLE "meta_ad_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connection_id" uuid NOT NULL,
	"ad_account_id" text NOT NULL,
	"ad_account_name" text,
	"business_id" text,
	"currency" text,
	"timezone_name" text,
	"account_status" integer,
	"is_default" boolean DEFAULT false NOT NULL,
	"last_sync_at" timestamp with time zone,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "meta_ad_accounts_connection_account_unique" UNIQUE("connection_id","ad_account_id")
);
--> statement-breakpoint
CREATE TABLE "meta_data_deletion_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"app_scoped_user_id" text NOT NULL,
	"signed_request_payload" jsonb NOT NULL,
	"confirmation_code" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"processed_at" timestamp with time zone,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "meta_data_deletion_confirmation_unique" UNIQUE("confirmation_code")
);
--> statement-breakpoint
DROP INDEX "meta_connections_workspace_id_idx";--> statement-breakpoint
ALTER TABLE "meta_connections" ALTER COLUMN "ad_account_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "meta_connections" ADD COLUMN "meta_user_id" text;--> statement-breakpoint
ALTER TABLE "meta_connections" ADD COLUMN "meta_user_name" text;--> statement-breakpoint
ALTER TABLE "meta_connections" ADD COLUMN "meta_user_email" text;--> statement-breakpoint
ALTER TABLE "meta_connections" ADD COLUMN "system_user_id" text;--> statement-breakpoint
ALTER TABLE "meta_connections" ADD COLUMN "is_system_user_token" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "meta_connections" ADD COLUMN "granted_scopes" jsonb;--> statement-breakpoint
ALTER TABLE "meta_connections" ADD COLUMN "access_tier" text DEFAULT 'standard' NOT NULL;--> statement-breakpoint
ALTER TABLE "meta_connections" ADD COLUMN "business_verification_status" text DEFAULT 'not_started' NOT NULL;--> statement-breakpoint
ALTER TABLE "meta_connections" ADD COLUMN "verified_domains" jsonb;--> statement-breakpoint
ALTER TABLE "meta_connections" ADD COLUMN "marketing_api_version" text DEFAULT 'v24.0' NOT NULL;--> statement-breakpoint
ALTER TABLE "meta_connections" ADD COLUMN "partner_agent" text DEFAULT 'criation-io-v1' NOT NULL;--> statement-breakpoint
ALTER TABLE "meta_connections" ADD COLUMN "last_token_refresh_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "meta_connections" ADD COLUMN "token_refresh_failures" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "meta_connections" ADD COLUMN "test_event_code" text;--> statement-breakpoint
ALTER TABLE "meta_ad_accounts" ADD CONSTRAINT "meta_ad_accounts_connection_id_meta_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."meta_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "meta_ad_accounts_connection_id_idx" ON "meta_ad_accounts" USING btree ("connection_id");--> statement-breakpoint
CREATE INDEX "meta_ad_accounts_default_idx" ON "meta_ad_accounts" USING btree ("connection_id","is_default");--> statement-breakpoint
CREATE INDEX "meta_data_deletion_app_scoped_user_idx" ON "meta_data_deletion_requests" USING btree ("app_scoped_user_id");--> statement-breakpoint
CREATE INDEX "meta_data_deletion_status_idx" ON "meta_data_deletion_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "meta_connections_token_expires_idx" ON "meta_connections" USING btree ("token_expires_at");--> statement-breakpoint
ALTER TABLE "meta_connections" ADD CONSTRAINT "meta_connections_workspace_id_unique" UNIQUE("workspace_id");