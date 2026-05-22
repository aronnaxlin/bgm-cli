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
- 条目收藏接口里的 `ep_status` 只能安全用于书籍类条目；剧集进度应走 `episode status` / `episode watch` 对应的独立 endpoint
- `episode list` 在本地存在 Access Token 时会自动附带 `Authorization`，避免 NSFW 条目出现服务端返回 `404` 的假象
- 单集进度写入要求父条目已经加入收藏；如果条目尚未收藏，Bangumi 会返回“需要先收藏父条目”的错误
- 单集进度写入并不要求父条目收藏状态必须是 `doing`；已实测 `wish`、`collect`、`doing`、`on_hold`、`dropped` 状态下都能更新单集进度
- `episode watch` 只匹配主线剧集的 `ep` 编号；SP / OP / ED 需要通过 `episode status <episode_id> ...` 直接写入
- Bangumi 的剧集状态回读偶尔会出现短暂延迟或网络抖动，因此 CLI 对剧集写入结果采用了比普通收藏更宽松的重试确认策略

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
- API 端点优先使用 `https://next.bgm.tv/p1`
- Bangumi 建议使用包含开发者和应用身份信息的自定义 `User-Agent`

## 测试与发布

### 测试规范

- 使用 Node.js 内置 `node:test` + `node:assert`，不引入外部测试框架
- 测试文件放在 `test/`目录，命名为 `*.test.js`
- 使用 ESM 导入（`import { describe, it } from "node:test"`）
- CLI 集成测试使用 `spawnSync` 调用 `node src/cli.js`
- 格式化单元测试直接从 `src/core/output.js` 导入函数

运行测试：

```bash
npm test
```

当前测试分类：

- `test/smoke.test.js` — 基础冒烟测试：验证 `--version`、`--help`、各命令组 help 是否可正常打开
- `test/public-api.test.js` — 公开 API 端到端测试：对 subject、user、group、blog、index、collection、status 等读接口做端到端检查
- `test/calendar.test.js` — 番组表专项测试：集成测试和格式化单元测试

### 发布流程

发布前检查清单：

1. **版本号一致性**：确保 `package.json` 中的 `version` 与代码内硬编码的版本号（如 `src/cli.js` 或 `src/core/config.js` 中的版本字符串）保持一致。使用 `bgm --version` 验证。
2. **代码检查**：运行 `node --check src/cli.js` 、`node --check src/core/*.js` 确保无语法错误。
3. **测试通过**：运行 `npm test` 确保所有测试通过。
4. **帮助文本**：检查 `bgm --help` 和各 `bgm <group> --help` 输出是否反映了最新功能。

发布步骤（示例）：

```bash
# 1. 检查当前版本
bgm --version

# 2. 更新版本号（同时修改 package.json 和代码中的版本字符串）
# 例如从 0.1.2 到 0.1.3

# 3. 提交并打标签
git add -A
git commit -m "release: v0.1.3"
git tag v0.1.3
git push origin main --tags

# 4. 如果使用 npm 发布（可选）
npm publish
```

版本号策略：遵循 [SemVer](https://semver.org/lang/zh-CN/)：
- 修复 bug 或文档更新 → patch 版本（如 0.1.2 → 0.1.3）
- 新增功能或新命令 → minor 版本（如 0.1.x → 0.2.0）
- 重大不兼容变更 → major 版本（如 0.x → 1.0.0）
