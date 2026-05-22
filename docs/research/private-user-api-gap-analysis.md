# Bangumi Private User API 与当前 CLI 覆盖对比

本文对比 Bangumi private API 中 `p1` 的用户相关能力，与 `bgm-cli` 当前已经实现的功能。

目的：

- 明确 `p1/users/:username/...` 这条线到底已经覆盖了多少
- 避免把“命令名不叫 user”但本质上属于用户能力的功能漏掉
- 判断哪些能力值得作为后续实现候选

参考来源：

- `bangumi/server-private`:
  - `routes/private/routes/user.ts`
  - `routes/private/routes/group.ts`
  - `lib/types/req.ts`
- 当前仓库实现：
  - `src/core/client.js`
  - `src/cli.js`
  - `docs/features.zh-CN.md`

## 结论先看

当前 `p1` 用户相关能力里，`bgm-cli` 已覆盖的主要只有 4 类：

1. 当前用户资料：`bgm user me`
2. 公开用户资料：`bgm user get <username>`
3. 指定用户日志：`bgm blog list --user <username>`
4. 指定用户时光机：`bgm timeline user <username>`

另外还有 1 类已经通过 `p1` 用户路由覆盖：

5. 指定用户条目收藏：`bgm collection list --user <username>`

当前这批用户相关读取能力已经基本接入，后续重点不再是“按用户列资源”，而是关系写操作、通知、以及各类评论 / 点赞 / 回复的互动细节。

## 1. `p1` 用户相关路由清单

按 `server-private/routes/private/routes/user.ts`，当前 `p1` 用户相关路由主要有：

| 路径 | 语义 |
| --- | --- |
| `GET /p1/users/{username}` | 获取用户信息 |
| `GET /p1/users/{username}/friends` | 获取用户好友列表 |
| `GET /p1/users/{username}/followers` | 获取用户关注者列表 |
| `GET /p1/users/{username}/collections/subjects` | 获取用户条目收藏 |
| `GET /p1/users/{username}/collections/characters` | 获取用户角色收藏 |
| `GET /p1/users/{username}/collections/persons` | 获取用户人物收藏 |
| `GET /p1/users/{username}/collections/indexes` | 获取用户目录收藏 |
| `GET /p1/users/{username}/groups` | 获取用户加入的小组 |
| `GET /p1/users/{username}/indexes` | 获取用户创建的目录 |
| `GET /p1/users/{username}/blogs` | 获取用户创建的日志 |
| `GET /p1/users/{username}/timeline` | 获取用户时光机 |

补充说明：

- 小组话题“当前登录用户自己创建 / 回复过”的过滤不在 `user.ts` 下，而在 `GET /p1/groups/-/topics?mode=created|replied`。
- `req.ts` 中 `GroupTopicFilterMode` 的定义明确写的是：
  - `created = 我创建的`
  - `replied = 我回复的`
- 这说明它不是“任意指定用户”的话题过滤器，而是当前认证用户语义。

## 2. 当前 CLI 覆盖情况

### 2.1 已直接覆盖

| `p1` 能力 | 当前命令 | 备注 |
| --- | --- | --- |
| 当前用户资料 | `bgm user me` | 直接对应 `p1/me` |
| 指定用户资料 | `bgm user get <username>` | 直接对应 `p1/users/{username}` |
| 指定用户日志 | `bgm blog list --user <username>` | 直接对应 `p1/users/{username}/blogs` |
| 指定用户时光机 | `bgm timeline user <username>` | 直接对应 `p1/users/{username}/timeline` |

### 2.2 已间接覆盖

| `p1` 能力 | 当前命令 | 覆盖方式 |
| --- | --- | --- |
| 指定用户条目收藏 | `bgm collection list --user <username>` | 直接对应 `p1/users/{username}/collections/subjects` |

### 2.3 完全未覆盖

| `p1` 能力 | 当前状态 |
| --- | --- |
| 好友关系添加 / 删除 | 未实现 |
| 黑名单列表 / 添加 / 删除 | 未实现 |
| 当前用户通知读取 / 清空 | 未实现 |

## 3. 哪些“虽然不在 user 命令组里”，但本质上已经回答了用户问题

这点容易误判。

当前 CLI 里有一些命令虽然名字不叫 `user ...`，但已经能回答典型的“某个用户做过什么”的问题：

| 用户问题 | 当前命令 |
| --- | --- |
| 这个用户收藏了什么条目？ | `bgm collection list --user <username>` |
| 这个用户发过哪些日志？ | `bgm blog list --user <username>` |
| 这个用户发过哪些时光机？ | `bgm timeline user <username>` |
| 我自己创建过哪些小组话题？ | `bgm group recent-topics --mode created` |
| 我自己回复过哪些小组话题？ | `bgm group recent-topics --mode replied` |

但要注意最后两项的限制：

- 它们只回答“当前登录用户”
- 不能回答“任意指定用户发过哪些小组话题”

## 4. 各项缺口的价值判断

### 4.1 高价值候选

#### A. 用户加入的小组

接口：`GET /p1/users/{username}/groups`

价值：

- 能回答“这个人常混哪些组”
- 能和现有 `group get` / `group topics` 串起来形成浏览链路
- 数据量和语义都比较稳定

建议命令形态：

```bash
bgm [--json] group user [username] [--limit n] [--offset n]
```

优先级：高

#### B. 用户创建的目录

接口：`GET /p1/users/{username}/indexes`

价值：

- 目录是 Bangumi 社区里很强的用户产出物
- 当前 CLI 已有完整 index 读写能力，缺的只是“按用户列目录”入口
- 和现有 index 命令天然可拼接

建议命令形态：

```bash
bgm [--json] index user [username] [--limit n] [--offset n]
```

优先级：高

#### C. 用户好友 / 关注者

接口：

- `GET /p1/users/{username}/friends`
- `GET /p1/users/{username}/followers`

价值：

- 是标准的用户画像能力
- 命令语义简单，适合作为 user 命令组补齐

限制：

- 对部分用户来说，实用价值可能不如小组 / 目录 / 日志 / 时光机

建议命令形态：

```bash
bgm [--json] user friends [username] [--limit n] [--offset n]
bgm [--json] user followers [username] [--limit n] [--offset n]
```

优先级：中高

### 4.2 中价值候选

#### D. 用户角色 / 人物 / 目录收藏

接口：

- `GET /p1/users/{username}/collections/characters`
- `GET /p1/users/{username}/collections/persons`
- `GET /p1/users/{username}/collections/indexes`

价值：

- 能补全“用户收藏画像”
- 对重度 Bangumi 用户和脚本用户有用

限制：

- 相比条目收藏，这些需求更偏小众
- CLI 当前也没有对应的 character / person / index collection 子命令体系，做出来会比“单读一个列表”更容易把产品面拉散

建议：

- 如果只做读取，也应挂到 `collection` 命令组，用 `--user` 表示用户筛选条件
- 但优先级低于 `group user` 和 `index user`

可能形态：

```bash
bgm [--json] collection characters --user <username> [--limit n] [--offset n]
bgm [--json] collection persons --user <username> [--limit n] [--offset n]
bgm [--json] collection indexes --user <username> [--limit n] [--offset n]
```

优先级：中

### 4.3 低价值或不建议优先做

#### E. `p1/users/{username}/collections/subjects`

接口：`GET /p1/users/{username}/collections/subjects`

不建议优先再接一层，原因：

- 当前已有 `bgm collection list --user <username>`
- 现有命令已经支持：
  - 类型筛选
  - 收藏状态筛选
  - 排序
  - 本地二次处理
- 对最终用户来说，再加一个 `user subject-collections` 很容易和现有 `collection list --user` 重叠

除非未来有明确需求证明：

- `p1` 返回字段对脚本场景明显更好
- 或 `p1` 在权限 / 性能 / 可见性上有明显优势

否则没必要并行暴露。

优先级：低

## 5. 关于“指定用户发过的小组话题”的实现可能性

这是本轮对比中特别需要单独说明的一点。

### 5.1 现成 API 是否支持

当前没有看到以下任一能力：

- `GET /p1/users/{username}/group-topics`
- `GET /p1/users/{username}/groups/topics`
- `GET /p1/groups/-/topics?creator=<username>`

而现有的：

- `GET /p1/groups/-/topics?mode=created`

在实现里绑定的是 `auth.userID`，也就是“我创建的”，不是“某个指定用户创建的”。

### 5.2 结论

- “我自己发过的小组话题”已经可做：`bgm group recent-topics --mode created`
- “指定用户发过的小组话题”没有精确稳定的现成 API

如果未来真要做，只能走近似方案，例如：

1. 先拉该用户已加入的小组
2. 再逐组拉 topic 列表
3. 本地按 `creator` 过滤

但这种方案天然不完整：

- 只能覆盖当前仍加入的小组
- 历史发帖会漏
- 私密组和权限可见性会漏
- 扫描成本高

所以这类能力更适合作为实验性 best-effort 功能，而不是稳定能力。

## 6. 推荐的后续实现顺序

如果只选 3 个最值得补的能力，我会建议：

1. `group user`
2. `index user`
3. `user friends` / `user followers`

理由：

- 都有明确 `p1` 路由
- 都是标准用户画像能力
- 和现有命令体系衔接自然
- 不会和当前已有命令高度重叠

不建议优先做：

1. `user subject-collections` 的 `p1` 平行入口
2. “指定用户发过的小组话题”的正式稳定命令

## 7. 推荐的 CLI 命令草案

如果后续要落地，比较自然的一组命令是：

```bash
bgm [--json] group user [username] [--limit n] [--offset n]
bgm [--json] index user [username] [--limit n] [--offset n]
bgm [--json] user friends [username] [--limit n] [--offset n]
bgm [--json] user followers [username] [--limit n] [--offset n]
```

第二梯队：

```bash
bgm [--json] collection characters --user <username> [--limit n] [--offset n]
bgm [--json] collection persons --user <username> [--limit n] [--offset n]
bgm [--json] collection indexes --user <username> [--limit n] [--offset n]
```

## 8. 最终判断

从“价值 / 明确性 / 与现有功能重叠度”三个维度综合看：

- `p1 user` 里确实还有一批值得补的能力
- 但最应该补的是“用户的小组 / 目录 / 社交关系”
- 不是再重复做一套 subject collections
- 也不是硬做“指定用户发过的小组话题”这种没有现成精确 API 的能力
