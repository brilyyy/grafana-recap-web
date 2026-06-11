CREATE TYPE "public"."error_type" AS ENUM('S', 'N', 'Sukses');--> statement-breakpoint
CREATE TYPE "public"."request_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."requested_role" AS ENUM('admin', 'user');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('superadmin', 'admin', 'user');--> statement-breakpoint
CREATE TABLE "app_identifier" (
	"id" serial PRIMARY KEY NOT NULL,
	"app_name" varchar(255) NOT NULL,
	"db_name" varchar(255),
	"raw_table_name" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "app_identifier_app_name_unique" UNIQUE("app_name")
);
--> statement-breakpoint
CREATE TABLE "app_success_rate" (
	"id" serial PRIMARY KEY NOT NULL,
	"id_app_identifier" integer NOT NULL,
	"tanggal_transaksi" date NOT NULL,
	"bulan" varchar(20) NOT NULL,
	"tahun" integer NOT NULL,
	"jenis_transaksi" varchar(255) NOT NULL,
	"rc" varchar(255),
	"rc_description" varchar(500),
	"total_transaksi" integer,
	"total_nominal" numeric(20, 2),
	"total_biaya_admin" numeric(20, 2),
	"status_transaksi" varchar(255),
	"error_type" "error_type",
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"account_id" varchar(255) NOT NULL,
	"provider_id" varchar(255) NOT NULL,
	"user_id" integer NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pending_user_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"requested_role" "requested_role" NOT NULL,
	"requested_by" integer,
	"status" "request_status" DEFAULT 'pending' NOT NULL,
	"approved_role" "user_role",
	"approved_by" integer,
	"rejected_by" integer,
	"rejection_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "pending_user_requests_username_unique" UNIQUE("username"),
	CONSTRAINT "pending_user_requests_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"ip_address" varchar(255),
	"user_agent" text,
	"user_id" integer NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"name" varchar(255),
	"email_verified" integer DEFAULT 0,
	"image" varchar(500),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"identifier" varchar(255) NOT NULL,
	"value" varchar(255) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "response_code_dictionary" (
	"id" serial PRIMARY KEY NOT NULL,
	"id_app_identifier" integer NOT NULL,
	"jenis_transaksi" varchar(255),
	"rc" varchar(255),
	"rc_description" varchar(500),
	"error_type" "error_type" NOT NULL,
	CONSTRAINT "unique_dictionary_entry" UNIQUE("id_app_identifier","jenis_transaksi","rc")
);
--> statement-breakpoint
CREATE TABLE "unmapped_rc" (
	"id" serial PRIMARY KEY NOT NULL,
	"id_app_identifier" integer NOT NULL,
	"jenis_transaksi" varchar(255),
	"rc" varchar(255),
	"rc_description" varchar(500),
	"status_transaksi" varchar(255),
	"error_type" "error_type",
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "unique_unmapped_rc_entry" UNIQUE("id_app_identifier","jenis_transaksi","rc")
);
--> statement-breakpoint
CREATE TABLE "app_processing_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"app_name" varchar(255) NOT NULL,
	"id_app_identifier" integer NOT NULL,
	"processing_date" date NOT NULL,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp,
	"status" varchar(20) NOT NULL,
	"records_processed" integer DEFAULT 0,
	"records_inserted" integer DEFAULT 0,
	"records_skipped" integer DEFAULT 0,
	"error_message" text,
	"recap_kind" varchar(64) DEFAULT 'success_rate_daily' NOT NULL,
	"catalog_entry_id" varchar(128),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"username" varchar(255),
	"action" varchar(255) NOT NULL,
	"resource_type" varchar(255) NOT NULL,
	"resource_id" varchar(255),
	"details" text,
	"ip_address" varchar(45),
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"ip_address" varchar(45) NOT NULL,
	"endpoint" varchar(255) NOT NULL,
	"blocked_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app_success_rate" ADD CONSTRAINT "app_success_rate_id_app_identifier_app_identifier_id_fk" FOREIGN KEY ("id_app_identifier") REFERENCES "public"."app_identifier"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_user_requests" ADD CONSTRAINT "pending_user_requests_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_user_requests" ADD CONSTRAINT "pending_user_requests_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_user_requests" ADD CONSTRAINT "pending_user_requests_rejected_by_users_id_fk" FOREIGN KEY ("rejected_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "response_code_dictionary" ADD CONSTRAINT "response_code_dictionary_id_app_identifier_app_identifier_id_fk" FOREIGN KEY ("id_app_identifier") REFERENCES "public"."app_identifier"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unmapped_rc" ADD CONSTRAINT "unmapped_rc_id_app_identifier_app_identifier_id_fk" FOREIGN KEY ("id_app_identifier") REFERENCES "public"."app_identifier"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_processing_log" ADD CONSTRAINT "app_processing_log_id_app_identifier_app_identifier_id_fk" FOREIGN KEY ("id_app_identifier") REFERENCES "public"."app_identifier"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_tanggal_transaksi" ON "app_success_rate" USING btree ("tanggal_transaksi");--> statement-breakpoint
CREATE INDEX "idx_id_app_identifier" ON "app_success_rate" USING btree ("id_app_identifier");--> statement-breakpoint
CREATE INDEX "idx_pur_status" ON "pending_user_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_pur_requested_by" ON "pending_user_requests" USING btree ("requested_by");--> statement-breakpoint
CREATE INDEX "idx_username" ON "users" USING btree ("username");--> statement-breakpoint
CREATE INDEX "idx_email" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_app_processing_date" ON "app_processing_log" USING btree ("app_name","processing_date");--> statement-breakpoint
CREATE INDEX "idx_apl_status" ON "app_processing_log" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "idx_app_processing_log_processing_date" ON "app_processing_log" USING btree ("processing_date");--> statement-breakpoint
CREATE INDEX "idx_apl_catalog_entry_date" ON "app_processing_log" USING btree ("catalog_entry_id","processing_date");--> statement-breakpoint
CREATE INDEX "idx_audit_user_id" ON "audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_audit_action" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "idx_audit_resource_type" ON "audit_logs" USING btree ("resource_type");--> statement-breakpoint
CREATE INDEX "idx_audit_created_at" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_ip_endpoint" ON "rate_limit_logs" USING btree ("ip_address","endpoint");--> statement-breakpoint
CREATE INDEX "idx_blocked_at" ON "rate_limit_logs" USING btree ("blocked_at");