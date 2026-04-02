# Bangumi 社区相关功能整理

本文基于以下资料整理，方便后续在 `bgm-cli` 中判断 Bangumi “社区”能力的可用范围：

- 文档站：<https://bangumi.github.io/dev-docs/#/>
- 本地文档快照：`bangumi-api/`（当前 HEAD: `32339d1`）
- 重点来源：
  - `bangumi-api/open-api/v0.yaml`
  - `bangumi-api/open-api/api.yml`
  - `bangumi-api/README.md`

## 结论先看

按当前公开开发文档，和“社区”最相关、且可稳定用于开发的能力主要有 4 类：

1. 用户收藏
2. 角色 / 人物收藏
3. 维基编辑历史（revisions）
4. 目录（indices）

另外，旧版 schema 里还能看到“讨论版 topic”和“日志 blog”的嵌入式字段，但当前公开 `v0` 规范里没有对应的独立社区接口路径。也就是说：

- 能公开、明确地调用：收藏、目录、修订历史
- 能在旧模型里看到痕迹，但没有现行独立接口：讨论帖、日志
- 当前公开规范里基本看不到：小组、超展开、时光机、好友 / 关注关系

## 1. 用户资料

社区功能通常会先依赖用户信息：

### 公开接口

| 接口 | 说明 | 认证 |
| --- | --- | --- |
| `GET /v0/users/{username}` | 获取用户资料 | 否 |
| `GET /v0/users/{username}/avatar?type=small|medium|large` | 获取头像，302 跳转 | 否 |
| `GET /v0/me` | 获取当前 token 对应用户 | 是 |

### 可用字段

`User` 模型中比较有社区意义的字段：

- `id`
- `username`
- `nickname`
- `user_group`
- `avatar`
- `sign`

注意：

- 文档明确说实际返回里可能还会有未声明的 `url` 字段，但不建议依赖。
- `path_username` 的说明写得很明确：设置用户名后不能再用 UID 替代。

## 2. 用户收藏

这是当前最完整的一组“社区行为”接口，也是最适合 CLI 集成的一组。

### 2.1 条目收藏

| 接口 | 说明 | 认证 |
| --- | --- | --- |
| `GET /v0/users/{username}/collections` | 获取某用户的条目收藏列表 | 查看私有收藏时需要 token |
| `GET /v0/users/{username}/collections/{subject_id}` | 获取某用户对单个条目的收藏 | 查看私有收藏时需要 token |
| `POST /v0/users/-/collections/{subject_id}` | 新增或修改当前用户的条目收藏 | 是 |
| `PATCH /v0/users/-/collections/{subject_id}` | 修改当前用户的条目收藏 | 是 |

### 支持的查询 / 写入字段

查询常用参数：

- `subject_type`: 条目类型筛选
- `type`: 收藏类型筛选
- `limit`
- `offset`

收藏类型 `SubjectCollectionType`：

- `1`: 想看
- `2`: 看过
- `3`: 在看
- `4`: 搁置
- `5`: 抛弃

`UserSubjectCollection` 里有用的字段：

- `subject_id`
- `subject_type`
- `rate`
- `type`
- `comment`
- `tags`
- `ep_status`
- `vol_status`
- `updated_at`
- `private`
- `subject`

写入时可修改：

- `type`
- `rate`
- `ep_status`
- `vol_status`
- `comment`
- `private`
- `tags`

### 重要限制

- 文档明确说明：直接改条目完成度可能带来意外效果，所以 `ep_status` / `vol_status` 只应当用于书籍类条目。
- `rate` 允许传 `0`，表示删除评分。
- `tags` 不传或传 `null` 会被忽略；传 `[]` 才是清空标签。
- `updated_at` 文档明确标注有 bug，不可靠：
  - 修改评分、评价、章节状态等时，这个时间不一定更新。
  - 后续逻辑不要把它当成真正的“收藏更新时间”。

### 2.2 章节收藏

| 接口 | 说明 | 认证 |
| --- | --- | --- |
| `GET /v0/users/-/collections/{subject_id}/episodes` | 获取当前用户在某条目下的章节收藏 | 是 |
| `PATCH /v0/users/-/collections/{subject_id}/episodes` | 批量更新章节收藏，并重新计算条目完成度 | 是 |
| `GET /v0/users/-/collections/-/episodes/{episode_id}` | 获取单个章节收藏 | 是 |
| `PUT /v0/users/-/collections/-/episodes/{episode_id}` | 更新单个章节收藏 | 是 |

章节收藏类型 `EpisodeCollectionType`：

- `0`: 未收藏
- `1`: 想看
- `2`: 看过
- `3`: 抛弃

补充说明：

- `GET /v0/users/-/collections/{subject_id}/episodes` 支持 `episode_type` 过滤。
- 该接口 `limit` 最大可到 `1000`。
- 单章节收藏返回里的 `updated_at` 是 Unix 时间戳，`0` 表示未知或未记录。

## 3. 角色 / 人物收藏

这部分也属于社区行为，但相对更轻量，主要围绕“收藏 / 查看收藏”。

### 3.1 当前用户收藏角色 / 人物

| 接口 | 说明 | 认证 |
| --- | --- | --- |
| `POST /v0/characters/{character_id}/collect` | 收藏角色 | 是 |
| `DELETE /v0/characters/{character_id}/collect` | 取消收藏角色 | 是 |
| `POST /v0/persons/{person_id}/collect` | 收藏人物 | 是 |
| `DELETE /v0/persons/{person_id}/collect` | 取消收藏人物 | 是 |

### 3.2 查看用户角色 / 人物收藏列表

| 接口 | 说明 | 认证 |
| --- | --- | --- |
| `GET /v0/users/{username}/collections/-/characters` | 获取用户角色收藏列表 | 否 |
| `GET /v0/users/{username}/collections/-/characters/{character_id}` | 获取用户单个角色收藏 | 否 |
| `GET /v0/users/{username}/collections/-/persons` | 获取用户人物收藏列表 | 否 |
| `GET /v0/users/{username}/collections/-/persons/{person_id}` | 获取用户单个人物收藏 | 否 |

返回字段比较简单，核心是：

- `id`
- `name`
- `type`
- `images`
- `created_at`

人物收藏额外有：

- `career`

## 4. 维基编辑历史（Revisions）

这组接口对应 Bangumi 社区里的“维基协作”能力，适合做：

- 变更追踪
- 历史查看
- 审核 / 对比辅助

### 公开接口

| 接口 | 说明 | 认证 |
| --- | --- | --- |
| `GET /v0/revisions/persons?person_id=...` | 获取人物编辑历史列表 | 否 |
| `GET /v0/revisions/persons/{revision_id}` | 获取人物某次修订详情 | 否 |
| `GET /v0/revisions/characters?character_id=...` | 获取角色编辑历史列表 | 否 |
| `GET /v0/revisions/characters/{revision_id}` | 获取角色某次修订详情 | 否 |
| `GET /v0/revisions/subjects?subject_id=...` | 获取条目编辑历史列表 | 否 |
| `GET /v0/revisions/subjects/{revision_id}` | 获取条目某次修订详情 | 否 |
| `GET /v0/revisions/episodes?episode_id=...` | 获取章节编辑历史列表 | 否 |
| `GET /v0/revisions/episodes/{revision_id}` | 获取章节某次修订详情 | 否 |

### 通用返回结构

分页列表 `Paged_Revision`：

- `total`
- `limit`
- `offset`
- `data[]`

基础修订对象 `Revision`：

- `id`
- `type`
- `creator`
  - `username`
  - `nickname`
- `summary`
- `created_at`

### 详情差异

- `PersonRevision.data`: key-value 结构，里面能看到 `prsn_infobox`、`prsn_summary`、`profession`、`prsn_name` 等。
- `CharacterRevision.data`: 也是 key-value 结构，常见字段有 `infobox`、`summary`、`name`、`extra`。
- `SubjectRevision.data`: 结构较固定，能看到 `field_summary`、`field_infobox`、`name`、`name_cn`、`platform`、`type` 等。
- `EpisodeRevision` 返回 `DetailedRevision`，`data` 是“响应类型不固定”的对象，需要按实际内容处理。

### 实际意义

如果后面 CLI 要做社区相关只读查询，这组接口是很值得接入的，因为它们能回答：

- 某条目最近被谁改过
- 某次修订改了什么
- 某个维基对象的历史分页列表

## 5. 目录（Indices）

目录是目前公开规范里最像“社区内容生产”的能力，既能创建，也能增删条目，还支持收藏目录。

### 公开接口

| 接口 | 说明 | 认证 |
| --- | --- | --- |
| `POST /v0/indices` | 创建目录 | 是 |
| `GET /v0/indices/{index_id}` | 获取目录详情 | 可选 |
| `PUT /v0/indices/{index_id}` | 修改目录基础信息 | 是 |
| `GET /v0/indices/{index_id}/subjects` | 获取目录内条目列表 | 可选 |
| `POST /v0/indices/{index_id}/subjects` | 向目录新增条目 | 是 |
| `PUT /v0/indices/{index_id}/subjects/{subject_id}` | 修改目录中某条目的信息；若不存在会创建 | 是 |
| `DELETE /v0/indices/{index_id}/subjects/{subject_id}` | 从目录中删除条目 | 是 |
| `POST /v0/indices/{index_id}/collect` | 收藏目录 | 是 |
| `DELETE /v0/indices/{index_id}/collect` | 取消收藏目录 | 是 |

### 目录对象

`Index` 的关键字段：

- `id`
- `title`
- `desc`
- `total`
- `stat`
  - `comments`
  - `collects`
- `created_at`
- `updated_at`
- `creator`
- `nsfw`

这说明目录在社区层面至少有两类统计量：

- 评论数 `comments`
- 收藏数 `collects`

### 目录内条目对象

`IndexSubject` 里值得关心的字段：

- `id`
- `type`
- `name`
- `images`
- `infobox`
- `date`
- `comment`
- `added_at`

可以把它理解成“目录作者给某个条目附上的备注项”。其中：

- `comment` 是目录内备注，不是楼层回复
- `added_at` 是条目被加入目录的时间

### 写入请求

新增条目到目录 `IndexSubjectAddInfo`：

- `subject_id`
- `sort`
- `comment`

修改目录条目 `IndexSubjectEditInfo`：

- `sort`
- `comment`

所以如果后面要在 CLI 支持目录编排，最实用的就是：

- 创建目录
- 修改目录标题 / 描述
- 批量增删目录条目
- 更新目录内排序和备注
- 收藏 / 取消收藏目录

## 6. 旧版 schema 里还能看到的社区痕迹

`bangumi-api/open-api/api.yml` 不是当前主力的公开接口规范，但里面保留了一些老模型，能帮助判断 Bangumi 社区页面里历史上暴露过什么数据。

### `Legacy_SubjectLarge`

在旧 schema 中，条目详情除了章节 `eps` 之外，还包含：

- `topic`: 讨论版列表，元素类型为 `Legacy_Topic`
- `blog`: 日志列表，元素类型为 `Legacy_Blog`

### `Legacy_Topic`

字段包括：

- `id`
- `url`
- `title`
- `main_id`
- `timestamp`
- `lastpost`
- `replies`
- `user`

### `Legacy_Blog`

字段包括：

- `id`
- `url`
- `title`
- `summary`
- `image`
- `replies`
- `timestamp`
- `dateline`
- `user`

### 这代表什么

可以合理推断，Bangumi 的社区内容里至少曾经有过以下公开数据形态：

- 条目讨论版帖子列表
- 用户日志列表
- 帖子 / 日志的作者、发布时间、回复数

但要注意，这里只是“旧 schema 暴露出的数据模型”，不是当前 `v0` 规范中可直接调用的独立路径。当前公开文档没有给出这些资源的正式 REST 路由，因此不建议在新功能里把它们当成稳定 API 依赖。

## 7. 当前公开文档没有明确开放的社区功能

结合文档站、本地 `v0.yaml` 和旧 schema，可以把“没公开 / 不稳定 / 不建议依赖”的社区能力列出来：

- 小组
- 小组帖子
- 超展开 / Rakuen
- 时光机 / timeline
- 好友 / 关注关系
- 日志的独立 CRUD 接口
- 讨论帖的独立 CRUD 接口

至少在当前公开 `v0` 规范中，这些都没有正式 path 定义。

## 8. 对 `bgm-cli` 的落地建议

如果后面要在 CLI 里逐步接 Bangumi 社区能力，建议优先级如下：

1. 收藏查询与修改
2. 目录查询与写入
3. 修订历史查询
4. 角色 / 人物收藏

原因很直接：

- 这些接口在 `v0.yaml` 里定义完整
- 认证要求清晰
- 返回结构相对稳定
- 既能做只读查询，也能做明确写操作

不建议现在就直接围绕以下能力设计命令：

- 小组 / 帖子
- 日志
- 超展开
- 时光机

因为当前公开文档没有提供足够稳定的官方接口定义。

## 9. 后续实现时要记住的坑

- 私有收藏可见性受 token 影响，匿名查询会缺数据。
- `username` 不是 UID 的别名，设置用户名后就要按用户名传。
- 条目收藏的 `updated_at` 已知不可靠。
- 条目完成度字段 `ep_status` / `vol_status` 不能想当然地用于所有类型。
- 目录里的 `comment` 是目录备注，不是社区回复。
- 旧 schema 中出现的 `topic` / `blog` 只能当参考，不能当现行稳定接口。

## 10. 最适合做 CLI 的社区功能清单

如果以后要给 `bgm-cli` 增加社区相关命令，最容易做且最靠谱的是：

- `bgm collection list`
- `bgm collection get`
- `bgm collection update`
- `bgm episode-collection list`
- `bgm episode-collection update`
- `bgm index create`
- `bgm index get`
- `bgm index subjects`
- `bgm index add-subject`
- `bgm index edit-subject`
- `bgm index remove-subject`
- `bgm index collect`
- `bgm revisions subject`
- `bgm revisions character`
- `bgm revisions person`
- `bgm revisions episode`

这份文档的核心判断可以简化成一句话：

Bangumi 当前公开开发文档里，真正可用的“社区 API”重点不是论坛流，而是“收藏 + 目录 + 维基修订历史”。
