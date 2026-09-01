import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { categoryColor } from "@/lib/colors";
import { dayKeyOf, formatDuration, formatTimeInTz, getDisplayTz } from "@/lib/time";
import type { EntryDTO } from "@/lib/types";

export function TableView({ rows }: { rows: EntryDTO[] }) {
  const tz = getDisplayTz();
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-24">日期</TableHead>
            <TableHead className="w-36">时间段</TableHead>
            <TableHead className="w-20">时长</TableHead>
            <TableHead className="w-24">分类</TableHead>
            <TableHead className="w-40">活动</TableHead>
            <TableHead>备注</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                无匹配记录
              </TableCell>
            </TableRow>
          )}
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell>{dayKeyOf(r.startedAt, tz)}</TableCell>
              <TableCell>
                {formatTimeInTz(r.startedAt, tz)}–{formatTimeInTz(r.endedAt, tz)}
              </TableCell>
              <TableCell>{formatDuration(r.durationMinutes)}</TableCell>
              <TableCell>
                <span className="flex items-center gap-1.5">
                  <span
                    className="inline-block size-2 rounded-full"
                    style={{ background: categoryColor(r.category) }}
                  />
                  {r.category}
                </span>
              </TableCell>
              <TableCell>{r.activity}</TableCell>
              <TableCell className="text-muted-foreground">{r.note ?? "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
