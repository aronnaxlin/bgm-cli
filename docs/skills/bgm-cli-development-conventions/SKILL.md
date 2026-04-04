---
name: "bgm-cli-development-conventions"
description: "Use when an agent is editing bgm-cli code or docs and needs the repository's development conventions: scope boundaries, implementation preferences, verification defaults, and behavior that must be preserved."
---

# bgm-cli Development Conventions

Use this skill when making code or documentation changes in this repository.

This skill captures the conventions that should shape implementation choices, not just file locations.

## Core Principles

- prefer the smallest correct change
- preserve existing command semantics unless the task explicitly requires a behavior change
- keep automation and verification non-interactive by default
- prefer source-owned fixes in the right layer over duplicated command-local patches
- do not introduce new complexity when an existing helper already covers the behavior

## CLI Behavior Conventions

- do not treat `bgm tui` as the default automation or repository-understanding surface
- prefer ordinary CLI commands and `--json` for verification
- do not assume `--init` is script-friendly; it is interactive by design
- if output behavior changes, update both the command implementation and the output layer in `src/core/output.js`

## Auth Conventions

- direct access-token login is the mature default path
- CLI OAuth helper flows are supported but secondary
- hosted `oauth-backend` is experimental and should only be expanded deliberately
- if an auth task is ambiguous, bias toward preserving or improving the token path rather than adding OAuth complexity

## Collection Conventions

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
- put agent-facing skill docs under `docs/skills/`
- update indexes such as `docs/README.md`, `docs/skills/README.md`, and `SKILLS.md` when discovery paths change

## Verification Conventions

Default checks are lightweight syntax and CLI verification, because the repository does not currently expose a broader scripted test suite:

- `node --check src/cli.js`
- `node --check src/core/client.js`
- `node --check src/core/config.js`
- `node --check src/core/http.js`
- `node --check src/core/output.js`
- `node --check oauth-backend/src/app.js`
- `node src/cli.js --help`
- `node src/cli.js --json <command...>`

If networked or authenticated behavior cannot be exercised, say so explicitly instead of implying full end-to-end validation.

## Environment Conventions

- Node.js `>= 20`
- package type is ESM
- config precedence is: built-in defaults, `bgm-dev.env`, runtime `config.json`, environment variables
- use existing install scripts under `scripts/` before inventing new manual setup steps

## When Not To Use This Skill

- when the task is only to understand repository layout at a high level and no implementation guidance is needed
- when the task is purely end-user CLI operation rather than repository development
