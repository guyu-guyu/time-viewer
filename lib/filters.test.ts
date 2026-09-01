import { describe, expect, it } from "vitest";
import { parseCommon, parseDateParam, parseMonthParam, parsePage, parseRange } from "./filters";

describe("parseCommon", () => {
  it("空/空白参数返回 null", () => {
    expect(parseCommon({})).toEqual({ category: null, q: null });
    expect(parseCommon({ category: "  ", q: "" })).toEqual({ category: null, q: null });
  });
  it("正常读取并去首尾空白", () => {
    expect(parseCommon({ category: " 工作 ", q: "重构" })).toEqual({ category: "工作", q: "重构" });
  });
});

describe("parseDateParam", () => {
  it("非法日期回退默认值", () => {
    expect(parseDateParam({ date: "2026-02-30" }, "2026-09-01")).toBe("2026-09-01");
    expect(parseDateParam({ date: "abc" }, "2026-09-01")).toBe("2026-09-01");
    expect(parseDateParam({}, "2026-09-01")).toBe("2026-09-01");
  });
  it("合法日期通过", () => {
    expect(parseDateParam({ date: "2026-08-15" }, "2026-09-01")).toBe("2026-08-15");
  });
});

describe("parseMonthParam", () => {
  it("非法月份回退", () => {
    expect(parseMonthParam({ month: "2026-13" }, "2026-09")).toBe("2026-09");
    expect(parseMonthParam({ month: "202609" }, "2026-09")).toBe("2026-09");
    expect(parseMonthParam({}, "2026-09")).toBe("2026-09");
  });
  it("合法月份通过", () => {
    expect(parseMonthParam({ month: "2025-12" }, "2026-09")).toBe("2025-12");
  });
});

describe("parseRange", () => {
  const fallback = { from: "2026-08-01", to: "2026-08-31" };
  it("缺失或非法端点用默认区间", () => {
    expect(parseRange({}, fallback)).toEqual(fallback);
    expect(parseRange({ from: "bad", to: "2026-08-31" }, fallback)).toEqual(fallback);
  });
  it("from 晚于 to 时自动交换", () => {
    expect(parseRange({ from: "2026-08-31", to: "2026-08-01" }, fallback)).toEqual(fallback);
  });
});

describe("parsePage", () => {
  it("非法页码回退第 1 页", () => {
    expect(parsePage({ page: "0" }, 50)).toEqual({ page: 1, offset: 0 });
    expect(parsePage({ page: "-3" }, 50)).toEqual({ page: 1, offset: 0 });
    expect(parsePage({ page: "abc" }, 50)).toEqual({ page: 1, offset: 0 });
    expect(parsePage({}, 50)).toEqual({ page: 1, offset: 0 });
  });
  it("第 3 页 offset 100", () => {
    expect(parsePage({ page: "3" }, 50)).toEqual({ page: 3, offset: 100 });
  });
});
