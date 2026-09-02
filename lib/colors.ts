export const PALETTE = [
  "#2563eb",
  "#059669",
  "#d97706",
  "#dc2626",
  "#7c3aed",
  "#0891b2",
  "#db2777",
  "#65a30d",
] as const;

/** 项目名 -> 稳定颜色：按名称 hash 落入调色板 */
export function projectColor(projectName: string): string {
  let hash = 0;
  for (const char of projectName) {
    hash = (hash * 31 + char.codePointAt(0)!) >>> 0;
  }
  return PALETTE[hash % PALETTE.length];
}
