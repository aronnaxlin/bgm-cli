# bgm-cli 功能列表

这份文档整理当前 CLI 已覆盖的功能范围，以及对应的命令入口。

## 功能范围总览

当前 CLI 主要覆盖这些能力：

- 登录和检查认证状态
- 查看当前账号和公开用户资料
- 按 ID 获取条目、列出条目、搜索条目
- 搜索和查看角色、人物
- 列出、查看和更新收藏
- 列出角色 / 人物 / 目录收藏
- 浏览小组、查看帖子、查看成员
- 创建小组帖子和回复帖子
- 浏览日志、查看日志评论、图片和关联条目
- 浏览时光机、查看回复，以及基础吐槽 / 回复 / 删除 / 反应操作
- 读取热门条目和热门条目讨论
- 读取社区维护的 Bangumi 可用性状态源
- 在普通终端输出和 `--json` 机器输出之间切换

以下能力当前属于实验性范围，请单独阅读 [`experimental.zh-CN.md`](./experimental.zh-CN.md)：

- 通过 Turnstile 执行日志评论写入
- 时光机写入路径
- OAuth 相关辅助流程
- private session 与 hosted backend 路径

## 命令概览

### 全局

| 命令 | 说明 |
| --- | --- |
| `bgm --help` | 显示帮助信息 |
| `bgm --version` | 显示 CLI 版本、配置作用域和认证摘要 |
| `bgm --json <command...>` | 以 JSON 输出任意支持命令的结果 |
| `bgm --init` | 启动交互式初始化向导 |
| `bgm tui` | 打开交互式 TUI |

### Setup

| 命令 | 说明 |
| --- | --- |
| `bgm setup install-path` | 将当前仓库加入 PATH，并启用全局配置模式 |
| `bgm setup update` | 更新一键安装得到的托管副本到最新 `main` |

### 配置

| 命令 | 说明 |
| --- | --- |
| `bgm config show` | 显示当前生效配置 |
| `bgm config set <key> <value>` | 写入一个配置项 |
| `bgm config unset <key>` | 删除一个配置项 |

### 状态

| 命令 | 说明 |
| --- | --- |
| `bgm status [--site <bgm.tv\|bangumi.tv\|chii.in>] [--audience <guest\|auth\|authenticated>]` | 优先查看当前是否异常，以及当前受影响服务 |
| `bgm status current [--site <bgm.tv\|bangumi.tv\|chii.in>] [--audience <guest\|auth\|authenticated>]` | 显式查看当前状态 |
| `bgm status incidents [--site <bgm.tv\|bangumi.tv\|chii.in>] [--audience <guest\|auth\|authenticated>] [--limit n]` | 读取 `bgm-status.ry.mk` 提供的社区维护状态事件订阅 |

### 番组表

| 命令 | 说明 |
| --- | --- |
| `bgm calendar [today]` | 显示今天的番组播出日程（默认） |
| `bgm calendar all` | 显示整周（7 天）番组播出日程 |
| `bgm calendar <weekday>` | 显示指定星期的番组播出日程，支持 `monday/mon`、`tuesday/tue`、`wednesday/wed`、`thursday/thu`、`friday/fri`、`saturday/sat`、`sunday/sun` |

### 认证

| 命令 | 说明 |
| --- | --- |
| `bgm auth login-url [--client-id xxx] [--redirect-uri xxx] [--state xxx]` | 生成 Bangumi OAuth 授权链接 |
| `bgm auth token --code <code> [--save]` | 用授权码换取 Access Token / Refresh Token |
| `bgm auth refresh [--save]` | 刷新已保存的 Access Token |
| `bgm auth turnstile [--manual] [--listen-host <host>] [--port n] [--public-origin <url>] [--timeout-seconds <n>]` | 获取供下一次写入动作使用的短时 Turnstile Token |
| `bgm auth set-token <access_token>` | 直接保存已有 Access Token |
| `bgm auth clear` | 清除已保存的认证状态（Access Token、Refresh Token、Private Session） |
| `bgm auth session-login [--manual]` | 打开官方 private API 登录页并保存辅助 session |
| `bgm auth set-session <chiiNextSessionID|cookie_string>` | 手动保存 private API session |
| `bgm auth session-status` | 检查当前是否已保存 private API session |
| `bgm auth status` | 检查当前 Access Token 状态 |

### 用户

| 命令 | 说明 |
| --- | --- |
| `bgm user me` | 获取当前登录用户资料 |
| `bgm user get <username_or_uid>` | 获取公开用户资料 |
| `bgm user friends [username] [--limit n] [--offset n]` | 获取用户好友列表；省略用户名时默认查询当前用户 |
| `bgm user followers [username] [--limit n] [--offset n]` | 获取用户关注者列表；省略用户名时默认查询当前用户 |

说明：数字 `uid` 路径只对仍在使用原始 uid 作为用户名的账号有效。一旦用户设置了自定义用户名，就需要改用用户名。

### 条目

| 命令 | 说明 |
| --- | --- |
| `bgm subject get <subject_id> [--verbose]` | 按 ID 获取单个条目；加 `--verbose` 显示 infobox、tags、评分分布和图片链接 |
| `bgm subject list --type <book\|anime\|music\|game\|real> [--sort date\|rank] [--year yyyy] [--month mm] [--limit n]` | 按类型和筛选条件浏览条目 |
| `bgm subject search <keyword> [--type ...] [--sort match\|heat\|rank\|score] [--tag xxx] [--limit n]` | 搜索条目 |
| `bgm subject comments <subject_id> [--type <wish\|collect\|doing\|on_hold\|dropped>] [--limit n] [--offset n]` | 获取条目吐槽箱 |
| `bgm subject reviews <subject_id> [--limit n] [--offset n]` | 获取条目评论 |
| `bgm subject topics <subject_id> [--limit n] [--offset n]` | 获取条目讨论列表 |
| `bgm subject topic <topic_id>` | 获取单个条目讨论 |
| `bgm subject characters <subject_id> [--type n] [--limit n] [--offset n]` | 获取条目角色 |
| `bgm subject collects <subject_id> [--type <wish\|collect\|doing\|on_hold\|dropped>] [--limit n] [--offset n]` | 获取条目收藏用户 |
| `bgm subject staff <subject_id> [--position n] [--limit n] [--offset n]` | 获取条目制作人员 |
| `bgm subject staff-positions <subject_id> [--limit n] [--offset n]` | 获取条目制作人员职位 |
| `bgm subject indexes <subject_id> [--limit n] [--offset n]` | 获取条目关联目录 |
| `bgm subject relations <subject_id> [--type <book\|anime\|music\|game\|real>] [--offprint <true\|false>] [--limit n] [--offset n]` | 获取条目关联条目 |
| `bgm subject recs <subject_id> [--limit n] [--offset n]` | 获取条目推荐 |

### 角色

| 命令 | 说明 |
| --- | --- |
| `bgm character search <keyword> [--nsfw <true\|false>] [--limit n] [--offset n]` | 搜索角色 |
| `bgm character get <character_id>` | 获取角色详情 |
| `bgm character casts <character_id> [--type n] [--subject-type <book\|anime\|music\|game\|real>] [--limit n] [--offset n]` | 获取角色出演作品 |
| `bgm character collects <character_id> [--limit n] [--offset n]` | 获取角色收藏用户 |
| `bgm character comments <character_id> [--limit n] [--offset n]` | 获取角色评论 |
| `bgm character indexes <character_id> [--limit n] [--offset n]` | 获取角色关联目录 |
| `bgm character photos <character_id> [--limit n] [--offset n]` | 获取角色图片 |
| `bgm character relations <character_id> [--limit n] [--offset n]` | 获取角色关系 |

### 人物

| 命令 | 说明 |
| --- | --- |
| `bgm person search <keyword> [--career <seiyu,writer,...>] [--limit n] [--offset n]` | 搜索人物 |
| `bgm person get <person_id>` | 获取人物详情 |
| `bgm person casts <person_id> [--type n] [--subject-type <book\|anime\|music\|game\|real>] [--limit n] [--offset n]` | 获取人物出演角色 |
| `bgm person works <person_id> [--limit n] [--offset n]` | 获取人物参与作品 |
| `bgm person collects <person_id> [--limit n] [--offset n]` | 获取人物收藏用户 |
| `bgm person comments <person_id> [--limit n] [--offset n]` | 获取人物评论 |
| `bgm person indexes <person_id> [--limit n] [--offset n]` | 获取人物关联目录 |
| `bgm person photos <person_id> [--limit n] [--offset n]` | 获取人物图片 |
| `bgm person relations <person_id> [--limit n] [--offset n]` | 获取人物关系 |

### 小组

| 命令 | 说明 |
| --- | --- |
| `bgm group list [--mode <all\|joined\|managed>] [--sort <created\|updated\|posts\|topics\|members>] [--limit n] [--offset n]` | 列出小组 |
| `bgm group get <group_name>` | 获取单个小组详情 |
| `bgm group topics <group_name> [--limit n] [--offset n]` | 列出小组帖子 |
| `bgm group topic <topic_id> [--reply-limit n]` | 获取单个小组帖子详情，含正文与评论摘要 |
| `bgm group create-topic <group_name> <title> <content> [--turnstile-token <token>] [--manual]` | 在小组中创建新帖子 |
| `bgm group reply <topic_id> <content> [--reply-to <reply_id>] [--turnstile-token <token>] [--manual]` | 回复小组帖子 |
| `bgm group members <group_name> [--role <visitor\|guest\|member\|creator\|moderator\|blocked>] [--limit n] [--offset n]` | 列出小组成员 |
| `bgm group user [username] [--limit n] [--offset n]` | 列出用户加入的小组；省略用户名时默认查询当前用户 |
| `bgm group recent-topics [--mode <all\|joined\|created\|replied>] [--limit n] [--offset n]` | 列出最新小组帖子 |
| `bgm group latest-replies [--mode <all\|joined\|created\|replied>] [--limit n] [--scan n]` | 列出最新被回复顶起的小组帖子 |
| `bgm group hot [--window <day\|week\|month>] [--mode <all\|joined\|created\|replied>] [--limit n] [--scan n]` | 按近期开帖活跃度计算最火小组 |
| `bgm group hot-topics [--window <day\|week\|month>] [--mode <all\|joined\|created\|replied>] [--limit n] [--scan n]` | 按近期活跃度计算最火小组帖子 |

说明：小组写操作支持直接传 `--turnstile-token`，也支持 CLI 自动发起 Turnstile 获取流程。

### 日志

| 命令 | 说明 |
| --- | --- |
| `bgm blog list [--user <username>] [--limit n] [--offset n]` | 列出某个用户的日志；省略 `--user` 时默认查询当前用户 |
| `bgm blog get <blog_id>` | 获取单篇日志详情 |
| `bgm blog comments <blog_id>` | 列出单篇日志评论 |
| `bgm blog photos <blog_id> [--limit n] [--offset n]` | 列出日志图片 |
| `bgm blog subjects <blog_id>` | 列出日志关联条目 |
| `[实验性] bgm blog reply <blog_id> <content> [--reply-to <comment_id>] [--turnstile-token <token>] [--manual]` | 回复日志或日志评论 |
| `[实验性] bgm blog edit-comment <comment_id> <content>` | 编辑自己的日志评论 |
| `[实验性] bgm blog delete-comment <comment_id>` | 删除自己的日志评论 |

说明：日志正文的创建、编辑和删除目前仍未支持。

### 目录

| 命令 | 说明 |
| --- | --- |
| `bgm index create <title> <desc> [--private <true\|false>]` | 创建目录 |
| `bgm index get <index_id>` | 获取目录详情 |
| `bgm index update <index_id> [--title <title>] [--desc <desc>] [--private <true\|false>]` | 更新目录 |
| `bgm index delete <index_id>` | 删除目录 |
| `bgm index comments <index_id>` | 获取目录的评论 |
| `bgm index comment <index_id> <content> [--reply-to <comment_id>] [--turnstile-token <token>] [--manual]` | 创建目录评论 |
| `bgm index edit-comment <comment_id> <content>` | 编辑目录评论 |
| `bgm index delete-comment <comment_id>` | 删除目录评论 |
| `bgm index related <index_id> [--cat <subject\|character\|person\|ep\|blog\|group_topic\|subject_topic>] [--type <book\|anime\|music\|game\|real>] [--limit n] [--offset n]` | 获取目录关联内容 |
| `bgm index user [username] [--limit n] [--offset n]` | 列出用户创建的目录；省略用户名时默认查询当前用户 |
| `bgm index add-related <index_id> --cat <subject\|character\|person\|ep\|blog\|group_topic\|subject_topic> --sid <sid> [--order <n>] [--comment <text>] [--award <text>]` | 添加目录关联内容 |
| `bgm index update-related <index_id> <related_id> --order <n> --comment <text>` | 更新目录关联内容 |
| `bgm index delete-related <index_id> <related_id>` | 删除目录关联内容 |

### 时光机

| 命令 | 说明 |
| --- | --- |
| `bgm timeline list [--mode <all\|friends>] [--limit n] [--until <timeline_id>]` | 列出时光机动态 |
| `bgm timeline user [username] [--limit n] [--until <timeline_id>]` | 列出某个用户的时光机；省略用户名时默认查询当前用户 |
| `bgm timeline replies <timeline_id>` | 列出单条时光机的回复 |
| `[实验性] bgm timeline say <content> [--turnstile-token <token>] [--manual]` | 发送时光机吐槽 |
| `[实验性] bgm timeline reply <timeline_id> <content> [--reply-to <comment_id>] [--turnstile-token <token>] [--manual]` | 回复时光机 |
| `bgm timeline delete <timeline_id>` | 删除自己的时光机 |
| `bgm timeline like <timeline_id> <value>` | 对时光机发送数值反应 |
| `bgm timeline unlike <timeline_id>` | 取消自己的时光机反应 |

说明：当前未接入文档中的 SSE 事件流接口，普通 CLI 先覆盖非流式读写路径。

### 收藏

| 命令 | 说明 |
| --- | --- |
| `bgm collection list [--user <username>] [--status <wish\|collect\|doing\|on_hold\|dropped>] [--type <book\|anime\|music\|game\|real>] [--sort <updated\|name\|rank\|community_score\|user_score\|date>] [--order <asc\|desc>] [--limit n] [--offset n]` | 列出某个用户的收藏；省略 `--user` 时默认查询当前用户 |
| `bgm collection get <subject_id>` | 按条目 ID 获取当前用户的收藏详情 |
| `bgm collection get --search <keyword> [--pick n]` | 先搜索条目，再获取当前用户的收藏详情 |
| `bgm collection collect <subject_id> [<wish\|collect\|doing\|on_hold\|dropped>]` | 新建或更新收藏 |
| `bgm collection collect --search <keyword> [--status <wish\|collect\|doing\|on_hold\|dropped>] [--pick n]` | 先搜索条目，再新建或更新收藏 |
| `bgm collection comment <subject_id> <comment>` | 更新收藏评论 |
| `bgm collection comment --search <keyword> <comment> [--pick n]` | 先搜索条目，再更新收藏评论 |
| `bgm collection rate <subject_id> <0-10>` | 更新收藏评分，`0` 表示清除评分 |
| `bgm collection rate --search <keyword> <0-10> [--pick n]` | 先搜索条目，再更新收藏评分 |
| `bgm collection status <subject_id> <wish\|collect\|doing\|on_hold\|dropped>` | 更新收藏状态 |
| `bgm collection status --search <keyword> <wish\|collect\|doing\|on_hold\|dropped> [--pick n]` | 先搜索条目，再更新收藏状态 |
| `bgm collection characters [--user <username>] [--limit n] [--offset n]` | 列出角色收藏；省略 `--user` 时默认查询当前用户 |
| `bgm collection persons [--user <username>] [--limit n] [--offset n]` | 列出人物收藏；省略 `--user` 时默认查询当前用户 |
| `bgm collection indexes [--user <username>] [--limit n] [--offset n]` | 列出目录收藏；省略 `--user` 时默认查询当前用户 |

### 热门

| 命令 | 说明 |
| --- | --- |
| `bgm trending subjects --type <book\|anime\|music\|game\|real> [--limit n] [--offset n]` | 获取热门条目 |
| `bgm trending subject-topics [--limit n] [--offset n]` | 获取热门条目讨论 |

### 剧集

| 命令 | 说明 |
| --- | --- |
| `bgm episode list <subject_id> [--type <main\|sp\|op\|ed\|op_ed\|trailer\|pv\|mad\|other>] [--limit n] [--offset n]` | 列出条目的剧集/章节 |
| `bgm episode status <episode_id> <queue\|watched\|drop\|remove>` | 更新单集收藏状态 |
| `bgm episode watch <subject_id> <episode_number>` | 通过集数直接标记本篇剧集为已看 |

说明：

- `episode status` / `episode watch` 的前提是父条目已经在你的收藏里；并不要求条目收藏状态必须是 `doing`。
- 已实测 `wish`、`collect`、`doing`、`on_hold`、`dropped` 这几种条目收藏状态下都可以更新单集进度。
- `episode watch` 只会按主线剧集的 `ep` 字段查找，不会匹配 SP / OP / ED。
- `--type op_ed` 会合并返回 OP 和 ED 两类剧集。

## 功能边界

- 当前没有暴露“取消条目收藏”功能；角色 / 人物 / 目录收藏后续会按 `p1` collection 路径单独补齐增删。
- Bangumi 的 `PATCH /p1/collections/subjects/{subjectID}` 中 `epStatus` / `volStatus` 只适合书籍类条目；动画、三次元、游戏等剧集进度应走独立的 episode collection endpoint。
- `GET /p1/subjects/{subjectID}/episodes` 对 NSFW 条目在未带 token 时可能返回误导性的 `404`，因此 CLI 在本地有 Access Token 时会自动附带认证头。
- NSFW / R18 条目在已登录情况下也可能因为账号权限或资格限制而无法读取；CLI 会在 `episode list` 失败时给出专门提示。
- 如果父条目还没加入收藏，Bangumi 会拒绝写入单集进度；CLI 会明确提示先收藏父条目再重试。
- 不应根据 Bangumi 网站页面倒推出 CLI 一定支持同名功能。
- 涉及 Turnstile、OAuth 或 private session 的能力，请结合 [`experimental.zh-CN.md`](./experimental.zh-CN.md) 一起阅读。
