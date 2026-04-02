# bgm-cli

[简体中文](./README.md) | [繁體中文（台灣）](./README.zh-TW.md) | [English](./README.en.md)

先給 agent 看的重點：

- 頂層 [`SKILLS.md`](./SKILLS.md) 現在是 agent skill 索引，不再是本倉庫的自動觸發開發 skill 入口
- 如果你想讓 agent 把 `bgm-cli` 當成 Bangumi 操作工具使用，先讓它讀 [`SKILLS.md`](./SKILLS.md)
- 如果你想讓 agent 開發這個倉庫本身，直接讀 `README.md` 與 `docs/ai/bgm-cli-non-tui/` 下的文件，不要把 operator skill 當成開發 skill
- 這個專案的核心敘事不是「又一個 Bangumi CLI」，而是「把使用者或 agent 的 Bangumi 操作整理成一般 CLI 可執行的工具鏈」

`bgm-cli` 是這套能力的人類入口，也是 agent 的 Bangumi 操作台。它重點支援：

- Bangumi 認證與登入
- 查看目前帳號與公開使用者資料
- 搜尋與讀取條目資料
- 列出收藏
- 在終端機中更新收藏狀態、評論與評分

本專案基於純 Node.js CLI 建構，預設輸出適合人類閱讀的終端文字，同時支援透過 `--json` 輸出機器友善的 JSON；相關文件也刻意把「操作 CLI」與「開發倉庫」兩種 agent 任務拆開，避免混用。

## 你可以用它做什麼

- 透過 `bgm --init` 進行首次互動式初始化
- 直接使用 Access Token
- 產生 Bangumi OAuth 授權連結並交換 Token
- 取得目前使用者與公開使用者資訊
- 取得、列出與搜尋條目
- 列出、查詢、收藏、評論、評分與修改收藏狀態
- 人類可讀輸出，以及機器友善的 `--json`
- 可選的託管 OAuth backend 腳手架，用於自託管實驗

## 推薦用法

- 已有 Bangumi Token 時，優先直接使用 Access Token 登入
- 要做腳本整合或穩定呼叫時，優先使用一般 CLI 指令
- 需要互動式終端工作流時，使用 `bgm tui`
- 只有在需要自託管 OAuth 輔助能力時，再使用倉庫中的 `oauth-backend`

## 執行需求

- Node.js `>= 20`

## 安裝

### 遠端一行安裝

macOS / Linux：

```bash
curl -fsSL https://raw.githubusercontent.com/aronnaxlin/bgm-cli/main/scripts/install-remote.sh | sh
```

Windows PowerShell：

```powershell
irm https://raw.githubusercontent.com/aronnaxlin/bgm-cli/main/scripts/install-remote.ps1 | iex
```

這兩個命令不需要先 `git clone`。它們會下載 `main` 分支原始碼到本機使用者目錄，然後自動執行全域安裝流程。

### 直接從倉庫執行

```bash
git clone <your-fork-or-repo-url>
cd bgm-cli
./bgm --help
```

### 一鍵安裝

macOS / Linux:

```bash
./install.sh
```

Windows PowerShell:

```powershell
./install.ps1
```

這兩個腳本會呼叫倉庫內既有的全域安裝流程，將目前倉庫加入 PATH，並啟用全域設定模式。

### 將目前倉庫暴露為全域可執行的 `bgm`

```bash
bgm setup install-path
bgm --help
```

倉庫入口檔：

- [`bgm`](./bgm)，用於 POSIX Shell
- [`bgm.cmd`](./bgm.cmd)，用於 Windows Shell
- [`install.sh`](./install.sh)，用於一鍵安裝（macOS / Linux）
- [`install.ps1`](./install.ps1)，用於一鍵安裝（Windows PowerShell）

安裝腳本：

- [`scripts/install-global-bgm.sh`](./scripts/install-global-bgm.sh)
- [`scripts/install-global-bgm.ps1`](./scripts/install-global-bgm.ps1)
- [`scripts/install-remote.sh`](./scripts/install-remote.sh)
- [`scripts/install-remote.ps1`](./scripts/install-remote.ps1)

## 快速開始

### 1. 初始化 CLI

```bash
./bgm --init
```

對多數使用者來說，建議路徑是直接貼上既有的 Bangumi Access Token。

### 2. 驗證目前帳號

```bash
./bgm user me
```

### 3. 搜尋條目

```bash
./bgm subject search "Heike Monogatari" --type anime --limit 5
```

### 4. 讀取或更新收藏

```bash
./bgm collection get 348335
./bgm collection collect 348335 collect
./bgm collection comment 348335 "Backfill"
./bgm collection rate 348335 8
```

## 命令總覽

### 命令表

| 分類 | 命令 | 說明 |
| --- | --- | --- |
| 全域 | `bgm --help` | 顯示說明資訊 |
| 全域 | `bgm --json <command...>` | 以 JSON 輸出任一支援命令的結果 |
| 全域 | `bgm --init` | 啟動互動式初始化精靈 |
| 全域 | `bgm tui` | 開啟互動式 TUI |
| Setup | `bgm setup install-path` | 將目前倉庫加入 PATH，並啟用全域設定模式 |
| 設定 | `bgm config show` | 顯示目前生效的設定 |
| 設定 | `bgm config set <key> <value>` | 寫入一個設定項 |
| 設定 | `bgm config unset <key>` | 刪除一個設定項 |
| 認證 | `bgm auth login-url [--client-id xxx] [--redirect-uri xxx] [--state xxx]` | 產生 Bangumi OAuth 授權連結 |
| 認證 | `bgm auth token --code <code> [--save]` | 用授權碼交換 Access Token / Refresh Token |
| 認證 | `bgm auth refresh [--save]` | 刷新已儲存的 Access Token |
| 認證 | `bgm auth set-token <access_token>` | 直接儲存既有 Access Token |
| 認證 | `bgm auth status` | 檢查目前 Token 狀態 |
| 使用者 | `bgm user me` | 取得目前登入使用者資料 |
| 使用者 | `bgm user get <username_or_uid>` | 取得公開使用者資料 |
| 條目 | `bgm subject get <subject_id>` | 依 ID 取得單一條目 |
| 條目 | `bgm subject list --type <book\|anime\|music\|game\|real> [--sort date\|rank] [--year yyyy] [--month mm] [--limit n]` | 依類型與篩選條件瀏覽條目 |
| 條目 | `bgm subject search <keyword> [--type ...] [--sort match\|heat\|rank\|score] [--tag xxx] [--limit n]` | 搜尋條目 |
| 小組 | `bgm group list [--mode <all\|joined\|managed>] [--sort <created\|updated\|posts\|topics\|members>] [--limit n] [--offset n]` | 列出小組 |
| 小組 | `bgm group get <group_name>` | 取得單一小組詳情 |
| 小組 | `bgm group topics <group_name> [--limit n] [--offset n]` | 列出小組主題 |
| 小組 | `bgm group topic <topic_id>` | 取得單一小組主題詳情 |
| 小組 | `bgm group members <group_name> [--role <visitor\|guest\|member\|creator\|moderator\|blocked>] [--limit n] [--offset n]` | 列出小組成員 |
| 小組 | `bgm group recent-topics [--mode <all\|joined\|created\|replied>] [--limit n] [--offset n]` | 列出最新小組主題 |
| 小組 | `bgm group latest-replies [--mode <all\|joined\|created\|replied>] [--limit n] [--scan n]` | 列出最新被回覆頂起的小組主題 |
| 小組 | `bgm group hot [--window <day\|week\|month>] [--mode <all\|joined\|created\|replied>] [--limit n] [--scan n]` | 依近期活躍度計算最火小組 |
| 小組 | `bgm group hot-topics [--window <day\|week\|month>] [--mode <all\|joined\|created\|replied>] [--limit n] [--scan n]` | 依近期活躍度計算最火小組主題 |
| 收藏 | `bgm collection list [--user <username>] [--status <wish\|collect\|doing\|on_hold\|dropped>] [--type <book\|anime\|music\|game\|real>] [--sort <updated\|name\|rank\|community_score\|user_score\|date>] [--order <asc\|desc>] [--limit n]` | 列出某位使用者的收藏 |
| 收藏 | `bgm collection get <subject_id>` | 依條目 ID 取得目前使用者的收藏詳情 |
| 收藏 | `bgm collection get --search <keyword> [--pick n]` | 先搜尋條目，再取得目前使用者的收藏詳情 |
| 收藏 | `bgm collection collect <subject_id> [<wish\|collect\|doing\|on_hold\|dropped>]` | 建立或更新收藏，支援用位置參數直接傳狀態 |
| 收藏 | `bgm collection collect --search <keyword> [--status <wish\|collect\|doing\|on_hold\|dropped>] [--pick n]` | 先搜尋條目，再建立或更新收藏 |
| 收藏 | `bgm collection comment <subject_id> <comment>` | 更新收藏評論 |
| 收藏 | `bgm collection comment --search <keyword> <comment> [--pick n]` | 先搜尋條目，再更新收藏評論 |
| 收藏 | `bgm collection rate <subject_id> <0-10>` | 更新收藏評分，`0` 代表清除評分 |
| 收藏 | `bgm collection rate --search <keyword> <0-10> [--pick n]` | 先搜尋條目，再更新收藏評分 |
| 收藏 | `bgm collection status <subject_id> <wish\|collect\|doing\|on_hold\|dropped>` | 更新收藏狀態 |
| 收藏 | `bgm collection status --search <keyword> <wish\|collect\|doing\|on_hold\|dropped> [--pick n]` | 先搜尋條目，再更新收藏狀態 |

### 全域

```bash
bgm --help
bgm --json <command...>
bgm --init
bgm tui
```

### 設定

```bash
bgm config show
bgm config set userAgent yourname/bgm-cli/0.1.0
bgm config unset userAgent
```

### 認證

```bash
bgm auth login-url --state random-state
bgm auth token --code YOUR_CODE --save
bgm auth refresh --save
bgm auth set-token YOUR_ACCESS_TOKEN
bgm auth status
```

### 使用者

```bash
bgm user me
bgm user get sai
bgm user get 123456
```

說明：數字 `uid` 路徑只對仍在使用原始 uid 作為使用者名稱的帳號有效。一旦使用者設定了自訂使用者名稱，就需要改用 `/v0/users/{username}` 內的使用者名稱。

### 條目

```bash
bgm subject get 12
bgm subject list --type anime --sort rank --limit 10
bgm subject search "Ghost in the Shell"
bgm subject search "Gundam" --type anime --sort rank --limit 5 --tag mecha --tag sci-fi
```

### 小組

```bash
bgm group list --sort members --limit 10
bgm group get boring
bgm group topics boring --limit 20
bgm group topic 498114
bgm group members boring --role member --limit 20
bgm group recent-topics --mode all --limit 10
bgm group latest-replies --limit 10
bgm group hot --window day --limit 10
bgm group hot-topics --window week --limit 10
```

### 收藏

列出收藏：

```bash
bgm collection list --status doing --type anime --sort updated
```

依條目 ID 操作：

```bash
bgm collection get 348335
bgm collection collect 348335 collect
bgm collection comment 348335 "Backfill"
bgm collection rate 348335 7
bgm collection status 348335 doing
```

先搜尋，再選擇目標：

```bash
bgm collection get --search "Heike Monogatari" --pick 1
bgm collection status --search "Gundam" doing --pick 1
```

在互動式終端中，如果 `--search` 回傳多個條目且未傳入 `--pick`，CLI 會提示你進行選擇。

### JSON 輸出

```bash
bgm --json user me
bgm --json subject get 348335
```

## 收藏命令語義

這個 CLI 反映了 Bangumi 伺服器端的一些行為限制：

- 當收藏處於 `wish` 狀態時，不允許評分
- `rate 0` 會清除評分
- `collection collect <subject_id> collect` 可以作為設定收藏狀態的簡寫，不需要額外再傳 `--status`
- 收藏寫入操作不會盲目信任寫請求結果，而是會回讀收藏結果確認是否真的持久化成功

目前沒有暴露「取消收藏」功能，因為 Bangumi 公開 v0 subject collection 文件目前還沒有確認此操作的刪除路徑。

## 認證

### 推薦方式：Access Token

最可靠的使用方式是：

1. 在瀏覽器中登入 Bangumi
2. 開啟 `https://next.bgm.tv/demo/access-token`
3. 複製 Token
4. 執行 `bgm --init`，並選擇 Access Token 流程

也可以直接儲存 Token：

```bash
bgm auth set-token YOUR_ACCESS_TOKEN
```

### 瀏覽器 OAuth

CLI 也支援 Bangumi OAuth 相關輔助命令：

- 產生授權 URL
- 交換授權碼
- 刷新 Token

如果已設定本地回呼位址，CLI 可以自動監聽回呼；否則也支援手動貼上回呼 URL 或授權碼。

### 託管 OAuth backend

這個倉庫包含一個可選的託管 OAuth backend 腳手架，位於 [`oauth-backend/`](./oauth-backend)。

這個 backend 主要用於：

- 自託管實驗
- 除錯 OAuth 流程
- 後續更可攜的瀏覽器授權方案探索

它並不是一般使用者最推薦的認證方式。

部署細節請參考 [`oauth-backend/README.md`](./oauth-backend/README.md)。

## 設定

本專案現在使用更簡化的設定模型：兩個執行期設定位置，加上一個開發覆蓋檔。

### 執行期設定位置

當執行過全域安裝腳本後，`bgm-cli` 會將目前安裝視為全域安裝，並將執行期設定儲存在使用者設定目錄：

```text
~/.config/bgm-cli/config.json
```

在 Windows 上，對應路徑位於 `%APPDATA%\bgm-cli\config.json`。

如果尚未執行全域安裝腳本，CLI 會使用專案本地的執行期設定檔：

```text
./.bgm-cli/config.json
```

全域安裝流程也會在目前倉庫下寫入一個本地標記檔 `./.bgm-cli/.global-install-enabled`，讓 CLI 可以穩定判斷這個 checkout 目前應運行於專案本地模式或全域模式。

### 開發覆蓋

開發專用覆蓋檔位於：

```text
./bgm-dev.env
```

它適用於：

- 本地 OAuth 應用程式憑證
- 回呼 URI 覆蓋
- 臨時 backend 覆蓋
- 開發時自訂 User-Agent 或應用程式中繼資料

可從以下範本開始：

- [`bgm-dev.env.example`](./bgm-dev.env.example)

### 設定來源

執行期的實際設定依照以下順序合併：

1. 專案內建預設值
2. `bgm-dev.env`
3. 目前生效的執行期 `config.json`
4. 環境變數

實際含義如下：

- 內建預設值主要提供應用程式中繼資料與預設託管 OAuth backend URL
- `bgm-dev.env` 用於開發期覆蓋
- 目前生效的 `config.json` 用於保存 `bgm --init` 或 `bgm auth set-token` 等 CLI 命令寫入的值
- 環境變數仍保有最高優先權

### 重要檔案

- `./.bgm-cli/config.json`
  未啟用全域安裝模式時使用的專案本地執行期設定。

- `~/.config/bgm-cli/config.json`
  啟用全域安裝模式後使用的使用者層級執行期設定。

- [`bgm-dev.env.example`](./bgm-dev.env.example)
  本地開發覆蓋範本。

- `./bgm-dev.env`
  未追蹤的開發專用覆蓋檔。

- [`oauth-backend/.env.example`](./oauth-backend/.env.example)
  可選託管 OAuth backend 的環境變數範本。

### 支援的環境變數

- `BGM_ACCESS_TOKEN`
- `BGM_REFRESH_TOKEN`
- `BGM_CLIENT_ID`
- `BGM_CLIENT_SECRET`
- `BGM_REDIRECT_URI`
- `BGM_OAUTH_SERVER_BASE_URL`
- `BGM_USER_AGENT`

## 輸出模型

預設情況下，命令會輸出適合終端閱讀的人類可讀文字。

建議在以下情境使用 `--json`：

- 與腳本整合
- 查看原始回應結構
- 將輸出繼續傳給其他工具

範例：

```bash
bgm --json collection get 348335
```

## 開發

### 本地執行

```bash
node src/cli.js --help
node src/cli.js user me
```

### 常用命令

```bash
node src/cli.js --help
node src/cli.js collection get 348335
node --check src/cli.js
node --check src/core/output.js
```

### 專案結構

```text
src/
  cli.js           主 CLI 入口與命令路由
  core/
    client.js      Bangumi API 與 OAuth 客戶端輔助邏輯
    config.js      設定載入與持久化
    http.js        HTTP 封裝與錯誤正規化
    output.js      人類可讀與 JSON 輸出格式化
oauth-backend/
  ...              可選的託管 OAuth backend 腳手架
bangumi-api/
  ...              開發時使用的本地 Bangumi API 參考資料
```

## 備註

- OAuth 端點使用 `https://bgm.tv`
- API 端點使用 `https://api.bgm.tv/v0`
- Bangumi 建議使用可識別開發者與應用程式身分的自訂 `User-Agent`

## 授權

本倉庫使用 `AGPL-3.0-only` 授權。詳見 [LICENSE](./LICENSE)。

## 附加文件

- [`docs/README.md`](./docs/README.md)
- [`SKILLS.md`](./SKILLS.md)
- [`docs/ai/bgm-cli-non-tui/README.md`](./docs/ai/bgm-cli-non-tui/README.md)
- [`docs/ai/bgm-cli-non-tui/references/source-map.md`](./docs/ai/bgm-cli-non-tui/references/source-map.md)
- [`docs/ai/bgm-cli-non-tui/references/config-and-auth.md`](./docs/ai/bgm-cli-non-tui/references/config-and-auth.md)
- [`docs/ai/bgm-cli-non-tui/references/collection-semantics.md`](./docs/ai/bgm-cli-non-tui/references/collection-semantics.md)
