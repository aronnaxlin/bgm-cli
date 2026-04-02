---
name: "bgm-cli-cli-operator"
description: "Use when an agent needs to operate the bgm CLI as a user-facing Bangumi tool: auth checks, profile reads, subject lookup, collection reads or writes, JSON output, and other ordinary non-TUI commands. Do not use this when editing the bgm-cli codebase itself."
---

# bgm-cli CLI Operator

This skill is for agents that need to use `bgm` as an already-available CLI tool.

It is not for developing `bgm-cli`. If the task is to change repository code, command behavior, auth implementation, output contracts, or tests, do not use this skill. Read the repository docs directly instead.

This file is intentionally stored outside `.codex/skills` so it does not auto-trigger during `bgm-cli` development work.

## Use This Skill For

- logging into Bangumi with an existing token
- checking auth state
- reading the current user or a public user profile
- searching or fetching subjects
- listing, reading, or updating collections
- producing machine-readable output with `--json`
- operating the normal CLI instead of `bgm tui`

## Do Not Use This Skill For

- editing files in this repository
- understanding code ownership or source layout
- changing API client implementation
- changing config persistence or auth internals
- changing TUI behavior
- debugging repository code paths from source

## Quick Start

1. Confirm which executable path is available.
2. Prefer ordinary CLI commands and `--json`.
3. Check auth status before write operations.
4. Prefer direct IDs for deterministic actions.
5. Use `--search ... --pick ...` only when the user does not know the exact subject ID.
6. Avoid `bgm tui` unless the user explicitly asks for the TUI.

## Executable Choice

Prefer this order:

1. `bgm` if the CLI is already installed globally
2. `./bgm` when working from this repository checkout

Use one executable consistently within the same task.

## Default Workflow

### 1. Check capability and auth

Run:

- `bgm --help`
- `bgm auth status`

If `bgm` is not installed but `./bgm` exists, switch to `./bgm`.

If the user wants writes and auth is missing, guide them toward:

- `bgm auth set-token <access_token>`
- `bgm --init`

Prefer direct access-token login over OAuth helper flows.

### 2. Prefer JSON for agent consumption

For agent-driven tasks, default to:

- `bgm --json user me`
- `bgm --json user get <username>`
- `bgm --json subject get <subject_id>`
- `bgm --json subject search "<keyword>" --type anime --limit 5`
- `bgm --json collection list ...`
- `bgm --json collection get <subject_id>`

Only use human-readable output when the user explicitly wants terminal-style output.

### 3. Resolve the target deterministically

Prefer exact IDs:

- subject: `bgm subject get <subject_id>`
- collection: `bgm collection get <subject_id>`

If the user gives a title instead of an ID:

- search first
- keep the result set small
- use `--pick` when a follow-up collection command supports it

### 4. Perform writes narrowly

Common safe write commands:

- `bgm collection collect <subject_id> collect`
- `bgm collection status <subject_id> doing`
- `bgm collection rate <subject_id> 8`
- `bgm collection comment <subject_id> "..."`

Use the narrowest command that matches the request.

## Behavioral Rules

- Prefer non-interactive commands.
- Prefer `--json` for agent reasoning and follow-up checks.
- Treat access-token auth as the stable default path.
- Do not assume repository checkout is required; this skill is about operating the CLI, not hacking on it.
- Do not route automation through `bgm tui`.
- When a write matters, verify by reading the result back if the command output is ambiguous.

## Command Coverage

Read [references/commands.md](references/commands.md) for the command groups and recommended patterns.

Read [references/community-boundaries.md](references/community-boundaries.md) before promising community-related operations beyond collections, indices, and revisions.

## Known Limits

- Private collection visibility depends on the authenticated user.
- Collection timestamps are not always reliable for “last updated” semantics.
- Search-based workflows are less deterministic than ID-based workflows.
- Some Bangumi community surfaces are not exposed as stable public CLI/API operations.

## Output Expectations

When using this CLI on behalf of another agent or user:

- say which executable was used: `bgm` or `./bgm`
- say whether auth was required
- say which commands were run
- say whether results came from JSON output or human-readable output
- mention any operations that could not be completed because of missing auth, missing installation, or unavailable public API support
