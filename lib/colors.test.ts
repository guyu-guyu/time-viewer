import { describe, expect, it } from "vitest";
import { PALETTE, projectColor } from "./colors";

describe("projectColor", () => {
  it("同一项目始终返回相同颜色", () => {
    expect(projectColor("time-viewer")).toBe(projectColor("time-viewer"));
  });

  it("返回调色板中的颜色", () => {
    for (const projectName of ["time-viewer", "内部工具", "未关联项目"]) {
      expect(PALETTE).toContain(projectColor(projectName));
    }
  });
});
