# time-viewer 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建单用户、纯读取的时间数据查看器：GitHub OAuth 白名单 + DAL 安全层 + 四个插件化视图（时间轴/月历/图表/明细）+ 首页总览，一次性实现规格全部功能（单一版本，不分期）。

**Architecture:** 路由即插件：每个视图是 `app/(dashboard)/views/<id>/` 下自包含目录（manifest + server page + client 组件），`lib/views/registry.ts` 一行注册；筛选全走 URL searchParams；全部 SQL 查询集中在 `lib/dal.ts` 且每函数首行 `requireOwner()`（安全边界）；私有路由全部 force-dynamic。

**Tech Stack:** Next.js 15 App Router（≥15.2.3）· NextAuth v5 beta · GitHub OAuth · Neon Postgres · Drizzle ORM（neon-http 驱动）· Tailwind CSS + shadcn/ui + Recharts · Vitest。

**规格：** `docs/superpowers/specs/2026-09-01-time-viewer-design.md`

---

## 全局约定（执行前必读）

1. **Next 15 的 `searchParams` 是 Promise**：页面组件签名一律 `async ({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> })`，先 `await searchParams` 再用。
2. **共享类型放 `lib/types.ts`**：`lib/dal.ts` 带 `"server-only"`，客户端组件只能从 `lib/types.ts` 导入类型（`import type`），绝不能从 dal 导入。
3. **时区**：服务端一切时区口径来自 `DISPLAY_TZ`（默认 `Asia/Shanghai`）；需要格式化时间的客户端组件由服务端页面以 `tz` prop 传入，客户端不读环境变量。
4. **区间语义统一**：`{from, to}` 两端都含（inclusive）；DAL 内部换算为 `[dayStartInTz(from), dayStartInTz(addDay(to,1)))`。
5. **归属规则**：跨午夜区间按开始时间归属当天（统计与时间轴一致，时间轴上超出 24:00 的部分截断显示）。
6. 每个任务完成后按步骤提交 git；提交信息用中文，格式如 `脚手架：初始化项目`。
7. Windows + Git Bash 环境，bash 命令均在此环境执行。

## 文件结构总览

```
├── auth.ts                                  # Task 8  NextAuth 配置（白名单）
├── middleware.ts                            # Task 8  未登录跳 /login
├── drizzle.config.ts                        # Task 3
├── vitest.config.ts                         # Task 1
├── .env.example / .env.local                # Task 2（local 不入库）
├── lib/
│   ├── types.ts                             # Task 5  共享 DTO/类型（server/client 两用）
│   ├── schema.ts                            # Task 3  entries 表
│   ├── db.ts                                # Task 3  Drizzle 客户端
│   ├── dal.ts                               # Task 9  requireOwner + 全部查询
│   ├── time.ts                              # Task 5  时区/日期工具（TDD）
│   ├── colors.ts                            # Task 6  分类→颜色（TDD）
│   ├── filters.ts                           # Task 7  searchParams 解析（TDD）
│   └── views/registry.ts                    # Task 10 视图清单
├── components/
│   ├── sidebar-nav.tsx                      # Task 10 侧边导航（client，读 searchParams）
│   ├── filter-bar.tsx                       # Task 11 共享筛选栏（client）
│   └── ui/…                                 # shadcn 组件（Task 1 生成）
├── app/
│   ├── layout.tsx                           # Task 10 改 metadata 标题
│   ├── login/page.tsx + login-button.tsx    # Task 8
│   ├── (dashboard)/
│   │   ├── layout.tsx                       # Task 10
│   │   ├── page.tsx                         # Task 10 占位 → Task 16 实现
│   │   ├── error.tsx                        # Task 17
│   │   └── views/
│   │       ├── timeline/{view.ts, page.tsx, timeline-view.tsx}   # Task 10/12
│   │       ├── calendar/{view.ts, page.tsx, calendar-view.tsx}   # Task 10/14
│   │       ├── charts/{view.ts, page.tsx, charts-view.tsx}       # Task 10/15
│   │       └── list/{view.ts, page.tsx, table-view.tsx}          # Task 10/13
│   └── api/auth/[...nextauth]/route.ts      # Task 8
├── scripts/seed.ts                          # Task 4
└── drizzle/                                 # Task 3 生成的迁移
```

---

### Task 1: 脚手架——初始化 Next.js 项目与全部依赖

**Files:**
- Create: 由 create-next-app 生成（app/、public/、package.json、eslint.config.mjs、tsconfig.json 等）
- Modify: `.gitignore`（合并 create-next-app 的忽略项）
- Create: `vitest.config.ts`

- [x] **Step 1: 在子目录中生成 Next.js 15 项目**

仓库已有文件（docs/、.git），create-next-app 不能在非空目录直接初始化，先在子目录生成再移入：

```bash
npx create-next-app@15 scaffold-tmp --ts --tailwind --eslint --app --no-src-dir --import-alias "@/*" --use-npm --yes
```

预期：生成 `scaffold-tmp/`，无交互提问（全部 flag 已指定 + `--yes`）。

- [x] **Step 2: 移入仓库根目录**

```bash
mv scaffold-tmp/* .
mv scaffold-tmp/eslint.config.mjs .
cat scaffold-tmp/.gitignore >> .gitignore
rm scaffold-tmp/.gitignore
rmdir scaffold-tmp
```

预期：`app/`、`public/`、`node_modules/`、`package.json` 等出现在根目录；`.gitignore` 追加了 node_modules、.next、.env*.local 等条目。

- [x] **Step 3: 安装运行时与开发依赖**

```bash
npm i next-auth@beta drizzle-orm @neondatabase/serverless recharts lucide-react
npm i -D drizzle-kit vitest tsx dotenv
```

- [x] **Step 4: 初始化 shadcn/ui 并添加所需组件**

```bash
npx shadcn@latest init -d -y
npx shadcn@latest add button card input select table badge separator -y
```

预期：`components/ui/` 下出现 button/card/input/select/table/badge/separator 及依赖的 ui 组件。

- [x] **Step 5: 配置 Vitest**

创建 `vitest.config.ts`：

```ts
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { environment: "node" },
  resolve: { alias: { "@": path.resolve(process.cwd()) } },
});
```

添加 test 脚本：

```bash
npm pkg set scripts.test="vitest run"
```

- [x] **Step 6: 验证构建与测试链路**

```bash
npm run build && npm test
```

预期：build 成功（默认脚手架页面）；vitest 报 "No test files found" 但退出码为 0（如非 0，在 vitest.config.ts 的 test 里加 `passWithNoTests: true`）。

```bash
npm list next
```

预期：next ≥ 15.2.3（CVE-2025-29927 已修复的硬性要求）。

- [x] **Step 7: 提交**

```bash
git add -A
git commit -m "脚手架：初始化 Next.js 15 + Tailwind + shadcn/ui + Drizzle/NextAuth/Recharts 依赖"
```

---

### Task 2: 环境变量与 GitHub OAuth App（本地）

**Files:**
- Create: `.env.example`（入库）
- Create: `.env.local`（不入库，`.env*.local` 已被 gitignore）

- [ ] **Step 1: 创建 `.env.example`**

```bash
# 会话 JWE 加解密密钥（必填）：node -e "console.log(require('crypto').randomBytes(32).toString('base64')"
AUTH_SECRET=
# GitHub OAuth App 凭据（本地 App 回调填 http://localhost:3000/api/auth/callback/github）
AUTH_GITHUB_ID=
AUTH_GITHUB_SECRET=
# 白名单：owner 的 GitHub 数字 id（不是用户名）
OWNER_GITHUB_ID=
# Neon 连接串
DATABASE_URL=
# 展示时区（天归属/日历分桶/图表口径），默认 Asia/Shanghai
DISPLAY_TZ=Asia/Shanghai
```

```bash
cp .env.example .env.local
```

- [ ] **Step 2: 生成 AUTH_SECRET 并填入 .env.local**

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

把输出填进 `.env.local` 的 `AUTH_SECRET=`。

- [ ] **Step 3: 创建本地 GitHub OAuth App**

GitHub → Settings → Developer settings → OAuth Apps → New OAuth App：

- Application name: `time-viewer-local`
- Homepage URL: `http://localhost:3000`
- Authorization callback URL: `http://localhost:3000/api/auth/callback/github`

创建后把 Client ID / Client Secret 填进 `.env.local` 的 `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET`。

- [ ] **Step 4: 创建 Neon 项目并取得连接串**

neon.com → Sign up / Log in → Create project（区域任选）→ Project Dashboard → Connection string（选 **pooled** 连接串，形如 `postgresql://user:pass@ep-xxx-pooler.region.aws.neon.tech/neondb?sslmode=require`）→ 填进 `.env.local` 的 `DATABASE_URL`。

- [ ] **Step 5: 获取 OWNER_GITHUB_ID（数字 id）**

```bash
curl -s https://api.github.com/users/<你的GitHub用户名> | grep '"id"'
```

把数字填进 `.env.local` 的 `OWNER_GITHUB_ID`。

- [ ] **Step 6: 提交（只有 .env.example）**

```bash
git add .env.example
git commit -m "配置：添加环境变量模板"
```

---

### Task 3: 数据层——schema、Drizzle 客户端与迁移

**Files:**
- Create: `lib/schema.ts`
- Create: `lib/db.ts`
- Create: `drizzle.config.ts`
- Create: `drizzle/`（drizzle-kit 生成）

前置：`.env.local` 的 `DATABASE_URL` 已填入 Neon 连接串（Neon 控制台 → Project → Connection string，用 pooled 连接串）。

- [ ] **Step 1: 创建 `lib/schema.ts`**

```ts
import { bigint, index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const entries = pgTable("entries", {
  id: bigint("id").generatedAlwaysAsIdentity().primaryKey(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
  endedAt: timestamp("ended_at", { withTimezone: true }).notNull(),
  category: text("category").notNull(),
  activity: text("activity").notNull(),
  note: text("note"),
  source: text("source").notNull().default("default"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("entries_started_at_idx").on(t.startedAt),
  index("entries_category_idx").on(t.category),
]);
```

- [ ] **Step 2: 创建 `lib/db.ts`**

```ts
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle(sql, { schema });
```

- [ ] **Step 3: 创建 `drizzle.config.ts`**

```ts
import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.local" });

export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
```

- [ ] **Step 4: 生成并执行迁移**

```bash
npx drizzle-kit generate
npx drizzle-kit migrate
```

预期：`drizzle/0000_*.sql` 生成并应用到 Neon（CREATE TABLE entries + 两个索引）。

- [ ] **Step 5: 提交**

```bash
git add lib/schema.ts lib/db.ts drizzle.config.ts drizzle/
git commit -m "数据层：entries 表结构与 Drizzle 客户端及首个迁移"
```

---

### Task 4: 种子脚本——灌入 30 天仿真数据

**Files:**
- Create: `scripts/seed.ts`

开发期没有写入方项目，四个视图的调试全靠这份数据。

- [ ] **Step 1: 创建 `scripts/seed.ts`**

```ts
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
```

- [ ] **Step 2: 执行并验证**

```bash
npx tsx scripts/seed.ts
```

预期：输出 `已插入 N 条记录`（N 约 120–200）。再跑一次：

```bash
npx tsx scripts/seed.ts
```

预期：退出码 1，输出"entries 已有数据"（防误重灌保护生效）。

- [ ] **Step 3: 提交**

```bash
git add scripts/seed.ts
git commit -m "工具：30 天仿真数据种子脚本"
```

---

### Task 5: 共享类型与时区工具（TDD）

**Files:**
- Create: `lib/types.ts`
- Create: `lib/time.ts`
- Test: `lib/time.test.ts`

- [ ] **Step 1: 创建 `lib/types.ts`（server/client 共享的纯类型）**

```ts
export type CommonFilter = { category: string | null; q: string | null };

export type EntryDTO = {
  id: number;
  startedAt: Date;
  endedAt: Date;
  durationMinutes: number;
  category: string;
  activity: string;
  note: string | null;
};

export type DailyTotal = {
  date: string;
  totalMinutes: number;
  byCategory: Record<string, number>;
};

export type CategoryTotal = { category: string; minutes: number };

export type ActivityTotal = { activity: string; category: string; minutes: number };
```

- [ ] **Step 2: 写失败测试 `lib/time.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import {
  addDay,
  addMonth,
  dayEndInTz,
  dayKeyOf,
  dayStartInTz,
  formatDuration,
  formatTimeInTz,
  isValidDateStr,
  isValidMonthStr,
  lastNDays,
  monthRange,
  weekRange,
} from "./time";

describe("dayStartInTz / dayEndInTz", () => {
  it("上海：当天 00:00 对应 UTC 前一天 16:00", () => {
    expect(dayStartInTz("2026-09-01", "Asia/Shanghai").toISOString()).toBe(
      "2026-08-31T16:00:00.000Z",
    );
    expect(dayEndInTz("2026-09-01", "Asia/Shanghai").toISOString()).toBe(
      "2026-09-01T16:00:00.000Z",
    );
  });
  it("UTC：当天 00:00 即 UTC 零点", () => {
    expect(dayStartInTz("2026-09-01", "UTC").toISOString()).toBe("2026-09-01T00:00:00.000Z");
  });
  it("纽约 DST 切换日（2026-03-08）午夜仍为 EST(-5)", () => {
    expect(dayStartInTz("2026-03-08", "America/New_York").toISOString()).toBe(
      "2026-03-08T05:00:00.000Z",
    );
  });
});

describe("dayKeyOf", () => {
  it("UTC 20:00 在上海已是次日", () => {
    expect(dayKeyOf(new Date("2026-08-31T20:00:00Z"), "Asia/Shanghai")).toBe("2026-09-01");
  });
});

describe("addDay / addMonth", () => {
  it("跨月与闰年回退", () => {
    expect(addDay("2026-08-31", 1)).toBe("2026-09-01");
    expect(addDay("2026-03-01", -1)).toBe("2026-02-28");
  });
  it("月份加减跨年", () => {
    expect(addMonth("2026-08", 1)).toBe("2026-09");
    expect(addMonth("2025-12", 1)).toBe("2026-01");
  });
});

describe("isValidDateStr / isValidMonthStr", () => {
  it("拒绝不存在的日期与格式错误", () => {
    expect(isValidDateStr("2026-02-30")).toBe(false);
    expect(isValidDateStr("20260901")).toBe(false);
    expect(isValidDateStr("2026-09-01")).toBe(true);
    expect(isValidMonthStr("2026-13")).toBe(false);
    expect(isValidMonthStr("202609")).toBe(false);
    expect(isValidMonthStr("2026-09")).toBe(true);
  });
});

describe("lastNDays / weekRange / monthRange", () => {
  it("近 30 天以今天收尾", () => {
    const r = lastNDays(30, "UTC");
    expect(r.to).toBe(dayKeyOf(new Date(), "UTC"));
    expect(addDay(r.from, 29)).toBe(r.to);
  });
  it("weekRange 周一起周日止（2026-09-01 是周二）", () => {
    expect(weekRange("2026-09-01")).toEqual({ from: "2026-08-31", to: "2026-09-06" });
  });
  it("monthRange 两端含（9 月 30 天）", () => {
    expect(monthRange("2026-09")).toEqual({ from: "2026-09-01", to: "2026-09-30" });
    expect(monthRange("2026-02")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
  });
});

describe("formatDuration / formatTimeInTz", () => {
  it("分钟/小时格式", () => {
    expect(formatDuration(0)).toBe("0m");
    expect(formatDuration(45)).toBe("45m");
    expect(formatDuration(60)).toBe("1h");
    expect(formatDuration(90)).toBe("1h 30m");
  });
  it("按指定时区格式化时刻", () => {
    expect(formatTimeInTz(new Date("2026-09-01T02:30:00Z"), "Asia/Shanghai")).toBe("10:30");
  });
});
```

- [ ] **Step 3: 运行测试确认失败**

```bash
npm test
```

预期：FAIL，报错模块 `./time` 不存在。

- [ ] **Step 4: 实现 `lib/time.ts`**

```ts
export function getDisplayTz(): string {
  return process.env.DISPLAY_TZ ?? "Asia/Shanghai";
}

function tzOffsetMs(date: Date, tz: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const asUTC = Date.UTC(
    get("year"), get("month") - 1, get("day"),
    get("hour") % 24, get("minute"), get("second"),
  );
  return asUTC - date.getTime();
}

/** 给定展示时区里的日期字符串，返回该日 00:00 对应的 UTC 瞬间（两遍修正 DST） */
export function dayStartInTz(dateStr: string, tz = getDisplayTz()): Date {
  const naive = new Date(`${dateStr}T00:00:00Z`);
  let result = new Date(naive.getTime() - tzOffsetMs(naive, tz));
  result = new Date(naive.getTime() - tzOffsetMs(result, tz));
  return result;
}

/** 该日 24:00（次日 00:00）对应的 UTC 瞬间，作为排他上界 */
export function dayEndInTz(dateStr: string, tz = getDisplayTz()): Date {
  return dayStartInTz(addDay(dateStr, 1), tz);
}

/** 瞬间在展示时区里的日期键 YYYY-MM-DD */
export function dayKeyOf(date: Date, tz = getDisplayTz()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(date);
}

export function todayStr(tz = getDisplayTz()): string {
  return dayKeyOf(new Date(), tz);
}

export function currentMonthStr(tz = getDisplayTz()): string {
  return todayStr(tz).slice(0, 7);
}

export function addDay(dateStr: string, delta: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

export function addMonth(monthStr: string, delta: number): string {
  const [y, m] = monthStr.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function isValidDateStr(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) &&
    new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;
}

export function isValidMonthStr(s: string): boolean {
  if (!/^\d{4}-\d{2}$/.test(s)) return false;
  const m = Number(s.slice(5));
  return m >= 1 && m <= 12;
}

/** 近 n 天（含今天），两端 inclusive */
export function lastNDays(n: number, tz = getDisplayTz()): { from: string; to: string } {
  const to = todayStr(tz);
  return { from: addDay(to, -(n - 1)), to };
}

/** anchor 所在周的周一~周日，两端 inclusive；缺省用今天 */
export function weekRange(anchorStr?: string, tz = getDisplayTz()): { from: string; to: string } {
  const anchor = anchorStr ?? todayStr(tz);
  const dow = new Date(`${anchor}T00:00:00Z`).getUTCDay(); // 0=周日
  const from = addDay(anchor, -((dow + 6) % 7));
  return { from, to: addDay(from, 6) };
}

/** 该月首日~末日，两端 inclusive */
export function monthRange(monthStr: string): { from: string; to: string } {
  const [y, m] = monthStr.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const last = new Date(Date.UTC(y, m, 0));
  return { from: first.toISOString().slice(0, 10), to: last.toISOString().slice(0, 10) };
}

export function formatDuration(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${r}m`;
  if (r === 0) return `${h}h`;
  return `${h}h ${r}m`;
}

export function formatTimeInTz(date: Date, tz = getDisplayTz()): string {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(date);
}
```

- [ ] **Step 5: 运行测试确认通过**

```bash
npm test
```

预期：全部 PASS。

- [ ] **Step 6: 提交**

```bash
git add lib/types.ts lib/time.ts lib/time.test.ts
git commit -m "工具：共享类型与时区/日期工具（TDD）"
```

---

### Task 6: 分类配色（TDD）

**Files:**
- Create: `lib/colors.ts`
- Test: `lib/colors.test.ts`

- [ ] **Step 1: 写失败测试 `lib/colors.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { PALETTE, categoryColor } from "./colors";

describe("categoryColor", () => {
  it("同一分类返回稳定颜色", () => {
    expect(categoryColor("工作")).toBe(categoryColor("工作"));
  });
  it("显式映射优先", () => {
    expect(categoryColor("工作")).toBe("#2563eb");
    expect(categoryColor("学习")).toBe("#7c3aed");
  });
  it("未知分类兜底到调色板内", () => {
    for (const c of ["完全未知的分类", "a", "运动2", "_xyz"]) {
      expect(PALETTE).toContain(categoryColor(c));
    }
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npm test
```

预期：FAIL，模块 `./colors` 不存在。

- [ ] **Step 3: 实现 `lib/colors.ts`**

```ts
export const PALETTE = [
  "#2563eb", "#059669", "#d97706", "#dc2626",
  "#7c3aed", "#0891b2", "#db2777", "#65a30d",
] as const;

const EXPLICIT: Record<string, string> = {
  工作: "#2563eb",
  学习: "#7c3aed",
  娱乐: "#d97706",
  运动: "#059669",
  休息: "#64748b",
};

/** 分类 → 稳定颜色：显式映射优先，未知分类按名称 hash 落入调色板 */
export function categoryColor(category: string): string {
  const explicit = EXPLICIT[category];
  if (explicit) return explicit;
  let h = 0;
  for (const ch of category) h = (h * 31 + ch.codePointAt(0)!) >>> 0;
  return PALETTE[h % PALETTE.length];
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
npm test
```

预期：全部 PASS。

- [ ] **Step 5: 提交**

```bash
git add lib/colors.ts lib/colors.test.ts
git commit -m "工具：分类稳定配色映射（TDD）"
```

---

### Task 7: searchParams 解析（TDD）

**Files:**
- Create: `lib/filters.ts`
- Test: `lib/filters.test.ts`

- [ ] **Step 1: 写失败测试 `lib/filters.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { parseCommon, parseDateParam, parseMonthParam, parsePage, parseRange } from "./filters";

describe("parseCommon", () => {
  it("空/空白参数返回 null", () => {
    expect(parseCommon({})).toEqual({ category: null, q: null });
    expect(parseCommon({ category: "  ", q: "" })).toEqual({ category: null, q: null });
  });
  it("正常读取并去首尾空白", () => {
    expect(parseCommon({ category: " 工作 ", q: "重构" })).toEqual({ category: "工作", q: "重构" });
  });
});

describe("parseDateParam", () => {
  it("非法日期回退默认值", () => {
    expect(parseDateParam({ date: "2026-02-30" }, "2026-09-01")).toBe("2026-09-01");
    expect(parseDateParam({ date: "abc" }, "2026-09-01")).toBe("2026-09-01");
    expect(parseDateParam({}, "2026-09-01")).toBe("2026-09-01");
  });
  it("合法日期通过", () => {
    expect(parseDateParam({ date: "2026-08-15" }, "2026-09-01")).toBe("2026-08-15");
  });
});

describe("parseMonthParam", () => {
  it("非法月份回退", () => {
    expect(parseMonthParam({ month: "2026-13" }, "2026-09")).toBe("2026-09");
    expect(parseMonthParam({ month: "202609" }, "2026-09")).toBe("2026-09");
    expect(parseMonthParam({}, "2026-09")).toBe("2026-09");
  });
  it("合法月份通过", () => {
    expect(parseMonthParam({ month: "2025-12" }, "2026-09")).toBe("2025-12");
  });
});

describe("parseRange", () => {
  const fallback = { from: "2026-08-01", to: "2026-08-31" };
  it("缺失或非法端点用默认区间", () => {
    expect(parseRange({}, fallback)).toEqual(fallback);
    expect(parseRange({ from: "bad", to: "2026-08-31" }, fallback)).toEqual(fallback);
  });
  it("from 晚于 to 时自动交换", () => {
    expect(parseRange({ from: "2026-08-31", to: "2026-08-01" }, fallback)).toEqual(fallback);
  });
});

describe("parsePage", () => {
  it("非法页码回退第 1 页", () => {
    expect(parsePage({ page: "0" }, 50)).toEqual({ page: 1, offset: 0 });
    expect(parsePage({ page: "-3" }, 50)).toEqual({ page: 1, offset: 0 });
    expect(parsePage({ page: "abc" }, 50)).toEqual({ page: 1, offset: 0 });
    expect(parsePage({}, 50)).toEqual({ page: 1, offset: 0 });
  });
  it("第 3 页 offset 100", () => {
    expect(parsePage({ page: "3" }, 50)).toEqual({ page: 3, offset: 100 });
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npm test
```

预期：FAIL，模块 `./filters` 不存在。

- [ ] **Step 3: 实现 `lib/filters.ts`**

```ts
import { isValidDateStr, isValidMonthStr } from "./time";
import type { CommonFilter } from "./types";

export type SP = Record<string, string | undefined>;

/** 共享筛选：category 精确匹配、q 模糊匹配 note/activity；空白视为未选 */
export function parseCommon(sp: SP): CommonFilter {
  const category = (sp.category ?? "").trim();
  const q = (sp.q ?? "").trim();
  return { category: category || null, q: q || null };
}

/** timeline 主参数：单日 YYYY-MM-DD，非法回退 fallback */
export function parseDateParam(sp: SP, fallback: string): string {
  const v = sp.date;
  return v && isValidDateStr(v) ? v : fallback;
}

/** calendar 主参数：月份 YYYY-MM，非法回退 fallback */
export function parseMonthParam(sp: SP, fallback: string): string {
  const v = sp.month;
  return v && isValidMonthStr(v) ? v : fallback;
}

/** charts/list 主参数：日期区间，两端 inclusive，非法回退，from>to 交换 */
export function parseRange(sp: SP, fallback: { from: string; to: string }): { from: string; to: string } {
  const from = sp.from && isValidDateStr(sp.from) ? sp.from : fallback.from;
  const to = sp.to && isValidDateStr(sp.to) ? sp.to : fallback.to;
  return from <= to ? { from, to } : { from: to, to: from };
}

/** list 分页：1 起始页码 → offset */
export function parsePage(sp: SP, pageSize: number): { page: number; offset: number } {
  const n = Number(sp.page);
  const page = Number.isInteger(n) && n >= 1 ? n : 1;
  return { page, offset: (page - 1) * pageSize };
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
npm test
```

预期：全部 PASS。

- [ ] **Step 5: 提交**

```bash
git add lib/filters.ts lib/filters.test.ts
git commit -m "工具：searchParams 筛选解析，非法参数一律回退默认值（TDD）"
```

---

### Task 8: 认证——NextAuth 白名单、登录页与 middleware

**Files:**
- Create: `auth.ts`
- Create: `app/api/auth/[...nextauth]/route.ts`
- Create: `app/login/page.tsx`
- Create: `app/login/login-button.tsx`
- Create: `middleware.ts`

- [ ] **Step 1: 创建 `auth.ts`**

```ts
import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID,
      clientSecret: process.env.AUTH_GITHUB_SECRET,
      authorization: { params: { scope: "" } }, // 只要身份，不要任何仓库权限
    }),
  ],
  callbacks: {
    // 白名单：比对数字 id（永久不变），不是 login 用户名（可改）
    async signIn({ account }) {
      return (
        account?.provider === "github" &&
        String(account.providerAccountId) === process.env.OWNER_GITHUB_ID
      );
    },
  },
});
```

- [ ] **Step 2: 创建 `app/api/auth/[...nextauth]/route.ts`**

```ts
import { handlers } from "@/auth";

export const { GET, POST } = handlers;
```

- [ ] **Step 3: 创建登录页 `app/login/page.tsx`**

```tsx
import { LoginButton } from "./login-button";

export const metadata = { title: "登录 · time-viewer" };

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-6">
        <h1 className="text-2xl font-semibold">time-viewer</h1>
        <p className="text-sm text-muted-foreground">仅限所有者访问</p>
        <LoginButton />
      </div>
    </main>
  );
}
```

创建 `app/login/login-button.tsx`：

```tsx
"use client";

import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";

export function LoginButton() {
  return <Button onClick={() => signIn("github")}>使用 GitHub 登录</Button>;
}
```

- [ ] **Step 4: 创建 `middleware.ts`（体验层：未登录跳转，非安全边界）**

```ts
import { auth } from "@/auth";

export default auth((req) => {
  if (!req.auth) {
    return Response.redirect(new URL("/login", req.url));
  }
});

export const config = {
  matcher: ["/((?!login|api/auth|_next|favicon\\.ico|.*\\.svg).*)"],
};
```

- [ ] **Step 5: 本地验证登录链路**

```bash
npm run dev
```

浏览器验证（依次确认）：
1. 访问 `http://localhost:3000/` → 被跳转到 `/login`
2. 点击"使用 GitHub 登录" → GitHub 授权 → 跳回后不再被重定向（脚手架首页可见）
3. 用 DevTools 清掉 cookie（或无痕窗口）再访问 `/` → 再次跳 `/login`
4. 把 `.env.local` 的 `OWNER_GITHUB_ID` 临时改成一个错误数字，重启 dev，重新登录 → 回到 `/login?error=AccessDenied`（白名单拒绝生效）。**验证完改回正确值。**

- [ ] **Step 6: 提交**

```bash
git add auth.ts middleware.ts app/login app/api
git commit -m "认证：GitHub OAuth 白名单 + 登录页 + middleware 跳转"
```

---

### Task 9: DAL——requireOwner 与全部查询函数

**Files:**
- Create: `lib/dal.ts`

安全要点（来自规格）：`"server-only"` 护栏；每个函数首行 `await requireOwner()`；throw 而非 redirect；DTO 显式列字段；聚合在 SQL 按 `DISPLAY_TZ` 分桶；区间换算为 `[dayStartInTz(from), dayStartInTz(addDay(to,1)))`。

- [ ] **Step 1: 创建 `lib/dal.ts`**

```ts
import "server-only";

import { cache } from "react";
import { and, desc, eq, gte, ilike, lt, or, sql } from "drizzle-orm";

import { auth } from "@/auth";
import { db } from "./db";
import { entries } from "./schema";
import { addDay, dayStartInTz, getDisplayTz } from "./time";
import type {
  ActivityTotal,
  CategoryTotal,
  CommonFilter,
  DailyTotal,
  EntryDTO,
} from "./types";

/** 安全边界：无有效会话即 throw；cache() 是请求级去重（性能优化，非安全机制） */
export const requireOwner = cache(async () => {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHORIZED");
  return { userId: process.env.OWNER_GITHUB_ID! };
});

function matchFilter(filter: CommonFilter) {
  const conds = [];
  if (filter.category) conds.push(eq(entries.category, filter.category));
  if (filter.q) {
    conds.push(or(ilike(entries.note, `%${filter.q}%`), ilike(entries.activity, `%${filter.q}%`)));
  }
  return conds.length > 0 ? and(...conds) : undefined;
}

function rangeToInstants(range: { from: string; to: string }) {
  return {
    start: dayStartInTz(range.from),
    end: dayStartInTz(addDay(range.to, 1)),
  };
}

const minutesExpr = sql<number>`coalesce(round(sum(extract(epoch from (${entries.endedAt} - ${entries.startedAt})) / 60))::int, 0)`;

const entryColumns = {
  id: entries.id,
  startedAt: entries.startedAt,
  endedAt: entries.endedAt,
  category: entries.category,
  activity: entries.activity,
  note: entries.note,
};

type EntryRow = { id: number; startedAt: Date; endedAt: Date; category: string; activity: string; note: string | null };

function toDTO(r: EntryRow): EntryDTO {
  return {
    id: r.id,
    startedAt: r.startedAt,
    endedAt: r.endedAt,
    durationMinutes: Math.max(
      0,
      Math.round((r.endedAt.getTime() - r.startedAt.getTime()) / 60_000),
    ),
    category: r.category,
    activity: r.activity,
    note: r.note,
  };
}

export async function listEntries(
  range: { from: string; to: string },
  filter: CommonFilter,
  opts: { limit: number; offset: number },
): Promise<EntryDTO[]> {
  await requireOwner();
  const { start, end } = rangeToInstants(range);
  const rows = await db
    .select(entryColumns)
    .from(entries)
    .where(and(gte(entries.startedAt, start), lt(entries.startedAt, end), matchFilter(filter)))
    .orderBy(desc(entries.startedAt))
    .limit(opts.limit)
    .offset(opts.offset);
  return rows.map(toDTO);
}

export async function countEntries(
  range: { from: string; to: string },
  filter: CommonFilter,
): Promise<number> {
  await requireOwner();
  const { start, end } = rangeToInstants(range);
  const rows = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(entries)
    .where(and(gte(entries.startedAt, start), lt(entries.startedAt, end), matchFilter(filter)));
  return rows[0]?.n ?? 0;
}

/** 时间轴：startedAt 落在该日的全部记录（与统计归属口径一致） */
export async function getDayEntries(date: string, filter: CommonFilter): Promise<EntryDTO[]> {
  await requireOwner();
  const start = dayStartInTz(date);
  const end = dayStartInTz(addDay(date, 1));
  const rows = await db
    .select(entryColumns)
    .from(entries)
    .where(and(gte(entries.startedAt, start), lt(entries.startedAt, end), matchFilter(filter)))
    .orderBy(entries.startedAt);
  return rows.map(toDTO);
}

/** 按日汇总（按开始时间归属当天，DISPLAY_TZ 分桶），服务月历/趋势图/首页 */
export async function getDailyTotals(
  range: { from: string; to: string },
  filter: CommonFilter,
): Promise<DailyTotal[]> {
  await requireOwner();
  const { start, end } = rangeToInstants(range);
  const tz = getDisplayTz();
  const rows = await db
    .select({
      day: sql<string>`to_char(${entries.startedAt} AT TIME ZONE ${tz}, 'YYYY-MM-DD')`,
      category: entries.category,
      minutes: minutesExpr,
    })
    .from(entries)
    .where(and(gte(entries.startedAt, start), lt(entries.startedAt, end), matchFilter(filter)))
    .groupBy(sql`1`, entries.category);

  const map = new Map<string, DailyTotal>();
  for (const r of rows) {
    const d = map.get(r.day) ?? { date: r.day, totalMinutes: 0, byCategory: {} };
    d.totalMinutes += r.minutes;
    d.byCategory[r.category] = (d.byCategory[r.category] ?? 0) + r.minutes;
    map.set(r.day, d);
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export async function getCategoryBreakdown(
  range: { from: string; to: string },
  filter: CommonFilter,
): Promise<CategoryTotal[]> {
  await requireOwner();
  const { start, end } = rangeToInstants(range);
  const rows = await db
    .select({ category: entries.category, minutes: minutesExpr })
    .from(entries)
    .where(and(gte(entries.startedAt, start), lt(entries.startedAt, end), matchFilter(filter)))
    .groupBy(entries.category);
  return rows.sort((a, b) => b.minutes - a.minutes);
}

export async function getActivityBreakdown(
  range: { from: string; to: string },
  filter: CommonFilter,
): Promise<ActivityTotal[]> {
  await requireOwner();
  const { start, end } = rangeToInstants(range);
  const rows = await db
    .select({ activity: entries.activity, category: entries.category, minutes: minutesExpr })
    .from(entries)
    .where(and(gte(entries.startedAt, start), lt(entries.startedAt, end), matchFilter(filter)))
    .groupBy(entries.activity, entries.category);
  return rows.sort((a, b) => b.minutes - a.minutes).slice(0, 10);
}

/** 筛选下拉的选项：去重分类 */
export async function getCategories(): Promise<string[]> {
  await requireOwner();
  const rows = await db
    .selectDistinct({ category: entries.category })
    .from(entries)
    .orderBy(entries.category);
  return rows.map((r) => r.category);
}
```

- [ ] **Step 2: 类型检查**

```bash
npx tsc --noEmit
```

预期：无错误。（DAL 的行为验证在 Task 12–15 的页面里对着种子数据进行，无法脱离会话单测。）

- [ ] **Step 3: 提交**

```bash
git add lib/dal.ts
git commit -m "数据访问层：requireOwner 安全边界与六个查询函数"
```

---

### Task 10: 视图插件骨架——registry、manifest、布局与占位页

**Files:**
- Create: `lib/views/registry.ts`
- Create: `app/(dashboard)/views/timeline/view.ts`、`app/(dashboard)/views/calendar/view.ts`、`app/(dashboard)/views/charts/view.ts`、`app/(dashboard)/views/list/view.ts`
- Create: 四个视图的占位 `page.tsx`（Task 12–15 替换为真实现）
- Create: `app/(dashboard)/layout.tsx`、`components/sidebar-nav.tsx`
- Create: `app/(dashboard)/page.tsx`（占位，Task 16 替换）
- Delete: `app/page.tsx`（脚手架首页，与 `(dashboard)/page.tsx` 路由冲突）
- Modify: `app/layout.tsx`（站点标题）

- [ ] **Step 1: 创建四个视图的 manifest**

`app/(dashboard)/views/timeline/view.ts`：

```ts
import { Clock } from "lucide-react";
import type { ViewManifest } from "@/lib/views/registry";

export const manifest: ViewManifest = { id: "timeline", title: "时间轴", icon: Clock, order: 1 };
```

`app/(dashboard)/views/calendar/view.ts`：

```ts
import { CalendarDays } from "lucide-react";
import type { ViewManifest } from "@/lib/views/registry";

export const manifest: ViewManifest = { id: "calendar", title: "月历", icon: CalendarDays, order: 2 };
```

`app/(dashboard)/views/charts/view.ts`：

```ts
import { PieChart } from "lucide-react";
import type { ViewManifest } from "@/lib/views/registry";

export const manifest: ViewManifest = { id: "charts", title: "图表", icon: PieChart, order: 3 };
```

`app/(dashboard)/views/list/view.ts`：

```ts
import { List } from "lucide-react";
import type { ViewManifest } from "@/lib/views/registry";

export const manifest: ViewManifest = { id: "list", title: "明细", icon: List, order: 4 };
```

- [ ] **Step 2: 创建 `lib/views/registry.ts`（唯一注册点）**

```ts
import type { LucideIcon } from "lucide-react";

import { manifest as calendar } from "@/app/(dashboard)/views/calendar/view";
import { manifest as charts } from "@/app/(dashboard)/views/charts/view";
import { manifest as list } from "@/app/(dashboard)/views/list/view";
import { manifest as timeline } from "@/app/(dashboard)/views/timeline/view";

export type ViewManifest = {
  id: string;
  title: string;
  icon: LucideIcon;
  order: number;
};

/** 增加视图 = 新建目录 + 此处加一行 import；移除 = 删目录 + 删对应行 */
export const views = [timeline, calendar, charts, list].sort((a, b) => a.order - b.order);
```

- [ ] **Step 3: 创建四个占位 page.tsx**

四个文件内容相同（各自放在自己视图目录下），以 timeline 为例，`app/(dashboard)/views/timeline/page.tsx`：

```tsx
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function TimelinePage() {
  return <p>时间轴开发中</p>;
}
```

calendar/charts/list 同样处理，占位文案分别为 `月历开发中`、`图表开发中`、`明细开发中`。

- [ ] **Step 4: 删除脚手架首页，创建 dashboard 布局与占位首页**

```bash
rm app/page.tsx
```

`app/(dashboard)/page.tsx`：

```tsx
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function HomePage() {
  return <p>总览开发中</p>;
}
```

`app/(dashboard)/layout.tsx`：

```tsx
import { Suspense } from "react";

import { SidebarNav } from "@/components/sidebar-nav";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex max-w-6xl gap-6 px-4 py-6">
        <aside className="hidden w-44 shrink-0 md:block">
          <Suspense>
            <SidebarNav />
          </Suspense>
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: 创建 `components/sidebar-nav.tsx`（client，携带共享筛选参数）**

```tsx
"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { views } from "@/lib/views/registry";

export function SidebarNav() {
  const pathname = usePathname();
  const sp = useSearchParams();

  // 只携带共享参数（category/q），视图主参数不跨视图
  const shared = new URLSearchParams();
  if (sp.get("category")) shared.set("category", sp.get("category")!);
  if (sp.get("q")) shared.set("q", sp.get("q")!);
  const qs = shared.toString();

  const link = (href: string) => `${href}${qs ? `?${qs}` : ""}`;
  const cls = (active: boolean) =>
    `flex items-center gap-2 rounded px-3 py-2 text-sm hover:bg-accent ${active ? "bg-accent font-medium" : "text-muted-foreground"}`;

  return (
    <nav className="flex flex-col gap-1">
      <Link href={link("/")} className={cls(pathname === "/")}>
        总览
      </Link>
      {views.map((v) => (
        <Link key={v.id} href={link(`/views/${v.id}`)} className={cls(pathname === `/views/${v.id}`)}>
          <v.icon className="size-4" />
          {v.title}
        </Link>
      ))}
    </nav>
  );
}
```

- [ ] **Step 6: 修改 `app/layout.tsx` 的 metadata**

把脚手架自带的 metadata 对象改为（其余内容不动）：

```ts
export const metadata: Metadata = {
  title: "time-viewer",
  description: "个人时间记录查看器",
};
```

- [ ] **Step 7: 验证**

```bash
npm run build
```

预期：构建成功；无 `app/page.tsx` 与 `(dashboard)/page.tsx` 的路由冲突。dev 起服务后：`/`、`/views/timeline` 等都可访问（已登录态），侧边栏五项齐全。

- [ ] **Step 8: 提交**

```bash
git add -A
git commit -m "骨架：视图 registry 插件体系、dashboard 布局与侧边导航"
```

---

### Task 11: 共享筛选栏组件

**Files:**
- Create: `components/filter-bar.tsx`

设计要点：mode 决定时间导航控件（date/month/range）；共享的 category 下拉 + 关键词输入所有模式都有；任何变更重置 `page`；**所有默认值经 `defaults` prop 由服务端页面传入**（客户端不读环境变量）。

- [ ] **Step 1: 创建 `components/filter-bar.tsx`**

```tsx
"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addDay, addMonth } from "@/lib/time";

type Props = {
  categories: string[];
  mode: "date" | "month" | "range";
  defaults: { date?: string; month?: string; from?: string; to?: string };
};

export function FilterBar({ categories, mode, defaults }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [q, setQ] = useState(sp.get("q") ?? "");

  const date = sp.get("date") ?? defaults.date!;
  const month = sp.get("month") ?? defaults.month!;
  const from = sp.get("from") ?? defaults.from!;
  const to = sp.get("to") ?? defaults.to!;

  function update(mutate: (p: URLSearchParams) => void) {
    const params = new URLSearchParams(sp.toString());
    mutate(params);
    params.delete("page"); // 筛选变更后回到第 1 页
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {mode === "date" && (
        <>
          <Button variant="outline" size="sm" onClick={() => update((p) => p.set("date", addDay(date, -1)))}>
            前一天
          </Button>
          <Input
            type="date"
            className="w-40"
            value={date}
            onChange={(e) => e.target.value && update((p) => p.set("date", e.target.value))}
          />
          <Button variant="outline" size="sm" onClick={() => update((p) => p.set("date", addDay(date, 1)))}>
            后一天
          </Button>
        </>
      )}
      {mode === "month" && (
        <>
          <Button variant="outline" size="sm" onClick={() => update((p) => p.set("month", addMonth(month, -1)))}>
            上月
          </Button>
          <Input
            type="month"
            className="w-36"
            value={month}
            onChange={(e) => e.target.value && update((p) => p.set("month", e.target.value))}
          />
          <Button variant="outline" size="sm" onClick={() => update((p) => p.set("month", addMonth(month, 1)))}>
            下月
          </Button>
        </>
      )}
      {mode === "range" && (
        <>
          <Input
            type="date"
            className="w-40"
            value={from}
            onChange={(e) => e.target.value && update((p) => p.set("from", e.target.value))}
          />
          <span className="text-sm text-muted-foreground">至</span>
          <Input
            type="date"
            className="w-40"
            value={to}
            onChange={(e) => e.target.value && update((p) => p.set("to", e.target.value))}
          />
        </>
      )}

      <Select
        value={sp.get("category") ?? "all"}
        onValueChange={(v) =>
          update((p) => (v === "all" ? p.delete("category") : p.set("category", v)))
        }
      >
        <SelectTrigger className="w-32">
          <SelectValue placeholder="全部分类" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">全部分类</SelectItem>
          {categories.map((c) => (
            <SelectItem key={c} value={c}>
              {c}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          update((p) => (q ? p.set("q", q) : p.delete("q")));
        }}
      >
        <Input
          className="w-44"
          placeholder="关键词：活动/备注"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <Button type="submit" variant="outline" size="sm">
          搜索
        </Button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: 类型检查与构建**

```bash
npx tsc --noEmit && npm run build
```

预期：无错误。

- [ ] **Step 3: 提交**

```bash
git add components/filter-bar.tsx
git commit -m "组件：共享筛选栏（日期/月份/区间三种模式 + 分类 + 关键词）"
```

---

### Task 12: 时间轴视图（timeline）

**Files:**
- Modify: `app/(dashboard)/views/timeline/page.tsx`（替换占位）
- Create: `app/(dashboard)/views/timeline/timeline-view.tsx`

- [ ] **Step 1: 实现 `app/(dashboard)/views/timeline/page.tsx`**

```tsx
import { FilterBar } from "@/components/filter-bar";
import { getCategories, getDayEntries } from "@/lib/dal";
import { parseCommon, parseDateParam } from "@/lib/filters";
import { getDisplayTz, todayStr } from "@/lib/time";

import { TimelineView } from "./timeline-view";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = { title: "时间轴 · time-viewer" };

export default async function TimelinePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const date = parseDateParam(sp, todayStr());
  const filter = parseCommon(sp);
  const [rows, categories] = await Promise.all([getDayEntries(date, filter), getCategories()]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">时间轴 · {date}</h1>
      <FilterBar mode="date" categories={categories} defaults={{ date }} />
      <TimelineView date={date} entries={rows} tz={getDisplayTz()} />
    </div>
  );
}
```

- [ ] **Step 2: 实现 `app/(dashboard)/views/timeline/timeline-view.tsx`（client）**

```tsx
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
            <span className="inline-block size-2 rounded-full" style={{ background: categoryColor(c) }} />
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
```

- [ ] **Step 3: 本地验证**

```bash
npm run dev
```

已登录访问 `/views/timeline`：能看到种子数据当天的彩色活动块，位置和时长与小时刻度对得上；前一天/后一天、日期输入、分类下拉、关键词都能改变渲染；合计与分类小结正确。

- [ ] **Step 4: 提交**

```bash
git add "app/(dashboard)/views/timeline"
git commit -m "视图：日视图时间轴（24 小时活动块 + 分类小结）"
```

---

### Task 13: 明细列表视图（list）

**Files:**
- Modify: `app/(dashboard)/views/list/page.tsx`（替换占位）
- Create: `app/(dashboard)/views/list/table-view.tsx`

- [ ] **Step 1: 实现 `app/(dashboard)/views/list/page.tsx`**

```tsx
import Link from "next/link";

import { FilterBar } from "@/components/filter-bar";
import { buttonVariants } from "@/components/ui/button";
import { countEntries, getCategories, listEntries } from "@/lib/dal";
import { parseCommon, parsePage, parseRange } from "@/lib/filters";
import { lastNDays } from "@/lib/time";

import { TableView } from "./table-view";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = { title: "明细 · time-viewer" };

const PAGE_SIZE = 50;

export default async function ListPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const range = parseRange(sp, lastNDays(7));
  const filter = parseCommon(sp);
  const { page, offset } = parsePage(sp, PAGE_SIZE);
  const [rows, total, categories] = await Promise.all([
    listEntries(range, filter, { limit: PAGE_SIZE, offset }),
    countEntries(range, filter),
    getCategories(),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function pageHref(target: number) {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) if (v && k !== "page") p.set(k, v);
    p.set("page", String(target));
    return `/views/list?${p.toString()}`;
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">明细</h1>
      <FilterBar mode="range" categories={categories} defaults={range} />
      <p className="text-sm text-muted-foreground">
        {range.from} ~ {range.to} · 共 {total} 条 · 第 {page}/{totalPages} 页
      </p>
      <TableView rows={rows} />
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link href={pageHref(page - 1)} className={buttonVariants({ variant: "outline", size: "sm" })}>
            上一页
          </Link>
        ) : (
          <span className={buttonVariants({ variant: "outline", size: "sm" }) + " pointer-events-none opacity-50"}>
            上一页
          </span>
        )}
        {page < totalPages ? (
          <Link href={pageHref(page + 1)} className={buttonVariants({ variant: "outline", size: "sm" })}>
            下一页
          </Link>
        ) : (
          <span className={buttonVariants({ variant: "outline", size: "sm" }) + " pointer-events-none opacity-50"}>
            下一页
          </span>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 实现 `app/(dashboard)/views/list/table-view.tsx`（server 组件，直接格式化）**

```tsx
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
                  <span className="inline-block size-2 rounded-full" style={{ background: categoryColor(r.category) }} />
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
```

注意：分类列渲染为"颜色圆点 + 文本"（如上），不需要 Badge。

- [ ] **Step 3: 本地验证**

已登录访问 `/views/list`：默认显示最近 7 天明细（倒序）；改日期区间/分类/关键词后条数与内容变化；`?page=999` 显示空表但页码正常（回退逻辑在服务端，不 500）；`?from=abc` 不报错（回退默认区间）。

- [ ] **Step 4: 提交**

```bash
git add "app/(dashboard)/views/list"
git commit -m "视图：明细列表（表格 + 筛选 + 分页）"
```

---

### Task 14: 月历热力图视图（calendar）

**Files:**
- Modify: `app/(dashboard)/views/calendar/page.tsx`（替换占位）
- Create: `app/(dashboard)/views/calendar/calendar-view.tsx`

- [ ] **Step 1: 实现 `app/(dashboard)/views/calendar/page.tsx`**

```tsx
import { FilterBar } from "@/components/filter-bar";
import { getCategories, getDailyTotals } from "@/lib/dal";
import { parseCommon, parseMonthParam } from "@/lib/filters";
import { currentMonthStr, monthRange } from "@/lib/time";

import { CalendarHeatmap } from "./calendar-view";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = { title: "月历 · time-viewer" };

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const month = parseMonthParam(sp, currentMonthStr());
  const range = monthRange(month);
  const filter = parseCommon(sp);
  const [totals, categories] = await Promise.all([
    getDailyTotals(range, filter),
    getCategories(),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">月历 · {month}</h1>
      <FilterBar mode="month" categories={categories} defaults={{ month }} />
      <CalendarHeatmap month={month} totals={totals} />
    </div>
  );
}
```

- [ ] **Step 2: 实现 `app/(dashboard)/views/calendar/calendar-view.tsx`（client）**

```tsx
"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { categoryColor } from "@/lib/colors";
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
    if (sp.get("category")) p.set("category", sp.get("category")!);
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
                  {Object.entries(t.byCategory)
                    .sort((a, b) => b[1] - a[1])
                    .map(([c, mins]) => (
                      <span
                        key={c}
                        style={{
                          width: `${(mins / t.totalMinutes) * 100}%`,
                          background: categoryColor(c),
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
```

- [ ] **Step 3: 本地验证**

已登录访问 `/views/calendar`：当月网格对齐（第一天落在正确的星期列）；有数据的日子显示总时长、底色深浅随时长变化、下方迷你堆叠条按分类着色；上/下月切换正常；点击某天跳到 `/views/timeline?date=…` 且共享筛选保留；`?month=2026-13` 不 500（回退当月）。

- [ ] **Step 4: 提交**

```bash
git add "app/(dashboard)/views/calendar"
git commit -m "视图：月历热力图（日总时长深浅 + 分类堆叠条，点击跳时间轴）"
```

---

### Task 15: 统计图表视图（charts）

**Files:**
- Modify: `app/(dashboard)/views/charts/page.tsx`（替换占位）
- Create: `app/(dashboard)/views/charts/charts-view.tsx`

- [ ] **Step 1: 实现 `app/(dashboard)/views/charts/page.tsx`**

```tsx
import { FilterBar } from "@/components/filter-bar";
import { getActivityBreakdown, getCategories, getCategoryBreakdown, getDailyTotals } from "@/lib/dal";
import { parseCommon, parseRange } from "@/lib/filters";
import { lastNDays } from "@/lib/time";

import { ChartsView } from "./charts-view";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = { title: "图表 · time-viewer" };

export default async function ChartsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const range = parseRange(sp, lastNDays(30));
  const filter = parseCommon(sp);
  const [daily, categoryTotals, activities, categoryOptions] = await Promise.all([
    getDailyTotals(range, filter),
    getCategoryBreakdown(range, filter),
    getActivityBreakdown(range, filter),
    getCategories(),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">图表 · {range.from} ~ {range.to}</h1>
      <FilterBar mode="range" categories={categoryOptions} defaults={range} />
      <ChartsView daily={daily} categoryTotals={categoryTotals} activities={activities} />
    </div>
  );
}
```

（`categoryTotals` 是环形图数据，`categoryOptions` 是筛选下拉选项，勿混用。）

- [ ] **Step 2: 实现 `app/(dashboard)/views/charts/charts-view.tsx`（client，Recharts）**

```tsx
"use client";

import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
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
```

- [ ] **Step 3: 本地验证**

已登录访问 `/views/charts`：三张图渲染且共用筛选区间；柱状趋势图 X 轴为 `MM-DD`；环形图各扇区颜色与其他视图同分类同色；Top10 横向条形图颜色取该活动所属分类色；改筛选后图表联动；无数据的筛选组合显示空图不报错。

- [ ] **Step 4: 提交**

```bash
git add "app/(dashboard)/views/charts"
git commit -m "视图：统计图表（按日趋势/分类占比/活动 Top10）"
```

---

### Task 16: 首页总览

**Files:**
- Modify: `app/(dashboard)/page.tsx`（替换占位）

- [ ] **Step 1: 实现 `app/(dashboard)/page.tsx`**

```tsx
import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCategoryBreakdown, getDailyTotals } from "@/lib/dal";
import { categoryColor } from "@/lib/colors";
import { views } from "@/lib/views/registry";
import { currentMonthStr, formatDuration, monthRange, todayStr, weekRange } from "@/lib/time";
import type { DailyTotal } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = { title: "总览 · time-viewer" };

export default async function HomePage() {
  const today = todayStr();
  const week = weekRange();
  const month = monthRange(currentMonthStr());

  // 一次月度汇总覆盖今日/本周/本月三个口径
  const [daily, weekCategories] = await Promise.all([
    getDailyTotals(month, { category: null, q: null }),
    getCategoryBreakdown(week, { category: null, q: null }),
  ]);

  const sum = (list: DailyTotal[]) => list.reduce((s, d) => s + d.totalMinutes, 0);
  const todayTotal = daily.find((d) => d.date === today)?.totalMinutes ?? 0;
  const weekTotal = sum(daily.filter((d) => d.date >= week.from && d.date <= week.to));
  const monthTotal = sum(daily);
  const topCategory = weekCategories[0];

  const tiles = [
    { label: "今日", value: formatDuration(todayTotal) },
    { label: "本周", value: formatDuration(weekTotal) },
    { label: "本月", value: formatDuration(monthTotal) },
    {
      label: "本周主力",
      value: topCategory
        ? `${topCategory.category} · ${formatDuration(topCategory.minutes)}`
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
              <CardTitle className="text-sm font-normal text-muted-foreground">{t.label}</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{t.value}</CardContent>
          </Card>
        ))}
      </div>
      <div>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">本周分类</h2>
        <div className="flex flex-wrap gap-2">
          {weekCategories.length === 0 && <span className="text-sm text-muted-foreground">暂无数据</span>}
          {weekCategories.map((c) => (
            <span key={c.category} className="flex items-center gap-1.5 text-sm">
              <span className="inline-block size-2 rounded-full" style={{ background: categoryColor(c.category) }} />
              {c.category} {formatDuration(c.minutes)}
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
```

- [ ] **Step 2: 本地验证**

`/`：四块 stat tiles 数值与各自视图口径一致（今日 = 时间轴当天合计；本月 = 月历当月各天之和）；"本周分类"合计 = 本周 tile；四张视图入口卡片可点击跳转。

- [ ] **Step 3: 提交**

```bash
git add "app/(dashboard)/page.tsx"
git commit -m "首页：今日/本周/本月总时长与视图入口总览"
```

---

### Task 17: 错误兜底、force-dynamic 审计与全量本地验证

**Files:**
- Create: `app/(dashboard)/error.tsx`

- [ ] **Step 1: 创建 `app/(dashboard)/error.tsx`**

```tsx
"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // 生产环境 error.message 不下发（只有 digest），所以统一展示通用提示
  return (
    <div className="flex flex-col items-center gap-4 py-20 text-center">
      <h2 className="text-lg font-semibold">出错了</h2>
      <p className="text-sm text-muted-foreground">
        可能是登录状态失效或数据服务暂时不可用，请重试或重新登录。
      </p>
      <div className="flex gap-2">
        <Button onClick={reset}>重试</Button>
        <Button variant="outline" asChild>
          <Link href="/login">重新登录</Link>
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: force-dynamic 审计**

```bash
grep -rL "force-dynamic" "app/(dashboard)" --include="page.tsx"
```

预期：**无输出**（dashboard 下每个 page.tsx 都含 force-dynamic）。若有输出，给对应文件补上：

```ts
export const dynamic = "force-dynamic";
export const revalidate = 0;
```

- [ ] **Step 3: 全量本地验证**

```bash
npm test && npx tsc --noEmit && npm run build
```

预期：测试全 PASS、类型无错、构建成功。

dev 起服务，已登录逐页走查：
1. `/` 总览数字与各视图一致
2. `/views/timeline` 前后一天/日期输入/分类/关键词联动
3. `/views/calendar` 切月、点日跳时间轴
4. `/views/charts` 三图联动筛选
5. `/views/list` 筛选 + 分页 + `?page=999`/`?from=abc` 不 500
6. 侧边栏切换视图时 category/q 保留、date/month/from 不跨视图
7. DevTools → Network → 任一视图文档请求的 RSC payload：只有 DTO 字段（id/startedAt/endedAt/durationMinutes/category/activity/note），无 source、createdAt 等多余字段

- [ ] **Step 4: 提交**

```bash
git add "app/(dashboard)/error.tsx"
git commit -m "兜底：dashboard 错误边界（登录失效/数据异常的通用提示）"
```

---

### Task 18: 部署与上线验证

**Files:**
- 无代码改动；产出部署配置与验证记录

- [ ] **Step 1: 推送代码**

```bash
git push origin master
```

- [ ] **Step 2: 创建生产 GitHub OAuth App**

GitHub → Settings → Developer settings → OAuth Apps → New OAuth App：

- Application name: `time-viewer`
- Homepage URL: `https://<你的生产域名>`
- Authorization callback URL: `https://<你的生产域名>/api/auth/callback/github`

记下 Client ID / Client Secret（生产域名以 Vercel 分配的 `<project>.vercel.app` 或自定义域为准，先建 Vercel 项目拿到域名再回来创建此 App 也行）。

- [ ] **Step 3: Vercel 部署**

Vercel → Add New → Project → 导入 GitHub 仓库（框架自动识别为 Next.js，其余默认）→ 配置 Environment Variables（Production + Preview 都加上，全部标记 Sensitive）：

| 变量 | 值 |
|---|---|
| `AUTH_SECRET` | 新生成一个（`node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`） |
| `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` | 生产 OAuth App 的凭据 |
| `OWNER_GITHUB_ID` | 与本地相同 |
| `DATABASE_URL` | 与本地相同 |
| `DISPLAY_TZ` | `Asia/Shanghai` |

Deploy。预期：构建成功。（Preview 部署的随机域名不在 OAuth 回调白名单里，**Preview 上登录不了是预期行为**，不影响生产。）

- [ ] **Step 4: curl 上线验证清单**

```bash
U=https://<你的生产域名>

curl -si $U/ | head -1                                        # 期望 307（跳 /login）
curl -si $U/views/timeline | head -1                          # 期望 307
curl -si $U/views/list | head -1                              # 期望 307
curl -si -H "x-middleware-subrequest: middleware" $U/ | head -1   # 期望 307（CVE-2025-29927 已修复，不穿透）
curl -sI $U/ | grep -iE "cache-control|x-vercel-cache"        # 期望无 x-vercel-cache: HIT
```

任何一项不符即视为部署不通过，修复后再验证。

- [ ] **Step 5: 人工验证**

1. 生产域名浏览器走完整登录流程，五个页面全部正常渲染
2. 登录后 DevTools → Network 检查 RSC payload，确认只有 DTO 字段
3. `npm list next` 确认 ≥ 15.2.3
4. 无痕窗口访问生产域名 → 跳转 `/login`，无法看到任何数据

- [ ] **Step 6: 收尾提交（如有零散修改）**

```bash
git status   # 确认无遗漏未提交文件
```

---

## 自审记录（计划完成后核对过）

1. **规格覆盖**：规格 §3 目录结构/插件机制 → Task 10；§4 数据模型 → Task 3；§5 DAL 六函数 → Task 9（`listEntries`/`countEntries`（分页需要计数）/`getDayEntries`/`getDailyTotals`/`getCategoryBreakdown`/`getActivityBreakdown`/`getCategories`）；§6 筛选 → Task 7 + 11；§7 四视图 → Task 12–15、首页 → Task 16；§8 安全 → Task 2/8/17 + Task 18 curl 清单；§9 错误处理 → filters 回退（Task 7）、error.tsx（Task 17）、0 时长渲染（Task 12 `Math.max`）；§10 测试 → Task 5/6/7 单测 + Task 4 种子 + Task 18 上线验证；§11 环境变量与部署 → Task 2/18。
2. **类型一致性**：`CommonFilter`/`EntryDTO`/`DailyTotal`/`CategoryTotal`/`ActivityTotal` 全部定义于 `lib/types.ts`（Task 5），dal（Task 9）与各 client 视图（Task 12–16）只做 import；DAL 函数签名在各调用任务中与 Task 9 定义一致；`ViewManifest` 定义于 registry（Task 10），四个 view.ts 一致。
3. **无占位符**：所有步骤给出完整代码或确切命令，无"稍后实现/自行处理"类占位；Task 15 中 `categoryTotals` 与 `categoryOptions` 的命名已直接写入代码。
4. **单一版本**：Task 1–18 顺序执行完成即为规格全部功能，无分期。



