# Access Token、Private Session 与 Turnstile 分工说明

本文专门说明 `bgm-cli` 当前涉及的三类认证 / 验证能力：

- `Access Token`
- `Private API Auth (private session)`
- `Turnstile`

这三者不是同一种东西，也不应该混成一条流程理解。

> 现状提示（2026-06）：本文最初写于 Access Token 作为默认入口的阶段。当前现实行为已经调整为：`bgm --init` / `bgm auth login` 是推荐的官方 p1 登录路径，Access Token 保留为第二登录渠道；对 `next.bgm.tv/p1` 请求，如果本地已有 Private Session，CLI 使用 session cookie，不会同时发送 Access Token。下文保留一些历史分析语境，实际操作以当前功能文档与 Skill 为准。

最重要的结论先放在前面：

- `bgm --init` / `bgm auth login` 是当前推荐的官方 p1 登录路径
- `Access Token` 是保留的第二登录渠道，适合已有 token 或脚本兼容场景
- `private session` 是 `next.bgm.tv/p1` 的官方登录结果，也是 p1 请求优先使用的认证上下文
- `Turnstile` 只是高风险写操作的单次人机验证
- `Access Token` 与 `private session` 不应在同一个 p1 请求里重复发送
- `private session` 也不消除 `Turnstile` 的需求

## 一句话分工

可以把三者理解成：

- `Access Token`: 第二登录渠道，证明“你是谁”，也服务非 p1 或脚本化路径
- `private session`: 官方 p1 登录后的 session cookie，是 p1 请求的优先认证上下文
- `Turnstile`: 证明“这一次写操作是经过人机验证的”

## 总览表

| 能力 | 主要作用 | 当前定位 | 是否推荐作为默认路径 | 是否长期有效 | 能否替代其他两者 |
| --- | --- | --- | --- | --- | --- |
| Access Token | 用户身份认证 | 第二登录渠道 | 否，保留给已有 token / 脚本路径 | 相对稳定 | 不能替代 Turnstile；也不等于 private session |
| private session | `next.bgm.tv/p1` session cookie | 官方 p1 登录结果 | 是 | 可能过期 | 不应与 Access Token 在 p1 请求里重复发送；也不替代 Turnstile |
| Turnstile | 单次写操作的人机验证 | 高风险写入附加验证 | 不是登录方式 | 很短 | 不能替代 Access Token 或 session |

## 1. Access Token

### 它负责什么

`Access Token` 是 CLI 里最主要、最推荐的登录方式。

它负责：

- 标识当前用户身份
- 让 CLI 调用 Bangumi 的主要 API
- 支撑大部分常规读取和用户相关操作
- 作为当前项目默认推荐的认证路径

### 它适合做什么

典型场景：

- `bgm user me`
- `bgm collection list`
- `bgm collection get`
- `bgm collection collect`
- `bgm collection rate`
- `bgm collection comment`
- `bgm collection status`
- 大多数普通 CLI 读取与收藏操作

### 它不负责什么

`Access Token` 不负责：

- 代替 Cloudflare Turnstile
- 直接生成 `turnstileToken`
- 保证社区发帖 / 回帖一定不需要额外验证
- 提供 `next.bgm.tv/p1` 浏览器 session

### 当前推荐用法

最简单的主路径：

```bash
bgm auth set-token YOUR_ACCESS_TOKEN
bgm auth token-status
```

或者：

```bash
bgm --init
```

### 当前项目里的定位

在 `bgm-cli` 当前设计里：

- `Access Token` 是主登录方式
- 如果只能保留一条最稳定路径，应优先保留它
- 所有其他 auth 辅助能力都不应影响它的行为

## 2. Private API Auth (private session)

### 它是什么

这里的 `private session` 指的是 `next.bgm.tv` private API 使用的浏览器 session，当前保存的核心值通常是：

- `chiiNextSessionID`

它来自浏览器在 `next.bgm.tv` 登录后的 session cookie。

### 它负责什么

它的作用是：

- 让 CLI 在请求 `next.bgm.tv/p1` 时可以附带一个浏览器 session
- 作为某些 `p1` 场景下的辅助身份材料
- 用来补充 private API 相关实验或兼容性研究

### 它不负责什么

它不负责：

- 代替 `Access Token` 成为项目默认登录方式
- 让所有操作都改走 cookie 而不走 token
- 代替 `Turnstile`
- 让小组发帖 / 回帖天然跳过人机验证

这是当前最容易误解的地方。

即使已经有 `private session`：

- 小组发帖 / 回帖仍然可能需要 `turnstileToken`

### 它什么时候有用

目前更适合这些场景：

- 调试 `next.bgm.tv/p1` 行为
- 对照官方 `Bangumi-iOS` 的 private API 路线
- 在某些 private API 读取或兼容性问题上排查 session 差异

### 它什么时候不应该被当主路径

不应该把它当成：

- 普通用户默认登录方式
- 推荐优先于 `Access Token` 的路径
- “拿到 session 就能长期稳定发帖”的方案

### 当前 CLI 用法

交互式方式：

```bash
bgm auth session-login
bgm auth session-status
```

这条路径会：

1. 打开官方 `https://next.bgm.tv/login`
2. 让用户在浏览器里登录
3. 提示把 `chiiNextSessionID` 粘贴回 CLI
4. 保存为本地辅助 session

手动方式：

```bash
bgm auth set-session "chiiNextSessionID=YOUR_SESSION_ID"
bgm auth session-status
```

### 当前项目里的定位

在 `bgm-cli` 当前设计里：

- `private session` 是辅助能力
- 它不会修改 `Access Token` 的主路径
- 它不应该改变“Access Token 是主登录方式”的产品定位

## 3. Turnstile

### 它是什么

`Turnstile` 指的是 Cloudflare Turnstile 人机验证。

在 Bangumi 当前社区写操作里，`turnstileToken` 更像是：

- 一次写操作前的附加验证材料

### 它负责什么

它负责：

- 证明“这一次写操作通过了人机验证”
- 为发帖、回帖等高风险写入提供附加校验

### 它不负责什么

它不负责：

- 登录用户
- 取代 `Access Token`
- 取代 `private session`
- 提供长期有效的认证状态

### 它最关键的特点

`turnstileToken` 通常具有这些特点：

- 短时有效
- 应该现取现用
- 更适合只服务于下一次写操作
- 不能当成长期配置保存后反复复用

### 它适合做什么

目前最典型的是：

- `bgm group create-topic`
- `bgm group reply`

### 当前 CLI 用法

显式获取：

```bash
bgm auth turnstile
```

远程 / VPS：

```bash
bgm auth turnstile --manual --port 8765
```

显式传入写操作：

```bash
bgm group create-topic boring "标题" "正文" --turnstile-token YOUR_TOKEN
bgm group reply 498114 "回复内容" --turnstile-token YOUR_TOKEN
```

或者不传 token，让 CLI 自动引导：

```bash
bgm group create-topic boring "标题" "正文"
bgm group reply 498114 "回复内容"
```

当前逻辑是：

- 如果没传 `--turnstile-token`
- CLI 会自动打开一个本地 helper 指导页
- helper 页会给出 `next.bgm.tv` 跳转、一键复制脚本和 token 回传入口
- 用户在 `next.bgm.tv` 页面上下文里完成验证后，再把 token 回传给 CLI

### 当前项目里的定位

在 `bgm-cli` 当前设计里：

- `Turnstile` 不是 auth 主流程
- 它只是 group 写操作等场景下的附加步骤
- 应当尽量让用户在“真正需要写入时”才触发它

## 三者之间的关系

### 正确理解

最合理的心智模型是：

1. `Access Token` 解决登录和身份
2. `private session` 只在需要时提供 `p1` session 辅助
3. `Turnstile` 只在高风险写入时解决单次人机验证

### 常见误区

#### 误区 1：有 Access Token 就一定不用 Turnstile

不对。

`Access Token` 解决的是身份认证，不等于写操作的人机校验。

#### 误区 2：有 private session 就能跳过 Turnstile

不对。

当前已知的 private API 设计和 `Bangumi-iOS` 的做法都说明：

- session 不能自然替代 Turnstile

#### 误区 3：Turnstile 是另一种登录方式

不对。

Turnstile 不是用来“登录”的，而是用来“放行这一次高风险写操作”的。

## 推荐使用顺序

### 面向普通用户

推荐顺序：

1. 先配置 `Access Token`
2. 普通读取和收藏操作直接使用 CLI
3. 只有在小组发帖 / 回帖时，再处理 `Turnstile`
4. 只有在研究 `p1` 行为时，才额外考虑 `private session`

### 面向当前项目实现

推荐的产品优先级：

1. `Access Token` 必须稳定
2. `Turnstile` 只作为写操作附加流程
3. `private session` 保持辅助定位，不抢主 auth 路径

## 推荐命令清单

### 主登录

```bash
bgm auth set-token YOUR_ACCESS_TOKEN
bgm auth token-status
```

### 辅助 private session

```bash
bgm auth session-login
bgm auth session-status
```

或：

```bash
bgm auth set-session "chiiNextSessionID=YOUR_SESSION_ID"
```

### 单次 Turnstile 验证

```bash
bgm auth turnstile
bgm auth turnstile --manual --port 8765
```

### group 写操作

```bash
bgm group create-topic boring "标题" "正文"
bgm group reply 498114 "回复内容"
```

如果你已经手里有 token：

```bash
bgm group create-topic boring "标题" "正文" --turnstile-token YOUR_TOKEN
bgm group reply 498114 "回复内容" --turnstile-token YOUR_TOKEN
```

## 当前结论

可以把 `bgm-cli` 现阶段的 auth / verification 模型总结成下面三句话：

- `Access Token` 是主登录
- `private session` 是 `p1` 辅助 session
- `Turnstile` 是高风险写操作的单次验证

只要把这三者分开理解，当前 CLI 的命令设计和后续演进方向就会清楚很多。
