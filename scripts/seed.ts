import { config } from "dotenv";
config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { entries } from "../lib/schema";

const CATEGORIES: Record<string, string[]> = {
  工作: ["写代码", "开会", "Code Review", "写文档"],
  学习: ["读技术文章", "看课程", "读书"],
  娱乐: ["看视频", "玩游戏", "刷社交媒体"],
  运动: ["跑步", "健身"],
  休息: ["午休", "晚饭散步"],
};

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
  for (let d = 29; d >= 0; d--) {
    const day = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - d),
    );
    let minute = 8 * 60 + rand(60); // 每天最早 8:00 开始（UTC 基准，足够调试）
    const blocks = 4 + rand(5);
    for (let b = 0; b < blocks; b++) {
      const category = Object.keys(CATEGORIES)[rand(5)];
      const activity = CATEGORIES[category][rand(CATEGORIES[category].length)];
      const dur = 25 + rand(150);
      const startedAt = new Date(day.getTime() + minute * 60_000);
      const endedAt = new Date(startedAt.getTime() + dur * 60_000);
      rows.push({
        startedAt,
        endedAt,
        category,
        activity,
        note: Math.random() < 0.3 ? `${activity}备注${b + 1}` : null,
        source: "seed",
      });
      minute += dur + 10 + rand(40);
      if (minute > 22 * 60) break;
    }
  }
  await db.insert(entries).values(rows);
  console.log(`已插入 ${rows.length} 条记录`);
}

main();
