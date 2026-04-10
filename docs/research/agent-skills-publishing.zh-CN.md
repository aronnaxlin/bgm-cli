# `npx skills` / Agent Skills 发布调研

这份笔记记录当前可行的 `bgm-cli` Skill 发布路径，以及本仓库采用的落地方案。

## 结论

当前最实用的公开发布渠道，不是额外发一个 npm 包来承载 Skill 内容，而是：

1. 按 Agent Skills 规范提供 `SKILL.md`
2. 把 Skill 放进公开 Git 仓库中的标准发现路径
3. 让用户通过 `npx skills add <owner/repo>` 直接安装

也就是说，Skill 的分发载体是 Git 仓库，`npx skills` 是安装器和生态入口。

## 这套生态是什么

- `vercel-labs/skills` 提供 `npx skills` CLI，用于安装、列出、更新、删除 Skills
- `agentskills.io` 是通用 Skill 规范站点
- `skills.sh` 是公开目录 / 发现入口

这三者组合起来，已经足够构成一条可用的发布链路。

## 已确认的关键能力

基于 `npm view skills readme` 和站点文档，可以确认：

- 用户可以直接运行 `npx skills add owner/repo`
- 也可以直接指定 Skill 目录 URL
- 不要求额外把 Skill 内容再打成独立 npm 包
- 仓库里只要有合法 `SKILL.md`，并位于可发现目录，就能被 `npx skills` 识别

`npx skills` 当前支持的仓库内发现路径包括：

- 根目录（若直接包含 `SKILL.md`）
- `skills/`
- `.agents/skills/`
- 以及多个 agent 专属 skill 目录

对 `bgm-cli` 来说，最合适的公开发布面是顶层 `skills/`。

## 为什么不是继续只放在 `docs/skills/`

仓库原本把 Skill 放在 `docs/skills/`，主要是为了：

- 明确它们是仓库文档的一部分
- 避免开发时把 end-user operator skill 误当成 repo development skill 自动加载

但 `npx skills` 默认不会优先把 `docs/skills/` 当作标准发布入口。

如果我们想要一个真正可安装、可分发、可被公开生态识别的 Skill，就需要新增一个标准发布面。

## 本仓库采用的方案

我们把职责拆成两层：

1. `docs/skills/`
   仓库内的 Skill 索引和说明文档，不再承载重复的可安装 `SKILL.md` payload
2. `skills/`
   面向外部生态发布的可安装 Skill 包

这样做的好处：

- 保留现有文档结构和索引逻辑
- 不破坏仓库内开发时的理解路径
- 同时获得 `npx skills add` 的直接发布能力

## 最小发布要求

要发布一个可安装 Skill，至少需要：

1. 公开 Git 仓库
2. `skills/<skill-name>/SKILL.md`
3. `SKILL.md` frontmatter 中包含：
   - `name`
   - `description`
4. 可选参考资料和附属文档与 Skill 同目录存放

## 推荐安装命令

列出本仓库可安装的 Skills：

```bash
npx skills add aronnaxlin/bgm-cli --list
```

给 OpenCode 全局安装操作 Skill：

```bash
npx skills add aronnaxlin/bgm-cli --skill bgm-cli-operate -g -a opencode -y
```

给 Codex 全局安装开发 Skill：

```bash
npx skills add aronnaxlin/bgm-cli --skill bgm-cli-develop -g -a codex -y
```

从当前本地仓库直接测试安装两个 Skill：

```bash
npx skills add . --skill bgm-cli-operate --skill bgm-cli-develop -a opencode -y
```

## 当前最终结构

目前仓库把原先职责重叠的多个 Skill 收敛为两个公开 Skill：

1. `bgm-cli-operate`
   负责安装、认证、CLI 操作、故障排查
2. `bgm-cli-develop`
   负责仓库开发、入口定位、约定与验证

这样做的原因：

- 用户操作与仓库开发是两类完全不同的任务
- 每类任务只保留一个权威入口，减少重复和冲突
- 更符合 `npx skills` 生态下的公开仓库组织方式

## 发布动作本身是什么

在这套生态里，最关键的“发布”动作就是把标准结构推送到公开 Git 仓库。

对本仓库来说，这意味着：

1. Skill 位于 `skills/<name>/SKILL.md`
2. GitHub 仓库公开可访问
3. 改动推送到远端后，用户就可以直接运行 `npx skills add aronnaxlin/bgm-cli`

也就是说，这里没有额外必须先过的 npm 打包步骤；推送到公开仓库本身就是主要发布动作。

## 发布后的用户路径

用户只要安装了这个 Skill，对 Agent 下达目标即可，例如：

- 帮我把 `bgm-cli` 安装好并验证能跑
- 帮我配置 Bangumi Access Token
- 帮我搜索某个条目并加入收藏
- 帮我列出某个小组最近的帖子

Skill 会告诉 Agent：

- 先检查 `bgm` / `./bgm` 是否存在
- 如果没有，就自行执行安装
- 安装后验证 `bgm --help`
- 优先走 Access Token 登录
- 读操作优先 `--json`
- 写操作要缩小范围并在必要时回读验证

这正是“即使用户只有 Skill，AI 也能把 CLI 跑起来”的关键。

## 对 `skills.sh` 的判断

`skills.sh` 明确是公开 Skills 目录和发现入口。

目前可以确定的是：

- 它与 `npx skills` 同属同一开放生态
- 它适合作为公开发现面和可信展示面

但从当前公开文档中，我没有拿到一个比“公开可安装 repo”更强的硬性发布前置条件。

因此更稳妥的工程结论是：

- 先把 repo 内 Skill 做成标准可安装结构
- 先保证 `npx skills add` 可直接消费
- 再把 `skills.sh` 视为附加发现渠道，而不是阻塞发布的前置步骤

## 后续维护建议

以后每次更新公开 Skill，至少同步这几处：

- `skills/`
- `skills/README.md`
- `docs/skills/README.md`
- `SKILLS.md`

每次发布前，至少做一次本地检查：

```bash
npx skills add . --list
```

如果要验证某个 Skill 的可安装性，再执行一次针对本地仓库的安装测试。
