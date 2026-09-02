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

import { projectColor } from "@/lib/colors";
import { formatDuration } from "@/lib/time";
import type { DailyTotal, ProjectTotal, TaskTotal } from "@/lib/types";

export function ChartsView({
  daily,
  projectTotals,
  tasks,
}: {
  daily: DailyTotal[];
  projectTotals: ProjectTotal[];
  tasks: TaskTotal[];
}) {
  const dailyData = daily.map((item) => ({
    date: item.date.slice(5),
    minutes: item.totalMinutes,
  }));
  const pieData = projectTotals.map((project) => ({
    name: project.projectName,
    value: project.minutes,
  }));
  const topData = tasks.map((task) => ({
    name: task.taskTitle,
    projectName: task.projectName,
    minutes: task.minutes,
  }));

  return (
    <div className="flex flex-col gap-10">
      <section>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">按日总时长</h2>
        <div className="h-72">
          <ResponsiveContainer>
            <BarChart data={dailyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis tickFormatter={(value: number) => `${Math.round(value / 60)}h`} />
              <Tooltip formatter={(value) => [formatDuration(Number(value)), "时长"]} />
              <Bar dataKey="minutes" fill="#2563eb" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">项目占比</h2>
        <div className="h-72">
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                innerRadius="55%"
                outerRadius="80%"
              >
                {pieData.map((project) => (
                  <Cell key={project.name} fill={projectColor(project.name)} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => formatDuration(Number(value))} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">任务时长 Top 10</h2>
        <div className="h-80">
          <ResponsiveContainer>
            <BarChart data={topData} layout="vertical" margin={{ left: 30 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                type="number"
                tickFormatter={(value: number) => `${Math.round(value / 60)}h`}
              />
              <YAxis type="category" dataKey="name" width={110} />
              <Tooltip formatter={(value) => [formatDuration(Number(value)), "时长"]} />
              <Bar dataKey="minutes" radius={[0, 3, 3, 0]}>
                {topData.map((task) => (
                  <Cell
                    key={`${task.projectName}:${task.name}`}
                    fill={projectColor(task.projectName)}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}
