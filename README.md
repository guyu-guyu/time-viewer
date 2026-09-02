# time-viewer

`time-viewer` 是一个单用户时间记录查看器。应用使用 GitHub OAuth 登录，只允许
`OWNER_GITHUB_ID` 指定的 GitHub 账号访问 Neon 中的数据。

当前页面提供总览、时间轴、明细列表、月历和统计图表。项目目前没有网页端的数据写入
功能，数据表通过 Drizzle migration 创建，测试数据通过 seed 脚本生成。

## 技术栈

- Next.js 15 App Router
- React 19
- Auth.js / NextAuth v5 + GitHub OAuth
- Neon Postgres + Drizzle ORM
- Vitest + ESLint
- Vercel

## 本地运行

### 1. 准备环境

建议使用当前 Node.js LTS 和 npm。首次拉取项目后安装锁定版本的依赖：

~~~powershell
npm ci
~~~

如果运行 `npm run dev` 时提示 `'next' 不是内部或外部命令`，说明
`node_modules` 尚未安装或不完整，重新执行 `npm ci`。

### 2. 配置环境变量

复制模板：

~~~powershell
Copy-Item .env.example .env.local
~~~

填写以下变量：

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `AUTH_SECRET` | 是 | Auth.js 会话加密密钥，本地和生产建议使用不同值 |
| `AUTH_GITHUB_ID` | 是 | GitHub OAuth App 的 Client ID |
| `AUTH_GITHUB_SECRET` | 是 | GitHub OAuth App 的 Client Secret |
| `OWNER_GITHUB_ID` | 是 | 唯一允许登录的 GitHub 数字账号 ID，不是用户名 |
| `DATABASE_URL` | 是 | Neon Postgres 连接串，建议使用 pooled 连接串 |
| `DISPLAY_TZ` | 否 | 展示和统计时区，默认 `Asia/Shanghai` |

生成 `AUTH_SECRET`：

~~~powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
~~~

`.env.local` 已被 `.gitignore` 忽略。不要把真实密钥写入
`.env.example`、README、提交记录或 Vercel 构建日志。

### 3. 创建 GitHub OAuth App

进入 GitHub：

`Settings -> Developer settings -> OAuth Apps -> New OAuth App`

本地回调地址必须添加为：

~~~text
http://localhost:3000/api/auth/callback/github
~~~

创建后：

- `Client ID` 填入 `AUTH_GITHUB_ID`
- 生成的 `Client Secret` 填入 `AUTH_GITHUB_SECRET`

GitHub OAuth App 目前支持添加多个 callback URL，因此同一个 App 可以同时登记本地和
生产地址。为了隔离环境，也可以分别创建本地、生产 OAuth App。

获取当前账号的数字 ID，推荐使用已经登录的 GitHub CLI：

~~~powershell
gh auth login
gh api user --jq .id
~~~

将输出的纯数字填入 `OWNER_GITHUB_ID`。不要填写 GitHub 用户名。如果直接请求未认证
的 GitHub REST API 遇到 rate limit，改用上述已认证命令。

### 4. 创建并初始化 Neon 数据库

1. 在 Neon 创建项目。
2. 在项目的 Connect 面板启用 Connection pooling。
3. 复制带 `-pooler` 且包含 `sslmode=require` 的连接串到
   `DATABASE_URL`。
4. 对目标数据库执行 migration：

~~~powershell
npx drizzle-kit migrate
~~~

Migration 会创建 `entries` 表。Neon 中不需要手工插入任何数据。

可选：生成最近 30 天的测试数据：

~~~powershell
npx tsx scripts/seed.ts
~~~

清除 seed 生成的数据：

~~~powershell
npm run seed:clear
~~~

数据脚本注意事项：

- `seed.ts` 和 `clear-seed.ts` 都读取项目根目录的 `.env.local`。
- 普通 seed 在 `entries` 已有数据时会退出。
- `npx tsx scripts/seed.ts --force` 会先删除 `entries` 中的全部数据，包括非
  seed 数据。不要对生产数据库使用。
- `npm run seed:clear` 只删除 `source = 'seed'` 的记录。
- 执行任何数据脚本前，先确认 `DATABASE_URL` 指向的 Neon 项目和分支。

### 5. 启动并验证

~~~powershell
npm run dev
~~~

打开 <http://localhost:3000>。基础检查：

- <http://localhost:3000/api/auth/providers> 能返回 GitHub provider JSON。
- 未登录访问首页会跳转到 `/login`。
- 使用 `OWNER_GITHUB_ID` 对应账号能够登录。
- 其他 GitHub 账号会收到 `AccessDenied`。
- 数据库已迁移且有数据时，各视图可以正常查询。

修改 `.env.local` 后必须重启开发服务器。

## 部署到 Vercel

### 1. 导入项目

将仓库推送到 GitHub，在 Vercel 中选择 `Add New -> Project` 并导入仓库。项目无需
`vercel.json`，Vercel 会识别 Next.js，并使用：

- Install Command：Vercel 默认 npm 安装命令
- Build Command：`npm run build`
- Output：Next.js 默认输出

`package-lock.json` 应提交到仓库，部署和本地统一使用锁定的依赖版本。

### 2. 配置生产环境变量

进入：

`Vercel Project -> Settings -> Environment Variables`

为 Production 配置：

- `AUTH_SECRET`：重新生成生产专用值
- `AUTH_GITHUB_ID`
- `AUTH_GITHUB_SECRET`
- `OWNER_GITHUB_ID`
- `DATABASE_URL`
- `DISPLAY_TZ`

本项目的 Auth.js 配置启用了 `trustHost`，正常部署到 Vercel 不需要额外配置
`AUTH_URL` 或 `NEXTAUTH_URL`。

环境变量按 Production、Preview、Development 分开生效。变量新增或修改后，只会影响
新的 deployment，必须 Redeploy。

### 3. 配置生产 OAuth 回调

确定最终生产域名后，在 GitHub OAuth App 中添加：

~~~text
https://<你的生产域名>/api/auth/callback/github
~~~

协议、域名和路径必须与浏览器发出的 `redirect_uri` 匹配。不要把 Homepage URL
误填成 callback URL。

出现以下 GitHub 警告时：

~~~text
The redirect_uri is not associated with this application.
~~~

检查 OAuth App 是否登记了当前访问域名对应的完整 callback URL。Vercel Preview
通常使用不同域名；单用户项目建议只在固定生产域名启用登录，或为需要使用的稳定
Preview 域名单独添加 callback。不要为了匹配随机 Preview 域名开启宽泛的 wildcard。

### 4. 初始化生产数据库

当前构建命令不会自动执行 migration。首次上线以及新增 migration 后，需要对生产
`DATABASE_URL` 明确执行：

~~~powershell
npx drizzle-kit migrate
~~~

执行前确认目标数据库。建议本地开发、Preview 和 Production 使用不同的 Neon branch，
避免测试数据污染生产数据。

不要在 Vercel Build Command 中运行 seed，也不要在生产库运行 `seed.ts --force`。

### 5. 部署后检查

1. 无痕窗口访问生产首页，确认跳转到 `/login`。
2. 访问 `/api/auth/providers`，确认 GitHub provider 正常。
3. 使用 owner 账号完成 GitHub 授权并返回生产域名。
4. 检查首页、时间轴、明细、月历和统计图表。
5. 使用非 owner 账号验证无法进入。
6. 在 Vercel Functions Logs 中确认没有 OAuth 或数据库错误。

## 常用命令

| 命令 | 用途 |
| --- | --- |
| `npm ci` | 按 `package-lock.json` 安装依赖 |
| `npm run dev` | 启动本地开发服务器 |
| `npm run build` | 执行生产构建 |
| `npm run start` | 启动已构建的生产服务 |
| `npm run lint` | ESLint 检查 |
| `npm test` | 运行 Vitest |
| `npx drizzle-kit migrate` | 应用数据库 migration |
| `npx tsx scripts/seed.ts` | 在空表中生成测试数据 |
| `npm run seed:clear` | 删除 `source = 'seed'` 的测试数据 |

部署前建议执行：

~~~powershell
npm test
npm run lint
npm run build
~~~

## 常见问题

### `next` 不是内部或外部命令

依赖未安装或 `node_modules` 不完整。执行 `npm ci`，不要全局安装 Next.js。

### GitHub 登录按钮没有拉起授权

先检查 `/api/auth/providers`，再检查 `AUTH_GITHUB_ID` 和
`AUTH_GITHUB_SECRET`，修改后重启本地服务或重新部署。浏览器 Network 和 Vercel
Functions Logs 会显示实际 OAuth 错误。

### GitHub 提示 redirect URI 不匹配

OAuth App 中缺少当前域名的
`<origin>/api/auth/callback/github`。本地、生产、Preview 是不同 origin，需要分别
登记。

### 登录后显示 AccessDenied

`OWNER_GITHUB_ID` 必须是完成授权账号的数字 ID。修改 owner 时还应轮换
`AUTH_SECRET`，使旧会话失效。

### GitHub API rate limit exceeded

不要反复调用未认证接口。先执行 `gh auth login`，再执行
`gh api user --jq .id`。

### 数据库连接失败或提示 entries 不存在

确认 `DATABASE_URL` 完整、密码未过期且目标 Neon branch 正确，然后执行
`npx drizzle-kit migrate`。Vercel 上还要确认变量配置到了当前 deployment 所属环境，
并在改动后重新部署。

### 页面没有数据

Migration 只建表，不会自动插入记录。开发环境可以运行 seed；生产环境应导入真实数据。

### 日期或统计归属不正确

检查 `DISPLAY_TZ` 是否为有效 IANA 时区，例如 `Asia/Shanghai`。数据库时间字段使用
`timestamptz`，页面按 `DISPLAY_TZ` 进行日期分桶和展示。

## 安全与维护注意事项

- 应用是单用户模型，`entries` 表没有多租户 `user_id`。不要直接扩展为多人共用。
- GitHub 白名单使用稳定的数字 ID，而不是可修改的用户名。
- 所有数据查询必须经过 `lib/dal.ts` 中的 `requireOwner()`。
- 私有页面保持动态渲染并关闭缓存，避免个人数据进入静态页面或共享缓存。
- 泄漏 `AUTH_GITHUB_SECRET` 后应在 GitHub 重新生成 secret。
- 泄漏 `AUTH_SECRET` 后应立即轮换；轮换会使现有会话失效。
- 泄漏 `DATABASE_URL` 后应在 Neon 轮换数据库凭据。
- 依赖变更时同时提交 `package.json` 和 `package-lock.json`，不要手工编辑 lock 文件。

## 进一步阅读

- [架构与安全说明](docs/doc.md)
- [GitHub：创建 OAuth App](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app)
- [GitHub：OAuth redirect URL 规则](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps#redirect-urls)
- [Neon：Connection pooling](https://neon.com/docs/connect/connection-pooling)
- [Vercel：Environment variables](https://vercel.com/docs/environment-variables)
- [Vercel：Environments](https://vercel.com/docs/deployments/environments)
