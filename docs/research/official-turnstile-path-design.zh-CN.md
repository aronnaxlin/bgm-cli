# Bangumi 官方 Turnstile 路径设计草案

这份文档的目标不是解释 `Turnstile` 是什么，而是回答一个更具体的问题：

- 如果要让 `bgm-cli` 走 Bangumi 私有 API 里“官方”的 `Turnstile` 路径，应该怎么设计？

最重要的结论先放前面：

- `Access Token` 不能直接换出 `turnstileToken`
- `private session` 也不能绕过 `Turnstile`
- Bangumi 私有 API 已经公开了 `/p1/turnstile`
- 但它要求 `redirect_uri` 在白名单里
- 这意味着“本地随机端口 localhost 回调”不是默认可用方案
- 如果要走官方路径，最现实的办法是：`固定公网 HTTPS callback + 白名单 redirect_uri + 短时 token relay`

## 1. 已确认事实

基于当前 `https://bangumi.github.io/dev-docs/api.yaml` 可确认：

### 1.1 已存在官方接口

私有 API 文档里有：

- `GET /p1/turnstile`

文档描述：

- `redirect_uri` 是必填
- `redirect_uri` 是白名单机制
- 如需添加，需要向 Bangumi 提 PR

### 1.2 文档已公开 site-key

`TurnstileToken` schema 里写明：

- `next.bgm.tv` 的 site-key 是 `0x4AAAAAAABkMYinukE8nzYS`
- `dev.bgm38.tv` 使用测试 site-key `1x00000000000000000000AA`

### 1.3 当前实测结果

直接请求：

```text
https://next.bgm.tv/p1/turnstile?redirect_uri=https://next.bgm.tv/
```

返回：

```json
{
  "statusCode": 400,
  "code": "BAD_REQUEST",
  "error": "Bad Request",
  "message": "Redirect URI is not in the whitelist, you can PR your redirect URI."
}
```

所以可以明确判断：

- 官方接口确实存在
- 但它不会接受任意 `redirect_uri`
- `localhost` / 临时本地 helper 端口这条路，至少现在不能直接当官方回调地址来用

## 2. 这对 `bgm-cli` 设计意味着什么

如果继续保留“完全本地、临时端口、无公网 callback”的前提，那么：

- 可以继续做现在这种 `next.bgm.tv` 页面上下文脚本注入 + 手动/半自动回传
- 但这不算“官方 `/p1/turnstile` 路径”

如果想走官方路径，则必须接受下面这个现实约束：

- 需要一个稳定、固定、可提交白名单的 `redirect_uri`

也就是说，官方路径更像 OAuth callback，而不像 CLI 本地 loopback callback。

## 3. 推荐目标形态

推荐把“官方 Turnstile 路径”设计成两段：

1. Bangumi 官方负责出 Turnstile 页面和 token 生成
2. `bgm-cli` 自己负责 token relay 和本地等待逻辑

最小可行架构：

- `bgm-cli`
- 一个固定公网 HTTPS callback 页面
- 一个极小的 relay backend

## 4. 推荐架构

### 4.1 组件

建议拆成三个组件：

#### A. CLI 本体

职责：

- 发起一次 Turnstile 会话
- 打开浏览器访问 Bangumi 官方 `/p1/turnstile`
- 轮询 relay backend，等待 token
- 拿到 token 后立刻用于下一次写操作

#### B. 公网 callback 页面

例如：

```text
https://bgm-cli.example.com/api/turnstile/callback
```

职责：

- 作为提交给 Bangumi 白名单的固定 `redirect_uri`
- 接收 Bangumi 完成 Turnstile 后的跳转
- 从 callback URL 自带的 session 参数恢复当前 CLI 会话
- 从 URL 中解析 token 或调试信息
- 把 token 提交给 relay backend
- 给用户显示“已完成，可回到终端”之类的状态页

#### C. Relay backend

职责：

- 创建短时 Turnstile 会话
- 接收 callback 页面上传的 token
- 供 CLI 轮询读取 token
- token 被读取后立即销毁

## 5. 为什么一定要 relay backend

因为即使 Bangumi 白名单允许你的公网 callback，也仍然有一个核心问题：

- `bgm-cli` 本身运行在本地终端
- Bangumi 官方回调只能跳到公网地址
- 它不能直接跳回某个临时本地随机端口

所以需要一个中间层：

- 浏览器把 token 交给 relay backend
- CLI 再从 relay backend 取回来

结合上游 `server-private` 源码还能进一步确认：

- `/p1/turnstile` 的白名单判断是 `redirectUri.startsWith(allowedUri)`
- 页面模板会在用户完成验证后，把 `token` 直接追加到传入的 `redirect_uri` query 上

这意味着：

- 如果 Bangumi 白名单里放的是 `https://your-domain.example/api/turnstile/callback`
- 那么你大概率可以直接传入
  `https://your-domain.example/api/turnstile/callback?session=...&secret=...`
- 而不需要额外的 cookie 或 hosted `start` 路由

这和当前 repo 里的 `oauth-backend` 思路很接近，只是这里交付的是 `turnstileToken`，不是 OAuth code/token。

## 6. 建议的最小协议

下面是一套足够小、可自己实现验证的协议。

### 6.1 CLI 创建会话

CLI 请求：

```text
POST /api/turnstile/session
```

建议请求体：

```json
{
  "action": "timeline-say",
  "ttlSeconds": 300
}
```

建议返回：

```json
{
  "sessionId": "ts_xxx",
  "sessionSecret": "sec_xxx",
  "redirectUri": "https://bgm-cli.example.com/api/turnstile/callback?session=ts_xxx&secret=sec_xxx",
  "authorizeUrl": "https://next.bgm.tv/p1/turnstile?redirect_uri=https%3A%2F%2Fbgm-cli.example.com%2Fapi%2Fturnstile%2Fcallback%3Fsession%3Dts_xxx%26secret%3Dsec_xxx",
  "pollUrl": "https://bgm-cli.example.com/api/turnstile/session/ts_xxx?secret=sec_xxx",
  "expiresAt": "2026-04-23T12:00:00.000Z"
}
```

然后 CLI 直接打开 Bangumi 官方 URL：

```text
https://next.bgm.tv/p1/turnstile?redirect_uri=https%3A%2F%2Fbgm-cli.example.com%2Fapi%2Fturnstile%2Fcallback%3Fsession%3Dts_xxx%26secret%3Dsec_xxx
```

### 6.2 Bangumi 完成验证后跳回 callback

callback 页面首先通过 URL 里的 `session` / `secret` 恢复当前 session，再处理 Bangumi 回跳。

这一步的未知点是：

- Bangumi 最终是把 token 放在 query、hash，还是别的字段里

所以 callback 页第一版必须做“探测优先”，不要先假设字段名只有一个。

建议 callback 页至少记录和尝试解析：

- `location.search`
- `location.hash`
- 常见候选字段：`turnstileToken`、`token`

如果都没有，也要把完整 URL 结构显示出来，便于人工判断。

### 6.3 Callback 页面上报 token

浏览器页面向 relay backend 上报：

```text
POST /api/turnstile/session/ts_xxx/complete
```

建议请求体：

```json
{
  "sessionId": "ts_xxx",
  "sessionSecret": "sec_xxx",
  "turnstileToken": "<very-long-token>",
  "rawQuery": "?...",
  "rawHash": "#..."
}
```

### 6.4 CLI 轮询结果

CLI 周期性请求：

```text
GET /api/turnstile/session/ts_xxx?secret=sec_xxx
```

未完成时返回：

```json
{
  "status": "pending"
}
```

成功时返回：

```json
{
  "status": "completed",
  "turnstileToken": "<very-long-token>"
}
```

CLI 取到 token 后：

- 立刻使用
- 读取成功后 relay backend 立即删除该 token

## 7. 推荐实现顺序

不要一开始就把 CLI、relay、callback、Bangumi 白名单全绑在一起做。

建议按下面顺序推进。

### Phase 0: 先搞清 callback 的真实参数形态

目标：

- 弄清 Bangumi 回跳到白名单 `redirect_uri` 时，到底会带哪些字段

最小动作：

- 先做一个最简单的公网 callback 页面
- 页面只打印：
  - `location.href`
  - `location.search`
  - `location.hash`
  - 解析后的 query params
- 向 Bangumi 提 PR，把该 callback URL 加白
- 手工跑一遍 `/p1/turnstile`

只有拿到真实回调样子后，后面协议才能收敛。

### Phase 1: 做“人工回读”的官方版 callback

目标：

- 不急着自动 relay
- 先让 callback 页面把 token 明文显示给你复制

这样你最少可以验证两件事：

- 官方 `/p1/turnstile` 能走通
- callback 能拿到可用 token

### Phase 2: 再做 relay backend

目标：

- callback 页自动把 token 发给 relay backend
- CLI 自动轮询拿回 token

这是第一个真正“产品可用”的版本。

### Phase 3: 把 `bgm auth turnstile` 切到官方路径

目标：

- 优先走官方 `/p1/turnstile`
- 如果未配置 relay backend 或未拿到白名单 redirect，则回退到当前 helper 流程

## 8. 最小可行实现建议

如果你只是想自己尽快试通，不要先改整个 CLI。

最小实验集：

1. 做一个简单网页，比如 `https://your-domain.example/api/turnstile/callback`
2. 页面打印全部 URL 信息
3. 向 Bangumi 提 PR 申请把这个 callback URL 加入白名单
4. 白名单通过后，手工访问：

```text
https://next.bgm.tv/p1/turnstile?redirect_uri=https%3A%2F%2Fyour-domain.example%2Fapi%2Fturnstile%2Fcallback%3Fsession%3Ddemo%26secret%3Ddemo
```

5. 完成 Turnstile
6. 看 callback 页到底收到了什么
7. 如果收到了 token，再拿它去试：

```bash
bgm timeline say "test" --turnstile-token '<token>'
```

这样能最快验证“官方路径到底值不值得做”。

## 9. 为什么不推荐把 localhost 继续包装成官方路径

根本原因不是 CLI 不够复杂，而是 Bangumi 官方接口的约束就是：

- `redirect_uri` 白名单

只要这条约束不变：

- 随机本地端口就不适合作为官方 callback 目标
- 继续在本地绕，只会越来越像 hack，而不是正式路径

所以如果目标是“官方、稳、可维护”，应当接受：

- callback 必须是固定公网地址

## 10. 安全注意事项

`turnstileToken` 虽然不是长期凭证，但仍然不应粗暴处理。

建议：

- relay backend 不要在日志里打印完整 token
- 最多打印 preview
- token 存储 TTL 控制在 5 分钟内
- token 一旦被 CLI 读取，立即删除
- `sessionId` 之外再加一个高熵 `sessionSecret`
- `pollUrl` 必须带 secret，避免别人枚举 sessionId 直接取走 token

## 11. 对 `bgm-cli` 仓库的落地建议

如果后续要在本仓库里正式实现，建议按现有 ownership 来放：

- `src/core/turnstile.js`
  继续负责 CLI 端 Turnstile 获取逻辑；这里新增 official flow client
- `src/cli.js`
  `bgm auth turnstile` 和所有需要 `resolveTurnstileTokenForMutation` 的写操作入口保持不变，只替换获取 token 的内部实现
- `oauth-backend/src/*`
  如果不想新开服务，可以把 relay backend 和 hosted callback 直接作为 `oauth-backend` 的一个新实验能力扩进去

最小改法不是重写命令层，而是：

- 在 `acquireTurnstileToken()` 里增加一个 `official` 模式
- 未配置 official relay 时，回退到当前 helper 流程

## 12. 仍然未知、必须先验证的点

这几个点在真正实现前必须实测，不应该拍脑袋：

1. `/p1/turnstile` 完成后到底怎么把 token 交回 callback
2. token 字段名是不是固定叫 `turnstileToken`
3. callback 是 GET 跳转还是别的形式
4. 同一个 token 对 group/blog/timeline 写操作是否都通用
5. token 的实际有效窗口有多长

在这几个点没确认前，最合理的做法不是直接写成“最终产品”，而是先做一版观测型 callback；但基于当前上游源码，正式实现优先采用“白名单 callback 前缀 + callback query 传 session”的方式，会比额外引入 cookie/start 路由更贴近官方实际行为。

## 13. 最终建议

如果你现在要自己尝试，最推荐顺序是：

1. 先做一个最简单的公网 callback 页面
2. 向 Bangumi 提 PR 申请白名单
3. 先验证 callback 真实长什么样
4. 再把 session / secret 作为 callback query 接进 relay backend
5. 验证成功后，再决定要不要继续做产品化自动回传

一句话总结：

Bangumi 的官方 Turnstile 路径不是“本地 helper 页再包装一下”就能得到的；它更像一条需要固定公网 callback 和白名单支持的 OAuth-style 回调链路。
