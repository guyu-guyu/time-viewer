"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { projectColor } from "@/lib/colors";
import { formatDuration } from "@/lib/time";
import type { DailyTotal } from "@/lib/types";

const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];

export function CalendarHeatmap({ month, totals }: { month: string; totals: DailyTotal[] }) {
  const sp = useSearchParams();
  const byDate = new Map(totals.map((t) => [t.date, t]));
  const [y, m] = month.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const leading = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7; // 周一开头
  const maxMinutes = Math.max(1, ...totals.map((t) => t.totalMinutes));

  function dayHref(date: string) {
    // 点击某天 → 时间轴，携带共享筛选
    const p = new URLSearchParams();
    if (sp.get("project")) p.set("project", sp.get("project")!);
    if (sp.get("q")) p.set("q", sp.get("q")!);
    p.set("date", date);
    return `/views/timeline?${p.toString()}`;
  }

  const cells: (string | null)[] = [
    ...Array.from({ length: leading }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`),
  ];

  return (
    <div className="grid grid-cols-7 gap-1.5">
      {WEEKDAYS.map((w) => (
        <div key={w} className="pb-1 text-center text-xs text-muted-foreground">
          {w}
        </div>
      ))}
      {cells.map((date, i) => {
        if (!date) return <div key={`pad-${i}`} />;
        const t = byDate.get(date);
        const ratio = t ? t.totalMinutes / maxMinutes : 0;
        return (
          <Link
            key={date}
            href={dayHref(date)}
            className="flex min-h-20 flex-col justify-between rounded-md border p-1.5 hover:border-primary/50"
            style={{ background: t ? `rgb(37 99 235 / ${0.04 + 0.4 * ratio})` : undefined }}
          >
            <span className="text-xs text-muted-foreground">{Number(date.slice(8))}</span>
            {t && (
              <>
                <span className="text-xs font-medium">{formatDuration(t.totalMinutes)}</span>
                <span className="flex h-1.5 overflow-hidden rounded-full">
                  {Object.entries(t.byProject)
                    .sort((a, b) => b[1] - a[1])
                    .map(([c, mins]) => (
                      <span
                        key={c}
                        style={{
                          width: `${(mins / t.totalMinutes) * 100}%`,
                          background: projectColor(c),
                        }}
                      />
                    ))}
                </span>
              </>
            )}
          </Link>
        );
      })}
    </div>
  );
}
