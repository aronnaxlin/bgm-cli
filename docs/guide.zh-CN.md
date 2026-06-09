# bgm-cli 主体导览

这份文档面向第一次进入项目的用户，目标是帮助你快速判断应该怎么安装、怎么认证、怎么开始使用。

## 一句话结论

- 如果你只想尽快把 CLI 用起来，先装好 `bgm`，然后执行 `bgm --init`。
- 普通用户优先使用 `bgm --init` 里的官方登录；Access Token 是保留的第二渠道。
- 做脚本集成时优先使用普通 CLI 命令加 `--json`。
- 需要交互式终端工作流时，再考虑 `bgm tui`。
- OAuth / hosted backend 不是默认主路径。

## 适合谁

`bgm-cli` 适合这些场景：

- 你想在终端里读取 Bangumi 用户、条目、收藏、小组、日志或时光机信息
- 你想用脚本调用 Bangumi 相关信息，并拿到稳定的 JSON 输出
- 你愿意接受一部分社区写操作存在额外验证和服务端约束

## 推荐使用路径

### 1. 普通用户

推荐顺序：

1. 安装 `bgm`
2. 运行 `bgm --init`
3. 选择 `Official Bangumi login (Recommended)`
4. 用 `bgm user me` 验证当前账号

### 2. 自动化 / Agent / 脚本

推荐顺序：

1. 先确认认证可用
2. 使用普通 CLI 命令
3. 始终加 `--json`
4. 不要依赖人类可读输出的文本格式

### 3. 交互式终端

如果你需要更强的交互体验，可以再看 `bgm tui`。但对于大多数自动化和脚本场景，普通命令行子命令仍然是更稳定的入口。

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

说明：

- 不需要先 `git clone`
- 会下载 `main` 分支源码到本地用户目录并完成全局安装
- 如果你之前就是通过这条路径安装的，再次执行会按更新处理，并尽量保留已有配置

### 从当前仓库直接运行

```bash
git clone https://github.com/aronnaxlin/bgm-cli.git
cd bgm-cli
./bgm --help
```

适合这些情况：

- 你已经在本地 clone 了仓库
- 你想先试跑，再决定是否安装到 PATH
- 你在排查安装或环境问题

### 从仓库一键安装

macOS / Linux：

```bash
./install.sh
```

Windows PowerShell：

```powershell
./install.ps1
```

### 将当前仓库暴露为全局可执行 `bgm`

```bash
bgm setup install-path
bgm --help
```

### 更新托管安装

```bash
bgm setup update
```

这个命令只面向通过远程一行安装得到的托管副本。如果你运行的是本地 `git clone` 仓库，请使用自己的 git 工作流更新。

## 代理设置

如果你的网络需要通过本机代理访问 Bangumi，可以把代理写入 `bgm-cli` 配置：

```bash
bgm proxy set http://127.0.0.1:7890
bgm proxy show
```

这会保存到当前生效的用户配置文件，之后所有 `bgm` 命令都会使用它。清除代理：

```bash
bgm proxy unset
```

如果只想临时对单次命令生效，可以使用环境变量：

```bash
BGM_PROXY=http://127.0.0.1:7890 bgm subject get 8
```

也兼容常见代理环境变量：`HTTPS_PROXY`、`https_proxy`、`HTTP_PROXY`、`http_proxy`。优先级为：

```text
config.proxy > BGM_PROXY > HTTPS_PROXY > https_proxy > HTTP_PROXY > http_proxy
```

当前只支持 HTTP/HTTPS 代理 URL，例如 `http://127.0.0.1:7890`。如果 URL 中包含用户名和密码，普通文本输出会脱敏显示；脚本集成时仍应注意不要把配置文件或 JSON 输出公开。

## 快速开始

### 1. 查看版本和帮助

```bash
bgm --version
bgm --help
```

### 2. 完成认证

```bash
bgm --init
```

`bgm --init` 会默认进入官方登录；如果你已经有 Token：

```bash
bgm auth set-token YOUR_ACCESS_TOKEN
bgm auth token-status
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
bgm episode list 348335 --type main --limit 10
bgm episode watch 348335 1
bgm book get 3510
bgm book ep 3510 10
bgm book vol 3510 2
```

### 6. 浏览小组或帖子

```bash
bgm group list --sort members --limit 10
bgm group get boring
bgm group topics boring --limit 20
bgm group topic <topic_id>
```

### 7. 查看番组表

```bash
bgm calendar
bgm calendar all
bgm calendar mon
```

### 8. 需要脚本集成时使用 JSON

```bash
bgm --json user me
bgm --json subject search "Gundam" --type anime --limit 5
bgm --json collection get 348335
```

## 入口文件

- [`../bgm`](../bgm)：POSIX Shell 入口
- [`../bgm.cmd`](../bgm.cmd)：Windows Shell 入口
- [`../install.sh`](../install.sh)：仓库内一键安装脚本
- [`../install.ps1`](../install.ps1)：Windows 一键安装脚本

## 下一步阅读

- 想看完整功能范围：读 [`features.zh-CN.md`](./features.zh-CN.md)
- 想看配置和实现细节：读 [`implementation.zh-CN.md`](./implementation.zh-CN.md)
- 想看实验性能力和高风险路径：读 [`experimental.zh-CN.md`](./experimental.zh-CN.md)
