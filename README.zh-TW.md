# bgm-cli

[简体中文](./README.md) | [繁體中文（台灣）](./README.zh-TW.md) | [English](./README.en.md)

`bgm-cli` 是一個面向 Bangumi 的命令列工具。

## 先給使用者的結論

- 如果你只是想把 Bangumi CLI 用起來，直接看下面的「安裝」和「快速開始」
- 如果你想讓 AI / Agent 直接幫你安裝並操作它，先讀 [`SKILLS.md`](./SKILLS.md)
- 面向一般使用者的公開 Skill 是 [`skills/bgm-cli-operate/SKILL.md`](./skills/bgm-cli-operate/SKILL.md)
- 倉庫開發專用 Skill 是 [`skills/bgm-cli-develop/SKILL.md`](./skills/bgm-cli-develop/SKILL.md)，一般使用者可以忽略

你可以在終端機中用它完成常見的 Bangumi 操作，包括：

- 登入與檢查認證狀態
- 查看目前帳號與公開使用者資料
- 依 ID 取得條目、列出條目、搜尋條目
- 列出、查看與更新收藏
- 瀏覽小組、主題與成員
- 建立小組主題與回覆主題
- [新增] 瀏覽日誌、查看日誌評論、圖片與關聯條目
- [新增] 瀏覽時光機、查看回覆，以及基礎吐槽 / 回覆 / 刪除 / 反應操作
- [實驗性] 透過 Turnstile 執行日誌評論寫入
- 在一般終端輸出與機器可讀的 `--json` 之間切換

本專案基於純 Node.js CLI 建構，預設輸出適合人類閱讀的終端文字，也支援透過 `--json` 輸出機器友善的 JSON。

## 推薦路線

- 一般使用者建議優先使用 Access Token
- 做自動化或腳本整合時，優先使用一般 CLI 指令加 `--json`
- 只有在需要互動式終端工作流時，再使用 `bgm tui`
- `next.bgm.tv` private session 只是輔助能力，不取代 Access Token
- Turnstile 只是小組寫入與實驗性日誌評論寫入等敏感動作的單次驗證，不是登入方式
- OAuth 相關流程目前仍是實驗性能力，不應視為預設使用路徑
- 倉庫中的 `oauth-backend` 僅用於自託管實驗與 OAuth 除錯

## 你可以用它做什麼

- 透過 `bgm --init` 進行首次互動式初始化
- 直接使用 Access Token
- 產生 Bangumi OAuth 授權連結、交換授權碼與刷新 Token
- 取得目前使用者與公開使用者資訊
- 取得、列出與搜尋條目
- 列出小組、查看小組詳情、主題與成員
- 建立小組主題、回覆主題，並支援 Turnstile 輔助流程
- [新增] 日誌列表、詳情、評論、圖片與關聯條目讀取
- [新增] 時光機列表、使用者時間線、回覆讀取與基礎寫入操作
- [實驗性] 日誌評論寫入、編輯與刪除
- 列出、查詢、收藏、評論、評分與修改收藏狀態
- 人類可讀輸出，以及機器友善的 `--json`
- 可選的託管 OAuth backend 腳手架，用於自託管實驗

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

這個命令不需要先 `git clone`。它會下載 `main` 分支原始碼到本機使用者目錄，然後自動執行全域安裝流程。安裝腳本本身是 `sh` 腳本，因此 `| sh` 也適用於使用 zsh 的環境。

如果本機已經存在透過一行安裝取得的託管副本，再次執行同一條安裝命令會自動視為更新。它會覆蓋為最新版本，並盡量保留既有本地設定。

### 從目前倉庫直接執行

```bash
git clone https://github.com/aronnaxlin/bgm-cli.git
cd bgm-cli
./bgm --help
```

這條路徑主要適合：

- 你本來就已經 clone 了倉庫
- 你想先試跑，再決定是否安裝到 PATH
- 你在排查安裝或環境問題

### 從倉庫一鍵安裝

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

### 一鍵更新託管安裝版本

```bash
bgm setup update
```

這個命令適用於透過遠端一行安裝得到的託管副本。它會下載並重新安裝最新的 `main` 分支，同時保留既有設定。

如果你目前是從本地 `git clone` 倉庫執行，這個命令會拒絕執行，請改用你平常的 git 工作流更新。

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

### 1. 安裝後先查看說明

```bash
bgm --help
```

### 2. 建議先完成認證

```bash
bgm --init
```

對多數使用者來說，建議路徑是直接貼上既有的 Bangumi Access Token。

如果你已經有 Token，也可以直接儲存：

```bash
bgm auth set-token YOUR_ACCESS_TOKEN
bgm auth status
```

### 3. 驗證目前帳號

```bash
bgm user me
```

### 4. 搜尋與讀取條目

```bash
bgm subject search "Heike Monogatari" --type anime --limit 5
bgm subject get 348335
```

### 5. 讀取或更新收藏

```bash
bgm collection get 348335
bgm collection collect 348335 collect
bgm collection comment 348335 "Backfill"
bgm collection rate 348335 8
bgm collection status 348335 doing
```

### 6. 瀏覽小組或主題

```bash
bgm group list --sort members --limit 10
bgm group get boring
bgm group topics boring --limit 20
bgm group topic <topic_id>
```

`<topic_id>` 可以直接從上一條 `bgm group topics ...` 的輸出取得。

### 7. 需要腳本整合時使用 JSON

```bash
bgm --json user me
bgm --json subject search "Gundam" --type anime --limit 5
bgm --json collection get 348335
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
| Setup | `bgm setup update` | 將託管安裝更新到最新的 `main` 版本 |
| 設定 | `bgm config show` | 顯示目前生效的設定 |
| 設定 | `bgm config set <key> <value>` | 寫入一個設定項 |
| 設定 | `bgm config unset <key>` | 刪除一個設定項 |
| 認證 | `bgm auth login-url [--client-id xxx] [--redirect-uri xxx] [--state xxx]` | 產生 Bangumi OAuth 授權連結 |
| 認證 | `bgm auth token --code <code> [--save]` | 用授權碼交換 Access Token / Refresh Token |
| 認證 | `bgm auth refresh [--save]` | 刷新已儲存的 Access Token |
| 認證 | `bgm auth turnstile [--manual] [--listen-host <host>] [--port n] [--public-origin <url>] [--timeout-seconds <n>]` | 打開本地 helper 指導頁，取得供下一次寫入動作使用的短效 Turnstile Token |
| 認證 | `bgm auth set-token <access_token>` | 直接儲存既有 Access Token |
| 認證 | `bgm auth session-login [--manual]` | 打開官方 private API 登入頁並保存輔助 session |
| 認證 | `bgm auth set-session <chiiNextSessionID|cookie_string>` | 手動保存 private API session |
| 認證 | `bgm auth session-status` | 檢查目前是否已保存 private API session |
| 認證 | `bgm auth status` | 檢查目前 Access Token 狀態 |
| 使用者 | `bgm user me` | 取得目前登入使用者資料 |
| 使用者 | `bgm user get <username_or_uid>` | 取得公開使用者資料 |
| 條目 | `bgm subject get <subject_id>` | 依 ID 取得單一條目 |
| 條目 | `bgm subject list --type <book\|anime\|music\|game\|real> [--sort date\|rank] [--year yyyy] [--month mm] [--limit n]` | 依類型與篩選條件瀏覽條目 |
| 條目 | `bgm subject search <keyword> [--type ...] [--sort match\|heat\|rank\|score] [--tag xxx] [--limit n]` | 搜尋條目 |
| 小組 | `bgm group list [--mode <all\|joined\|managed>] [--sort <created\|updated\|posts\|topics\|members>] [--limit n] [--offset n]` | 列出小組 |
| 小組 | `bgm group get <group_name>` | 取得單一小組詳情 |
| 小組 | `bgm group topics <group_name> [--limit n] [--offset n]` | 列出小組主題 |
| 小組 | `bgm group topic <topic_id> [--reply-limit n]` | 取得單一小組主題詳情，含正文與留言摘要 |
| 小組 | `bgm group create-topic <group_name> <title> <content> [--turnstile-token <token>] [--manual]` | 在小組中建立新主題；未傳 token 時會自動開啟本地 helper 指導頁 |
| 小組 | `bgm group reply <topic_id> <content> [--reply-to <reply_id>] [--turnstile-token <token>] [--manual]` | 回覆小組主題；未傳 token 時會自動開啟本地 helper 指導頁 |
| 小組 | `bgm group members <group_name> [--role <visitor\|guest\|member\|creator\|moderator\|blocked>] [--limit n] [--offset n]` | 列出小組成員 |
| 小組 | `bgm group recent-topics [--mode <all\|joined\|created\|replied>] [--limit n] [--offset n]` | 列出最新小組主題 |
| 小組 | `bgm group latest-replies [--mode <all\|joined\|created\|replied>] [--limit n] [--scan n]` | 列出最新被回覆頂起的小組主題 |
| 小組 | `bgm group hot [--window <day\|week\|month>] [--mode <all\|joined\|created\|replied>] [--limit n] [--scan n]` | 依近期活躍度計算最火小組 |
| 小組 | `bgm group hot-topics [--window <day\|week\|month>] [--mode <all\|joined\|created\|replied>] [--limit n] [--scan n]` | 依近期活躍度計算最火小組主題 |
| 日誌 | `[新增] bgm blog list [--user <username>] [--limit n] [--offset n]` | 列出某位使用者的日誌 |
| 日誌 | `[新增] bgm blog get <blog_id>` | 取得單篇日誌詳情 |
| 日誌 | `[新增] bgm blog comments <blog_id>` | 列出單篇日誌評論 |
| 日誌 | `[新增] bgm blog photos <blog_id> [--limit n] [--offset n]` | 列出日誌圖片 |
| 日誌 | `[新增] bgm blog subjects <blog_id>` | 列出日誌關聯條目 |
| 日誌 | `[實驗性] bgm blog reply <blog_id> <content> [--reply-to <comment_id>] [--turnstile-token <token>] [--manual]` | 回覆日誌或日誌評論；需要 Turnstile，且目前仍可能遇到伺服器端失敗 |
| 日誌 | `[實驗性] bgm blog edit-comment <comment_id> <content>` | 編輯自己的日誌評論 |
| 日誌 | `[實驗性] bgm blog delete-comment <comment_id>` | 刪除自己的日誌評論 |
| 時光機 | `[新增] bgm timeline list [--mode <all\|friends>] [--limit n] [--until <timeline_id>]` | 列出時光機動態 |
| 時光機 | `[新增] bgm timeline user <username> [--limit n] [--until <timeline_id>]` | 列出某位使用者的時光機 |
| 時光機 | `[新增] bgm timeline replies <timeline_id>` | 列出單條時光機的回覆 |
| 時光機 | `[實驗性] bgm timeline say <content> [--turnstile-token <token>] [--manual]` | 發送時光機吐槽；需要 Turnstile |
| 時光機 | `[實驗性] bgm timeline reply <timeline_id> <content> [--reply-to <comment_id>] [--turnstile-token <token>] [--manual]` | 回覆時光機；需要 Turnstile |
| 時光機 | `[新增] bgm timeline delete <timeline_id>` | 刪除自己的時光機 |
| 時光機 | `[新增] bgm timeline like <timeline_id> <value>` | 對時光機送出數值反應 |
| 時光機 | `[新增] bgm timeline unlike <timeline_id>` | 取消自己的時光機反應 |
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
bgm config set timezone Asia/Tokyo
bgm config unset userAgent
```

### 認證

```bash
bgm auth login-url --state random-state
bgm auth token --code YOUR_CODE --save
bgm auth refresh --save
bgm auth turnstile --manual --port 8765
bgm auth set-token YOUR_ACCESS_TOKEN
bgm auth session-login
bgm auth session-status
bgm auth status
```

遠端或 VPS 場景下，如果官方託管驗證頁無法把 token 回傳到目前終端，可以固定連接埠後透過 SSH tunnel 手動開啟本地 helper 頁，例如先在本地執行 `ssh -L 8765:127.0.0.1:8765 your-server`，再執行 `bgm auth turnstile --manual --port 8765`。

說明：

- Access Token 是最推薦、也最穩定的預設路徑
- `bgm auth status` 檢查的是已儲存的 Access Token 狀態
- `bgm auth session-login` / `bgm auth session-status` 只是 `next.bgm.tv/p1` 的輔助 session 能力
- 這個 private session 不取代 Access Token，也不會消除小組寫入與實驗性日誌評論寫入對 Turnstile 的需求
- `bgm auth turnstile` 現在會優先走 Bangumi 官方託管驗證頁；只有官方鏈路不可用，或你明確傳入 `--manual` 時，才會回退到本地 helper
- 取得到的 `turnstileToken` 是一次短時有效、供下一次寫入動作使用的驗證 token

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
bgm group topic <topic_id>
bgm group create-topic boring "Title" "Content"
bgm group members boring --role member --limit 20
bgm group recent-topics --mode all --limit 10
bgm group latest-replies --limit 10
bgm group hot --window day --limit 10
bgm group hot-topics --window week --limit 10
```

寫入操作支援兩種方式：

- 直接傳入 `--turnstile-token`
- 不傳 token，讓 CLI 代你取得一次 token

預設情況下，CLI 會優先開啟 Bangumi 官方託管驗證頁。驗證成功後，託管 callback 頁會嘗試把 token 自動回傳到目前終端。

如果官方鏈路暫時不可用，CLI 會自動回退到本地 helper 指導頁。helper 頁會提供 `next.bgm.tv` 跳轉、一鍵複製腳本與手動貼上回傳入口。遠端環境可明確傳入 `--manual`，直接強制使用本地 helper 路徑。

### 日誌

```bash
bgm blog list --user sai --limit 10
bgm blog get 371953
bgm blog comments 371953
bgm blog photos 371953
bgm blog subjects 371953
bgm blog reply 371953 "測試成功，可忽略"
```

說明：

- `[新增]` 日誌讀取指令目前已接入 CLI
- `[實驗性]` 日誌評論寫入指令需要 Turnstile，CLI 會優先走官方託管驗證頁
- `[實驗性]` 日誌評論寫入、編輯、刪除目前仍可能遇到 Bangumi 伺服器端 `500`
- 目前尚未支援日誌正文的建立、編輯與刪除

### 時光機

```bash
bgm timeline list --mode friends --limit 10
bgm timeline user sai --limit 10
bgm timeline replies 123456
bgm timeline say "下班了"
bgm timeline reply 123456 "收到" --reply-to 0
bgm timeline like 123456 1
```

說明：

- `[新增]` 時光機讀取、刪除與反應指令已接入 CLI
- `[實驗性]` 時光機 `say` / `reply` 寫入指令需要 Turnstile，CLI 會優先走官方託管驗證頁
- 目前尚未接入文件中的 SSE 事件流介面，普通 CLI 先覆蓋非串流的讀寫路徑

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

如果已設定託管 OAuth backend，CLI 也可以讓託管 callback 頁把最終 token 自動回傳到本地終端。這條路徑更適合實驗和相容性測試；一般情況下仍建議優先使用 Access Token。

這條路徑目前仍是實驗性能力，不是一般使用者的預設推薦主路徑。

### Turnstile 驗證

對於小組發文、日誌評論、時間膠囊吐槽等需要 Turnstile 的寫入動作，CLI 目前的順序是：

1. 優先走 Bangumi 官方託管 Turnstile 頁面
2. 如果官方鏈路不可用，再自動回退到本地 helper
3. 如果你傳入 `--manual`，則直接使用本地 helper

如果你想單獨先取一次 token，可以執行：

```bash
bgm auth turnstile
```

如果你在遠端機器上，或官方 callback 頁無法把 token 回傳到目前終端，可以改用：

```bash
bgm auth turnstile --manual --port 8765
```

### 託管 OAuth backend

這個倉庫包含一個可選的託管 OAuth backend 腳手架，位於 [`oauth-backend/`](./oauth-backend)。

這個 backend 主要用於：

- 自託管實驗
- 除錯 OAuth 流程
- 後續更可攜的瀏覽器授權方案探索

它並不是一般使用者最推薦的認證方式，也不應取代 Access Token 成為預設方案。

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

## 倉庫開發

如果你只是想使用這個 CLI，前面的內容基本上就已經足夠。

下面這部分只給想修改這個倉庫、送 PR 或維護命令實作的人看。

### 本地執行

```bash
node src/cli.js --help
node src/cli.js user me
```

### 常用命令

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

### 開發入口

- 先讀 [`SKILLS.md`](./SKILLS.md)
- 倉庫開發看 [`skills/bgm-cli-develop/SKILL.md`](./skills/bgm-cli-develop/SKILL.md)
- 如果任務是操作 CLI 而不是改程式碼，讀 [`skills/bgm-cli-operate/SKILL.md`](./skills/bgm-cli-operate/SKILL.md)

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

## 更多文件

- [`docs/README.md`](./docs/README.md)
- [`SKILLS.md`](./SKILLS.md)
- [`skills/README.md`](./skills/README.md)
- [`skills/bgm-cli-operate/SKILL.md`](./skills/bgm-cli-operate/SKILL.md)
- [`skills/bgm-cli-develop/SKILL.md`](./skills/bgm-cli-develop/SKILL.md)
- [`docs/skills/README.md`](./docs/skills/README.md)
