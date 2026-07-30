ALTER TABLE "snapshots" ALTER COLUMN "save_id" DROP NOT NULL;
ALTER TABLE "snapshots" ADD COLUMN "scenarios_id" uuid;
ALTER TABLE "snapshots" ADD CONSTRAINT "snapshots_scenarios_id_scenarios_id_fk" FOREIGN KEY ("scenarios_id") REFERENCES "public"."scenarios"("id") ON DELETE cascade ON UPDATE no action;
