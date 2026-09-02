import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { projectColor } from "@/lib/colors";
import {
  dayKeyOf,
  formatDuration,
  formatTimeInTz,
  getDisplayTz,
  millisecondsToMinutes,
} from "@/lib/time";
import {
  ENTRY_TYPE_LABELS,
  UNASSIGNED_PROJECT,
  type EntryDTO,
} from "@/lib/types";

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
            <TableHead className="w-20">暂停</TableHead>
            <TableHead className="w-20">类型</TableHead>
            <TableHead className="w-32">项目</TableHead>
            <TableHead className="w-40">任务</TableHead>
            <TableHead>备注</TableHead>
            <TableHead className="w-24">来源</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={9} className="text-center text-muted-foreground">
                无匹配记录
              </TableCell>
            </TableRow>
          )}
          {rows.map((row) => {
            const projectName = row.projectName ?? UNASSIGNED_PROJECT;
            return (
              <TableRow key={row.id}>
                <TableCell>{dayKeyOf(row.startTime, tz)}</TableCell>
                <TableCell>
                  {formatTimeInTz(row.startTime, tz)}–{formatTimeInTz(row.endTime, tz)}
                </TableCell>
                <TableCell>{formatDuration(millisecondsToMinutes(row.duration))}</TableCell>
                <TableCell>
                  {formatDuration(millisecondsToMinutes(row.pauseDuration))}
                </TableCell>
                <TableCell>{ENTRY_TYPE_LABELS[row.type]}</TableCell>
                <TableCell>
                  <span className="flex items-center gap-1.5">
                    <span
                      className="inline-block size-2 rounded-full"
                      style={{ background: projectColor(projectName) }}
                    />
                    {projectName}
                  </span>
                </TableCell>
                <TableCell>{row.taskTitle ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{row.note ?? "—"}</TableCell>
                <TableCell>{row.source}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
