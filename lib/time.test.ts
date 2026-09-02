import { describe, expect, it } from "vitest";
import {
  addDay,
  addMonth,
  dayEndInTz,
  dayKeyOf,
  dayStartInTz,
  formatDuration,
  formatTimeInTz,
  isValidDateStr,
  isValidMonthStr,
  lastNDays,
  millisecondsToMinutes,
  monthRange,
  weekRange,
} from "./time";

describe("dayStartInTz / dayEndInTz", () => {
  it("上海：当天 00:00 对应 UTC 前一天 16:00", () => {
    expect(dayStartInTz("2026-09-01", "Asia/Shanghai").toISOString()).toBe(
      "2026-08-31T16:00:00.000Z",
    );
    expect(dayEndInTz("2026-09-01", "Asia/Shanghai").toISOString()).toBe(
      "2026-09-01T16:00:00.000Z",
    );
  });
  it("UTC：当天 00:00 即 UTC 零点", () => {
    expect(dayStartInTz("2026-09-01", "UTC").toISOString()).toBe("2026-09-01T00:00:00.000Z");
  });
  it("纽约 DST 切换日（2026-03-08）午夜仍为 EST(-5)", () => {
    expect(dayStartInTz("2026-03-08", "America/New_York").toISOString()).toBe(
      "2026-03-08T05:00:00.000Z",
    );
  });
});

describe("dayKeyOf", () => {
  it("UTC 20:00 在上海已是次日", () => {
    expect(dayKeyOf(new Date("2026-08-31T20:00:00Z"), "Asia/Shanghai")).toBe("2026-09-01");
  });
});

describe("addDay / addMonth", () => {
  it("跨月与闰年回退", () => {
    expect(addDay("2026-08-31", 1)).toBe("2026-09-01");
    expect(addDay("2026-03-01", -1)).toBe("2026-02-28");
  });
  it("月份加减跨年", () => {
    expect(addMonth("2026-08", 1)).toBe("2026-09");
    expect(addMonth("2025-12", 1)).toBe("2026-01");
  });
});

describe("isValidDateStr / isValidMonthStr", () => {
  it("拒绝不存在的日期与格式错误", () => {
    expect(isValidDateStr("2026-02-30")).toBe(false);
    expect(isValidDateStr("20260901")).toBe(false);
    expect(isValidDateStr("2026-09-01")).toBe(true);
    expect(isValidMonthStr("2026-13")).toBe(false);
    expect(isValidMonthStr("202609")).toBe(false);
    expect(isValidMonthStr("2026-09")).toBe(true);
  });
});

describe("lastNDays / weekRange / monthRange", () => {
  it("近 30 天以今天收尾", () => {
    const r = lastNDays(30, "UTC");
    expect(r.to).toBe(dayKeyOf(new Date(), "UTC"));
    expect(addDay(r.from, 29)).toBe(r.to);
  });
  it("weekRange 周一起周日止（2026-09-01 是周二）", () => {
    expect(weekRange("2026-09-01")).toEqual({ from: "2026-08-31", to: "2026-09-06" });
  });
  it("monthRange 两端含（9 月 30 天）", () => {
    expect(monthRange("2026-09")).toEqual({ from: "2026-09-01", to: "2026-09-30" });
    expect(monthRange("2026-02")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
  });
});

describe("formatDuration / formatTimeInTz", () => {
  it("分钟/小时格式", () => {
    expect(formatDuration(0)).toBe("0m");
    expect(formatDuration(45)).toBe("45m");
    expect(formatDuration(60)).toBe("1h");
    expect(formatDuration(90)).toBe("1h 30m");
  });
  it("按指定时区格式化时刻", () => {
    expect(formatTimeInTz(new Date("2026-09-01T02:30:00Z"), "Asia/Shanghai")).toBe("10:30");
  });
  it("毫秒时长按分钟四舍五入且不返回负数", () => {
    expect(millisecondsToMinutes(90_000)).toBe(2);
    expect(millisecondsToMinutes(60_000)).toBe(1);
    expect(millisecondsToMinutes(-1)).toBe(0);
  });
});
