"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { categoryColor } from "@/lib/colors";
import { formatDuration } from "@/lib/time";
import type { ActivityTotal, CategoryTotal, DailyTotal } from "@/lib/types";

export function ChartsView({
  daily,
  categoryTotals,
  activities,
}: {
  daily: DailyTotal[];
  categoryTotals: CategoryTotal[];
  activities: ActivityTotal[];
}) {
  const dailyData = daily.map((d) => ({ date: d.date.slice(5), minutes: d.totalMinutes }));
  const pieData = categoryTotals.map((c) => ({ name: c.category, value: c.minutes }));
  const topData = activities.map((a) => ({ name: a.activity, minutes: a.minutes }));

  return (
    <div className="flex flex-col gap-10">
      <section>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">按日总时长</h2>
        <div className="h-72">
          <ResponsiveContainer>
            <BarChart data={dailyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis tickFormatter={(v: number) => `${Math.round(v / 60)}h`} />
              <Tooltip formatter={(v) => [formatDuration(Number(v)), "时长"]} />
              <Bar dataKey="minutes" fill="#2563eb" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">分类占比</h2>
        <div className="h-72">
          <ResponsiveContainer>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="80%">
                {pieData.map((d) => (
                  <Cell key={d.name} fill={categoryColor(d.name)} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => formatDuration(Number(v))} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">活动时长 Top 10</h2>
        <div className="h-80">
          <ResponsiveContainer>
            <BarChart data={topData} layout="vertical" margin={{ left: 30 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tickFormatter={(v: number) => `${Math.round(v / 60)}h`} />
              <YAxis type="category" dataKey="name" width={110} />
              <Tooltip formatter={(v) => [formatDuration(Number(v)), "时长"]} />
              <Bar dataKey="minutes" radius={[0, 3, 3, 0]}>
                {topData.map((d, i) => (
                  <Cell key={i} fill={categoryColor(activities[i]?.category ?? "")} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}
