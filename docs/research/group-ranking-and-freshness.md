# Bangumi 小组热度与最新回复排序设计

本文记录 `bgm-cli` 当前围绕 Bangumi 小组帖子流实现的几个“排序 / 榜单”能力，包括：

- `bgm group hot`
- `bgm group hot-topics`
- `bgm group latest-replies`

目的不是复述 CLI 用法，而是说明：

- 当前依赖的数据源是什么
- 为什么排序算法这样设计
- 现阶段结果能回答什么问题
- 结果还不够准确的地方在哪里
- 后续若要继续提高精度，应该往哪里扩

## 1. 数据源与约束

当前实现主要依赖 Bangumi 私有 API 文档中的小组主题流：

- 文档站：<https://bangumi.github.io/dev-docs/api.yaml>
- 相关路径：
  - `GET /p1/groups/-/topics`
  - `GET /p1/groups/{groupName}/topics`
  - `GET /p1/groups/-/topics/{topicID}`

实际接入时有一个重要事实：

- `/v0/...` 走 `https://api.bgm.tv`
- `/p1/...` 走 `https://next.bgm.tv`

也就是说，小组这套能力虽然定义在同一份 `api.yaml` 里，但不在 `api.bgm.tv` 上。

### 1.1 现阶段稳定可用的帖子字段

从最近小组主题流 `GET /p1/groups/-/topics` 能稳定拿到的关键字段主要是：

- `id`
- `title`
- `creator`
- `group`
- `replyCount`
- `createdAt`
- `updatedAt`

其中最关键的是：

- `replyCount`: 帖子总回复数
- `createdAt`: 创建时间
- `updatedAt`: 最后活动时间

### 1.2 现阶段拿不到的关键数据

如果想算“当天 / 当周 / 当月真正新增了多少回复”，理论上最好有：

- 每条回复的精确创建时间分布
- 窗口内新增回复数
- 去重回复用户数
- 小组成员增长数

当前 CLI 没有批量抓这些数据，也没有为所有候选帖子额外逐条抓回复详情，因此只能做“近似热度”而不是“精确增长热度”。

这不是 bug，而是当前成本和稳定性的取舍。

## 2. 为什么不能直接按总回复数 / 总成员数排序

如果直接按静态总量排序：

- 小组按 `members`
- 帖子按 `replyCount`

得到的只会是历史积累最久的大组、大楼，而不是“最近最火”。

举例：

- 一个十年前的大组，即使今天完全没人说话，也可能仍然成员很多。
- 一个两周前开的高楼，即使今天没有新回复，也可能总回复数远高于今天刚爆的帖子。

因此当前排序都引入了“时间衰减”。

## 3. `latest-replies` 的定义

`bgm group latest-replies` 要解决的问题是：

- 我想看“最近被回复顶起来的话题”
- 不是“刚刚创建的新帖子”

因此当前过滤条件是：

1. `replyCount > 0`
2. `updatedAt > createdAt`

只有同时满足这两个条件，才认为它是“已经被回复顶起”的帖子。

### 3.1 为什么要同时用这两个条件

只看 `replyCount > 0` 不够稳，因为极端情况下：

- 某些接口实现可能在创建楼主内容时就出现统计偏差
- 某些历史兼容数据不一定严格符合“无回复就为 0”

只看 `updatedAt > createdAt` 也不够，因为这不能保证一定是用户回复造成的更新时间。

把两者合起来，语义更接近：

- 这个帖子确实已经有过回复
- 且最后活动时间确实晚于发帖时间

## 4. `hot-topics` 的算法

`bgm group hot-topics` 当前实现的是“近似热度帖子榜”。

### 4.1 时间窗

支持三个窗口：

- `day`
- `week`
- `month`

对应配置：

```text
day   -> 24h,  gravity 1.8
week  -> 7d,   gravity 1.4
month -> 30d,  gravity 1.1
```

窗口越短，时间衰减越强。

### 4.2 候选集获取

算法不是扫全站所有话题，而是从：

- `GET /p1/groups/-/topics`

按时间倒序分页抓取最近的话题流，然后在本地做两步筛选：

1. 只保留 `updatedAt` 还在窗口内的话题
2. 一旦某一页已经出现明显落到窗口外的旧话题，就停止继续翻页

这样能把扫描量控制在合理范围内。

### 4.3 热度公式

当前帖子热度分数：

```text
topic_hot = log1p(replyCount + 1) / (ageHours + 2) ^ gravity
```

其中：

- `replyCount` 是帖子总回复数
- `ageHours` 基于 `updatedAt` 计算
- `gravity` 由窗口控制

### 4.4 这个公式的含义

- 回复数越高，分数越高
- 最后活动越近，分数越高
- 短窗口下更偏向“刚刚正在爆”的帖子
- 长窗口下允许“近一周 / 近一月持续活跃”的帖子留下来

### 4.5 这版算法的局限

这不是“窗口内新增回复数”的精确排序。

例如：

- 一个老帖有 300 总回复，今天新增 1 回复
- 一个新帖有 30 总回复，今天新增 25 回复

当前算法可能仍然会给前者较高分，尤其在长窗口下更明显。

因此它适合叫：

- 近似热度
- 近期活跃热度

但不应该叫：

- 精确当日新增回复热度

## 5. `hot` 的算法

`bgm group hot` 的目标不是直接看小组总成员数，而是回答：

- 最近哪些小组的话题流最活跃

### 5.1 聚合思路

先对窗口内的话题算出 `topic_hot`，再按小组聚合：

- `topicCount`: 窗口内活跃话题数
- `replyCount`: 这些话题的回复数总和
- `hotScore`: 所有窗口内话题热度之和
- `latestActivityAt`: 小组内最近一次话题活动时间

### 5.2 小组分数

当前分数：

```text
group_hot = sum(topic_hot) + exp(- ageHours / groupDecayHours)
```

其中：

- `sum(topic_hot)` 表示这个组在窗口内整体活跃程度
- `exp(- ageHours / groupDecayHours)` 是一个小的最近活动奖励

不同窗口使用不同的 `groupDecayHours`：

```text
day   -> 6
week  -> 24
month -> 72
```

### 5.3 为什么不用 `members` 直接入分

成员数是小组体量，不是近期热度。

如果直接把 `members` 混进主分数：

- 大组会长期压制中小组
- 榜单会更像“最大的小组榜”，而不是“最近最热的小组榜”

因此当前实现只把 `members` 当成展示信息，不直接参与排序。

## 6. 当前实现与源码映射

截至当前版本，相关逻辑主要在以下文件：

- `src/cli.js`
  - `GROUP_HOT_WINDOWS`
  - `executeHotGroupsCommand`
  - `executeHotGroupTopicsCommand`
  - `executeLatestRepliedGroupTopicsCommand`
  - `fetchTopicsForHotWindow`
  - `fetchRecentRepliedTopics`
  - `computeTopicHotScore`
  - `aggregateHotGroups`
  - `isRepliedTopic`

- `src/core/output.js`
  - `formatGroupHot`
  - `formatGroupHotTopics`
  - `formatGroupLatestReplies`

## 7. 为什么有 `scan` 参数

榜单不是数据库内聚合，而是客户端现抓现算。

所以必须控制扫描成本。

`--scan` 表示最多从“最近小组主题流”里抓多少条候选话题，再在本地筛选和排序。

默认值：

```text
day   -> 300
week  -> 1000
month -> 3000
```

### 7.1 `scan` 太小时会怎样

- 榜单更快
- 但可能漏掉本该进入榜单的帖子或小组
- 尤其 `week` / `month` 更明显

### 7.2 `scan` 太大时会怎样

- 更接近完整候选集
- 但接口请求次数增加
- CLI 响应时间变长

因此当前把它设计成显式参数，而不是写死。

## 8. 当前结果最适合的解释方式

当前三个命令最适合这样理解：

- `group latest-replies`
  看最近被回复顶起的话题流

- `group hot-topics`
  看最近一段时间内“最热的活跃话题”

- `group hot`
  看最近一段时间内“整体最活跃的小组”

它们都不是严格意义上的统计报表，更像是：

- 时间衰减排序
- 近期活跃度近似榜

## 9. 结果不够准时，下一步该怎么升级

如果以后要继续提高准确性，建议按这个顺序做：

### 9.1 第一优先级：引入“窗口内新增回复数”

做法：

1. 先从 `recent-topics` 选出候选帖子
2. 对候选帖子调用 `GET /p1/groups/-/topics/{topicID}`
3. 读取 `replies[]`
4. 只统计时间窗内的回复

这样就能把帖子热度公式升级成：

```text
topic_hot = 4 * log1p(windowReplyCount)
          + 2 * log1p(uniqueRepliers)
          + recencyBonus
```

这会比当前版本更符合“当天 / 当周 / 当月最火”的直觉。

### 9.2 第二优先级：做 rising 榜

可以把窗口拆成两个半窗：

- 今天 vs 昨天
- 本周 vs 上周
- 本月前半 vs 后半

再计算增长率：

```text
rising = currentWindowReplies / max(1, previousWindowReplies)
```

这样就能得到“突然起势”的帖子和小组，而不只是“总量大”。

### 9.3 第三优先级：引入小组成员增长

如果将来能拿到：

- 小组加入时间流
- 或成员增长相关统计

就可以做更完整的小组热度：

```text
group_hot = a * windowTopics
          + b * windowReplies
          + c * activeUsers
          + d * memberGain
```

但在当前接口条件下，这项暂时不现实。

## 10. 当前结论

当前实现采用的是一个工程上务实的版本：

- 不额外依赖复杂的回复明细批量抓取
- 先把“最近回复流”、“近似热帖榜”、“近似热组榜”做出来
- 结果足够可用，而且响应速度仍可控

这意味着：

- 它已经足够支持日常浏览和探索
- 但如果以后要把“最火”解释成更严格的统计意义，就需要继续引入窗口内回复明细

换句话说，当前版本更像：

- Trending

而不是：

- Analytics
