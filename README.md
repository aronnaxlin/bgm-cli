# bgm-cli

[简体中文](./README.md) | [繁體中文（台灣）](./README.zh-TW.md) | [English](./README.en.md)

`bgm-cli` 是一个面向 Bangumi 的命令行工具。

## 先给用户的结论

- 如果你只是想尽快把 Bangumi CLI 用起来，直接看下面的“安装”和“快速开始”
- 如果你想让 AI / Agent 直接帮你安装并操作它，先让它读 [`SKILLS.md`](./SKILLS.md)
- 面向用户的公开 Skill 是 [`skills/bgm-cli-operate/SKILL.md`](./skills/bgm-cli-operate/SKILL.md)
- 仓库开发专用 Skill 是 [`skills/bgm-cli-develop/SKILL.md`](./skills/bgm-cli-develop/SKILL.md)，普通用户可以忽略

你可以用它在终端里完成常见 Bangumi 操作，包括：

- 登录和检查认证状态
- 查看当前账号和公开用户资料
- 按 ID 获取条目、列出条目、搜索条目
- 列出、查看和更新收藏
- 浏览小组、查看帖子、查看成员
- 创建小组帖子和回复帖子
- [新增] 浏览日志、查看日志评论、图片和关联条目
- [实验性] 通过 Turnstile 执行日志评论写入
- 在普通终端输出和 `--json` 机器输出之间切换

项目基于纯 Node.js CLI 构建，默认输出适合人类阅读的终端文本，也支持通过 `--json` 输出机器友好的 JSON。

## 推荐路线

- 普通用户推荐优先使用 Access Token
- 做脚本集成或稳定调用时，优先使用普通 CLI 命令加 `--json`
- 需要交互式终端操作时，再使用 `bgm tui`
- `next.bgm.tv` private session 只是辅助能力，不替代 Access Token
- Turnstile 只是小组写操作和实验性日志评论写入等高风险动作的单次验证，不是登录方式
- OAuth 相关流程目前仍是实验性能力，不应作为默认使用路径
- 仓库中的 `oauth-backend` 仅用于自托管实验和 OAuth 调试

## 你可以用它做什么

- 通过 `bgm --init` 进行首次交互式初始化
- 直接使用 Access Token
- 生成 Bangumi OAuth 授权链接、交换授权码、刷新 Token
- 获取当前用户和公开用户信息
- 获取、列出和搜索条目
- 列出小组、查看小组详情、查看帖子和成员
- 创建小组帖子、回复帖子，并支持 Turnstile 辅助流程
- [新增] 日志列表、详情、评论、图片和关联条目读取
- [实验性] 日志评论写入、编辑和删除
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

这个命令不需要先 `git clone`。它会下载 `main` 分支源码到本地用户目录，然后自动执行全局安装。安装脚本本身是 `sh` 脚本，`| sh` 也适用于使用 zsh 的环境。

如果本地已经存在通过一行安装得到的托管副本，再次执行同一条安装命令会自动按“更新”处理，覆盖为最新版本，并尽量保留已有本地配置。

### 从当前仓库直接运行

```bash
git clone https://github.com/aronnaxlin/bgm-cli.git
cd bgm-cli
./bgm --help
```

如果你只是想用 CLI，本仓库直跑主要适合：

- 你已经在本地 clone 了仓库
- 你想先试一下，再决定是否装到 PATH
- 你在排查安装或环境问题

### 从仓库一键安装

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

### 一键更新托管安装版本

```bash
bgm setup update
```

这个命令面向通过远程一行安装得到的托管副本。它会下载并重新安装最新的 `main` 分支代码，同时保留已有配置文件，不需要先手动删除旧目录。

如果你当前运行的是本地 `git clone` 仓库，这个命令会拒绝执行，请直接用你自己的 `git pull` 或开发工作流更新。

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

### 1. 安装后查看帮助

```bash
bgm --help
```

### 2. 推荐先完成认证

```bash
bgm --init
```

对大多数用户来说，推荐路径是直接粘贴已有的 Bangumi Access Token。

如果你已经有 Token，也可以直接保存：

```bash
bgm auth set-token YOUR_ACCESS_TOKEN
bgm auth status
```

### 3. 验证当前账号

```bash
bgm user me
```

### 4. 搜索和读取条目

```bash
bgm subject search "Heike Monogatari" --type anime --limit 5
bgm subject get 348335
```

### 5. 读取或更新收藏

```bash
bgm collection get 348335
bgm collection collect 348335 collect
bgm collection comment 348335 "Backfill"
bgm collection rate 348335 8
bgm collection status 348335 doing
```

### 6. 浏览小组或帖子

```bash
bgm group list --sort members --limit 10
bgm group get boring
bgm group topics boring --limit 20
bgm group topic <topic_id>
```

`<topic_id>` 可以直接从上一条 `bgm group topics ...` 的输出里取。

### 7. 需要脚本集成时使用 JSON

```bash
bgm --json user me
bgm --json subject search "Gundam" --type anime --limit 5
bgm --json collection get 348335
```

## 命令概览

### 命令表

| 分类 | 命令 | 说明 |
| --- | --- | --- |
| 全局 | `bgm --help` | 显示帮助信息 |
| 全局 | `bgm --json <command...>` | 以 JSON 输出任意支持命令的结果 |
| 全局 | `bgm --init` | 启动交互式初始化向导 |
| 全局 | `bgm tui` | 打开交互式 TUI |
| Setup | `bgm setup install-path` | 将当前仓库加入 PATH，并启用全局配置模式 |
| Setup | `bgm setup update` | 更新一键安装得到的托管副本到最新 main |
| 配置 | `bgm config show` | 显示当前生效配置 |
| 配置 | `bgm config set <key> <value>` | 写入一个配置项 |
| 配置 | `bgm config unset <key>` | 删除一个配置项 |
| 认证 | `bgm auth login-url [--client-id xxx] [--redirect-uri xxx] [--state xxx]` | 生成 Bangumi OAuth 授权链接 |
| 认证 | `bgm auth token --code <code> [--save]` | 用授权码换取 Access Token / Refresh Token |
| 认证 | `bgm auth refresh [--save]` | 刷新已保存的 Access Token |
| 认证 | `bgm auth turnstile [--manual] [--listen-host <host>] [--port n] [--public-origin <url>] [--timeout-seconds <n>]` | 打开本地 helper 指导页，获取供下一次写入动作使用的短时 Turnstile Token |
| 认证 | `bgm auth set-token <access_token>` | 直接保存已有 Access Token |
| 认证 | `bgm auth session-login [--manual]` | 打开官方 private API 登录页并保存辅助 session |
| 认证 | `bgm auth set-session <chiiNextSessionID|cookie_string>` | 手动保存 private API session |
| 认证 | `bgm auth session-status` | 检查当前是否已保存 private API session |
| 认证 | `bgm auth status` | 检查当前 Access Token 状态 |
| 用户 | `bgm user me` | 获取当前登录用户资料 |
| 用户 | `bgm user get <username_or_uid>` | 获取公开用户资料 |
| 条目 | `bgm subject get <subject_id>` | 按 ID 获取单个条目 |
| 条目 | `bgm subject list --type <book\|anime\|music\|game\|real> [--sort date\|rank] [--year yyyy] [--month mm] [--limit n]` | 按类型和筛选条件浏览条目 |
| 条目 | `bgm subject search <keyword> [--type ...] [--sort match\|heat\|rank\|score] [--tag xxx] [--limit n]` | 搜索条目 |
| 小组 | `bgm group list [--mode <all\|joined\|managed>] [--sort <created\|updated\|posts\|topics\|members>] [--limit n] [--offset n]` | 列出小组 |
| 小组 | `bgm group get <group_name>` | 获取单个小组详情 |
| 小组 | `bgm group topics <group_name> [--limit n] [--offset n]` | 列出小组帖子 |
| 小组 | `bgm group topic <topic_id> [--reply-limit n]` | 获取单个小组帖子详情，含正文与评论摘要 |
| 小组 | `bgm group create-topic <group_name> <title> <content> [--turnstile-token <token>] [--manual]` | 在小组中创建新帖子；未传 token 时会自动打开本地 helper 指导页 |
| 小组 | `bgm group reply <topic_id> <content> [--reply-to <reply_id>] [--turnstile-token <token>] [--manual]` | 回复小组帖子；未传 token 时会自动打开本地 helper 指导页 |
| 小组 | `bgm group members <group_name> [--role <visitor\|guest\|member\|creator\|moderator\|blocked>] [--limit n] [--offset n]` | 列出小组成员 |
| 小组 | `bgm group recent-topics [--mode <all\|joined\|created\|replied>] [--limit n] [--offset n]` | 列出最新小组帖子 |
| 小组 | `bgm group latest-replies [--mode <all\|joined\|created\|replied>] [--limit n] [--scan n]` | 列出最新被回复顶起的小组帖子 |
| 小组 | `bgm group hot [--window <day\|week\|month>] [--mode <all\|joined\|created\|replied>] [--limit n] [--scan n]` | 按近期开帖活跃度计算最火小组 |
| 小组 | `bgm group hot-topics [--window <day\|week\|month>] [--mode <all\|joined\|created\|replied>] [--limit n] [--scan n]` | 按近期活跃度计算最火小组帖子 |
| 日志 | `[新增] bgm blog list [--user <username>] [--limit n] [--offset n]` | 列出某个用户的日志 |
| 日志 | `[新增] bgm blog get <blog_id>` | 获取单篇日志详情 |
| 日志 | `[新增] bgm blog comments <blog_id>` | 列出单篇日志评论 |
| 日志 | `[新增] bgm blog photos <blog_id> [--limit n] [--offset n]` | 列出日志图片 |
| 日志 | `[新增] bgm blog subjects <blog_id>` | 列出日志关联条目 |
| 日志 | `[实验性] bgm blog reply <blog_id> <content> [--reply-to <comment_id>] [--turnstile-token <token>] [--manual]` | 回复日志或日志评论；需要 Turnstile，当前可能仍会遇到服务端失败 |
| 日志 | `[实验性] bgm blog edit-comment <comment_id> <content>` | 编辑自己的日志评论 |
| 日志 | `[实验性] bgm blog delete-comment <comment_id>` | 删除自己的日志评论 |
| 收藏 | `bgm collection list [--user <username>] [--status <wish\|collect\|doing\|on_hold\|dropped>] [--type <book\|anime\|music\|game\|real>] [--sort <updated\|name\|rank\|community_score\|user_score\|date>] [--order <asc\|desc>] [--limit n]` | 列出某个用户的收藏 |
| 收藏 | `bgm collection get <subject_id>` | 按条目 ID 获取当前用户的收藏详情 |
| 收藏 | `bgm collection get --search <keyword> [--pick n]` | 先搜索条目，再获取当前用户的收藏详情 |
| 收藏 | `bgm collection collect <subject_id> [<wish\|collect\|doing\|on_hold\|dropped>]` | 新建或更新收藏，支持位置参数直接传状态 |
| 收藏 | `bgm collection collect --search <keyword> [--status <wish\|collect\|doing\|on_hold\|dropped>] [--pick n]` | 先搜索条目，再新建或更新收藏 |
| 收藏 | `bgm collection comment <subject_id> <comment>` | 更新收藏评论 |
| 收藏 | `bgm collection comment --search <keyword> <comment> [--pick n]` | 先搜索条目，再更新收藏评论 |
| 收藏 | `bgm collection rate <subject_id> <0-10>` | 更新收藏评分，`0` 表示清除评分 |
| 收藏 | `bgm collection rate --search <keyword> <0-10> [--pick n]` | 先搜索条目，再更新收藏评分 |
| 收藏 | `bgm collection status <subject_id> <wish\|collect\|doing\|on_hold\|dropped>` | 更新收藏状态 |
| 收藏 | `bgm collection status --search <keyword> <wish\|collect\|doing\|on_hold\|dropped> [--pick n]` | 先搜索条目，再更新收藏状态 |

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
bgm config set timezone Asia/Tokyo
bgm config unset userAgent
```

### 认证

```bash
bgm auth login-url --state random-state
bgm auth token --code YOUR_CODE --save
bgm auth refresh --save
bgm auth turnstile --manual --port 8765
bgm auth set-token YOUR_ACCESS_TOKEN
bgm auth session-login
bgm auth session-status
bgm auth status
```

远程或 VPS 场景下，可以固定端口后通过 SSH 隧道手动打开 helper 页，例如先在本地执行 `ssh -L 8765:127.0.0.1:8765 your-server`，再运行 `bgm auth turnstile --manual --port 8765`。

说明：

- Access Token 是当前最推荐、最稳定的使用方式
- `bgm auth status` 检查的是 Access Token 状态
- `bgm auth session-login` / `bgm auth session-status` 只是 `next.bgm.tv/p1` 的辅助 session 能力
- 这个 private session 不替代 Access Token，也不消除小组写入和实验性日志评论写入对 Turnstile 的需求
- `bgm auth turnstile` 会打开一个本地 helper 指导页，里面提供 `next.bgm.tv` 跳转、控制台脚本复制和 token 回传入口
- 获取到的 `turnstileToken` 是一次短时有效的写操作验证 token，应立即使用
- OAuth 相关流程目前是实验性能力，适合调试、验证或特定授权场景
- 如果只是想尽快稳定地用 CLI，优先使用 `bgm auth set-token` 或 `bgm --init` 的 Access Token 路径

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

### 小组

```bash
bgm group list --sort members --limit 10
bgm group get boring
bgm group topics boring --limit 20
bgm group topic <topic_id>
bgm group create-topic boring "Title" "Content"
bgm group members boring --role member --limit 20
bgm group recent-topics --mode all --limit 10
bgm group latest-replies --limit 10
bgm group hot --window day --limit 10
bgm group hot-topics --window week --limit 10
```

写操作支持两种方式：直接传 `--turnstile-token`，或者在未传 token 时让 CLI 自动打开本地 helper 指导页。helper 页会给出 `next.bgm.tv` 页面跳转、一键复制脚本和手动粘贴回传入口。远程环境可搭配 `--manual` 使用。

### 日志

```bash
bgm blog list --user sai --limit 10
bgm blog get 371953
bgm blog comments 371953
bgm blog photos 371953
bgm blog subjects 371953
bgm blog reply 371953 "测试成功，可忽略"
```

说明：

- `[新增]` 日志读取命令目前已接入 CLI
- `[实验性]` 日志评论写入命令需要 Turnstile
- `[实验性]` 日志评论写入、编辑、删除目前仍可能遇到 Bangumi 服务端 `500`
- 当前未支持日志正文的创建、编辑和删除

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

这条路径目前仍是实验性能力，不是默认推荐给普通用户的主路径。

### 托管 OAuth backend

这个仓库包含一个可选的托管 OAuth backend 脚手架，位于 [`oauth-backend/`](./oauth-backend)。

这个 backend 主要用于：

- 自托管实验
- 调试 OAuth 流程
- 后续更便携的浏览器授权方案探索

它并不是普通用户最推荐的认证方式，也不应替代 Access Token 作为默认方案。

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

## 仓库开发

如果你只是要使用这个工具，到这里为止基本就够了。

下面这部分只给要改这个仓库、提 PR 或维护命令实现的人看。

### 本地运行

```bash
node src/cli.js --help
node src/cli.js user me
```

### 常用命令

```bash
node src/cli.js --help
node src/cli.js collection get 348335
node src/cli.js group list --limit 5
node src/cli.js --json user me
node --check src/cli.js
node --check src/core/client.js
node --check src/core/config.js
node --check src/core/http.js
node --check src/core/output.js
```

### 开发入口

- 先读 [`SKILLS.md`](./SKILLS.md)
- 开发仓库看 [`skills/bgm-cli-develop/SKILL.md`](./skills/bgm-cli-develop/SKILL.md)
- 如果是让 Agent 操作 CLI，而不是改代码，看 [`skills/bgm-cli-operate/SKILL.md`](./skills/bgm-cli-operate/SKILL.md)

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

本仓库使用 `AGPL-3.0-only` 许可证。详见 [LICENSE](./LICENSE)。

## 更多文档

- [`docs/README.md`](./docs/README.md)
- [`SKILLS.md`](./SKILLS.md)
- [`skills/README.md`](./skills/README.md)
- [`skills/bgm-cli-operate/SKILL.md`](./skills/bgm-cli-operate/SKILL.md)
- [`skills/bgm-cli-develop/SKILL.md`](./skills/bgm-cli-develop/SKILL.md)
- [`docs/skills/README.md`](./docs/skills/README.md)
