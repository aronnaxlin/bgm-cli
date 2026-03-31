# bgm-cli

[简体中文](./README.md) | [繁體中文（台灣）](./README.zh-TW.md) | [English](./README.en.md)

一个面向 Bangumi 日常使用场景的命令行客户端，重点支持：

- Bangumi 认证与登录
- 查看当前账号和公开用户资料
- 搜索与读取条目数据
- 列出收藏
- 在终端里更新收藏状态、评论和评分

项目基于纯 Node.js CLI 构建，默认输出适合人类阅读的终端文本，同时支持通过 `--json` 输出机器友好的 JSON。

## AI / Skill 指南

这个仓库已经提供一套面向 AI Agent 和自动化编码工作流的非 TUI 指南。

通用、与工具无关的主入口：

- [`docs/ai/bgm-cli-non-tui/README.md`](./docs/ai/bgm-cli-non-tui/README.md)

配套参考文档：

- [`docs/ai/bgm-cli-non-tui/references/source-map.md`](./docs/ai/bgm-cli-non-tui/references/source-map.md)
- [`docs/ai/bgm-cli-non-tui/references/config-and-auth.md`](./docs/ai/bgm-cli-non-tui/references/config-and-auth.md)
- [`docs/ai/bgm-cli-non-tui/references/collection-semantics.md`](./docs/ai/bgm-cli-non-tui/references/collection-semantics.md)

对 Codex 用户，还提供一个可触发的本地 Skill 入口：

- [`.codex/skills/bgm-cli-non-tui/SKILL.md`](./.codex/skills/bgm-cli-non-tui/SKILL.md)

给 Agent 的关键信息：

- 优先使用非 TUI 代码路径，而不是 `bgm tui`
- 直接 Access Token 登录是目前更成熟、也更推荐的认证方式
- CLI OAuth 辅助流程相对没那么成熟
- 托管版 `oauth-backend` 仍属于实验能力

## 当前状态

`bgm-cli` 现在已经可以实际使用，但整体仍属于早期阶段。

目前对常规使用来说相对稳定的部分：

- 基于 Access Token 的认证
- 条目查询与搜索
- 收藏列表
- 通过条目 ID 更新收藏，或先搜索再选择目标后更新收藏

目前仍偏实验性的部分：

- 浏览器 OAuth 流程
- 仓库内置的托管 OAuth 后端 [`oauth-backend/`](./oauth-backend)
- TUI 工作流

## 功能

- 通过 `bgm --init` 进行首次交互式初始化
- 直接使用 Access Token
- 生成 Bangumi OAuth 授权链接并交换 Token
- 获取当前用户和公开用户信息
- 获取、列出和搜索条目
- 列出、查询、收藏、评论、评分和修改收藏状态
- 人类可读输出，以及机器友好的 `--json`
- 可选的托管 OAuth backend 脚手架，用于自托管实验

## 运行要求

- Node.js `>= 20`

## 安装

### 远程一行安装

macOS / Linux：

```bash
curl -fsSL https://raw.githubusercontent.com/aronnaxlin/bgm-cli/main/scripts/install-remote.sh | sh
```

Windows PowerShell：

```powershell
irm https://raw.githubusercontent.com/aronnaxlin/bgm-cli/main/scripts/install-remote.ps1 | iex
```

这两个命令不需要先 `git clone`。它们会下载 `main` 分支源码到本地用户目录，然后自动执行全局安装。

### 直接从仓库运行

```bash
git clone <your-fork-or-repo-url>
cd bgm-cli
./bgm --help
```

### 一键安装

macOS / Linux:

```bash
./install.sh
```

Windows PowerShell:

```powershell
./install.ps1
```

这两个脚本会调用仓库内已有的全局安装逻辑，把当前仓库加入 PATH，并启用全局配置模式。

### 将当前仓库暴露为全局可执行的 `bgm`

```bash
bgm setup install-path
bgm --help
```

仓库入口文件：

- [`bgm`](./bgm)，用于 POSIX Shell
- [`bgm.cmd`](./bgm.cmd)，用于 Windows Shell
- [`install.sh`](./install.sh)，用于一键安装（macOS / Linux）
- [`install.ps1`](./install.ps1)，用于一键安装（Windows PowerShell）

安装脚本：

- [`scripts/install-global-bgm.sh`](./scripts/install-global-bgm.sh)
- [`scripts/install-global-bgm.ps1`](./scripts/install-global-bgm.ps1)
- [`scripts/install-remote.sh`](./scripts/install-remote.sh)
- [`scripts/install-remote.ps1`](./scripts/install-remote.ps1)

## 快速开始

### 1. 初始化 CLI

```bash
./bgm --init
```

对大多数用户来说，推荐路径是直接粘贴已有的 Bangumi Access Token。

### 2. 验证当前账号

```bash
./bgm user me
```

### 3. 搜索条目

```bash
./bgm subject search "Heike Monogatari" --type anime --limit 5
```

### 4. 读取或更新收藏

```bash
./bgm collection get 348335
./bgm collection collect 348335 collect
./bgm collection comment 348335 "Backfill"
./bgm collection rate 348335 8
```

## 命令概览

### 全局

```bash
bgm --help
bgm --json <command...>
bgm --init
bgm tui
```

### 配置

```bash
bgm config show
bgm config set userAgent yourname/bgm-cli/0.1.0
bgm config unset userAgent
```

### 认证

```bash
bgm auth login-url --state random-state
bgm auth token --code YOUR_CODE --save
bgm auth refresh --save
bgm auth set-token YOUR_ACCESS_TOKEN
bgm auth status
```

### 用户

```bash
bgm user me
bgm user get sai
bgm user get 123456
```

说明：数字 `uid` 路径只对仍在使用原始 uid 作为用户名的账号有效。一旦用户设置了自定义用户名，就需要改用 `/v0/users/{username}` 里的用户名。

### 条目

```bash
bgm subject get 12
bgm subject list --type anime --sort rank --limit 10
bgm subject search "Ghost in the Shell"
bgm subject search "Gundam" --type anime --sort rank --limit 5 --tag mecha --tag sci-fi
```

### 收藏

列出收藏：

```bash
bgm collection list --status doing --type anime --sort updated
```

按条目 ID 操作：

```bash
bgm collection get 348335
bgm collection collect 348335 collect
bgm collection comment 348335 "Backfill"
bgm collection rate 348335 7
bgm collection status 348335 doing
```

先搜索，再选择目标：

```bash
bgm collection get --search "Heike Monogatari" --pick 1
bgm collection status --search "Gundam" doing --pick 1
```

在交互式终端中，如果 `--search` 返回多个条目且未传入 `--pick`，CLI 会提示你进行选择。

### JSON 输出

```bash
bgm --json user me
bgm --json subject get 348335
```

## 收藏命令语义

这个 CLI 反映了 Bangumi 服务端的一些行为约束：

- 当收藏处于 `wish` 状态时，不允许评分
- `rate 0` 会清除评分
- `collection collect <subject_id> collect` 可以作为设置收藏状态的简写，不需要再额外传 `--status`
- 收藏写操作不会盲目信任写请求结果，而是会回读收藏结果确认是否真正持久化成功

目前没有暴露“取消收藏”功能，因为 Bangumi 公共 v0 subject collection 文档里暂时没有确认过该操作的删除路径。

## 认证

### 推荐方式：Access Token

最可靠的使用方式是：

1. 在浏览器里登录 Bangumi
2. 打开 `https://next.bgm.tv/demo/access-token`
3. 复制 Token
4. 运行 `bgm --init`，并选择 Access Token 流程

也可以直接保存 Token：

```bash
bgm auth set-token YOUR_ACCESS_TOKEN
```

### 浏览器 OAuth

CLI 也支持 Bangumi OAuth 相关辅助命令：

- 生成授权 URL
- 交换授权码
- 刷新 Token

如果配置了本地回调地址，CLI 可以自动监听回调；否则也支持手动粘贴回调 URL 或授权码。

### 托管 OAuth backend

这个仓库包含一个可选的托管 OAuth backend 脚手架，位于 [`oauth-backend/`](./oauth-backend)。

这个 backend 主要用于：

- 自托管实验
- 调试 OAuth 流程
- 后续更便携的浏览器授权方案探索

它并不是普通用户最推荐的认证方式。

部署相关细节请查看 [`oauth-backend/README.md`](./oauth-backend/README.md)。

## 配置

项目现在使用了一个更简单的配置模型：两个运行时配置位置，加一个开发覆盖文件。

### 运行时配置位置

当执行过全局安装脚本后，`bgm-cli` 会把当前安装视为全局安装，并把运行时配置保存到用户配置目录：

```text
~/.config/bgm-cli/config.json
```

在 Windows 上，对应路径位于 `%APPDATA%\bgm-cli\config.json`。

如果还没有执行全局安装脚本，CLI 会使用项目本地的运行时配置文件：

```text
./.bgm-cli/config.json
```

全局安装流程还会在当前仓库下写入一个本地标记文件 `./.bgm-cli/.global-install-enabled`，用于让 CLI 稳定判断这个 checkout 当前应运行在项目本地模式还是全局模式。

### 开发覆盖

开发专用覆盖文件位于：

```text
./bgm-dev.env
```

它适用于：

- 本地 OAuth 应用凭据
- 回调 URI 覆盖
- 临时 backend 覆盖
- 开发时自定义 User-Agent 或应用元数据

可从以下模板开始：

- [`bgm-dev.env.example`](./bgm-dev.env.example)

### 配置来源

运行时的实际配置按以下顺序合并：

1. 项目内置默认值
2. `bgm-dev.env`
3. 当前生效的运行时 `config.json`
4. 环境变量

实际含义是：

- 内置默认值主要提供应用元数据和默认托管 OAuth backend URL
- `bgm-dev.env` 用于开发期覆盖
- 当前生效的 `config.json` 用于保存 `bgm --init` 或 `bgm auth set-token` 等 CLI 命令写入的值
- 环境变量仍然拥有最高优先级

### 重要文件

- `./.bgm-cli/config.json`
  未启用全局安装模式时使用的项目本地运行时配置。

- `~/.config/bgm-cli/config.json`
  启用全局安装模式后使用的用户级运行时配置。

- [`bgm-dev.env.example`](./bgm-dev.env.example)
  本地开发覆盖模板。

- `./bgm-dev.env`
  未跟踪的开发专用覆盖文件。

- [`oauth-backend/.env.example`](./oauth-backend/.env.example)
  可选托管 OAuth backend 的环境变量模板。

### 支持的环境变量

- `BGM_ACCESS_TOKEN`
- `BGM_REFRESH_TOKEN`
- `BGM_CLIENT_ID`
- `BGM_CLIENT_SECRET`
- `BGM_REDIRECT_URI`
- `BGM_OAUTH_SERVER_BASE_URL`
- `BGM_USER_AGENT`

## 输出模型

默认情况下，命令会输出适合终端阅读的人类可读文本。

建议在以下场景使用 `--json`：

- 与脚本集成
- 查看原始响应结构
- 将输出继续传给其他工具

示例：

```bash
bgm --json collection get 348335
```

## 开发

### 本地运行

```bash
node src/cli.js --help
node src/cli.js user me
```

### 常用命令

```bash
node src/cli.js --help
node src/cli.js collection get 348335
node --check src/cli.js
node --check src/core/output.js
```

### 项目结构

```text
src/
  cli.js           主 CLI 入口与命令路由
  core/
    client.js      Bangumi API 与 OAuth 客户端辅助逻辑
    config.js      配置加载与持久化
    http.js        HTTP 封装与错误归一化
    output.js      人类可读与 JSON 输出格式化
oauth-backend/
  ...              可选的托管 OAuth backend 脚手架
bangumi-api/
  ...              开发时使用的本地 Bangumi API 参考资料
```

## 备注

- OAuth 端点使用 `https://bgm.tv`
- API 端点使用 `https://api.bgm.tv/v0`
- Bangumi 建议使用包含开发者和应用身份信息的自定义 `User-Agent`

## 许可证

当前仓库还没有包含许可证文件。如果要更广泛发布，或者接受外部贡献，建议先补充明确的许可证。
