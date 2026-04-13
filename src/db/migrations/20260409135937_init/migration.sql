CREATE TABLE "events" (
	"id" text PRIMARY KEY,
	"title" text NOT NULL,
	"description" text,
	"location" text,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"category" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shifts" (
	"id" text PRIMARY KEY,
	"title" text NOT NULL,
	"description" text,
	"location" text,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"capacity" integer DEFAULT 1 NOT NULL,
	"department_id" text NOT NULL,
	"team_id" text,
	"event_id" text,
	"category" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assignments" (
	"id" text PRIMARY KEY,
	"shift_id" text NOT NULL,
	"critter_user_id" text NOT NULL,
	"status" text DEFAULT 'requested' NOT NULL,
	"requested_at" timestamp DEFAULT now() NOT NULL,
	"decided_at" timestamp,
	"decided_by" text,
	"decline_reason" text,
	"withdrawn_at" timestamp,
	"request_note" text
);
--> statement-breakpoint
CREATE TABLE "assignment_history" (
	"id" text PRIMARY KEY,
	"assignment_id" text NOT NULL,
	"from_status" text,
	"to_status" text NOT NULL,
	"changed_by" text NOT NULL,
	"changed_at" timestamp DEFAULT now() NOT NULL,
	"reason" text
);
--> statement-breakpoint
CREATE TABLE "critter_profiles" (
	"user_id" text PRIMARY KEY,
	"shirt_size" text,
	"dietary" text,
	"emergency_contact" text,
	"skills" text[],
	"availability_note" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" text PRIMARY KEY DEFAULT 'singleton',
	"convention_name" text DEFAULT 'Convention' NOT NULL,
	"convention_tz" text DEFAULT 'UTC' NOT NULL,
	"convention_starts_on" timestamp with time zone,
	"convention_ends_on" timestamp with time zone,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" text
);
--> statement-breakpoint
CREATE INDEX "events_time_idx" ON "events" ("starts_at","ends_at");--> statement-breakpoint
CREATE INDEX "events_status_idx" ON "events" ("status");--> statement-breakpoint
CREATE INDEX "shifts_time_idx" ON "shifts" ("starts_at","ends_at");--> statement-breakpoint
CREATE INDEX "shifts_dept_idx" ON "shifts" ("department_id");--> statement-breakpoint
CREATE INDEX "shifts_status_idx" ON "shifts" ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "assignments_unique_active" ON "assignments" ("shift_id","critter_user_id") WHERE "status" != 'withdrawn';--> statement-breakpoint
CREATE INDEX "assignments_shift_idx" ON "assignments" ("shift_id");--> statement-breakpoint
CREATE INDEX "assignments_user_idx" ON "assignments" ("critter_user_id");--> statement-breakpoint
CREATE INDEX "assignments_status_idx" ON "assignments" ("status");--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_event_id_events_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_shift_id_shifts_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "shifts"("id") ON DELETE CASCADE;