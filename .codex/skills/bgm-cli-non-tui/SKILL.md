---
name: "bgm-cli-non-tui"
description: "Use when working on the non-TUI parts of bgm-cli: Bangumi API client behavior, config loading and persistence, auth flows, JSON or human-readable output, collection semantics, setup/install-path logic, or the optional oauth-backend service. Also use this skill when an agent needs to understand the repository before changing command behavior outside `bgm tui`. Do not use this skill for TUI layout, key handling, or interactive screen rendering unless the non-TUI code path is directly affected."
---

# bgm-cli Non-TUI

This skill is the Codex entrypoint for the non-TUI half of `bgm-cli`.

Public, homepage-facing skill documentation starts at:

- `SKILLS.md`

Detailed references live under:

- `docs/ai/bgm-cli-non-tui/references/source-map.md`
- `docs/ai/bgm-cli-non-tui/references/config-and-auth.md`
- `docs/ai/bgm-cli-non-tui/references/collection-semantics.md`

Read `SKILLS.md` first when you need the public operating summary. This `SKILL.md` exists mainly so Codex can trigger the guidance automatically.

Current auth maturity is uneven:

- direct access-token login is the mature and preferred path
- OAuth helper flows exist, but they are less mature and should be treated as secondary or experimental unless the task is explicitly about auth debugging
- the hosted `oauth-backend` is even more experimental and should not be treated as the default user path

## What belongs in scope

- Bangumi API access in `src/core/client.js`
- HTTP request and error normalization in `src/core/http.js`
- Config resolution and persistence in `src/core/config.js`
- Human-readable and JSON output shaping in `src/core/output.js`
- Non-TUI command routing and business rules in `src/cli.js`
- Optional hosted OAuth backend under `oauth-backend/`
- Shell installation scripts under `scripts/`

## What is out of scope

- TUI menu rendering, raw keypress handling, and screen drawing
- Cosmetic changes that only affect `bgm tui`
- Treating interactive flows as the default verification path

If a task mixes both, handle the non-TUI change first and only touch TUI code if it is required to keep behavior consistent.

## Quick start

1. Read `README.md` for the public contract and supported workflows.
2. Read `SKILLS.md` for the public agent entrypoint and working rules.
3. Read `docs/ai/bgm-cli-non-tui/references/source-map.md` for the real code ownership map.
4. If the task touches config or auth, also read `docs/ai/bgm-cli-non-tui/references/config-and-auth.md`.
5. If the task touches collection writes or Bangumi behavior, also read `docs/ai/bgm-cli-non-tui/references/collection-semantics.md`.
6. Prefer changing core modules and command logic over adding one-off CLI hacks.

## Working rules

- Prefer non-interactive code paths and `--json` outputs when reasoning about behavior.
- Treat access-token login as the stable default auth path.
- Treat OAuth helper flows as less mature than token login. Only prefer them when the task is specifically about OAuth support, browser auth debugging, refresh-token behavior, or backend session flow.
- Do not assume the hosted OAuth backend is the recommended login path. It is experimental and below token auth in maturity and priority.
- When modifying collection write behavior, preserve the current design principle: write first, then read back and verify when the code already does so.
- Respect the split between API endpoints and OAuth endpoints.
  - API: `https://api.bgm.tv`
  - OAuth: `https://bgm.tv` in the CLI, `https://bangumi.tv` in `oauth-backend/`
- Check whether a behavior is implemented in `src/core/*` before editing `src/cli.js`. Many command changes should be core-first.
- Do not route new automation through `bgm tui`. If the task is scriptable, implement or verify it through ordinary commands or core modules.

## Architecture

The repository is a plain Node.js CLI with one large entrypoint and a small core layer:

- `src/cli.js`
  Command router, arg parsing, init flow, command implementations, collection business rules, and TUI code.
- `src/core/client.js`
  Bangumi REST client, OAuth helper client, and client for the optional hosted OAuth backend.
- `src/core/http.js`
  `fetch` wrapper, query/body construction, and API error normalization.
- `src/core/config.js`
  Config defaults, merge order, project-vs-global runtime config selection, and persistence helpers.
- `src/core/output.js`
  Human-readable formatting, JSON passthrough, and user-facing error/result presentation.
- `oauth-backend/`
  Separate deployment unit for a portable OAuth backend using Hono plus Upstash Redis.

For deeper details, read `docs/ai/bgm-cli-non-tui/references/source-map.md`.

## Default task workflow

1. Identify whether the request is really non-TUI.
2. Locate the owning layer.
   - Parsing, routing, collection workflow, install-path flow: `src/cli.js`
   - API/OAuth calls: `src/core/client.js`
   - Config precedence or persistence: `src/core/config.js`
   - Request serialization or errors: `src/core/http.js`
   - Display contract: `src/core/output.js`
   - Hosted OAuth service: `oauth-backend/src/*`
3. Read only the relevant reference file for the task.
4. If the task involves auth, first decide whether it should stay on the token path instead of expanding OAuth complexity.
5. Implement the narrowest fix that preserves current command semantics.
6. Verify with targeted non-interactive commands. Favor `node --check` and direct CLI invocations over TUI testing.

## Verification defaults

Use the smallest relevant checks:

- Syntax only:
  - `node --check src/cli.js`
  - `node --check src/core/client.js`
  - `node --check src/core/config.js`
  - `node --check src/core/http.js`
  - `node --check src/core/output.js`
- Backend syntax:
  - `node --check oauth-backend/src/app.js`
  - `node --check oauth-backend/src/config.js`
  - `node --check oauth-backend/src/bangumi-oauth.js`
- CLI behavior:
  - `node src/cli.js --help`
  - `node src/cli.js --json <command...>`

If a task depends on real credentials or network access, say so explicitly and separate static verification from live verification.

## Reference map

Read only what you need:

- `docs/ai/bgm-cli-non-tui/references/source-map.md`
  Use for file ownership, command grouping, and where business logic lives.
- `docs/ai/bgm-cli-non-tui/references/config-and-auth.md`
  Use for config precedence, runtime file locations, token login, OAuth helpers, and backend session flow.
- `docs/ai/bgm-cli-non-tui/references/collection-semantics.md`
  Use for collection list/get/update behavior, search-and-pick rules, and Bangumi-specific constraints.

## Common task patterns

### Add or change a CLI command

Update the command implementation in `src/cli.js`, then check whether:

- usage text in `src/core/output.js` must change
- output shaping must change for JSON and human-readable modes
- config or client helpers should absorb reusable logic

### Change Bangumi request behavior

Start in `src/core/client.js` and `src/core/http.js`. Keep command code focused on orchestration and validation, not low-level HTTP details.

### Change config behavior

Start in `src/core/config.js`. Preserve the documented merge order:

1. built-in defaults
2. `bgm-dev.env`
3. active runtime `config.json`
4. environment variables

### Change collection write behavior

Read `docs/ai/bgm-cli-non-tui/references/collection-semantics.md` first. The repository already encodes several server-side Bangumi rules; avoid weakening them.

### Change auth behavior

Read `docs/ai/bgm-cli-non-tui/references/config-and-auth.md` first.

- If the user goal can be solved with an access token, prefer that path.
- Do not expand OAuth-first product behavior unless the task explicitly requires it.
- When changing OAuth code, describe the maturity tradeoff clearly in your final explanation.

### Work on hosted OAuth backend

Treat `oauth-backend/` as a separate app with its own env contract and deployment surface. Read `docs/ai/bgm-cli-non-tui/references/config-and-auth.md` before changing session flow or callback handling.

## Output expectations

When you finish a task in this repo:

- explain which non-TUI layer changed
- mention any config or credential assumptions
- mention exactly what was verified
- call out if live Bangumi or deployed-backend testing was not performed

## Examples

Example triggers for this skill:

- "给 `collection rate` 增加一个非交互式参数校验"
- "排查 `bgm auth refresh` 为什么没有保存 refresh token"
- "把 oauth-backend 的 session 轮询流程解释给我"
- "新增一个脚本友好的 JSON 输出字段"
- "梳理这个项目除了 TUI 之外的架构"
