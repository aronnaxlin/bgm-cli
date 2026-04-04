---
name: "bgm-cli-development-onboarding"
description: "Use when an agent needs to get productive in the bgm-cli repository quickly: understand the project scope, find the owning files, choose the right entrypoints, and verify changes without wandering through the whole codebase."
---

# bgm-cli Development Onboarding

Use this skill when the task is to develop `bgm-cli` itself and the agent needs a fast, reliable entrypoint into the repository.

This skill is for repository understanding and implementation onboarding.

It is not for operating `bgm` as an end-user CLI. For that, use `docs/skills/bgm-cli-cli-operator/SKILL.md`.

## What This Skill Helps With

- understanding what this repository does
- identifying the main entrypoints and owning modules
- choosing the right entrypoints before editing
- limiting code reads to the relevant surfaces
- verifying changes with the existing command flow

## Project Snapshot

`bgm-cli` is a Node.js CLI for Bangumi workflows.

Core user-facing capabilities include:

- auth and login
- user profile reads
- subject search and subject reads
- collection list, get, comment, rate, and status changes
- machine-readable output with `--json`
- optional self-hosted `oauth-backend`

This repository contains both ordinary CLI flows and TUI flows. For most repository work, start from the ordinary command path and only touch TUI code when the task actually requires it.

## Read Order

Start here:

1. `README.md`
2. `SKILLS.md`
3. this skill
4. `docs/skills/bgm-cli-development-conventions/SKILL.md`

## Ownership Map

Main files and directories:

- `src/cli.js`: command parsing, command handlers, init flow, ordinary CLI and TUI entrypoints
- `src/core/client.js`: Bangumi API client, OAuth client, hosted backend client
- `src/core/http.js`: request transport and error normalization
- `src/core/config.js`: config defaults, merge behavior, runtime persistence, install mode
- `src/core/output.js`: human-readable rendering and JSON output path
- `oauth-backend/src/*`: optional hosted OAuth backend
- `scripts/*`: installation helpers

Search these command handlers first before making CLI changes:

- `runConfigCommand`
- `runAuthCommand`
- `runSetupCommand`
- `runSubjectCommand`
- `runGroupCommand`
- `runUserCommand`
- `runCollectionCommand`

## Working Defaults

- treat the ordinary CLI command path as the default engineering surface
- do not start from `bgm tui` unless the task explicitly requires TUI behavior
- prefer the narrowest change in the owning module instead of adding parallel abstractions
- reuse existing client and helper functions before adding new command-local logic

## Domain Guidance

- direct access-token login is the most mature auth path
- CLI OAuth helper flows are secondary
- hosted `oauth-backend` is experimental and should not become the default path accidentally
- collection writes have Bangumi-specific constraints and read-back verification behavior; inspect the collection semantics doc before changing them

## Verification Defaults

Prefer static and non-interactive checks:

- `node --check src/cli.js`
- `node --check src/core/client.js`
- `node --check src/core/config.js`
- `node --check src/core/http.js`
- `node --check src/core/output.js`
- `node --check oauth-backend/src/app.js`
- `node src/cli.js --help`
- `node src/cli.js --json <command...>`

If a task requires live Bangumi credentials or network access, separate static verification from live verification in your report.

## When Not To Use This Skill

- when the task is just to run `bgm` commands for a user
- when the task is only about skill discovery rather than repository development
