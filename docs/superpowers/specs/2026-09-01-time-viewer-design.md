# time-viewer · 设计文档

> 状态：已获用户批准（2026-09-01）
> 前置文档：`docs/doc.md`（架构与安全文档，安全模型的原出处）

## 1. 项目定位与范围

部署在 Vercel 上的**单用户、纯读取**的时间数据查看器（time-viewer）。

- **数据来源**：另一个项目自动写入 Neon 数据库，本项目**不写入、不编辑、不校验**数据，只读取并做筛选/过滤与多样式展示。
- **核心约束**：只有 owner 一人能读，其他任何人打不开（沿用 `docs/doc.md` 的安全模型）。
- **核心工程约束**：**视图插件化**——每个视图一个目录、逻辑完全解耦，可像插件一样随时增删。

### 范围内

- 四种视图：日视图时间轴、月历热力图、统计图表、明细列表
- 首页总览（stat tiles + 视图入口）
- 筛选：日期范围、活动/分类、关键词
- GitHub OAuth 白名单登录 + DAL 安全层
- 仿真数据种子脚本（开发期无写入方）

### 范围外（明确排除）

- 数据写入/编辑/删除接口（写入方直连 Neon）
- 多用户、分享、导出
- 数据来源筛选（schema 预留 `source` 字段但不在 UI 暴露）
- E2E 自动化测试（后续可加，现阶段用上线验证清单替代）

## 2. 技术栈

Next.js App Router · NextAuth v5 (Auth.js) · GitHub OAuth · Neon Postgres · Drizzle ORM · `@neondatabase/serverless` 驱动 · Tailwind CSS + shadcn/ui + Recharts · Vercel Hobby · Vitest。

Next.js 版本必须 ≥ 15.2.3（CVE-2025-29927 已修复）。

## 3. 总体架构与目录结构

```
time-viewer/
├── auth.ts                      # NextAuth v5 配置，signIn 回调里做白名单判定
├── middleware.ts                # 未登录 → /login（体验层，非安全层）
├── drizzle.config.ts
├── lib/
│   ├── dal.ts                   # requireOwner() + 全部查询函数（唯一碰 db 的地方）
│   ├── db.ts                    # Drizzle 客户端
│   ├── schema.ts                # entries 表定义
│   ├── filters.ts               # searchParams → 查询条件（共享解析）
│   ├── time.ts                  # 时区/日期工具（天边界、区间计算）
│   ├── colors.ts                # 分类 → 颜色映射（跨视图配色一致）
│   └── views/
│       └── registry.ts          # 视图清单（插件注册点）
├── components/
│   ├── filter-bar.tsx           # 共享筛选栏（日期/分类/关键词）
│   └── ui/…                     # shadcn/ui 组件
├── app/
│   ├── login/page.tsx           # 唯一公开页面
│   ├── (dashboard)/
│   │   ├── layout.tsx           # 侧边导航，由 registry 自动生成
│   │   ├── page.tsx             # 总览首页：今日/本周/本月时长 + top 分类
│   │   ├── error.tsx            # requireOwner throw 的兜底渲染
│   │   └── views/
│   │       ├── timeline/        # 视图插件①
│   │       │   ├── view.ts      #   清单：{ id, title, icon, order }
│   │       │   ├── page.tsx     #   Server Component：读 searchParams → 调 DAL
│   │       │   └── timeline-view.tsx   #   Client Component（渲染时间轴）
│   │       ├── calendar/…       # 视图插件② 同构
│   │       ├── charts/…         # 视图插件③ 同构
│   │       └── list/…           # 视图插件④ 同构
│   └── api/auth/[...nextauth]/route.ts
├── scripts/
│   └── seed.ts                  # 仿真数据种子（开发用）
└── drizzle/                     # 迁移文件
```

### 视图插件机制

- **每个视图目录自包含**：`view.ts` 导出 `ViewManifest`（`{ id, title, icon, order }`）；`page.tsx` 是 Server Component，读 searchParams、调 DAL、以 DTO 传给目录内的 Client Component 渲染。视图需要的一切都在自己目录里，视图之间互不引用。
- **registry 是唯一耦合点**：`lib/views/registry.ts` 静态 import 各视图 manifest，导出按 `order` 排序的数组。侧边导航、首页入口卡片都从它生成。
  - **增加视图** = 新建目录 + registry 加一行 import；
  - **移除视图** = 删目录 + 删那一行，导航自动更新。
- **筛选状态全部走 URL searchParams**，不做全局内存状态。侧边栏链接自然携带当前筛选，视图间切换筛选不丢；每个视图只读取自己关心的参数。这是视图可独立增删的前提。
- **安全边界与展示解耦是两回事**：所有 SQL 查询集中在 `lib/dal.ts`（安全文档的硬约束，不可为插件化让步）；视图目录里只放展示逻辑。多个视图共用的聚合查询（如按日汇总）在 DAL 只实现一份。

### 与 `docs/doc.md` 的偏离

| 文档内容 | 本设计 | 原因 |
|---|---|---|
| `/api/ingest` 写接口 + `INGEST_SECRET` | 删除 | 写入方直连 Neon，本项目纯读 |
| `/api/entries` 读接口 | 删除 | 视图是 Server Component，经 DAL 取数后以 DTO 传给客户端组件，无需 HTTP API |
| `(dashboard)/stats/page.tsx` | 改为 `views/charts` 插件 | 统一进插件体系 |

认证、middleware 三层防护、force-dynamic、DTO 收窄等安全设计**原样保留**。

## 4. 数据模型

### entries 表

```ts
export const entries = pgTable("entries", {
  id:         bigint("id").generatedAlwaysAsIdentity().primaryKey(),
  startedAt:  timestamp("started_at", { withTimezone: true }).notNull(),
  endedAt:    timestamp("ended_at",   { withTimezone: true }).notNull(),
  category:   text("category").notNull(),   // 分类，自由文本，如 工作/学习/娱乐
  activity:   text("activity").notNull(),   // 具体活动，如 "写代码"
  note:       text("note"),                 // 可选备注，关键词搜索的目标
  source:     text("source").notNull().default("default"),  // 预留：采集端标识
  createdAt:  timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("entries_started_at_idx").on(t.startedAt),   // 日期范围查询主索引
  index("entries_category_idx").on(t.category),
]);
```

设计决定：

- **时长永不落库**，永远由 `endedAt - startedAt` 推导——单一事实来源，杜绝时长与起止矛盾。
- **category 是自由文本而非枚举**：分类集合由写入方决定。viewer 筛选下拉选项来自 `SELECT DISTINCT`；颜色由 `lib/colors.ts` 做稳定映射（显式映射表 + 兜底 hash），跨视图一致。
- **source 预留但不过滤**，不在 UI 暴露。
- **跨午夜归属规则**：区间（如 23:00–01:00）按**开始时间**归属当天。所有视图与统计统一采用此口径。
- **数据不变量由写入方保证**（`ended_at > started_at`）。viewer 读到非法数据时该条按 0 时长渲染，不崩溃。
- **迁移归属**：本项目拥有 schema 定义与迁移（drizzle-kit 生成 `drizzle/` 迁移文件并执行）；写入方项目遵循此结构。

## 5. 数据访问层（DAL）

全部位于 `lib/dal.ts`，顶部 `"server-only"`；每个查询函数首行 `await requireOwner()`。

| 函数 | 返回 | 服务于 |
|---|---|---|
| `listEntries(filter, {limit, offset})` | 分页的原始记录 DTO | 明细列表 |
| `getDayEntries(date)` | `startedAt` 落在该日的全部记录（与归属规则一致） | 时间轴 |
| `getDailyTotals(from, to, filter)` | `[{date, totalMinutes, byCategory}]` | 月历 + 趋势图 + 首页 |
| `getCategoryBreakdown(from, to, filter)` | `[{category, minutes}]` | 占比图 + 首页 |
| `getActivityBreakdown(from, to, filter)` | `[{activity, category, minutes}]` | 活动排名 |
| `getCategories()` | 去重分类列表 | 筛选下拉 |

- `requireOwner()` 按安全文档实现：`cache()` 包裹、`auth()` 取会话、无会话即 `throw new Error("UNAUTHORIZED")`、返回 `{ userId }` 供 WHERE 子句使用。
- 聚合在 SQL 完成（`date_trunc` 按 `DISPLAY_TZ` 分桶）；单用户数据量（每天几十~几百条）下性能充足。
- **DTO 显式列字段**：`{ id, startedAt, endedAt, durationMinutes, category, activity, note }`，禁止 `select *` 直出。

## 6. 筛选机制

URL searchParams 驱动，例如：

```
/views/list?from=2026-08-01&to=2026-08-31&category=工作&q=重构&page=2
```

- `lib/filters.ts` 统一解析：**非法或缺失参数一律回退到该视图默认值，永不 500**（如 `from=abc` → 忽略该参数）。
- **参数分两层**：
  - **共享参数**（所有视图语义一致，切换视图时由侧边栏链接携带）：`category`、`q`。
  - **视图主参数**（各视图自己的时间导航）：timeline 用 `date`（单日）；calendar 用 `month`（`YYYY-MM`）；charts / list 用 `from` + `to`；list 另有 `page` / `pageSize`。
- 各视图默认区间：时间轴 = 今天；月历 = 当月；图表 = 近 30 天；列表 = 最近 7 天。
- 共享 `components/filter-bar.tsx`：日期区间选择、分类下拉（来自 `getCategories()`）、关键词输入，通过改写 searchParams 生效。
- 视图特有导航（时间轴前一天/后一天、月历上月/下月、列表分页）放视图目录内部，同样走 searchParams。
- 关键词匹配语义：`note ILIKE '%q%' OR activity ILIKE '%q%'`。
- 分类筛选：`category` 精确匹配单值。

## 7. 视图设计

每个视图一个目录（`app/(dashboard)/views/<id>/`），结构一致：`view.ts`（manifest）+ `page.tsx`（Server，force-dynamic）+ 客户端渲染组件。

### ① timeline 日视图时间轴 — `/views/timeline?date=2026-09-01`

- 24 小时纵向轴；活动块按起止时间定位、高度∝时长、按分类着色（`lib/colors.ts`）；空隙留白。
- 跨午夜区间按开始日归属：完整时长计入开始日，时间轴上超出当日 24:00 的部分截断显示。
- 顶部：前一天/后一天导航 + 当天各分类时长小结。
- Hover/点击显示活动名、起止时间、备注。

### ② calendar 月历热力图 — `/views/calendar?month=2026-09`

- 月网格；每格：日期 + 当日总时长（颜色深浅∝时长）+ 分类占比迷你堆叠条。
- 上月/下月导航；点击某天 → 跳转 `timeline?date=…`（携带当前分类/关键词筛选）。

### ③ charts 统计图表 — `/views/charts?from=…&to=…`

Recharts 三张图，共用筛选区间：

- 按日总时长柱状趋势图（`getDailyTotals`）
- 分类占比环形图（`getCategoryBreakdown`）
- 活动时长 Top 10 横向条形图（`getActivityBreakdown`）

### ④ list 明细列表 — `/views/list?from=…&to=…&category=…&q=…&page=2`

- 表格列：日期、时间段、时长、分类、活动、备注。
- 按开始时间倒序；分页 `page`/`pageSize` 走 searchParams，每页 50 条。

### 首页总览 — `/`

今日 / 本周 / 本月总时长 + 本周 top 分类 stat tiles + 各视图入口卡片（来自 registry）。复用 `getDailyTotals` / `getCategoryBreakdown`，无新查询。

## 8. 安全（沿用 docs/doc.md）

- `auth.ts`：GitHub provider；`signIn` 回调比对 `account.providerAccountId === process.env.OWNER_GITHUB_ID`（**数字 id，非 login 名**）；`scope` 留空。
- **主防线是 DAL**：`lib/dal.ts` 顶部 `"server-only"`，每个查询函数首行 `requireOwner()`，throw 而非 redirect。
- `middleware.ts`：matcher 覆盖除 `/login`、`/api/auth` 外全部路径，未登录跳 `/login`；仅体验层。
- `(dashboard)` 下所有 `page.tsx`：`export const dynamic = "force-dynamic"` + `revalidate = 0`，绝不用 ISR/静态渲染。
- 不保存 GitHub access token；不依赖 URL 保密做防护。
- GitHub OAuth 拆两个 App：生产域名一个、localhost 一个。**Preview 部署不支持登录**（回调域名不匹配），单人项目可接受。
- 环境变量全部在 Vercel 标记 Sensitive。

## 9. 错误处理

| 场景 | 行为 |
|---|---|
| 未登录访问受保护页 | middleware 跳 `/login`；若穿透，`requireOwner()` throw，`(dashboard)/error.tsx` 渲染"请重新登录"+ 链接 |
| 查询参数非法 | `filters.ts` 回退视图默认值，不出错误页 |
| 数据非法（ended ≤ started） | 该条按 0 时长渲染，不崩 |
| DB 连接失败 | `error.tsx` 通用提示，不泄漏内部信息 |

## 10. 测试策略

- **Vitest 单元测试**（纯逻辑，不碰 DB）：
  - `filters.ts`：非法日期、空参、越界值回退默认值
  - `time.ts`：时区天边界、跨午夜归属规则、区间计算
  - `colors.ts`：同一分类颜色稳定、未知分类有兜底色
- **种子脚本** `scripts/seed.ts`：生成近 30 天仿真数据（合理分类/活动/备注/跨午夜区间）写入 Neon，供开发期视图调试。
- **上线验证**：执行 `docs/doc.md` 第 7 节 curl 清单并按本项目调整——受保护页（`/`、`/views/*`）未登录期望 307 → `/login`（本项目已无自定义 API 路由，原 `/api/entries` → 401 一项不再适用）；CVE 头不穿透；缓存头确认无 CDN 命中。外加人工检查登录后 RSC payload 只含 DTO 字段。

## 11. 环境变量与部署

| 变量 | 用途 | 备注 |
|---|---|---|
| `AUTH_SECRET` | 会话 JWE 加解密 | 泄漏 = 可伪造会话 |
| `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` | OAuth 凭据 | 生产/本地各一套 App |
| `OWNER_GITHUB_ID` | 白名单判定 + 数据作用域 | 数字 id |
| `DATABASE_URL` | Neon 连接串 | |
| `DISPLAY_TZ` | 展示时区，默认 `Asia/Shanghai` | 天归属、日历分桶、图表 X 轴口径 |

（原文档的 `INGEST_SECRET` 随写接口一并删除。）

**部署顺序**：

1. Neon 建库（取得连接串）
2. 本地 `drizzle-kit migrate` 建表 + `seed.ts` 灌数据
3. localhost OAuth App 配好，本地跑通登录与四个视图
4. Vercel 建项目（Hobby），配生产 OAuth App 与全部环境变量
5. 生产域名跑 curl 验证清单 + `npm list next` 版本检查

## 12. 一句话总结

安全模型照抄 `docs/doc.md`（OAuth 白名单 + DAL `requireOwner()` 是主防线，私有路由全 force-dynamic）；新增的核心是**路由即插件**的视图体系——一个视图一个目录，registry 一行注册，筛选全走 searchParams，DAL 集中查询——使"随时增删视图"成为目录级操作。
