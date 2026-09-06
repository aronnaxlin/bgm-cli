# bgm-cli

[简体中文](./README.md) | [繁體中文（台灣）](./README.zh-TW.md) | [English](./README.en.md)

`bgm-cli` 是一个面向 Bangumi 的命令行工具，目标是让用户尽快在终端里完成常见读取、查询和部分写入操作。

## 快速开始

### 运行要求

- Node.js `>= 20`

### 安装

npm / npx：

```bash
npx @aronnaxlin/bgm-cli --help
npm install -g @aronnaxlin/bgm-cli
```

macOS / Linux：

```bash
curl -fsSL https://raw.githubusercontent.com/aronnaxlin/bgm-cli/main/scripts/install-remote.sh | sh
```

Windows PowerShell：

```powershell
irm https://raw.githubusercontent.com/aronnaxlin/bgm-cli/main/scripts/install-remote.ps1 | iex
```

如果你已经在本地 clone 了仓库，也可以直接运行：

```bash
./bgm --help
```

### 认证

推荐路径是使用官方 Bangumi 登录：

```bash
bgm --init
```

`bgm --init` 会优先提供官方登录，也保留 Access Token 作为第二种渠道。如果你已经有 Token，也可以直接保存：

```bash
bgm auth set-token YOUR_ACCESS_TOKEN
bgm auth token-status
```

### 代理

如果你所在网络访问 Bangumi API 不稳定，可以为所有 CLI 请求设置 HTTP/HTTPS 代理：

```bash
bgm proxy set http://127.0.0.1:7890
bgm proxy show
```

临时使用也可以通过环境变量：

```bash
BGM_PROXY=http://127.0.0.1:7890 bgm subject get 8
```

代理优先级为：`bgm proxy set` 持久化配置 > `BGM_PROXY` > `HTTPS_PROXY` / `HTTP_PROXY`。

### 常用命令

```bash
bgm user me
bgm notify --limit 10
bgm subject search "Heike Monogatari" --type anime --limit 5
bgm subject get 348335
bgm subject comments 348335 --limit 5
bgm character search "明日香" --limit 3
bgm person search "庵野" --limit 3
bgm collection get 348335
bgm collection indexes --limit 5
bgm episode list 348335 --type main --limit 10
bgm episode comments 348335 1
bgm episode watch 348335 1
bgm book get 3510
bgm book ep 3510 10
bgm blog --help
bgm group list --sort members --limit 10
bgm user friends --limit 5
bgm group user --limit 5
bgm index user --limit 5
bgm search subject "海贼王" --limit 5
bgm trending subjects --type anime --limit 5
bgm status --site bgm.tv
bgm --json user me
```

## 文档索引

- 本项目同时提供可安装的 Skills，适合让 AI / Agent 直接安装并操作 `bgm-cli`。
- 可以通过 `npx skills add aronnaxlin/bgm-cli` 添加本项目的 Skills。
- [`docs/README.md`](./docs/README.md)：文档总入口
- [`docs/guide.zh-CN.md`](./docs/guide.zh-CN.md)：主体导览、推荐使用路径、安装与常见使用方式
- [`docs/features.zh-CN.md`](./docs/features.zh-CN.md)：完整功能列表与命令索引
- [`docs/implementation.zh-CN.md`](./docs/implementation.zh-CN.md)：配置模型、输出模型、收藏语义、仓库结构与开发说明
- [`docs/experimental.zh-CN.md`](./docs/experimental.zh-CN.md)：实验性功能、OAuth / Turnstile / private session / hosted backend 说明
- [`oauth-backend/README.md`](./oauth-backend/README.md)：可选自托管 OAuth backend 的部署说明
- [`SKILLS.md`](./SKILLS.md)：给 AI / Agent 的仓库与操作入口

## 核心风险与边界

- 本项目不是 Bangumi 官方产品，与 Bangumi 官方没有隶属关系。
- 普通用户默认应优先使用 `bgm --init` 里的官方登录；Access Token 保留为兼容和脚本场景渠道，OAuth / hosted backend 不应视为默认主路径。
- 一部分社区写操作依赖 Turnstile；本轮机器验证已跳过这类人机验证步骤，相关写操作仍需要人工复测，且个别实验性写操作目前仍可能遇到 Bangumi 服务端失败。
- 如果要做脚本集成，建议优先使用 `--json`，不要依赖人类可读输出的文本格式。
- Bangumi 建议客户端使用可识别开发者和应用身份的自定义 `User-Agent`。

## 致谢与承认

- 感谢 [`bgm.tv`](https://bgm.tv/) 提供 Bangumi 主站与社区生态。
- 感谢 [`bangumi/server-private`](https://github.com/bangumi/server-private) 提供 private API 相关实现参考。
- 感谢 [`bangumi/api`](https://github.com/bangumi/api) 提供公开 API 相关实现与文档基础。
- 感谢 [`SearchEncore`](https://bgmdb.ry.mk/v1/docs)（`bgmdb.ry.mk`）提供社区维护的 Bangumi 增强搜索能力；该服务作者为 [`wataame`](https://bangumi.tv/user/wataame)。SearchEncore 是社区成员自发维护的搜索服务，数据来自社区聚合，与 bangumi.tv 官方接口互补。
- 感谢 [`bgm-status.ry.mk`](https://bgm-status.ry.mk/) 提供社区维护的 Bangumi 可用性状态观测能力；该服务作者同样为 [`wataame`](https://bangumi.tv/user/wataame)。
- 本仓库会尽量反映当前可验证的 Bangumi 行为约束，但不承诺覆盖网站上的全部功能。

## 许可证

本仓库使用 `AGPL-3.0-only` 许可证。详见 [LICENSE](./LICENSE)。
