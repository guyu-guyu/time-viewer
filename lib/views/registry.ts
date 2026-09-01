import type { LucideIcon } from "lucide-react";

import { manifest as calendar } from "@/app/(dashboard)/views/calendar/view";
import { manifest as charts } from "@/app/(dashboard)/views/charts/view";
import { manifest as list } from "@/app/(dashboard)/views/list/view";
import { manifest as timeline } from "@/app/(dashboard)/views/timeline/view";

export type ViewManifest = {
  id: string;
  title: string;
  icon: LucideIcon;
  order: number;
};

/** 增加视图 = 新建目录 + 此处加一行 import；移除 = 删目录 + 删对应行 */
export const views = [timeline, calendar, charts, list].sort((a, b) => a.order - b.order);
