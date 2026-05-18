CREATE TYPE "public"."exercise_type" AS ENUM('mcq', 'fill_blank', 'translate_fr_en', 'translate_en_fr', 'short_writing', 'reading_comprehension', 'vocab_recall');--> statement-breakpoint
CREATE TYPE "public"."knowledge_kind" AS ENUM('vocab', 'grammar_rule');--> statement-breakpoint
CREATE TYPE "public"."skill_kind" AS ENUM('reading', 'writing', 'vocab', 'grammar');--> statement-breakpoint
CREATE TYPE "public"."turn_role" AS ENUM('user', 'assistant', 'tool', 'system_summary');--> statement-breakpoint
CREATE TABLE "attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"exercise_id" uuid NOT NULL,
	"response" text NOT NULL,
	"score" numeric(3, 2) NOT NULL,
	"feedback" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversation_turns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"role" "turn_role" NOT NULL,
	"content" text NOT NULL,
	"tool_name" text,
	"tool_payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exercises" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "exercise_type" NOT NULL,
	"skill" "skill_kind" NOT NULL,
	"cefr" numeric(4, 2) NOT NULL,
	"topic" text NOT NULL,
	"domain" text NOT NULL,
	"payload" jsonb NOT NULL,
	"answer_key" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" "knowledge_kind" NOT NULL,
	"value" text NOT NULL,
	"mastery" integer DEFAULT 0 NOT NULL,
	"next_review_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mastery_range" CHECK ("knowledge_items"."mastery" BETWEEN 0 AND 5)
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"domains" text[] DEFAULT '{}'::text[] NOT NULL,
	"interests" text[] DEFAULT '{}'::text[] NOT NULL,
	"goal_text" text DEFAULT '' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skill_levels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"skill" "skill_kind" NOT NULL,
	"cefr_estimate" numeric(4, 2) NOT NULL,
	"confidence" numeric(3, 2) DEFAULT '0.30' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "skill_levels_user_skill_uq" UNIQUE("user_id","skill")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"target_cefr" text DEFAULT 'C2' NOT NULL,
	"ui_lang" text DEFAULT 'fr' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_turns" ADD CONSTRAINT "conversation_turns_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_items" ADD CONSTRAINT "knowledge_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_levels" ADD CONSTRAINT "skill_levels_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attempts_user_created_idx" ON "attempts" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "conv_user_session_created_idx" ON "conversation_turns" USING btree ("user_id","session_id","created_at");--> statement-breakpoint
CREATE INDEX "exercises_user_created_idx" ON "exercises" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "knowledge_user_review_idx" ON "knowledge_items" USING btree ("user_id","next_review_at");