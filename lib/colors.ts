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

/** 类别 -> 固定颜色（工作/学习/娱乐/未分类 恒定，其余按 hash 落入调色板） */
const CATEGORY_COLORS: Record<string, string> = {
  工作: "#2563eb",
  学习: "#059669",
  娱乐: "#d97706",
  未分类: "#94a3b8",
};

function hashColor(name: string): string {
  let hash = 0;
  for (const char of name) {
    hash = (hash * 31 + char.codePointAt(0)!) >>> 0;
  }
  return PALETTE[hash % PALETTE.length];
}

/** 项目名 -> 稳定颜色：按名称 hash 落入调色板 */
export function projectColor(projectName: string): string {
  return hashColor(projectName);
}

/** 类别颜色：已知类别固定，未知类别按 hash */
export function categoryColor(category: string): string {
  return CATEGORY_COLORS[category] ?? hashColor(category);
}
