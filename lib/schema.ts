import { bigint, index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const entries = pgTable("entries", {
  id: bigint("id", { mode: "number" }).generatedAlwaysAsIdentity().primaryKey(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }).notNull(),
  category: text("category").notNull(),
  activity: text("activity").notNull(),
  note: text("note"),
  source: text("source").notNull().default("default"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("entries_started_at_idx").on(t.startedAt),
  index("entries_category_idx").on(t.category),
]);
