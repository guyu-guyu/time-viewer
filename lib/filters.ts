import { isValidDateStr, isValidMonthStr } from "./time";
import type { CommonFilter } from "./types";

export type SP = Record<string, string | undefined>;

/** 共享筛选：category 精确匹配、q 模糊匹配 note/activity；空白视为未选 */
export function parseCommon(sp: SP): CommonFilter {
  const category = (sp.category ?? "").trim();
  const q = (sp.q ?? "").trim();
  return { category: category || null, q: q || null };
}

/** timeline 主参数：单日 YYYY-MM-DD，非法回退 fallback */
export function parseDateParam(sp: SP, fallback: string): string {
  const v = sp.date;
  return v && isValidDateStr(v) ? v : fallback;
}

/** calendar 主参数：月份 YYYY-MM，非法回退 fallback */
export function parseMonthParam(sp: SP, fallback: string): string {
  const v = sp.month;
  return v && isValidMonthStr(v) ? v : fallback;
}

/** charts/list 主参数：日期区间，两端 inclusive，非法回退，from>to 交换 */
export function parseRange(
  sp: SP,
  fallback: { from: string; to: string },
): { from: string; to: string } {
  const from = sp.from && isValidDateStr(sp.from) ? sp.from : fallback.from;
  const to = sp.to && isValidDateStr(sp.to) ? sp.to : fallback.to;
  return from <= to ? { from, to } : { from: to, to: from };
}

/** list 分页：1 起始页码 → offset */
export function parsePage(sp: SP, pageSize: number): { page: number; offset: number } {
  const n = Number(sp.page);
  const page = Number.isInteger(n) && n >= 1 ? n : 1;
  return { page, offset: (page - 1) * pageSize };
}
