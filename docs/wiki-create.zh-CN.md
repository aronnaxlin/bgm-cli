# 通过 p1 批量创建 Wiki 对象

`bgm wiki create` 接收已经整理好的 JSON，创建作品条目、人物和角色，并提交调用方准备好的图片、章节或音乐曲目。

CLI 只做输入格式校验、接口调用、限速和结果记录。名称、简介、infobox 原样提交；不会抓网页、下载图片、清洗内容、生成 infobox、搜索查重或创建关联。Wiki 助手的 `bnwh-export/1` / `infos[]` 不是本命令的输入，需要调用方在 CLI 之外转换。

首版只做创建，不包含已有对象编辑、历史查询、封面投票或老站关联表单。

## 命令

```bash
# 离线检查，不需要登录，不创建结果文件
bgm --json wiki create --file batch.json --dry-run

# 真正写入；不弹交互确认
bgm --json wiki create --file batch.json --report results.jsonl

# 使用同一个结果文件继续
bgm --json wiki create --file batch.json --report results.jsonl --resume

# 使用已有账户 profile；不会改动保存的凭据
bgm --profile alternate --json wiki create --file batch.json --report results.jsonl
```

`--file -` 从 stdin 读取一个完整 JSON 文档，`--report` 仍须为本地路径。支持 `--file=...` / `--report=...`；布尔参数 `--dry-run`、`--resume` 不接受值，两者不能一起使用。复用现有 Access Token / private session 和代理配置。

正式执行要求结果文件不存在；重用既有文件必须显式传入 `--resume`。新换一个结果文件意味着新批次，会再次发送创建请求。

## 输入格式

完整可校验的三类示例见 [examples/wiki-create.json](examples/wiki-create.json)。示例内容须由调用方替换成真实、已核对的数据。

```json
{
  "version": 1,
  "items": [
    {
      "key": "anime-001",
      "kind": "subject",
      "body": {
        "name": "示例动画",
        "type": 2,
        "platform": 1,
        "infobox": "{{Infobox animanga/TVAnime\n|中文名=示例\n}}",
        "nsfw": false,
        "metaTags": [],
        "summary": ""
      },
      "image": { "file": "./cover.jpg" },
      "episodes": [
        { "ep": 1, "name": "示例章节", "duration": "00:24:00" }
      ]
    }
  ]
}
```

- `version` 必须为 `1`，`items` 为数组。空数组表示无任务。
- 每项必须有非空字符串 `key`、`kind`、`body`。`key` 在批次内唯一，是结果与续跑的身份标识，不是 Bangumi ID。重复 key 会拒绝整个批次。
- `kind` 为 `subject` / `person` / `character`。正文采用对应 p1 请求结构，不是统一的字段映射格式。
- 未支持的字段会明确报错，不静默删除。管理员 `authorID` 不在本命令范围内。

### 作品 subject

`body` 直接是 p1 `SubjectNew`：

| 字段 | 要求 |
| --- | --- |
| `name`、`infobox` | 必填非空字符串；不 trim、不改写 |
| `summary` | 必填字符串，可以为空 |
| `type` | 必填：1 书籍、2 动画、3 音乐、4 游戏、6 三次元 |
| `platform` | 必填整数，由调用方选定对应类型的有效值 |
| `nsfw` | 必填布尔值 |
| `metaTags` | 必填字符串数组，可为空 |
| `series` | 可选布尔值 |
| `date` | 可选 `YYYY-MM-DD` 字符串 |

不自动推导类型、平台、日期或标签。具体平台合法性、Wiki 语法和标签语义仍由 p1 检查。

按 `bangumi/server-private` 当前实现，有两处服务端行为需要调用方自己避开：

- 音乐条目（`type: 3`）没有可选平台，`platform` 取任何值都会被 `400` 拒绝，暂时无法通过 p1 创建。
- 动画和三次元条目的 infobox 写了 `话数` / `集数` 时，服务端会在创建条目的同时插入对应数量（最多 50 个）的空白章节。此时再提供 `episodes` 会得到两套章节，而 p1 没有删除章节的接口。要么不写话数，要么不带 `episodes`。

### 人物 person 与角色 character

人物：

```json
{
  "key": "person-001",
  "kind": "person",
  "body": {
    "person": {
      "name": "示例人物",
      "type": 1,
      "infobox": "{{Infobox Crt\n|生日=1977年3月18日\n}}",
      "summary": "",
      "profession": { "artist": true }
    }
  }
}
```

角色将 `kind` 和 `body` 内的键改为 `character`，不提供 `profession`。

- 两类均要求 `name`、`infobox`、`summary`、`type`。请求体没有中文名字段，中文名写在 infobox 的 `简体中文名`。
- 新建的人物和角色不带任何关联；与条目的关联、角色的声优需要之后在网页上添加。
- 人物类型：1 个人、2 公司、3 组合。角色类型：1 角色、2 机体、3 舰船、4 组织机构。不要把助手导出中的作品类型直接当作角色类型。
- 人物可选 `profession`：`producer`、`mangaka`、`artist`、`seiyu`、`writer`、`illustrator`、`actor`，值为布尔值。
- 两类可在 `body.person.img` / `body.character.img` 提供原始 base64 肖像；也可使用 `image`，二者不能同时提供。

### 图片与章节

`image` 恰好包含一种来源：`{ "file": "./cover.jpg" }` 或 `{ "base64": "..." }`。

- 文件相对输入 JSON 所在目录解析；stdin 的相对路径以当前工作目录为准。带空格的命令行路径需要加引号。
- base64 必须是标准原始编码，包括所需的尾部填充；不接受 data URL、远程 URL 或编码内空白。解码后不得超过 4 MiB。
- 读取文件后仅做 base64 编码，不缩放、打码或转码。图片格式有效性由 p1 检查。
- 作品先创建，再调用封面上传接口；人物／角色将图片字节并入创建请求。

`episodes` 仅用于作品。每条必填数值 `ep`；可选 `name`、`nameCN`、`duration`、`date`、`summary`、数值 `disc`、类型 `type`（0–6）。不接受已有章节的 `id` / `subjectID`。省略的可选字段保留 p1 自身默认行为，CLI 不补值。

保持数组顺序，每次最多提交 40 条。多碟音乐的 `disc` 和 `ep` 由调用方提供，不自动重新编号。空数组不产生章节请求。

## 失败、输出和续跑

文件无法读取、JSON 非法、批次版本错误或重复 key 时，整批不写入。单条格式不正确则记录失败，仍处理其余有效条目。`--dry-run` 只检查本地格式和文件，不保证在线权限或 Wiki 语法有效。

写请求串行执行，同一结果文件记录的请求按五分钟最多 30 次排队，窗口从收到响应的时刻起算并留一秒余量。其他程序使用同一账户仍可能耗尽额度；收到 429 时本批停止，稍后使用 `--resume`。单次请求超时为 60 秒，不自动重试。

| 情况 | 行为 |
| --- | --- |
| p1 明确拒绝单次请求（普通 4xx） | 记录失败，继续其他独立任务 |
| 主体创建失败 | 跳过该对象的封面、章节 |
| 主体成功，封面失败 | 保留主体 ID，仍尝试章节 |
| 部分章节批次失败 | 记录失败批次，继续其他独立批次 |
| 401 / 403 / 429 | 记录失败并停止整批，保留进度，登录、权限或限流问题解决后可续跑 |
| 连接没有建立（连接被拒、域名解析失败、连接超时） | 请求没有发出，记录失败并停止整批，网络恢复后可续跑 |
| 其他网络异常、请求超时、408、5xx、缺少预期创建 ID | 标记 `unknown`，停止整批，禁止自动重发 |

每个对象结果包括 `key`、状态、已确认的 `id`、各步骤结果和 `unfinishedSteps`；章节步骤返回 `episodeIDs`。状态有 `ready`（dry-run）、`succeeded`、`failed`、`partial`、`unknown`、`pending`。成功续跑步骤带 `resumed: true`。进度写 stderr，新建对象的 ID 在写入结果文件之前先输出到 stderr；`--json` 的 stdout 仅包含结果 JSON。

全部完成（或 dry-run 全部有效）退出码为 `0`；存在失败、部分完成、未执行或结果不确定则为 `1`。无法开始的文件、参数和报告错误沿用 CLI 的 stderr 错误输出。

结果文件逐次追加 JSONL，开始请求前和收到结果后均落盘。包含 key、步骤、请求摘要、ID 和错误信息，不保存凭据或图片正文。续跑规则：

1. 成功请求不重发，其内容必须与摘要一致。不能从输入中删除已成功的对象。
2. 确定失败或未发送的内容可以修正；已提交 key 的对象种类不变。未成功的封面可以替换，主体不会因此重建。
3. 章节按数组位置每 40 条一批。已成功批次覆盖的章节不能修改，也不能在它们之前增删章节；被拒绝的批次可以原位修正后续跑。
4. 任一请求有 `started` 却没有结果，或结果为 `unknown`，整个报告阻止续跑；从输入移除该对象也不会绕过。
5. 报告损坏或末行不完整时拒绝续跑。不要删除不确定记录强行重试，应先核对线上结果。

同一结果文件只能有一个写入进程，旁边的 `.lock` 文件正常退出时移除。强制终止后可能遗留锁；确认原进程退出并检查报告后，仅移除 `.lock` 再尝试续跑。未完成的请求记录仍会阻止重复提交。CLI 不自动抢占旧锁，避免并发恢复时互相覆盖。

此机制不提供跨结果文件、跨机器或服务端意义上的去重，也不自动回滚已经创建的对象。不确定请求由调用方核实；首版不提供强制重发或伪造成功状态的选项。

## 开发与验证

接口依据为 `bangumi/server-private` 的 `routes/private/routes/wiki/subject/index.ts`、`subject/image.ts`、`person/index.ts`、`character/index.ts` 和 `lib/types/req.ts`。普通验证使用模拟 HTTP，不向真实站点创建样例。

```bash
node --test test/wiki-batch.test.js test/wiki-command.test.js
node src/cli.js --json wiki create --file docs/examples/wiki-create.json --dry-run
```

真实写入验收单独指定测试数据；离线测试通过不代表验证了线上账户权限、图片服务或 Wiki 语法。
