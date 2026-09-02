import { config } from "dotenv";
config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { entries } from "../lib/schema";
import type { EntryType } from "../lib/types";

const PROJECTS = [
  { projectName: "time-viewer", tasks: ["开发功能", "Code Review", "整理文档"] },
  { projectName: "内部工具", tasks: ["需求分析", "修复问题", "数据核对"] },
  { projectName: "个人成长", tasks: ["读技术文章", "看课程", "整理笔记"] },
] as const;

const rand = (n: number) => Math.floor(Math.random() * n);

async function main() {
  const db = drizzle(neon(process.env.DATABASE_URL!));

  const existing = await db.select({ id: entries.id }).from(entries).limit(1);
  if (existing.length > 0 && !process.argv.includes("--force")) {
    console.error("entries 已有数据；如需重灌请执行: npx tsx scripts/seed.ts --force");
    process.exit(1);
  }
  await db.delete(entries);

  const rows: (typeof entries.$inferInsert)[] = [];
  const now = new Date();
  for (let dayOffset = 29; dayOffset >= 0; dayOffset--) {
    const day = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - dayOffset),
    );
    let minute = 8 * 60 + rand(60);
    const blocks = 4 + rand(5);
    for (let block = 0; block < blocks; block++) {
      const hasProject = Math.random() >= 0.1;
      const project = hasProject ? PROJECTS[rand(PROJECTS.length)] : null;
      const taskTitle = project ? project.tasks[rand(project.tasks.length)] : null;
      const type: EntryType = Math.random() < 0.65 ? 0 : 1;
      const durationMinutes = type === 0 ? [25, 50][rand(2)] : 25 + rand(150);
      const pauseMinutes = type === 0 ? 5 + rand(6) : rand(20);
      const startTime = new Date(day.getTime() + minute * 60_000);
      const endTime = new Date(
        startTime.getTime() + (durationMinutes + pauseMinutes) * 60_000,
      );
      rows.push({
        type,
        note: Math.random() < 0.3 ? `第 ${block + 1} 段记录` : null,
        taskTitle,
        projectName: project?.projectName ?? null,
        startTime,
        endTime,
        duration: durationMinutes * 60_000,
        pauseDuration: pauseMinutes * 60_000,
        source: "seed",
      });
      minute += durationMinutes + pauseMinutes + 10 + rand(30);
      if (minute > 22 * 60) break;
    }
  }
  await db.insert(entries).values(rows);
  console.log(`已插入 ${rows.length} 条记录`);
}

main();
