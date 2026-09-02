import { sql } from "drizzle-orm";
import { bigint, check, index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const entries = pgTable(
  "entries",
  {
    id: bigint("id", { mode: "number" }).generatedAlwaysAsIdentity().primaryKey(),
    type: integer("type").notNull(),
    note: text("note"),
    taskTitle: text("task_title"),
    projectName: text("project_name"),
    startTime: timestamp("start_time", { withTimezone: true }).notNull(),
    endTime: timestamp("end_time", { withTimezone: true }).notNull(),
    duration: integer("duration").notNull(),
    pauseDuration: integer("pause_duration").notNull(),
    source: text("source").notNull().default("default"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("entries_start_time_idx").on(t.startTime),
    index("entries_project_name_idx").on(t.projectName),
    check("entries_type_check", sql`${t.type} in (0, 1)`),
    check("entries_duration_check", sql`${t.duration} >= 0`),
    check("entries_pause_duration_check", sql`${t.pauseDuration} >= 0`),
  ],
);
