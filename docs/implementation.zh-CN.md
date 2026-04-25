# bgm-cli 具体实现细节

这份文档保留主 `README` 中不适合放在快速开始入口里的实现与开发说明。

## 配置模型

项目目前使用两个运行时配置位置，加一个开发覆盖文件。

### 运行时配置位置

执行过全局安装脚本后，`bgm-cli` 会把当前安装视为全局安装，并把运行时配置保存到用户配置目录：

```text
~/.config/bgm-cli/config.json
```

在 Windows 上，对应路径位于 `%APPDATA%\bgm-cli\config.json`。

如果还没有执行全局安装脚本，CLI 会使用项目本地的运行时配置文件：

```text
./.bgm-cli/config.json
```

全局安装流程还会在当前仓库下写入本地标记文件 `./.bgm-cli/.global-install-enabled`，用于稳定判断当前 checkout 应运行在项目本地模式还是全局模式。

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

模板文件：

- [`../bgm-dev.env.example`](../bgm-dev.env.example)

### 配置来源优先级

运行时实际配置按以下顺序合并：

1. 项目内置默认值
2. `bgm-dev.env`
3. 当前生效的运行时 `config.json`
4. 环境变量

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

建议在这些场景使用 `--json`：

- 与脚本集成
- 查看原始响应结构
- 将输出继续传给其他工具

示例：

```bash
bgm --json collection get 348335
```

## 收藏命令语义

这个 CLI 反映了 Bangumi 服务端的一些行为约束：

- 当收藏处于 `wish` 状态时，不允许评分
- `rate 0` 会清除评分
- `collection collect <subject_id> collect` 可以作为设置收藏状态的简写
- 收藏写操作不会盲目信任写请求结果，而是会回读收藏结果确认是否真正持久化成功

在交互式终端中，如果 `--search` 返回多个条目且未传入 `--pick`，CLI 会提示用户进行选择。

## 认证实现备注

- 当前最推荐、最稳定的使用方式仍是 Access Token
- `bgm auth status` 检查的是 Access Token 状态
- `bgm auth session-login` / `bgm auth session-status` 只是 `next.bgm.tv` private session 的辅助能力
- private session 不替代 Access Token，也不消除部分写入操作对 Turnstile 的需求

更详细的实验性路径说明见 [`experimental.zh-CN.md`](./experimental.zh-CN.md)。

## 仓库开发

如果你只是要使用这个工具，前面的用户文档已经足够。下面这部分主要面向仓库维护者和贡献者。

### 本地运行

```bash
node src/cli.js --help
node src/cli.js user me
```

### 常用检查命令

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

- 先读 [`../SKILLS.md`](../SKILLS.md)
- 开发仓库看 [`../skills/bgm-cli-develop/SKILL.md`](../skills/bgm-cli-develop/SKILL.md)
- 如果是让 Agent 操作 CLI，而不是改代码，看 [`../skills/bgm-cli-operate/SKILL.md`](../skills/bgm-cli-operate/SKILL.md)

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
