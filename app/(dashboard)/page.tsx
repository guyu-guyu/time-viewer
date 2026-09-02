import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { projectColor } from "@/lib/colors";
import { getDailyTotals, getProjectBreakdown } from "@/lib/dal";
import { currentMonthStr, formatDuration, monthRange, todayStr, weekRange } from "@/lib/time";
import { views } from "@/lib/views/registry";
import type { DailyTotal } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = { title: "总览 · time-viewer" };

export default async function HomePage() {
  const today = todayStr();
  const week = weekRange();
  const month = monthRange(currentMonthStr());

  // 一次月度汇总覆盖今日/本周/本月三个口径
  const [daily, weekProjects] = await Promise.all([
    getDailyTotals(month, { projectName: null, q: null }),
    getProjectBreakdown(week, { projectName: null, q: null }),
  ]);

  const sum = (list: DailyTotal[]) => list.reduce((s, d) => s + d.totalMinutes, 0);
  const todayTotal = daily.find((d) => d.date === today)?.totalMinutes ?? 0;
  const weekTotal = sum(daily.filter((d) => d.date >= week.from && d.date <= week.to));
  const monthTotal = sum(daily);
  const topProject = weekProjects[0];

  const tiles = [
    { label: "今日", value: formatDuration(todayTotal) },
    { label: "本周", value: formatDuration(weekTotal) },
    { label: "本月", value: formatDuration(monthTotal) },
    {
      label: "本周主力项目",
      value: topProject
        ? `${topProject.projectName} · ${formatDuration(topProject.minutes)}`
        : "暂无数据",
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-xl font-semibold">总览</h1>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {tiles.map((t) => (
          <Card key={t.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-normal text-muted-foreground">
                {t.label}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{t.value}</CardContent>
          </Card>
        ))}
      </div>
      <div>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">本周项目</h2>
        <div className="flex flex-wrap gap-2">
          {weekProjects.length === 0 && (
            <span className="text-sm text-muted-foreground">暂无数据</span>
          )}
          {weekProjects.map((project) => (
            <span key={project.projectName} className="flex items-center gap-1.5 text-sm">
              <span
                className="inline-block size-2 rounded-full"
                style={{ background: projectColor(project.projectName) }}
              />
              {project.projectName} {formatDuration(project.minutes)}
            </span>
          ))}
        </div>
      </div>
      <div>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">视图</h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {views.map((v) => (
            <Link key={v.id} href={`/views/${v.id}`}>
              <Card className="transition-colors hover:border-primary/50">
                <CardContent className="flex items-center gap-3">
                  <v.icon className="size-5 text-muted-foreground" />
                  <span className="font-medium">{v.title}</span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
