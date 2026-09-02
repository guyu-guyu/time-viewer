"use client";

import { projectColor } from "@/lib/colors";
import {
  dayEndInTz,
  dayStartInTz,
  formatDuration,
  formatTimeInTz,
  millisecondsToMinutes,
} from "@/lib/time";
import {
  ENTRY_TYPE_LABELS,
  UNASSIGNED_PROJECT,
  UNASSIGNED_TASK,
  type EntryDTO,
} from "@/lib/types";

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
  const startMs = dayStartInTz(date, tz).getTime();
  const dayEndMs = dayEndInTz(date, tz).getTime();
  const totalMinutes = entries.reduce(
    (sum, entry) => sum + millisecondsToMinutes(entry.duration),
    0,
  );
  const byProject = entries.reduce<Record<string, number>>((totals, entry) => {
    const projectName = entry.projectName ?? UNASSIGNED_PROJECT;
    totals[projectName] =
      (totals[projectName] ?? 0) + millisecondsToMinutes(entry.duration);
    return totals;
  }, {});

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        <span>合计 {formatDuration(totalMinutes)}</span>
        {Object.entries(byProject).map(([projectName, minutes]) => (
          <span key={projectName} className="flex items-center gap-1">
            <span
              className="inline-block size-2 rounded-full"
              style={{ background: projectColor(projectName) }}
            />
            {projectName} {formatDuration(minutes)}
          </span>
        ))}
      </div>

      <div
        className="relative overflow-y-auto rounded-md border"
        style={{ height: 12 * HOUR_PX }}
      >
        {Array.from({ length: 24 }, (_, hour) => (
          <div
            key={hour}
            className="absolute inset-x-0 border-t border-dashed text-[10px] text-muted-foreground"
            style={{ top: hour * HOUR_PX }}
          >
            <span className="absolute -top-2 left-1 bg-background px-1">
              {String(hour).padStart(2, "0")}:00
            </span>
          </div>
        ))}
        {entries.map((entry) => {
          const projectName = entry.projectName ?? UNASSIGNED_PROJECT;
          const taskTitle = entry.taskTitle ?? UNASSIGNED_TASK;
          const durationMinutes = millisecondsToMinutes(entry.duration);
          const pauseMinutes = millisecondsToMinutes(entry.pauseDuration);
          const top = ((entry.startTime.getTime() - startMs) / 3_600_000) * HOUR_PX;
          const clippedEnd = Math.min(entry.endTime.getTime(), dayEndMs);
          const height =
            ((clippedEnd - entry.startTime.getTime()) / 3_600_000) * HOUR_PX;
          const details = [
            `${taskTitle} · ${projectName}`,
            `${formatTimeInTz(entry.startTime, tz)}–${formatTimeInTz(entry.endTime, tz)}`,
            `${ENTRY_TYPE_LABELS[entry.type]} · ${formatDuration(durationMinutes)}`,
            pauseMinutes > 0 ? `暂停 ${formatDuration(pauseMinutes)}` : null,
            entry.note,
          ]
            .filter(Boolean)
            .join("\n");

          return (
            <div
              key={entry.id}
              title={details}
              className="absolute left-14 right-2 overflow-hidden rounded px-2 py-1 text-xs text-white"
              style={{
                top,
                height: Math.max(height, 4),
                background: projectColor(projectName),
              }}
            >
              {height > 24 ? `${taskTitle} · ${formatDuration(durationMinutes)}` : ""}
            </div>
          );
        })}
      </div>
    </div>
  );
}
