import { Clock } from "lucide-react";
import type { ViewManifest } from "@/lib/views/registry";

export const manifest: ViewManifest = { id: "timeline", title: "时间轴", icon: Clock, order: 1 };
