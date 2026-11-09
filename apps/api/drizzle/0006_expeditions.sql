CREATE TABLE "expedition_blobs" (
	"expedition_id" uuid NOT NULL,
	"key" text NOT NULL,
	"data" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "expedition_blobs_expedition_id_key_pk" PRIMARY KEY("expedition_id","key")
);
--> statement-breakpoint
CREATE TABLE "expedition_members" (
	"expedition_id" uuid NOT NULL,
	"hero_id" uuid NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"left_at" timestamp with time zone,
	"controlled_by_user_id" uuid,
	CONSTRAINT "expedition_members_expedition_id_hero_id_pk" PRIMARY KEY("expedition_id","hero_id")
);
--> statement-breakpoint
CREATE TABLE "expeditions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"host_user_id" uuid NOT NULL,
	"kind" text DEFAULT 'world' NOT NULL,
	"seed" text NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "expedition_blobs" ADD CONSTRAINT "expedition_blobs_expedition_id_expeditions_id_fk" FOREIGN KEY ("expedition_id") REFERENCES "public"."expeditions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expedition_members" ADD CONSTRAINT "expedition_members_expedition_id_expeditions_id_fk" FOREIGN KEY ("expedition_id") REFERENCES "public"."expeditions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expedition_members" ADD CONSTRAINT "expedition_members_hero_id_heroes_id_fk" FOREIGN KEY ("hero_id") REFERENCES "public"."heroes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expedition_members" ADD CONSTRAINT "expedition_members_controlled_by_user_id_users_id_fk" FOREIGN KEY ("controlled_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expeditions" ADD CONSTRAINT "expeditions_host_user_id_users_id_fk" FOREIGN KEY ("host_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "expeditions_host_idx" ON "expeditions" USING btree ("host_user_id","status");