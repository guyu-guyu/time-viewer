ALTER TABLE "entries" RENAME COLUMN "started_at" TO "start_time";--> statement-breakpoint
ALTER TABLE "entries" RENAME COLUMN "ended_at" TO "end_time";--> statement-breakpoint
ALTER TABLE "entries" RENAME COLUMN "category" TO "project_name";--> statement-breakpoint
ALTER TABLE "entries" RENAME COLUMN "activity" TO "task_title";--> statement-breakpoint
ALTER INDEX "entries_started_at_idx" RENAME TO "entries_start_time_idx";--> statement-breakpoint
ALTER INDEX "entries_category_idx" RENAME TO "entries_project_name_idx";--> statement-breakpoint
ALTER TABLE "entries" ALTER COLUMN "project_name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "entries" ALTER COLUMN "task_title" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "entries" ADD COLUMN "type" integer;--> statement-breakpoint
ALTER TABLE "entries" ADD COLUMN "duration" integer;--> statement-breakpoint
ALTER TABLE "entries" ADD COLUMN "pause_duration" integer;--> statement-breakpoint
UPDATE "entries"
SET
  "type" = 1,
  "duration" = least(
    2147483647,
    greatest(0, round(extract(epoch from ("end_time" - "start_time")) * 1000))
  )::integer,
  "pause_duration" = 0;--> statement-breakpoint
ALTER TABLE "entries" ALTER COLUMN "type" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "entries" ALTER COLUMN "duration" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "entries" ALTER COLUMN "pause_duration" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_type_check" CHECK ("type" in (0, 1));--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_duration_check" CHECK ("duration" >= 0);--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_pause_duration_check" CHECK ("pause_duration" >= 0);
