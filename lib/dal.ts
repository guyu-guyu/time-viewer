import "server-only";

import { cache } from "react";
import { and, desc, eq, gte, ilike, isNotNull, isNull, lt, or, sql } from "drizzle-orm";

import { auth } from "@/auth";
import { db } from "./db";
import { entries } from "./schema";
import { addDay, dayStartInTz, getDisplayTz } from "./time";
import {
  UNASSIGNED_PROJECT,
  UNASSIGNED_PROJECT_FILTER,
  UNASSIGNED_TASK,
  type CommonFilter,
  type DailyTotal,
  type EntryDTO,
  type EntryType,
  type ProjectTotal,
  type TaskTotal,
} from "./types";

/** 安全边界：无有效会话即 throw；cache() 是请求级去重（性能优化，非安全机制） */
export const requireOwner = cache(async () => {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHORIZED");
  return { userId: process.env.OWNER_GITHUB_ID! };
});

function matchFilter(filter: CommonFilter) {
  const conditions = [];
  if (filter.projectName) {
    conditions.push(
      filter.projectName === UNASSIGNED_PROJECT_FILTER
        ? isNull(entries.projectName)
        : eq(entries.projectName, filter.projectName),
    );
  }
  if (filter.q) {
    conditions.push(
      or(
        ilike(entries.note, `%${filter.q}%`),
        ilike(entries.taskTitle, `%${filter.q}%`),
        ilike(entries.projectName, `%${filter.q}%`),
      ),
    );
  }
  return conditions.length > 0 ? and(...conditions) : undefined;
}

function rangeToInstants(range: { from: string; to: string }) {
  return {
    start: dayStartInTz(range.from),
    end: dayStartInTz(addDay(range.to, 1)),
  };
}

const minutesExpr = sql<number>`
  coalesce(round(sum(${entries.duration}) / 60000.0)::int, 0)
`;
const projectExpr = sql<string>`coalesce(${entries.projectName}, ${UNASSIGNED_PROJECT})`;
const taskExpr = sql<string>`coalesce(${entries.taskTitle}, ${UNASSIGNED_TASK})`;

const entryColumns = {
  id: entries.id,
  type: entries.type,
  note: entries.note,
  taskTitle: entries.taskTitle,
  projectName: entries.projectName,
  startTime: entries.startTime,
  endTime: entries.endTime,
  duration: entries.duration,
  pauseDuration: entries.pauseDuration,
  source: entries.source,
  createdAt: entries.createdAt,
};

type EntryRow = Omit<EntryDTO, "type"> & { type: number };

function toDTO(row: EntryRow): EntryDTO {
  return {
    ...row,
    type: (row.type === 0 ? 0 : 1) satisfies EntryType,
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
    .where(and(gte(entries.startTime, start), lt(entries.startTime, end), matchFilter(filter)))
    .orderBy(desc(entries.startTime))
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
    .select({ count: sql<number>`count(*)::int` })
    .from(entries)
    .where(and(gte(entries.startTime, start), lt(entries.startTime, end), matchFilter(filter)));
  return rows[0]?.count ?? 0;
}

/** 时间轴：startTime 落在该日的全部记录（与统计归属口径一致） */
export async function getDayEntries(date: string, filter: CommonFilter): Promise<EntryDTO[]> {
  await requireOwner();
  const start = dayStartInTz(date);
  const end = dayStartInTz(addDay(date, 1));
  const rows = await db
    .select(entryColumns)
    .from(entries)
    .where(and(gte(entries.startTime, start), lt(entries.startTime, end), matchFilter(filter)))
    .orderBy(entries.startTime);
  return rows.map(toDTO);
}

/** 按日汇总（按开始时间归属当天，DISPLAY_TZ 分桶），服务月历、趋势图和首页 */
export async function getDailyTotals(
  range: { from: string; to: string },
  filter: CommonFilter,
): Promise<DailyTotal[]> {
  await requireOwner();
  const { start, end } = rangeToInstants(range);
  const tz = getDisplayTz();
  const rows = await db
    .select({
      day: sql<string>`to_char(${entries.startTime} AT TIME ZONE ${tz}, 'YYYY-MM-DD')`,
      projectName: projectExpr,
      minutes: minutesExpr,
    })
    .from(entries)
    .where(and(gte(entries.startTime, start), lt(entries.startTime, end), matchFilter(filter)))
    .groupBy(sql`1`, projectExpr);

  const totals = new Map<string, DailyTotal>();
  for (const row of rows) {
    const daily = totals.get(row.day) ?? {
      date: row.day,
      totalMinutes: 0,
      byProject: {},
    };
    daily.totalMinutes += row.minutes;
    daily.byProject[row.projectName] = (daily.byProject[row.projectName] ?? 0) + row.minutes;
    totals.set(row.day, daily);
  }
  return [...totals.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export async function getProjectBreakdown(
  range: { from: string; to: string },
  filter: CommonFilter,
): Promise<ProjectTotal[]> {
  await requireOwner();
  const { start, end } = rangeToInstants(range);
  const rows = await db
    .select({ projectName: projectExpr, minutes: minutesExpr })
    .from(entries)
    .where(and(gte(entries.startTime, start), lt(entries.startTime, end), matchFilter(filter)))
    .groupBy(projectExpr);
  return rows.sort((a, b) => b.minutes - a.minutes);
}

export async function getTaskBreakdown(
  range: { from: string; to: string },
  filter: CommonFilter,
): Promise<TaskTotal[]> {
  await requireOwner();
  const { start, end } = rangeToInstants(range);
  const rows = await db
    .select({
      taskTitle: taskExpr,
      projectName: projectExpr,
      minutes: minutesExpr,
    })
    .from(entries)
    .where(and(gte(entries.startTime, start), lt(entries.startTime, end), matchFilter(filter)))
    .groupBy(taskExpr, projectExpr);
  return rows.sort((a, b) => b.minutes - a.minutes).slice(0, 10);
}

/** 筛选下拉的选项：去重非空项目名 */
export async function getProjects(): Promise<string[]> {
  await requireOwner();
  const rows = await db
    .selectDistinct({ projectName: entries.projectName })
    .from(entries)
    .where(isNotNull(entries.projectName))
    .orderBy(entries.projectName);
  return [
    UNASSIGNED_PROJECT_FILTER,
    ...rows.flatMap((row) => (row.projectName ? [row.projectName] : [])),
  ];
}
