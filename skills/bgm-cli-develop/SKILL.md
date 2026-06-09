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
- book progress reads and writes (`book get`, `book ep`, `book vol`) for book-type subjects
- collection list, get, comment, rate, and status changes
- subject discussion topic/post CRUD plus topic and collection reaction writes
- episode comments plus episode-progress writes
- character/person comments plus photo preview/detail/comment reads
- group reads plus topic/post CRUD and selected Turnstile-gated group writes
- blog reads plus experimental Turnstile-gated blog comment writes
- index reads and writes (create, update, delete, comments, related items)
- timeline reads, SSE event sampling, and Turnstile-gated timeline `say` and `reply`
- weekly anime broadcast calendar (`calendar today`, `calendar all`, `calendar <weekday>`)
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
- `runBookCommand`
- `runGroupCommand`
- `runUserCommand`
- `runCollectionCommand`
- `runCalendarCommand`
- `runIndexCommand`

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

### Bangumi comments and reactions

- Bangumi comment bodies can contain `(bgmNN)` emote codes, and the site renders them as inline emojis.
- Reaction-style `like` commands are target-specific; do not assume every sticker code works everywhere.
- Keep a copy of the full emote mapping around for AI output and comment generation, but maintain a narrower per-target reaction allow-list for write validation.

### Auth

- `bgm --init` and `bgm auth login` are the recommended official login path
- Access Token remains a preserved second channel for compatibility and scripting
- CLI OAuth helper flows are supported but secondary
- hosted `oauth-backend` is experimental and should only be expanded deliberately
- if an auth task is ambiguous, preserve the two-channel contract: official p1 login/session first, Access Token second, and no credential double-send on p1 requests

**Turnstile / Hosted Backend Quirks**

- `startHostedRelayReceiver()` lives in `src/utils/auth-flow.js` and currently binds/exposes `http://127.0.0.1:<port>/callback` so browser fetches from the hosted callback page can reach the local CLI relay.
- Do not change that relay URL back to `0.0.0.0`; it can be useful as a listen address but is not a browser-fetchable callback target.
- `oauth-backend/src/app.js` `normalizeRelayUrl()` currently accepts valid `http:` and `https:` URLs; it does not contain a localhost-only allow-list.
- The hosted backend API endpoint is `POST /api/turnstile/session` with body field `relay_url` (or `relayUrl` as fallback). It returns `{"error":"missing_relay_url"}` when the relay URL is absent or invalid.
- Remote/VPS Turnstile operation needs a deliberately designed public relay URL and backend policy; do not patch localhost behavior casually or hardcode public IPs.

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
- ✅ **Version metadata stays in sync.** Keep `package.json`, the config default `appVersion`, and `bgm --version` aligned on release bumps.

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
- for book-type subjects, use the dedicated `book` commands (`book get`, `book ep`, `book vol`) instead of `episode` commands
- preserve the observed constraint that the parent subject must already be collected before episode writes and book progress writes
- do not assume `doing` is required for episode writes unless Bangumi behavior is revalidated and changed
- preserve the NSFW episode-list auth behavior: for `p1` requests, prefer private session cookie and fall back to Access Token without double-sending credentials; without a usable auth context, surface the misleading-404 caveat clearly
- preserve the book-type hint behavior: when a user targets a book-type subject with `episode list`, `episode watch`, or `episode comments <subject_id> <episode_number>`, suggest the correct `bgm book` command

Relevant helpers in `src/cli.js`:

- `executeEpisodeListCommand`
- `executeEpisodeStatusCommand`
- `executeEpisodeWatchCommand`
- `fetchMyEpisodeCollectionVerified`
- `normalizeEpisodeCollectionStatusValue`
- `normalizeEpisodeTypeFilter`
- `fetchAllEpisodes`

Relevant helpers in `src/commands/book.js`:

- `runBookCommand`
- `executeBookGetCommand`
- `executeBookEpCommand`
- `executeBookVolCommand`
- `ensureBookCollection`

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

For book commands specifically, also verify:
- `node src/cli.js book get --help`
- `node src/cli.js book ep --help`
- `node src/cli.js book vol --help`
- non-book subjects are rejected with a clear message
- book-type hints appear when `episode list` / `episode watch` / `episode comments` target a book subject

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

### Test what the CLI does, not what the API returns

Real API calls are acceptable for **1 smoke test per command group** to confirm end-to-end wiring, but the bulk of tests should validate the **CLI's own logic** using mock data:

- **Parameter parsing and normalization** — e.g. `parseFlags()`, `normalizeSubjectTypeFilter()`, `normalizeCollectionStatusFilter()`
- **Formatting and rendering** — e.g. `formatDisplayResult()` with constructed payloads
- **Filtering, sorting, slicing** — e.g. `sortCollections()`, client-side pagination logic
- **Boundary conditions** — empty arrays, missing fields, `undefined` scores

**Do not write multiple integration tests that merely exercise the upstream Bangumi API** (e.g. testing that `calendar mon` returns Monday, `calendar sun` returns Sunday, `calendar all` returns 7 days). Those test Bangumi's API contract, not the CLI. One default-path smoke test per group is enough.

**Shift test budget toward high-frequency commands.** `collection` and `subject` are heavily used; they deserve deep unit coverage for filtering/sorting/formatting. `calendar` is read-only and low-complexity; 1 integration + 2 formatting tests is sufficient.

If the CLI code tightly couples API calls with logic (common in `src/cli.js` handlers), prefer extracting the pure logic into testable functions over adding more integration tests. Integration tests are slow, flaky, and burn CI minutes.

### Release conventions

- Keep `package.json` version in sync with the hardcoded version string used by `bgm --version` (check `src/cli.js` or `src/core/config.js`).
- Before tagging, run the full verification checklist:
  1. `node --check src/cli.js && node --check src/core/*.js`
  2. `npm test`
  3. `node src/cli.js --help` (ensure all commands appear)
  4. `node src/cli.js --version` (ensure version matches `package.json`)
- Use semantic versioning: patch for fixes/docs, minor for features/commands, major for breaking changes.
- Tag format: `v{version}`, e.g. `git tag v0.1.3`.
- Push tags with `git push origin main --tags`.
- `npm publish` is optional depending on distribution strategy; the remote installer pulls from GitHub `main` by default.

## Environment Conventions

- Node.js `>= 20`
- package type is ESM
- config precedence is: built-in defaults, `bgm-dev.env`, runtime `config.json`, environment variables
- use existing install scripts under `scripts/` before inventing new manual setup steps

## When Not To Use This Skill

- when the task is just to run `bgm` commands for a user
- when the task is only about end-user installation and auth rather than repository changes
