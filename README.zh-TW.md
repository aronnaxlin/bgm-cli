# bgm-cli

[简体中文](./README.md) | [繁體中文（台灣）](./README.zh-TW.md) | [English](./README.en.md)

`bgm-cli` 是一個面向 Bangumi 的命令列工具，目標是讓使用者能快速在終端機中完成常見查詢、讀取與部分寫入操作。

## 快速開始

### 執行需求

- Node.js `>= 20`

### 安裝

macOS / Linux：

```bash
curl -fsSL https://raw.githubusercontent.com/aronnaxlin/bgm-cli/main/scripts/install-remote.sh | sh
```

Windows PowerShell：

```powershell
irm https://raw.githubusercontent.com/aronnaxlin/bgm-cli/main/scripts/install-remote.ps1 | iex
```

如果你已經在本地 clone 倉庫，也可以直接執行：

```bash
./bgm --help
```

### 認證

建議路徑是使用 Bangumi Access Token：

```bash
bgm --init
```

如果你已經有 Token，也可以直接保存：

```bash
bgm auth set-token YOUR_ACCESS_TOKEN
bgm auth status
```

### 常用命令

```bash
bgm user me
bgm subject search "Heike Monogatari" --type anime --limit 5
bgm subject get 348335
bgm subject comments 348335 --limit 5
bgm character search "明日香" --limit 3
bgm person search "庵野" --limit 3
bgm collection get 348335
bgm collection indexes --user sai --limit 5
bgm group list --sort members --limit 10
bgm group user sai --limit 5
bgm index user sai --limit 5
bgm trending subjects --type anime --limit 5
bgm --json user me
```

## 文件索引

- 本專案同時提供可安裝的 Skills，適合讓 AI / Agent 直接安裝並操作 `bgm-cli`。
- 可以透過 `npx skills add aronnaxlin/bgm-cli` 添加本專案的 Skills。
- [`docs/README.md`](./docs/README.md)：文件總入口
- [`docs/guide.zh-CN.md`](./docs/guide.zh-CN.md)：主體導覽、推薦使用路線、安裝與常見使用方式
- [`docs/features.zh-CN.md`](./docs/features.zh-CN.md)：完整功能列表與命令索引
- [`docs/implementation.zh-CN.md`](./docs/implementation.zh-CN.md)：設定模型、輸出模型、收藏語義、倉庫結構與開發說明
- [`docs/experimental.zh-CN.md`](./docs/experimental.zh-CN.md)：實驗性功能，以及 OAuth、Turnstile、private session、hosted backend 說明
- [`oauth-backend/README.md`](./oauth-backend/README.md)：可選自託管 OAuth backend 的部署說明
- [`SKILLS.md`](./SKILLS.md)：給 AI / Agent 的倉庫與操作入口

拆分後的詳細文件目前統一以簡體中文維護於 `docs/` 之下。

## 核心風險與邊界

- 本專案不是 Bangumi 官方產品，與 Bangumi 官方沒有隸屬關係。
- 一般使用者應優先使用 Access Token；OAuth、private session、hosted backend 都不應視為預設主路徑。
- 一部分社群寫入操作依賴 Turnstile；本輪機器驗證已跳過這類人機驗證步驟，相關寫入操作仍需要人工複測，且部分實驗性寫入目前仍可能遇到 Bangumi 伺服器端失敗。
- 若要做腳本整合，建議優先使用 `--json`，不要依賴人類可讀輸出的文字格式。
- Bangumi 建議客戶端使用可識別開發者與應用程式身分的自訂 `User-Agent`。

## 致謝與承認

- 感謝 [`bgm.tv`](https://bgm.tv/) 提供 Bangumi 主站與社群生態。
- 感謝 [`bangumi/server-private`](https://github.com/bangumi/server-private) 提供 private API 相關實作參考。
- 感謝 [`bangumi/api`](https://github.com/bangumi/api) 提供公開 API 相關實作與文件基礎。
- 感謝 [`bgm-status.ry.mk`](https://bgm-status.ry.mk/) 提供社群維護的 Bangumi 可用性狀態觀測能力；該服務作者為 [`wataame`](https://bangumi.tv/user/wataame)。
- 本倉庫會盡量反映目前可驗證的 Bangumi 行為限制，但不承諾覆蓋網站上的全部功能，也不承諾第三方站點行為會長期穩定不變。

## 授權

本倉庫使用 `AGPL-3.0-only` 授權。詳見 [LICENSE](./LICENSE)。
