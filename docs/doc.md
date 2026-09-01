下面是整理好的文档。数据库/ORM 部分我按前面讨论时提到的 Neon + Drizzle 写，如果实际不是这套，替换掉对应小节即可；其余内容都是前面已经逐条核实过的结论。

---

# 单人时间记录应用 · 架构与安全文档

## 1. 项目定位

一个部署在 Vercel 上的**单用户**数据应用。核心约束不是"多租户隔离"，而是**只有我一个人能读写，其他任何人打不开**。这个约束决定了后面所有设计：授权逻辑可以简化成"是不是 owner"，但不能因为简化就放到 middleware 里草草了事。

技术栈：Next.js App Router · NextAuth v5 (Auth.js) · GitHub OAuth · Neon Postgres · Drizzle ORM · Vercel Hobby。

---

## 2. 目录结构

```
├── auth.ts                    # NextAuth 配置，白名单判定在这里
├── middleware.ts              # 未登录跳转登录页（体验层，非安全层）
├── lib/
│   ├── dal.ts                 # 数据访问层 + requireOwner()，真正的安全边界
│   ├── db.ts                  # Drizzle 客户端
│   └── schema.ts              # 表定义
├── app/
│   ├── login/page.tsx         # 唯一公开页面
│   ├── (dashboard)/
│   │   ├── page.tsx           # force-dynamic
│   │   └── stats/page.tsx     # force-dynamic
│   └── api/
│       ├── auth/[...nextauth]/route.ts
│       ├── entries/route.ts   # 读接口，内部独立校验
│       └── ingest/route.ts    # 写接口，Bearer token，不走 session
└── drizzle/                   # 迁移文件
```

关键点：**所有数据库查询只出现在 `lib/dal.ts` 里**。页面、Route Handler、Server Action 都不直接碰 `db`。这是让"授权"无法被绕过的结构前提。

---

## 3. 认证与授权原理

### 3.1 平台层的真实能力（先明确边界）

Vercel Hobby 免费版的 Standard Protection 定义就是"保护除生产域名以外的所有部署"，所以 `your-app.vercel.app` **在免费版下始终公开**。Pro 版把作用域切到 All Deployments 才能罩住生产域名（不需要额外买 $150 的 Advanced Deployment Protection，那是给 Password Protection 用的）。

结论：**平台保护只能算加分项，主防线必须写在应用里。**

### 3.2 白名单：在 OAuth 回调里拒绝

走的是标准 OAuth 2.0 授权码流，不是什么私有登录 API。GitHub 侧只负责证明"这个人是 GitHub 用户 X"，**是否放行由我们自己判断**：

```ts
callbacks: {
  signIn: ({ account }) =>
    account?.provider === "github" &&
    String(account.providerAccountId) === process.env.OWNER_GITHUB_ID,
}
```

别人可以完整走完 GitHub 授权，但在这里被拒，拿不到会话 cookie。

两个必须记住的细节：

- 比对 **`id`（数字，永久不变）**，不是 `login`（用户名可改，改完就是安全漏洞）
- `scope` 留空。只要身份就不要任何仓库权限，`/user` 返回的 `id` 属于公开信息，无 scope 的 token 就能拿到

因为白名单是环境变量，**代码可以公开开源**——别人 fork 后填自己的 ID，就是他自己的实例。

### 3.3 三层防护及各自职责

| 层 | 文件 | 职责 | 是否安全边界 |
|---|---|---|---|
| middleware | `middleware.ts` | 未登录立即跳转，避免闪现数据 | ❌ 否 |
| DAL | `lib/dal.ts` | 每个数据函数首行 `requireOwner()` | ✅ 是 |
| 边界 | Route Handler / Server Action | 各自独立校验，翻译错误码 | ✅ 是 |

middleware 不算安全边界有具体原因：CVE-2025-29927 允许伪造 `x-middleware-subrequest` 请求头让 Next.js **整段跳过 middleware**。已在 **14.2.25 / 15.2.3** 修复，务必确认版本。（网上有说法称该漏洞是"middleware 里 redirect 不终止执行"或"要等 Next.js 17 才修"，这是错的，别照着改。）

即便没有这个 CVE，middleware 保护的是 **URL 路径**——matcher 写漏一条、新加页面忘记登记，数据就裸奔。DAL 保护的是 **数据本身**，新页面只要想取数据就必须经过它。

### 3.4 `requireOwner()` 的运行机制

```ts
import "server-only";
import { cache } from "react";

export const requireOwner = cache(async () => {
  const session = await auth();
  if (!session?.user) throw new Error("UNAUTHORIZED");
  return { userId: process.env.OWNER_GITHUB_ID! };
});
```

四个机制各司其职：

- **`server-only`** 是构建期护栏。任何 `"use client"` 文件直接或间接引入 DAL，`next build` 直接失败。不做运行时检查，纯粹防止 DAL 被打进浏览器 bundle。
- **`auth()` 不传参却能知道"当前是谁"**，靠 Next.js 用 AsyncLocalStorage 维护的请求上下文；`cookies()` 从中取出本次请求的 cookie，再用 `AUTH_SECRET` 解密验签（NextAuth v5 用的是 JWE 加密 JWT）。cookie 是 httpOnly + 签名的，改一个字节就解不开。**签名里看不到 request，但严格 per-request，不会串号。**
- **`throw` 而非 `redirect()`**：`redirect()` 在 Server Component 里正确，但在 Route Handler 里会变成 307，对 API 调用方语义错误。统一 throw，在各边界翻译成 401 / 跳转。生产环境下未捕获错误的 message 不会发给客户端，只给 digest，不泄漏内部信息。
- **`cache()` 只是请求级去重**，是性能优化。一次请求里三个组件各取数据，只真正验证一次；请求结束即销毁，**不跨请求、不跨用户共享**。去掉它代码依然安全——安全性来自那句 `throw`。

`requireOwner()` 同时返回 `userId` 供 WHERE 子句使用，这样"门禁"和"数据作用域"合在一处，不会出现"查了身份但查询忘了过滤"。

---

## 4. 数据写入路径

写入接口（`/api/ingest`）**不走 session**，用独立的 `INGEST_SECRET` 做 Bearer token 校验。理由是解耦：网页登录不可用时（GitHub OAuth 故障、cookie 过期），数据采集不能中断。

对应地，**不建议为"登不进去"再加第二种网页登录方式**——那等于多开一个攻击面。应急路径应该是：写入靠 ingest token，临时读数据用 `psql` 直连 Neon。

---

## 5. 注意事项

### 5.1 缓存会绕过所有认证

最隐蔽的泄漏路径：CDN 缓存了一份带数据的 HTML，之后未登录用户直接命中缓存，认证层根本不参与。

所有含个人数据的路由必须：

```ts
export const dynamic = "force-dynamic";
export const revalidate = 0;
```

绝不对这些路由用 ISR。这和"静态渲染绕过 DAL"是同一件事的两面——如果路由被静态化，数据是**构建时**取的，`requireOwner()` 跑在构建机上，那时没有请求上下文。

### 5.2 layout 里检查不算保护

Partial Rendering 让 layout 在路由切换时不重新渲染；route segment 和并行路由 slot 由 router 独立渲染，layout 隐藏它们既不阻止执行、也不阻止它们进 RSC payload。**检查要贴着数据源，不是贴着布局。**

### 5.3 Server Action 是公开端点

Server Action 本质是公开 POST 端点。"只在受保护页面里渲染那个按钮"不构成保护，任何人都能直接调用。每个 action 内部必须重新校验。

### 5.4 返回值收窄（DTO）

传给 Client Component 的对象**整体**都会进 RSC payload，用户能看见。DAL 里显式列字段，别把整行 `select *` 甩出去。上线前用 DevTools 看一遍实际 payload。

### 5.5 GitHub OAuth 的唯一真坑：回调 URL 精确匹配

OAuth App 支持最多 10 个回调 URL，但**主机名必须完全一致，不支持通配符**。这直接撞上 Vercel Preview 部署的随机域名。三种解法：

- **`redirectProxyUrl`**（推荐）：GitHub 只认固定生产域名，NextAuth 收到后转发回当前 preview
- **按环境拆 OAuth App**：Production 一个、本地一个（localhost 是 GitHub 允许非 HTTPS 的唯一例外），上限 100 个 App
- **Preview 不开登录**，单人项目最省事

### 5.6 不要保存 GitHub access token

常见的过度设计。验证完身份后这个 token 就没用了，NextAuth 的 JWT session 完全独立。不存 = 少一个泄漏面，也不用处理 OAuth App 默认的 8 小时过期与 refresh 流程。

### 5.7 其余限流对本项目无感

token 交换 2000 次/小时、用户级 API 5000 次/小时（与 PAT 共享配额）——每天登录几次的量级完全够。给 `/api/auth/*` 加个限流（Upstash 免费额度足够）仍然值得，但不紧急。

### 5.8 别把 URL 保密当防护

`robots.txt` 加 noindex 只防搜索引擎收录，防不住人。`*.vercel.app` 域名会进证书透明日志，被扫描器发现是必然的。

---

## 6. 环境变量

| 变量 | 用途 | 备注 |
|---|---|---|
| `AUTH_SECRET` | 会话 JWE 加解密 | 泄漏 = 任何人可伪造会话 |
| `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` | OAuth 凭据 | secret 支持双份并存，可无缝轮换 |
| `OWNER_GITHUB_ID` | 白名单判定 + 数据作用域 | 数字 id |
| `DATABASE_URL` | Neon 连接串 | |
| `INGEST_SECRET` | 写入接口鉴权 | 与网页登录解耦 |

全部标记 Sensitive。`AUTH_GITHUB_SECRET` 和 `DATABASE_URL` 同级对待。GitHub 的 secret scanning 会在误提交到公开仓库时自动吊销 OAuth secret，但不要指望它兜底。

---

## 7. 上线验证清单

浏览器点一圈不算验证——你的 cookie 会骗你。开无痕或直接 curl：

```bash
U=https://your-app.vercel.app

curl -si $U/ | head -1                        # 期望 307 → /login
curl -si $U/api/entries | head -1             # 期望 401
curl -si -X POST $U/api/ingest | head -1      # 期望 401

# CVE-2025-29927 已修复：此头不应穿透
curl -si -H "x-middleware-subrequest: middleware" $U/ | head -1

# 私有页未被缓存
curl -sI $U/ | grep -iE "cache-control|x-vercel-cache"
```

外加两项人工检查：

- `npm list next` 确认 ≥ 14.2.25 / 15.2.3
- 登录后看 Network 里的 RSC payload，确认没多传原始记录

---

## 8. 一句话总结

免费版生产域名只能靠自己的代码守住。主防线是 **OAuth 白名单 + DAL 里每个函数的 `requireOwner()`**；middleware 和 Vercel Deployment Protection 都只是外围；私有路由必须关缓存，否则 CDN 会绕过全部认证逻辑。
