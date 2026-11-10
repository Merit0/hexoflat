CREATE TYPE "public"."account_role" AS ENUM('player', 'creator', 'admin');--> statement-breakpoint
CREATE TYPE "public"."command_result" AS ENUM('applied', 'rejected', 'conflict');--> statement-breakpoint
CREATE TABLE "account_roles" (
	"user_id" uuid NOT NULL,
	"role" "account_role" NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"granted_by" uuid,
	CONSTRAINT "account_roles_user_id_role_pk" PRIMARY KEY("user_id","role")
);
--> statement-breakpoint
CREATE TABLE "aggregate_snapshots" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"hero_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"revision" integer NOT NULL,
	"state" jsonb NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "command_journal" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"command_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"hero_id" uuid NOT NULL,
	"expedition_id" uuid,
	"aggregate_kind" text NOT NULL,
	"command_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"expected_revision" integer,
	"result" "command_result" NOT NULL,
	"reason" text,
	"events" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"new_revision" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "command_journal_command_id_unique" UNIQUE("command_id")
);
--> statement-breakpoint
CREATE TABLE "hero_aggregates" (
	"hero_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"revision" integer NOT NULL,
	"schema_version" integer NOT NULL,
	"content_version" text NOT NULL,
	"state" jsonb NOT NULL,
	"server_state" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hero_aggregates_hero_id_kind_pk" PRIMARY KEY("hero_id","kind")
);
--> statement-breakpoint
CREATE TABLE "item_ledger" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"hero_id" uuid NOT NULL,
	"command_id" uuid NOT NULL,
	"item_key" text NOT NULL,
	"item_instance_id" uuid,
	"delta" integer NOT NULL,
	"balance_after" integer NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "heroes" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "heroes" ADD COLUMN "is_sandbox" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "account_roles" ADD CONSTRAINT "account_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_roles" ADD CONSTRAINT "account_roles_granted_by_users_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aggregate_snapshots" ADD CONSTRAINT "aggregate_snapshots_hero_id_heroes_id_fk" FOREIGN KEY ("hero_id") REFERENCES "public"."heroes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "command_journal" ADD CONSTRAINT "command_journal_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "command_journal" ADD CONSTRAINT "command_journal_hero_id_heroes_id_fk" FOREIGN KEY ("hero_id") REFERENCES "public"."heroes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hero_aggregates" ADD CONSTRAINT "hero_aggregates_hero_id_heroes_id_fk" FOREIGN KEY ("hero_id") REFERENCES "public"."heroes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_ledger" ADD CONSTRAINT "item_ledger_hero_id_heroes_id_fk" FOREIGN KEY ("hero_id") REFERENCES "public"."heroes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "aggregate_snapshots_hero_kind_idx" ON "aggregate_snapshots" USING btree ("hero_id","kind","revision");--> statement-breakpoint
CREATE INDEX "command_journal_hero_created_idx" ON "command_journal" USING btree ("hero_id","created_at");--> statement-breakpoint
CREATE INDEX "item_ledger_hero_item_idx" ON "item_ledger" USING btree ("hero_id","item_key","created_at");
--> statement-breakpoint
UPDATE "heroes" SET "data" = "data" - 'coins';
