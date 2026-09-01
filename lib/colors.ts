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

const EXPLICIT: Record<string, string> = {
  工作: "#2563eb",
  学习: "#7c3aed",
  娱乐: "#d97706",
  运动: "#059669",
  休息: "#64748b",
};

/** 分类 → 稳定颜色：显式映射优先，未知分类按名称 hash 落入调色板 */
export function categoryColor(category: string): string {
  const explicit = EXPLICIT[category];
  if (explicit) return explicit;
  let h = 0;
  for (const ch of category) h = (h * 31 + ch.codePointAt(0)!) >>> 0;
  return PALETTE[h % PALETTE.length];
}
