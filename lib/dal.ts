import "server-only";

import { cache } from "react";
import { and, desc, eq, gte, ilike, lt, or, sql } from "drizzle-orm";

import { auth } from "@/auth";
import { db } from "./db";
import { entries } from "./schema";
import { addDay, dayStartInTz, getDisplayTz } from "./time";
import type {
  ActivityTotal,
  CategoryTotal,
  CommonFilter,
  DailyTotal,
  EntryDTO,
} from "./types";

/** 安全边界：无有效会话即 throw；cache() 是请求级去重（性能优化，非安全机制） */
export const requireOwner = cache(async () => {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHORIZED");
  return { userId: process.env.OWNER_GITHUB_ID! };
});

function matchFilter(filter: CommonFilter) {
  const conds = [];
  if (filter.category) conds.push(eq(entries.category, filter.category));
  if (filter.q) {
    conds.push(or(ilike(entries.note, `%${filter.q}%`), ilike(entries.activity, `%${filter.q}%`)));
  }
  return conds.length > 0 ? and(...conds) : undefined;
}

function rangeToInstants(range: { from: string; to: string }) {
  return {
    start: dayStartInTz(range.from),
    end: dayStartInTz(addDay(range.to, 1)),
  };
}

const minutesExpr = sql<number>`coalesce(round(sum(extract(epoch from (${entries.endedAt} - ${entries.startedAt})) / 60))::int, 0)`;

const entryColumns = {
  id: entries.id,
  startedAt: entries.startedAt,
  endedAt: entries.endedAt,
  category: entries.category,
  activity: entries.activity,
  note: entries.note,
};

type EntryRow = {
  id: number;
  startedAt: Date;
  endedAt: Date;
  category: string;
  activity: string;
  note: string | null;
};

function toDTO(r: EntryRow): EntryDTO {
  return {
    id: r.id,
    startedAt: r.startedAt,
    endedAt: r.endedAt,
    durationMinutes: Math.max(
      0,
      Math.round((r.endedAt.getTime() - r.startedAt.getTime()) / 60_000),
    ),
    category: r.category,
    activity: r.activity,
    note: r.note,
  };
}

export async function listEntries(
  range: { from: string; to: string },
  filter: CommonFilter,
  opts: { limit: number; offset: number },
): Promise<EntryDTO[]> {
  await requireOwner();
  const { start, end } = rangeToInstants(range);
  const rows = await db
    .select(entryColumns)
    .from(entries)
    .where(and(gte(entries.startedAt, start), lt(entries.startedAt, end), matchFilter(filter)))
    .orderBy(desc(entries.startedAt))
    .limit(opts.limit)
    .offset(opts.offset);
  return rows.map(toDTO);
}

export async function countEntries(
  range: { from: string; to: string },
  filter: CommonFilter,
): Promise<number> {
  await requireOwner();
  const { start, end } = rangeToInstants(range);
  const rows = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(entries)
    .where(and(gte(entries.startedAt, start), lt(entries.startedAt, end), matchFilter(filter)));
  return rows[0]?.n ?? 0;
}

/** 时间轴：startedAt 落在该日的全部记录（与统计归属口径一致） */
export async function getDayEntries(date: string, filter: CommonFilter): Promise<EntryDTO[]> {
  await requireOwner();
  const start = dayStartInTz(date);
  const end = dayStartInTz(addDay(date, 1));
  const rows = await db
    .select(entryColumns)
    .from(entries)
    .where(and(gte(entries.startedAt, start), lt(entries.startedAt, end), matchFilter(filter)))
    .orderBy(entries.startedAt);
  return rows.map(toDTO);
}

/** 按日汇总（按开始时间归属当天，DISPLAY_TZ 分桶），服务月历/趋势图/首页 */
export async function getDailyTotals(
  range: { from: string; to: string },
  filter: CommonFilter,
): Promise<DailyTotal[]> {
  await requireOwner();
  const { start, end } = rangeToInstants(range);
  const tz = getDisplayTz();
  const rows = await db
    .select({
      day: sql<string>`to_char(${entries.startedAt} AT TIME ZONE ${tz}, 'YYYY-MM-DD')`,
      category: entries.category,
      minutes: minutesExpr,
    })
    .from(entries)
    .where(and(gte(entries.startedAt, start), lt(entries.startedAt, end), matchFilter(filter)))
    .groupBy(sql`1`, entries.category);

  const map = new Map<string, DailyTotal>();
  for (const r of rows) {
    const d = map.get(r.day) ?? { date: r.day, totalMinutes: 0, byCategory: {} };
    d.totalMinutes += r.minutes;
    d.byCategory[r.category] = (d.byCategory[r.category] ?? 0) + r.minutes;
    map.set(r.day, d);
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export async function getCategoryBreakdown(
  range: { from: string; to: string },
  filter: CommonFilter,
): Promise<CategoryTotal[]> {
  await requireOwner();
  const { start, end } = rangeToInstants(range);
  const rows = await db
    .select({ category: entries.category, minutes: minutesExpr })
    .from(entries)
    .where(and(gte(entries.startedAt, start), lt(entries.startedAt, end), matchFilter(filter)))
    .groupBy(entries.category);
  return rows.sort((a, b) => b.minutes - a.minutes);
}

export async function getActivityBreakdown(
  range: { from: string; to: string },
  filter: CommonFilter,
): Promise<ActivityTotal[]> {
  await requireOwner();
  const { start, end } = rangeToInstants(range);
  const rows = await db
    .select({ activity: entries.activity, category: entries.category, minutes: minutesExpr })
    .from(entries)
    .where(and(gte(entries.startedAt, start), lt(entries.startedAt, end), matchFilter(filter)))
    .groupBy(entries.activity, entries.category);
  return rows.sort((a, b) => b.minutes - a.minutes).slice(0, 10);
}

/** 筛选下拉的选项：去重分类 */
export async function getCategories(): Promise<string[]> {
  await requireOwner();
  const rows = await db
    .selectDistinct({ category: entries.category })
    .from(entries)
    .orderBy(entries.category);
  return rows.map((r) => r.category);
}
