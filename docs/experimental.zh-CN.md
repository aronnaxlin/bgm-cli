# bgm-cli 实验性功能

这份文档集中说明不应当被普通用户视为默认主路径的能力，以及这些能力当前的风险和边界。

## 先给结论

- 普通用户默认应优先使用 Access Token。
- Turnstile 是高风险写操作的单次验证步骤，不是登录方式。
- OAuth 相关流程目前适合调试、验证或特定授权场景，不适合作为默认入口。
- `next.bgm.tv` private session 只是辅助能力，不替代 Access Token。
- `oauth-backend` 只用于自托管实验和 OAuth / Turnstile 调试。

## Turnstile 验证

对于小组发帖、日志评论、时光机吐槽等需要 Turnstile 的写操作，CLI 当前默认顺序是：

1. 优先走 Bangumi 官方托管 Turnstile 页面
2. 如果官方链路不可用，再自动回退到本地 helper
3. 如果显式传入 `--manual`，则直接使用本地 helper

如果只是想单独获取一次 token：

```bash
bgm auth turnstile
```

如果你处在远程机器或浏览器无法自动回传到当前终端的环境，可以改用：

```bash
bgm auth turnstile --manual --port 8765
```

远程或 VPS 场景下，如果官方托管验证页无法把 token 回传到当前终端，可以固定端口后通过 SSH 隧道手动打开本地 helper 页，例如：

```bash
ssh -L 8765:127.0.0.1:8765 your-server
bgm auth turnstile --manual --port 8765
```

说明：

- 获取到的 `turnstileToken` 是一次短时有效的写操作验证 token，应立即使用
- 这是写操作验证流程，不是认证主流程
- Bangumi 官方链路、回调和服务端行为都有可能影响最终成功率

## OAuth

CLI 目前支持这些 OAuth 辅助命令：

- 生成授权 URL
- 交换授权码
- 刷新 Token

如果配置了本地回调地址，CLI 可以自动监听回调；否则也支持手动粘贴回调 URL 或授权码。

如果配置了托管 OAuth backend，CLI 也可以把最终 token 通过托管 callback 页自动回传到本地终端。但这条路径更适合实验和兼容性测试，不建议优先于 Access Token 使用。

## Private Session

CLI 提供 `bgm auth session-login`、`bgm auth set-session` 和 `bgm auth session-status` 等 private session 辅助命令。

需要明确：

- 这只是 `next.bgm.tv` private API 的辅助 session 能力
- 它不替代 Access Token
- 它也不会消除部分写入动作对 Turnstile 的需求

## 日志实验性写入

当前这些命令仍属于实验性：

- `bgm blog reply <blog_id> <content> [--reply-to <comment_id>] [--turnstile-token <token>] [--manual]`
- `bgm blog edit-comment <comment_id> <content>`
- `bgm blog delete-comment <comment_id>`

已知限制：

- 需要 Turnstile
- CLI 会优先尝试官方托管验证页
- 即使拿到新的 token，Bangumi 服务端目前仍可能返回 `500`
- 当前未支持日志正文的创建、编辑和删除

## 时光机实验性写入

当前这些命令仍属于实验性：

- `bgm timeline say <content> [--turnstile-token <token>] [--manual]`
- `bgm timeline reply <timeline_id> <content> [--reply-to <comment_id>] [--turnstile-token <token>] [--manual]`

已知限制：

- 需要 Turnstile
- CLI 会优先尝试官方托管验证页
- 当前普通 CLI 主要覆盖非流式读写路径，未接入文档中的 SSE 事件流接口

## Hosted OAuth Backend

仓库包含一个可选的托管 OAuth backend 脚手架，位于 [`../oauth-backend/`](../oauth-backend)。

它主要用于：

- 自托管实验
- 调试 OAuth 流程
- 后续更便携的浏览器授权方案探索

它不是普通用户最推荐的认证方式，也不应替代 Access Token 作为默认方案。

部署说明见 [`../oauth-backend/README.md`](../oauth-backend/README.md)。

## 阅读延伸

- [`guide.zh-CN.md`](./guide.zh-CN.md)
- [`features.zh-CN.md`](./features.zh-CN.md)
- [`implementation.zh-CN.md`](./implementation.zh-CN.md)
- [`research/access-token-private-session-turnstile.zh-CN.md`](./research/access-token-private-session-turnstile.zh-CN.md)
- [`research/turnstile-manual-token.zh-CN.md`](./research/turnstile-manual-token.zh-CN.md)
- [`research/official-turnstile-path-design.zh-CN.md`](./research/official-turnstile-path-design.zh-CN.md)
