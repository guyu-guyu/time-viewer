# time-viewer 架构与安全说明

本文描述当前代码的架构、安全边界和维护约束。完整的本地运行、Neon 初始化、GitHub
OAuth 配置及 Vercel 部署步骤见项目根目录的 [README](../README.md)。

`docs/superpowers/specs` 和 `docs/superpowers/plans` 是设计及实施过程记录，
可能包含历史方案，不作为当前部署手册。

## 1. 项目定位

`time-viewer` 是部署在 Vercel 上的单用户时间记录查看器：

- GitHub OAuth 负责确认登录身份。
- `OWNER_GITHUB_ID` 是唯一允许登录的 GitHub 数字账号 ID。
- Neon Postgres 保存时间记录。
- 页面只负责查询和展示，当前没有网页写入接口或编辑功能。
- 总览、时间轴、明细列表、月历和统计图表共享同一张 `entries` 表。

这是单租户模型，不是多用户系统。`entries` 没有 `user_id`，不能仅通过
增加多个可登录账号扩展成多用户应用。

## 2. 技术栈

- Next.js 15 App Router
- React 19
- Auth.js / NextAuth v5
- GitHub OAuth App
- Neon Postgres
- Drizzle ORM / Drizzle Kit
- Vitest / ESLint
- Vercel

## 3. 当前目录职责

~~~text
├── auth.ts                         # Auth.js 配置和 GitHub owner 白名单
├── middleware.ts                   # 未登录请求跳转 /login
├── app/
│   ├── login/                      # 公开登录页
│   ├── api/auth/[...nextauth]/     # Auth.js Route Handler
│   └── (dashboard)/
│       ├── page.tsx                # 首页总览
│       └── views/
│           ├── timeline/           # 时间轴
│           ├── list/               # 明细列表
│           ├── calendar/           # 月历
│           └── charts/             # 统计图表
├── lib/
│   ├── dal.ts                      # 运行时查询和 requireOwner()
│   ├── db.ts                       # Drizzle 客户端
│   ├── schema.ts                   # entries 表结构
│   ├── time.ts                     # DISPLAY_TZ 时间换算
│   └── filters.ts                  # 查询参数解析
├── drizzle/                        # 已生成的 migration
└── scripts/
    ├── seed.ts                     # 生成开发测试数据
    └── clear-seed.ts               # 删除 source = seed 的数据
~~~

应用运行时的数据查询集中在 `lib/dal.ts`。数据库维护脚本可以直接访问 schema，
但页面和组件不应绕过 DAL 查询数据库。

## 4. 认证与授权

### 4.1 GitHub OAuth 白名单

`auth.ts` 的 `signIn` callback 同时检查 provider 和 GitHub 数字 ID：

~~~ts
account?.provider === "github" &&
String(account.providerAccountId) === process.env.OWNER_GITHUB_ID
~~~

必须使用数字 ID，而不是可修改的 GitHub 用户名。GitHub provider 的授权
`scope` 为空，应用只需要身份，不申请仓库权限。

GitHub access token 只参与 OAuth 登录流程，项目不把它保存到数据库。

### 4.2 middleware 是导航保护

`middleware.ts` 将未登录的私有页面请求跳转到 `/login`，并排除：

- `/login`
- `/api/auth/*`
- Next.js 静态资源
- favicon 和 SVG

middleware 改善未登录访问体验，但不能作为唯一的数据安全边界。新增页面即使 matcher
遗漏，也不能获得未经授权的数据。

### 4.3 DAL 是数据安全边界

`lib/dal.ts` 导入 `server-only`，所有导出的查询函数都会先调用
`requireOwner()`：

~~~ts
export const requireOwner = cache(async () => {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHORIZED");
  return { userId: process.env.OWNER_GITHUB_ID! };
});
~~~

- `server-only` 防止 DAL 被打进客户端 bundle。
- `auth()` 验证 Auth.js 会话。
- `cache()` 只做单次请求内去重，不是授权机制。
- 查询只选择页面需要的字段，再转换成 DTO。

新增页面、Route Handler 或 Server Action 时，必须在接触数据的位置重新调用 DAL 或
`requireOwner()`，不能只依赖 layout 或 middleware。

如果更换 `OWNER_GITHUB_ID`，同时轮换 `AUTH_SECRET`，使旧 owner 的现有
会话立即失效。

## 5. 数据模型与数据生命周期

`entries` 表字段：

| 字段 | 类型/约束 | 含义 |
| --- | --- | --- |
| `id` | bigint identity, primary key | 记录 ID |
| `type` | integer, not null, 仅 0/1 | 0 = 番茄，1 = 正计时 |
| `note` | text, nullable | 备注 |
| `task_title` | text, nullable | 关联任务名 |
| `project_name` | text, nullable | 关联项目名 |
| `start_time` | timestamptz, not null | 开始时间 |
| `end_time` | timestamptz, not null | 结束时间 |
| `duration` | integer, not null, >= 0 | 持续时间，单位毫秒 |
| `pause_duration` | integer, not null, >= 0 | 暂停时间，单位毫秒 |
| `source` | text, default `default` | 数据来源 |
| `created_at` | timestamptz, default now | 创建时间 |

`start_time` 和 `project_name` 有索引。数据以带时区时间戳保存，日期归属、
日历分桶和页面展示按 `DISPLAY_TZ` 计算。统计使用数据库中的 `duration`，
时间轴位置使用 `start_time` 和 `end_time`。

`0001_reshape_entries` migration 会保留旧数据并完成以下映射：

- `started_at` -> `start_time`
- `ended_at` -> `end_time`
- `category` -> `project_name`
- `activity` -> `task_title`
- 旧记录的 `type` 设为 1（正计时）
- 旧记录的 `duration` 由起止时间换算为毫秒
- 旧记录的 `pause_duration` 设为 0

数据库生命周期：

1. `npx drizzle-kit migrate` 创建或升级表结构。
2. `npx tsx scripts/seed.ts` 只用于生成开发测试数据。
3. `npm run seed:clear` 只删除 `source = 'seed'` 的记录。

`seed.ts --force` 会删除表中全部数据后重新生成 seed，包括非 seed 数据。它不能用于
生产数据库。执行数据库脚本前必须确认 `.env.local` 中的 `DATABASE_URL`
目标。

## 6. 渲染和缓存约束

所有读取个人数据的页面都声明：

~~~ts
export const dynamic = "force-dynamic";
export const revalidate = 0;
~~~

这些页面不能改成静态生成或 ISR。否则构建产物或共享缓存可能包含个人数据，并绕过
每次请求中的认证。

当前受保护页面包括：

- `/`
- `/views/timeline`
- `/views/list`
- `/views/calendar`
- `/views/charts`

增加新的数据视图时需要同时检查：

1. 页面是否保持动态渲染并关闭 revalidate。
2. 数据是否只从 DAL 获取。
3. DAL 查询是否先执行 `requireOwner()`。
4. 返回客户端的 DTO 是否只包含必要字段。
5. middleware matcher 是否提供预期的未登录跳转。

## 7. 环境变量

| 变量 | 用途 | 安全要求 |
| --- | --- | --- |
| `AUTH_SECRET` | Auth.js 会话加密 | 本地和生产使用不同随机值；泄漏后立即轮换 |
| `AUTH_GITHUB_ID` | GitHub OAuth Client ID | 与 callback 所属 OAuth App 对应 |
| `AUTH_GITHUB_SECRET` | GitHub OAuth Client Secret | 按密钥管理；泄漏后在 GitHub 重新生成 |
| `OWNER_GITHUB_ID` | owner 白名单 | 必须是 GitHub 数字 ID |
| `DATABASE_URL` | Neon Postgres 连接串 | 建议 pooled；泄漏后轮换数据库凭据 |
| `DISPLAY_TZ` | 日期展示和统计时区 | 默认 `Asia/Shanghai` |

`.env.local` 只用于本地，不能提交。Vercel 中的变量按 Development、Preview 和
Production 独立配置，修改后需要重新部署才会进入新的 deployment。

当前 `auth.ts` 已设置 `trustHost: true`。正常 Vercel 部署不依赖
`AUTH_URL` 或 `NEXTAUTH_URL`。

## 8. 部署边界

具体操作顺序见 [README 的 Vercel 部署章节](../README.md#部署到-vercel)。架构上必须
保证以下条件：

1. 生产 deployment 在构建和运行阶段都能读取完整环境变量。
2. GitHub OAuth App 登记
   `https://<生产域名>/api/auth/callback/github`。
3. 生产数据库在首次请求前已经执行 migration。
4. Preview 若没有登记独立 callback，不用于 OAuth 登录测试。
5. seed 和 migration 不放入 Vercel Build Command。
6. Production、Preview 和本地尽量使用不同 Neon branch。

GitHub callback 的协议、主机和路径需要与 `redirect_uri` 匹配。不要为了适配
随机 Preview 域名而开启过宽的 wildcard。单用户项目优先使用固定生产域名。

## 9. 上线验证

每次首次部署、OAuth App 变更或环境变量轮换后，至少检查：

1. 无痕访问 `/` 会跳转到 `/login`。
2. `/api/auth/providers` 返回 GitHub provider JSON。
3. owner 完成授权后回到同一个生产 origin。
4. 非 owner 登录被拒绝。
5. 五个数据视图都能查询 Neon。
6. Vercel Functions Logs 没有认证、relation 或连接错误。
7. 页面响应没有被配置为公开静态缓存。

部署前本地质量检查：

~~~powershell
npm test
npm run lint
npm run build
~~~

生产构建需要有效的环境变量，尤其是 `DATABASE_URL`。

## 10. 密钥轮换和故障处置

| 事件 | 处理 |
| --- | --- |
| `AUTH_SECRET` 泄漏 | 立即生成新值并重新部署；现有会话全部失效 |
| `AUTH_GITHUB_SECRET` 泄漏 | 在 GitHub OAuth App 生成新 secret，更新 Vercel 后重新部署 |
| `DATABASE_URL` 泄漏 | 在 Neon 轮换角色密码或连接凭据，更新所有环境 |
| owner 账号变更 | 更新 `OWNER_GITHUB_ID`，同时轮换 `AUTH_SECRET` |
| OAuth callback 变更 | 先更新 GitHub OAuth App，再验证最终生产域名 |
| 数据误删 | 从 Neon branch、备份或恢复点处理；应用本身没有撤销机制 |

不要把 URL 隐蔽性当成访问控制。生产域名可能被发现，安全性来自 OAuth 白名单、有效
会话、DAL 校验和禁止私有页面缓存。

## 11. 维护规则

- Next.js、Auth.js 或 Drizzle 升级前先阅读对应版本文档和迁移说明。
- 依赖变更同时提交 `package.json` 与 `package-lock.json`。
- `package-lock.json` 由 npm 生成，不手工修改。
- schema 变更后生成并提交新的 Drizzle migration，再对各环境分别应用。
- 不修改已应用的历史 migration；用新的 migration 追加变更。
- 新增写入能力前先设计独立的认证、校验、审计和恢复方案。
- 历史设计稿可保留，但 README 和本文必须与当前代码同步。
