"use client";

import type { EntryDTO } from "@/lib/types";
import { categoryColor } from "@/lib/colors";
import { formatDuration, formatTimeInTz } from "@/lib/time";

const HOUR_PX = 44;

export function TimelineView({
  date,
  entries,
  tz,
}: {
  date: string;
  entries: EntryDTO[];
  tz: string;
}) {
  const startMs = new Date(`${date}T00:00:00Z`).getTime();
  const dayEndMs = startMs + 86_400_000;
  const total = entries.reduce((s, e) => s + e.durationMinutes, 0);
  const byCategory = entries.reduce<Record<string, number>>((acc, e) => {
    acc[e.category] = (acc[e.category] ?? 0) + e.durationMinutes;
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        <span>合计 {formatDuration(total)}</span>
        {Object.entries(byCategory).map(([c, m]) => (
          <span key={c} className="flex items-center gap-1">
            <span
              className="inline-block size-2 rounded-full"
              style={{ background: categoryColor(c) }}
            />
            {c} {formatDuration(m)}
          </span>
        ))}
      </div>

      <div
        className="relative overflow-y-auto rounded-md border"
        style={{ height: 12 * HOUR_PX }}
      >
        {Array.from({ length: 24 }, (_, h) => (
          <div
            key={h}
            className="absolute inset-x-0 border-t border-dashed text-[10px] text-muted-foreground"
            style={{ top: h * HOUR_PX }}
          >
            <span className="absolute -top-2 left-1 bg-background px-1">
              {String(h).padStart(2, "0")}:00
            </span>
          </div>
        ))}
        {entries.map((e) => {
          const top = ((e.startedAt.getTime() - startMs) / 3_600_000) * HOUR_PX;
          const clippedEnd = Math.min(e.endedAt.getTime(), dayEndMs); // 跨午夜截断
          const height = ((clippedEnd - e.startedAt.getTime()) / 3_600_000) * HOUR_PX;
          return (
            <div
              key={e.id}
              title={`${e.activity} ${formatTimeInTz(e.startedAt, tz)}–${formatTimeInTz(e.endedAt, tz)} · ${formatDuration(e.durationMinutes)}${e.note ? `\n${e.note}` : ""}`}
              className="absolute left-14 right-2 overflow-hidden rounded px-2 py-1 text-xs text-white"
              style={{ top, height: Math.max(height, 4), background: categoryColor(e.category) }}
            >
              {height > 24 ? `${e.activity} · ${formatDuration(e.durationMinutes)}` : ""}
            </div>
          );
        })}
      </div>
    </div>
  );
}
