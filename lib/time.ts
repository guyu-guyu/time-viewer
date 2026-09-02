export function getDisplayTz(): string {
  return process.env.DISPLAY_TZ ?? "Asia/Shanghai";
}

function tzOffsetMs(date: Date, tz: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const asUTC = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") % 24,
    get("minute"),
    get("second"),
  );
  return asUTC - date.getTime();
}

/** 给定展示时区里的日期字符串，返回该日 00:00 对应的 UTC 瞬间（两遍修正 DST） */
export function dayStartInTz(dateStr: string, tz = getDisplayTz()): Date {
  const naive = new Date(`${dateStr}T00:00:00Z`);
  let result = new Date(naive.getTime() - tzOffsetMs(naive, tz));
  result = new Date(naive.getTime() - tzOffsetMs(result, tz));
  return result;
}

/** 该日 24:00（次日 00:00）对应的 UTC 瞬间，作为排他上界 */
export function dayEndInTz(dateStr: string, tz = getDisplayTz()): Date {
  return dayStartInTz(addDay(dateStr, 1), tz);
}

/** 瞬间在展示时区里的日期键 YYYY-MM-DD */
export function dayKeyOf(date: Date, tz = getDisplayTz()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function todayStr(tz = getDisplayTz()): string {
  return dayKeyOf(new Date(), tz);
}

export function currentMonthStr(tz = getDisplayTz()): string {
  return todayStr(tz).slice(0, 7);
}

export function addDay(dateStr: string, delta: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

export function addMonth(monthStr: string, delta: number): string {
  const [y, m] = monthStr.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function isValidDateStr(s: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(s) &&
    new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s
  );
}

export function isValidMonthStr(s: string): boolean {
  if (!/^\d{4}-\d{2}$/.test(s)) return false;
  const m = Number(s.slice(5));
  return m >= 1 && m <= 12;
}

/** 近 n 天（含今天），两端 inclusive */
export function lastNDays(n: number, tz = getDisplayTz()): { from: string; to: string } {
  const to = todayStr(tz);
  return { from: addDay(to, -(n - 1)), to };
}

/** anchor 所在周的周一~周日，两端 inclusive；缺省用今天 */
export function weekRange(anchorStr?: string, tz = getDisplayTz()): { from: string; to: string } {
  const anchor = anchorStr ?? todayStr(tz);
  const dow = new Date(`${anchor}T00:00:00Z`).getUTCDay(); // 0=周日
  const from = addDay(anchor, -((dow + 6) % 7));
  return { from, to: addDay(from, 6) };
}

/** 该月首日~末日，两端 inclusive */
export function monthRange(monthStr: string): { from: string; to: string } {
  const [y, m] = monthStr.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const last = new Date(Date.UTC(y, m, 0));
  return { from: first.toISOString().slice(0, 10), to: last.toISOString().slice(0, 10) };
}

export function formatDuration(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${r}m`;
  if (r === 0) return `${h}h`;
  return `${h}h ${r}m`;
}

export function millisecondsToMinutes(milliseconds: number): number {
  return Math.max(0, Math.round(milliseconds / 60_000));
}

export function formatTimeInTz(date: Date, tz = getDisplayTz()): string {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}
