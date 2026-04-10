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
- collection list, get, comment, rate, and status changes
- group reads plus selected Turnstile-gated group writes
- machine-readable output with `--json`
- optional self-hosted `oauth-backend`

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

### Collections

- preserve current Bangumi-specific constraints unless they are explicitly revalidated
- prefer explicit `subject_id` or `--pick` aware flows for deterministic behavior
- keep post-write verification when changing rating, status, or collect behavior
- when adding collection filtering or sorting behavior, update both normalization and the actual sorter

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

## Verification Defaults

Default checks are lightweight syntax and CLI verification because the repository does not currently expose a broader scripted test suite:

- `node --check src/cli.js`
- `node --check src/core/client.js`
- `node --check src/core/config.js`
- `node --check src/core/http.js`
- `node --check src/core/output.js`
- `node --check oauth-backend/src/app.js`
- `node src/cli.js --help`
- `node src/cli.js --json <command...>`
- `npx skills add . --list`

If networked or authenticated behavior cannot be exercised, say so explicitly instead of implying full end-to-end validation.

## Environment Conventions

- Node.js `>= 20`
- package type is ESM
- config precedence is: built-in defaults, `bgm-dev.env`, runtime `config.json`, environment variables
- use existing install scripts under `scripts/` before inventing new manual setup steps

## When Not To Use This Skill

- when the task is just to run `bgm` commands for a user
- when the task is only about end-user installation and auth rather than repository changes
