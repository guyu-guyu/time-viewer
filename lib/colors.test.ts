import { describe, expect, it } from "vitest";
import { PALETTE, categoryColor } from "./colors";

describe("categoryColor", () => {
  it("同一分类返回稳定颜色", () => {
    expect(categoryColor("工作")).toBe(categoryColor("工作"));
  });
  it("显式映射优先", () => {
    expect(categoryColor("工作")).toBe("#2563eb");
    expect(categoryColor("学习")).toBe("#7c3aed");
  });
  it("未知分类兜底到调色板内", () => {
    for (const c of ["完全未知的分类", "a", "运动2", "_xyz"]) {
      expect(PALETTE).toContain(categoryColor(c));
    }
  });
});
