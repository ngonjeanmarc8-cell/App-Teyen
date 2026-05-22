CREATE TYPE "public"."mission_run_status" AS ENUM('in_progress', 'success', 'incomplete');--> statement-breakpoint
CREATE TABLE "mission_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"mission_id" text NOT NULL,
	"status" "mission_run_status" DEFAULT 'in_progress' NOT NULL,
	"turn_count" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "mission_turns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"role" "turn_role" NOT NULL,
	"content" text NOT NULL,
	"correction" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mission_runs" ADD CONSTRAINT "mission_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mission_turns" ADD CONSTRAINT "mission_turns_run_id_mission_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."mission_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mission_runs_user_started_idx" ON "mission_runs" USING btree ("user_id","started_at");--> statement-breakpoint
CREATE INDEX "mission_turns_run_created_idx" ON "mission_turns" USING btree ("run_id","created_at");