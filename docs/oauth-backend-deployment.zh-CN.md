# Bangumi OAuth 后端接入与部署指南

本文档说明如何为 `bgm-cli` 部署一套安全的 Bangumi OAuth 后端服务，并将其接入现有 CLI。

目标：

- 用户通过 Bangumi 官方网页完成 OAuth 授权
- `client_secret` 不暴露在公开 CLI 中
- 同时兼容：
  - Vercel
  - Cloudflare Workers
- 使用托管型 Redis 保存短期 OAuth 会话状态

本文档基于仓库中的 [oauth-backend/README.md](/home/aronnax/code/bgm-cli/oauth-backend/README.md) 对应实现。

## 1. 总体架构

推荐架构如下：

```text
CLI <-> OAuth Backend <-> Redis
         |
         -> Bangumi OAuth
```

各组件职责：

- `bgm-cli`
  - 创建 OAuth 登录会话
  - 打印授权链接
  - 轮询登录状态
  - 领取并保存 token
- `OAuth Backend`
  - 持有 `client_id` / `client_secret`
  - 接收 Bangumi 回调
  - 用 `code` 换取 token
  - 将 token 临时保存到 Redis
- `Redis`
  - 保存短期会话
  - 保存 `state`
  - 保存授权完成后的 token 交换结果
  - 自动过期清理
- `Bangumi`
  - 官方 OAuth 授权与 token 交换提供方

## 2. 为什么需要后端

Bangumi OAuth 的 token 交换需要：

- `client_id`
- `client_secret`
- `code`
- `redirect_uri`

其中 `client_secret` 不能安全地放到公开 CLI 里。

因此正确做法是：

- CLI 只发起登录
- 用户在 Bangumi 官方网站输入账号密码
- 后端持有 `client_secret` 并完成 token 交换

这就是这套后端服务存在的原因。

## 3. OAuth 后端提供的接口

后端当前提供以下接口：

### 3.1 `POST /api/oauth/session`

创建一次短期 OAuth 会话。

返回示例：

```json
{
  "session_id": "sess_xxx",
  "authorize_url": "https://bgm.tv/oauth/authorize?...",
  "expires_at": "2026-03-30T12:00:00.000Z",
  "poll_interval_ms": 2000,
  "status_url": "https://example.com/api/oauth/session/sess_xxx",
  "claim_url": "https://example.com/api/oauth/session/sess_xxx/claim"
}
```

### 3.2 `GET /api/oauth/callback`

Bangumi OAuth 回调入口。

作用：

- 接收 Bangumi 返回的 `code`
- 根据 `state` 找到会话
- 用 `code` 向 Bangumi 换取 token
- 将 token 临时写入 Redis

### 3.3 `GET /api/oauth/session/:id`

CLI 轮询会话状态。

可能状态：

- `pending`
- `authorized`
- `failed`
- `expired`

### 3.4 `POST /api/oauth/session/:id/claim`

CLI 领取授权结果。

领取成功后：

- 返回 token payload
- 删除 Redis 中的临时会话

### 3.5 `GET /healthz`

健康检查接口。

## 4. Redis 在这套体系中的作用

Vercel Functions 和 Cloudflare Workers 都更偏向无状态执行环境，不适合把 OAuth 会话放在进程内存中等待。

因此需要一个外部共享存储来保存短期状态。

Redis 在这里负责：

- 保存 `session_id -> session`
- 保存 `state -> session_id`
- 保存授权是否完成
- 临时保存 token 交换结果
- 通过 TTL 自动清理过期会话

## 5. 为什么推荐托管型 Redis

不一定要自己在 VPS 上部署 Redis。

对这个项目来说，更推荐使用托管型 Redis，例如：

- Upstash Redis
- Redis Cloud
- 其他支持公网访问的托管 Redis

当前仓库实现默认使用 **Upstash Redis REST API**，原因是：

- 对 Vercel 友好
- 对 Cloudflare Workers 友好
- 不依赖 TCP 连接
- 可以直接通过 `fetch` 调用

这也是为什么当前后端代码里使用的是 Upstash 的 REST URL 和 REST Token。

## 6. 需要准备哪些信息

在部署前，你需要准备：

### 6.1 Bangumi 开发平台信息

从 Bangumi 开发平台获取：

- `BGM_CLIENT_ID`
- `BGM_CLIENT_SECRET`
- `BGM_REDIRECT_URI`

其中：

- `BGM_REDIRECT_URI` 必须是你后端实际部署后的回调地址
- 通常应该写成：

```text
https://your-backend.example.com/api/oauth/callback
```

注意：

- 这个值必须和 Bangumi 开发平台里配置的回调地址完全一致
- 如果不一致，Bangumi 在 token 交换时会报错

### 6.2 OAuth 服务公网地址

也就是后端本身的基准地址：

- `BGM_OAUTH_SERVER_BASE_URL`

例如：

```text
https://bgm-oauth.example.com
```

### 6.3 Redis 访问信息

以 Upstash 为例，需要：

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

### 6.4 会话加密密钥

你还需要一个随机的服务端密钥：

- `SESSION_ENCRYPTION_SECRET`

要求：

- 足够长
- 随机
- 不要提交到 Git

可以自己生成一个 32 字节以上的随机字符串。

## 7. 项目内涉及的配置文件

### 7.1 OAuth 后端环境模板

见：

- [oauth-backend/.env.example](/home/aronnax/code/bgm-cli/oauth-backend/.env.example)

示例：

```dotenv
BGM_CLIENT_ID=your_bangumi_app_id
BGM_CLIENT_SECRET=your_bangumi_app_secret
BGM_REDIRECT_URI=https://your-backend.example.com/api/oauth/callback
BGM_OAUTH_SERVER_BASE_URL=https://your-backend.example.com
UPSTASH_REDIS_REST_URL=https://your-upstash-instance.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_upstash_rest_token
SESSION_ENCRYPTION_SECRET=replace_with_a_long_random_secret
BGM_SESSION_TTL_SECONDS=300
```

### 7.2 CLI 本地开发配置

项目里建议拆成两层：

- 可提交的公共默认值：[bangumi-project.env](/home/aronnax/code/bgm-cli/bangumi-project.env)
- 仅本地或自部署者使用的私有覆盖：[bangumi-development.env.example](/home/aronnax/code/bgm-cli/bangumi-development.env.example)

对普通用户，公共文件里最关键的是：

```dotenv
BGM_OAUTH_SERVER_BASE_URL=https://your-backend.example.com
```

这样仓库可以直接内置公开 OAuth 服务地址，而不暴露 `client_secret`。

如果你是自部署者，需要覆盖项目默认值，再创建本地 `bangumi-development.env`。

## 8. 先配置 Bangumi 开发平台

在 Bangumi 开发平台创建应用后，请重点配置以下内容：

### 8.1 应用主页

建议填写：

- 项目 GitHub 仓库地址
- 或项目主页地址

例如：

```text
https://github.com/aronnaxlin/bgm-cli
```

### 8.2 回调地址

必须填写为你后端的真实 callback 地址，例如：

```text
https://bgm-oauth.example.com/api/oauth/callback
```

如果你分别部署了：

- Vercel 版本
- Cloudflare Workers 版本

则 Bangumi 开发平台里最终应填写你**当前实际使用的那一个地址**。

## 9. 部署 Upstash Redis

### 9.1 创建 Redis

1. 注册并登录 Upstash
2. 创建一个 Redis 数据库
3. 记录以下信息：
   - REST URL
   - REST Token

### 9.2 不需要自己部署服务器

这里不需要你自己在 VPS 上单独安装 Redis。

因为：

- 当前实现使用的是 Upstash 的 HTTP REST API
- Vercel / Workers 都可以直接访问它

## 10. 部署到 Vercel

### 10.1 创建项目

1. 打开 Vercel
2. 新建项目
3. 将仓库导入
4. 把项目 Root Directory 设置为：

```text
oauth-backend
```

### 10.2 配置环境变量

在 Vercel Project Settings 里添加：

- `BGM_CLIENT_ID`
- `BGM_CLIENT_SECRET`
- `BGM_REDIRECT_URI`
- `BGM_OAUTH_SERVER_BASE_URL`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `SESSION_ENCRYPTION_SECRET`
- `BGM_SESSION_TTL_SECONDS` 可选

也可以直接用 Vercel CLI 逐个录入：

```bash
vercel env add BGM_CLIENT_ID
vercel env add BGM_CLIENT_SECRET
vercel env add BGM_REDIRECT_URI
vercel env add BGM_OAUTH_SERVER_BASE_URL
vercel env add UPSTASH_REDIS_REST_URL
vercel env add UPSTASH_REDIS_REST_TOKEN
vercel env add SESSION_ENCRYPTION_SECRET
vercel env add BGM_SESSION_TTL_SECONDS
```

推荐值示例：

```dotenv
BGM_OAUTH_SERVER_BASE_URL=https://your-project.vercel.app
BGM_REDIRECT_URI=https://your-project.vercel.app/api/oauth/callback
BGM_SESSION_TTL_SECONDS=300
```

`SESSION_ENCRYPTION_SECRET` 可以先本地生成：

```bash
npm run generate:secret
```

在真正部署前，建议先把 Vercel 环境拉到本地做一次校验：

```bash
vercel env pull .env.local
cp .env.local .env
npm run check:env
```

这一步会检查：

- 必填环境变量是否齐全
- `BGM_REDIRECT_URI` 是否与 `BGM_OAUTH_SERVER_BASE_URL` 对应

### 10.3 部署

在 `oauth-backend/` 下可以使用：

```bash
npm run deploy:vercel
```

也可以直接在 Vercel 控制台部署。

### 10.4 部署后验证

部署成功后访问：

```text
https://your-vercel-domain/healthz
```

预期返回：

```json
{
  "ok": true,
  "service": "bgm-oauth-backend",
  "timestamp": "..."
}
```

## 11. 部署到 Cloudflare Workers

### 11.1 创建 Worker

使用 `oauth-backend/` 目录作为 Worker 项目。

当前入口在：

- [oauth-backend/src/worker.js](/home/aronnax/code/bgm-cli/oauth-backend/src/worker.js)
- [oauth-backend/wrangler.jsonc](/home/aronnax/code/bgm-cli/oauth-backend/wrangler.jsonc)

### 11.2 配置变量与密钥

建议区分：

非敏感变量：

- `BGM_CLIENT_ID`
- `BGM_REDIRECT_URI`
- `BGM_OAUTH_SERVER_BASE_URL`
- `UPSTASH_REDIS_REST_URL`
- `BGM_SESSION_TTL_SECONDS`

敏感密钥：

- `BGM_CLIENT_SECRET`
- `UPSTASH_REDIS_REST_TOKEN`
- `SESSION_ENCRYPTION_SECRET`

设置 secret：

```bash
wrangler secret put BGM_CLIENT_SECRET
wrangler secret put UPSTASH_REDIS_REST_TOKEN
wrangler secret put SESSION_ENCRYPTION_SECRET
```

### 11.3 部署

在 `oauth-backend/` 下执行：

```bash
npm run deploy:worker
```

或：

```bash
wrangler deploy
```

### 11.4 部署后验证

访问：

```text
https://your-worker-domain/healthz
```

确认健康检查通过。

## 12. 将 CLI 接入后端 OAuth

### 12.1 配置本地开发文件

在仓库根目录创建或修改：

```text
bangumi-development.env
```

至少补充：

```dotenv
BGM_OAUTH_SERVER_BASE_URL=https://your-backend.example.com
```

如果你已经有完整本地配置，也可以是：

```dotenv
BGM_APP_NAME=bgm-cli
BGM_OAUTH_SERVER_BASE_URL=https://your-backend.example.com
BGM_CLIENT_ID=your_bangumi_app_id
BGM_CLIENT_SECRET=your_bangumi_app_secret
BGM_REDIRECT_URI=https://your-backend.example.com/api/oauth/callback
BGM_HOMEPAGE_LINK=https://github.com/yourname/bgm-cli
BGM_DEVELOPER_ID=yourname
BGM_APP_VERSION=0.1.0
```

### 12.2 CLI 登录行为

配置了 `BGM_OAUTH_SERVER_BASE_URL` 之后：

```bash
./bgm --init
```

CLI 会优先显示：

- `1. 使用项目 OAuth 服务网页授权 (Recommended)`
- `2. 填写用户自己的 access token`

如果用户选 `1`：

1. CLI 调后端创建 session
2. CLI 输出 Bangumi 授权 URL
3. 用户在浏览器中登录 Bangumi 并授权
4. Bangumi 回调后端
5. CLI 轮询 session 状态
6. 授权完成后自动领取 token 并保存本地

### 12.3 VPS 场景

VPS 场景同样适用，因为：

- CLI 不需要本地起 callback 监听
- CLI 只是在轮询 OAuth 后端
- 用户只需在自己的浏览器中访问授权链接即可

## 13. 安全建议

强烈建议遵守以下规则：

### 13.1 不要把 `client_secret` 提交到公开仓库

应仅保存在：

- Vercel 环境变量
- Cloudflare Worker Secrets
- 本地私有 `.env`

### 13.2 不要把 token 打到日志中

包括：

- access token
- refresh token
- Redis 里保存的加密前 token 内容

### 13.3 设置较短 TTL

推荐：

```text
BGM_SESSION_TTL_SECONDS=300
```

也就是 5 分钟。

### 13.4 token 只临时存储

当前实现设计是：

- 后端只在 Redis 中临时保存 token
- CLI `claim` 后立即删除

不要把用户 token 长期保留在服务端。

## 14. 建议的上线顺序

推荐按这个顺序进行：

1. 先创建 Bangumi 开发平台应用
2. 再创建 Upstash Redis
3. 先在 Vercel 或 Workers 中部署一个版本
4. 验证 `/healthz`
5. 在 Bangumi 开发平台里把回调地址改成部署后的真实 callback 地址
6. 本地设置 `BGM_OAUTH_SERVER_BASE_URL`
7. 运行：

```bash
./bgm --init
```

8. 用实际浏览器完成一次授权测试

## 15. 推荐优先使用哪个平台

### 如果你更偏向传统 Web 项目体验

优先选：

- Vercel

原因：

- 控制台更直观
- 环境变量管理简单
- 对前后端一体的项目团队友好

### 如果你更偏向边缘运行与 Workers 生态

优先选：

- Cloudflare Workers

原因：

- Worker 模型更轻量
- Secrets 管理清晰
- 全球边缘分发天然适配

### 如果你只想先最快跑起来

建议组合：

- Vercel
- Upstash Redis

这是目前最容易先落地的一套组合。

## 16. 常见问题

### 16.1 用户是否会看到 Bangumi 账号密码输入框？

不会在 CLI 中出现。

用户只会在 Bangumi 官方授权页面输入账号密码。

### 16.2 用户是否必须自己申请 Bangumi 开发者应用？

不需要。

只要你已经部署好了 OAuth 后端，并在后端配置了你自己的 Bangumi 应用凭据，用户就可以直接走项目 OAuth 服务登录。

### 16.3 用户是否还可以手动填 token？

可以。

CLI 仍然保留：

- `填写用户自己的 access token`

这条备用路径。

### 16.4 后端必须使用 Upstash 吗？

不是必须。

但当前仓库代码默认就是围绕 Upstash REST API 实现的。如果你换成别的 Redis 提供商，需要自己改会话存储层。

## 17. 相关文件索引

- 后端说明：[oauth-backend/README.md](/home/aronnax/code/bgm-cli/oauth-backend/README.md)
- 后端应用入口：[oauth-backend/src/app.js](/home/aronnax/code/bgm-cli/oauth-backend/src/app.js)
- Worker 入口：[oauth-backend/src/worker.js](/home/aronnax/code/bgm-cli/oauth-backend/src/worker.js)
- Vercel 路由入口：[oauth-backend/api/[[route]].js](/home/aronnax/code/bgm-cli/oauth-backend/api/[[route]].js)
- Redis 会话层：[oauth-backend/src/upstash-session-store.js](/home/aronnax/code/bgm-cli/oauth-backend/src/upstash-session-store.js)
- 后端环境模板：[oauth-backend/.env.example](/home/aronnax/code/bgm-cli/oauth-backend/.env.example)
- CLI 本地开发模板：[bangumi-development.env.example](/home/aronnax/code/bgm-cli/bangumi-development.env.example)

## 18. 下一步建议

文档部署完成后，建议继续做：

1. 给 CLI 增加独立 `bgm auth login` 命令
2. 为后端增加基础限流
3. 为后端增加会话清理与错误观测
4. 在 README 主文档中加入本指南链接
