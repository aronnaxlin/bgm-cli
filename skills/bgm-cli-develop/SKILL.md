---
name: "bgm-cli-develop"
description: "Use when an agent needs to work on the bgm-cli repository itself: understand scope, find the owning modules quickly, follow repository conventions, preserve Bangumi-specific behavior, and verify code or documentation changes safely."
---

# bgm-cli Develop

This is the main published repository-development skill for `bgm-cli`.

Use it when the task is to change code or docs in this repository.

Do not use it when the task is only to operate `bgm` for an end user. For that, use `bgm-cli-operate`.

## What This Skill Covers

- fast repository onboarding
- file ownership and entrypoint mapping
- implementation conventions and change boundaries
- auth, collection, and output behavior that should be preserved
- lightweight default verification for code and docs changes

## Project Snapshot

`bgm-cli` is a Node.js Bangumi CLI.

Core user-facing capabilities include:

- auth and login
- user profile reads
- subject search and subject reads
- episode list plus episode-progress status and watch writes
- collection list, get, comment, rate, and status changes
- group reads plus selected Turnstile-gated group writes
- blog reads plus experimental Turnstile-gated blog comment writes
- timeline reads plus Turnstile-gated timeline `say` and `reply`
- machine-readable output with `--json`
- optional self-hosted `oauth-backend` for hosted OAuth and official-first Turnstile relay flows

This repository contains both ordinary CLI flows and TUI flows. For most work, start from the ordinary command path and only touch TUI code when the task explicitly requires it.

## Read Order

Start here:

1. `README.md`
2. `SKILLS.md`
3. this skill

## Ownership Map

Main files and directories:

- `src/cli.js`: command parsing, command handlers, init flow, ordinary CLI and TUI entrypoints
- `src/core/client.js`: Bangumi API client, OAuth client, hosted backend client
- `src/core/http.js`: request transport and error normalization
- `src/core/config.js`: config defaults, merge behavior, runtime persistence, install mode
- `src/core/output.js`: human-readable rendering and JSON output path
- `oauth-backend/src/*`: optional hosted OAuth backend
- `scripts/*`: installation helpers
- `skills/*`: published installable skill packages
- `docs/*`: repository docs and research notes

Search these command handlers first before making CLI changes:

- `runConfigCommand`
- `runAuthCommand`
- `runSetupCommand`
- `runSubjectCommand`
- `runEpisodeCommand`
- `runGroupCommand`
- `runUserCommand`
- `runCollectionCommand`

## Core Principles

- prefer the smallest correct change
- preserve existing command semantics unless the task explicitly requires a behavior change
- keep automation and verification non-interactive by default
- prefer source-owned fixes in the right layer over duplicated command-local patches
- do not introduce new complexity when an existing helper already covers the behavior

## Working Defaults

- treat the ordinary CLI command path as the default engineering surface
- do not start from `bgm tui` unless the task explicitly requires TUI behavior
- prefer the narrowest change in the owning module instead of adding parallel abstractions
- reuse existing client and helper functions before adding new command-local logic
- if output behavior changes, update both the command implementation and `src/core/output.js`

## Domain Conventions

### Auth

- direct access-token login is the mature default path
- CLI OAuth helper flows are supported but secondary
- hosted `oauth-backend` is experimental and should only be expanded deliberately
- if an auth task is ambiguous, bias toward preserving or improving the token path rather than adding OAuth complexity

**Turnstile / Hosted Backend Quirks**

- `oauth-backend/src/app.js` contains `normalizeRelayUrl()`, which **hardcodes an allow-list of only `127.0.0.1` and `localhost`** for the relay callback URL. This means the official `bgm auth turnstile` flow (which uses the hosted Vercel backend to relay the token) is **designed for localhost only** out of the box.
- When running `bgm-cli` on a remote VPS, `startHostedRelayReceiver()` in `src/cli.js` binds to `127.0.0.1` by default. Change the `hostname` to `"0.0.0.0"` so the server listens on all interfaces; the user's phone/browser can then reach it via the VPS public IP. **Do not hardcode the public IP** — `"0.0.0.0"` is portable and avoids leaking the address in source control.
- However, the Vercel backend will then reject the relay URL because `normalizeRelayUrl()` blocks non-localhost hostnames.
- To enable the official flow on a remote server, **patch both sides**:
  1. **CLI side** (`src/cli.js` ~line 6422 in `startHostedRelayReceiver`): change `hostname: "127.0.0.1"` to `hostname: "0.0.0.0"`
  2. **Backend side** (`oauth-backend/src/app.js` `normalizeRelayUrl()`): remove the `if (!["127.0.0.1", "localhost"].includes(url.hostname))` check so any valid http(s) URL is accepted
- After patching the backend, **redeploy the Vercel project** (`vercel deploy` or manual Redeploy in the Vercel dashboard). Pushing to GitHub alone does not update the live Vercel deployment unless Git integration + auto-deploy is enabled.
- The Vercel backend API endpoint is `POST /api/turnstile/session` with body field `relay_url` (or `relayUrl` as fallback). It returns `{"error":"missing_relay_url"}` when `normalizeRelayUrl()` rejects the value.

### Collections

- preserve current Bangumi-specific constraints unless they are explicitly revalidated
- prefer explicit `subject_id` or `--pick` aware flows for deterministic behavior
- keep post-write verification when changing rating, status, or collect behavior
- when adding collection filtering or sorting behavior, update both normalization and the actual sorter

**Resolved gaps (v0.1.3 → current):**

The following were addressed in commits `c893e25` through `aaac995`:

1. ✅ **`--offset` is now implemented in `executeCollectionListCommand`.** The CLI parses and forwards the `--offset` flag to the Bangumi API's native offset parameter. (c893e25)

2. ✅ **Single-value filters (`subject_type`, `type`) are passed to the Bangumi API** to reduce payload size. `fetchAllCollections` accepts an optional `{ query }` parameter; when a single subject type or collection status is specified, it's forwarded as a query param. Multi-value filters still fall back to client-side filtering. (c893e25)

3. ✅ **Parallel fetch with bounded concurrency (8 requests/batch).** `fetchAllCollections` uses `Promise.all` in batches of 8. Also applied to `fetchAllSubjects` for auto-paginated subject list queries. (c893e25, ac041b4)

4. ✅ **401 errors now include auto-generated hints** suggesting `bgm auth refresh --save` or `bgm auth set-token <access_token>`. (c893e25)

5. ✅ **CJK-safe table formatting.** All list commands (`collection list`, `subject list`, `group list/topics/members`, `blog list`) now render as `│`-delimited tables with proper CJK character width handling (Chinese/Japanese counted as 2 columns). Uses `formatTable()` with `displayWidth()`/`truncateDisplay()` helpers. (1f4e05e)

6. ✅ **`subject list` auto-paginates when `limit > 100`.** The Bangumi v0 API enforces limit ≤ 100. `fetchAllSubjects()` with bounded concurrency fetches additional pages transparently. (ac041b4)

7. ✅ **`subject get --verbose`** adds tags with counts and rating distribution to output. Bar charts (`█` characters) removed from verbose output for cleaner display. (4329ee8, 506613e)

8. ✅ **`collection list --sort user_score` outputs sorted correctly.** API filter passthrough reduces payload size enough that client-side sort overhead is negligible.

**Still open:**

- ❌ **No progress indication when fetching large collections/subject lists.** `fetchAllCollections` and `fetchAllSubjects` paginate silently with no user feedback. For users with 1000+ items, the CLI appears to hang for several seconds.
- ❌ **No early termination for `--limit`.** `fetchAllCollections` always fetches ALL pages before applying `--limit` slicing in memory. Tested with user `asm13177806` (UID 78670, 223,623 collections): even `--limit 1` tries to fetch all 2,236 pages across 280 batches, timing out after 120s+. The limit should short-circuit the fetch loop once enough items are collected, OR the offset/limit should be passed directly to the API for server-side pagination (which the v0 API does support). Combined with the silent pagination issue, this makes the CLI effectively unusable for whale accounts.
- ❌ **Sort remains in-memory** — Bangumi v0 API provides no server-side sort parameter for collections. Mitigated by API filter passthrough keeping payloads small.
- ❌ **Node.js version warning.** Package requires `>=20` but works on v18.19.1 with `EBADENGINE` warnings from npm.
- ❌ **Version not bumped.** `package.json` version stuck at 0.1.2 despite multiple feature commits; `bgm --version` still reports 0.1.2.

Relevant helpers in `src/cli.js`:

- `resolveCollectionTarget`
- `selectSubjectFromSearch`
- `buildCollectionMutationPayload`
- `fetchMySubjectCollection`
- `fetchMySubjectCollectionVerified`
- `normalizeCollectionStatusValue`
- `normalizeRateValue`
- `fetchAllCollections`
- `sortCollections`
- `executeCollectionListCommand` (line ~3410) — collection list handler with offset, API filter passthrough, and pagination
- `fetchAllCollections` (line ~4308) — parallel fetch with bounded concurrency, API filter passthrough, sequential fallback for unreliable totals

### Episodes

- preserve the Bangumi-specific distinction between subject collection progress and dedicated episode collection endpoints
- do not route anime / game / real subject progress through subject collection `ep_status`
- preserve the observed constraint that the parent subject must already be collected before episode writes
- do not assume `doing` is required for episode writes unless Bangumi behavior is revalidated and changed
- preserve the NSFW episode-list auth behavior: with a token, attach auth; without one, surface the misleading-404 caveat clearly

Relevant helpers in `src/cli.js`:

- `executeEpisodeListCommand`
- `executeEpisodeStatusCommand`
- `executeEpisodeWatchCommand`
- `fetchMyEpisodeCollectionVerified`
- `normalizeEpisodeCollectionStatusValue`
- `normalizeEpisodeTypeFilter`
- `fetchAllEpisodes`

## File Ownership Conventions

- reusable Bangumi API behavior belongs in `src/core/client.js`
- transport and request normalization belong in `src/core/http.js`
- config defaults, merge order, and persistence belong in `src/core/config.js`
- human-readable rendering and JSON passthrough belong in `src/core/output.js`
- command orchestration belongs in `src/cli.js`
- self-hosted OAuth service behavior belongs under `oauth-backend/src/`

Avoid adding parallel logic in `src/cli.js` when the behavior should live in a reusable core module.

## Documentation Conventions

- put repository documentation under `docs/`
- do not create a parallel top-level `doc/` directory
- keep published installable skills under the top-level `skills/` directory
- use `docs/skills/README.md` and `SKILLS.md` as indexes, not as duplicate skill payloads
- update `README.md`, localized READMEs, `docs/README.md`, `docs/skills/README.md`, `skills/README.md`, and `SKILLS.md` when skill discovery paths or names change

## Adding a New Command

When adding a new top-level command (e.g. `calendar`, `index`, `subject`), follow the three-layer convention:

1. **API client** — `src/core/client.js`
   - Add an async method to `BangumiClient` (or the appropriate client class).
   - Reuse `this.request()` with the correct endpoint path.
   - Example pattern: `async getCalendar() { return this.request("/calendar"); }`

2. **Output formatting** — `src/core/output.js`
   - Add a type-guard function (e.g. `isCalendarPayload(value)`) near the other guards at the bottom of the file.
   - Add a formatter function (e.g. `formatCalendar(payload)`) for human-readable output.
   - Wire the guard into `formatDisplayResult()` so `--json` passthrough and human rendering both work.
   - Add help text in `buildUsageText()` under the appropriate `case`.

3. **Command handler** — `src/cli.js`
   - Add an async `run<Command>Command(command, args, context)` handler.
   - **Do not assume `getBangumiClient()` exists.** Look at existing handlers: some construct `new BangumiClient(getConfig())` directly. Copy the pattern used by the most similar handler.
   - Wire the handler into the main `switch (group)` block in `main()`.
   - **Pitfall — flag options become the `command` parameter.** The CLI's `main()` destructures argv as `[group, command, ...rest]`. When a user runs `bgm calendar --all`, the `--all` token becomes `command` and `args` (the `rest`) is empty. If your handler checks `args.includes("--all")`, it will silently miss the flag. **Fix:** merge `--` prefixed commands back into args before processing, following the pattern in `runStatusCommand`:
     ```js
     const allArgs = command && String(command).startsWith("--") ? [command, ...args] : args;
     const all = allArgs.includes("--all");
     ```

### CLI argument style convention

This project uses **subcommand-style** positional arguments for behavior selection, **not** `--flag` style. Study existing commands before choosing a style:

- `bgm status current` — subcommand `current`
- `bgm collection status <id> doing` — subcommand `status`, positional enum `doing`
- `bgm episode watch <id> 5` — subcommand `watch`, positional number

Flags (`--`) are reserved for **options** (modifiers), not for behavior selection:
- `bgm subject search "ghost" --type anime --limit 5` — `--type` and `--limit` are options

**When adding a new command that selects a mode (e.g. `all`, `today`, `monday`), use positional subcommands, not `--flags`.**

Bad:
```
bgm calendar --all          # violates convention
bgm calendar --monday       # violates convention
```

Good:
```
bgm calendar all            # follows convention
bgm calendar monday         # follows convention
bgm calendar mon            # abbreviated form also OK
```

If an earlier draft used `--flag` style and may already be in users' muscle memory, preserve backward compatibility by also accepting the old `--flag` forms (merge `--` prefixed `command` back into `args`).

### Verification checklist for new commands

- `node --check src/core/client.js`
- `node --check src/core/output.js`
- `node --check src/cli.js`
- `node src/cli.js <new-command>` (human-readable smoke test)
- `node src/cli.js --json <new-command>` (JSON smoke test)
- `node src/cli.js <new-command> --help` (help text smoke test)
- `node src/cli.js --help` (ensure the command appears in the main help list)

If networked or authenticated behavior cannot be exercised, say so explicitly instead of implying full end-to-end validation.

### Output language policy

All non-API output strings in `src/` must be **English only**. API-returned data (subject names, weekday labels from Bangumi, etc.) may contain any language. The TUI layer is the only exception where localized strings are acceptable.

This applies to:
- Help text and usage descriptions in `src/core/output.js`
- Error messages in `src/core/output.js` and `src/cli.js`
- Mock data in tests under `test/`
- Table headers, column names, and CLI prompts

Bad:
```
// In src/core/output.js help text
["bgm calendar", "显示今日番组表"]   // violates policy
```

Good:
```
["bgm calendar", "Show today's anime broadcast schedule"]   // correct
```

### Testing conventions

Use Node.js built-in `node:test` + `node:assert`. Do **not** add external test dependencies like `vitest`, `jest`, or `mocha`.

- Place tests under `test/`
- Name files `*.test.js`
- Use ESM imports (`import { describe, it } from "node:test"`)
- For CLI integration tests, use `spawnSync` to invoke `node src/cli.js`
- For unit tests on formatters, import directly from `src/core/output.js`
- Add `"test": "node --test"` to `package.json` scripts
- GitHub Actions should run `npm test` on push/PR/release

Example test pattern:
```js
import { spawnSync } from "node:child_process";
import { describe, it } from "node:test";
import assert from "node:assert";

function run(args) {
  return spawnSync("node", ["src/cli.js", ...args], { encoding: "utf-8", cwd: process.cwd() });
}
```

## Environment Conventions

- Node.js `>= 20`
- package type is ESM
- config precedence is: built-in defaults, `bgm-dev.env`, runtime `config.json`, environment variables
- use existing install scripts under `scripts/` before inventing new manual setup steps

## When Not To Use This Skill

- when the task is just to run `bgm` commands for a user
- when the task is only about end-user installation and auth rather than repository changes
