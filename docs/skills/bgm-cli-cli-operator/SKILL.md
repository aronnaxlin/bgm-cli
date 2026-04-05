---
name: "bgm-cli-cli-operator"
description: "Use when an agent needs to operate the bgm CLI as a user-facing Bangumi tool: auth checks, profile reads, subject and group lookup, collection reads or writes, group topic reads or writes, Turnstile-gated mutations, JSON output, and other ordinary non-TUI commands. Do not use this when editing the bgm-cli codebase itself."
---

# bgm-cli CLI Operator

This skill is for agents that need to use `bgm` as an already-available CLI tool.

It is not for developing `bgm-cli`. If the task is to change repository code, command behavior, auth implementation, output contracts, or tests, do not use this skill. Read the repository docs directly instead.

This skill lives under `docs/skills/` so the repository keeps a single obvious home for operator-facing skill material.

## Use This Skill For

- logging into Bangumi with an existing token
- checking saved Access Token state
- checking optional private API session state
- inspecting current config when needed for operator troubleshooting
- reading the current user or a public user profile
- searching, listing, or fetching subjects
- listing groups, reading group details, and reading group topics
- creating group topics or replies when the user provides auth and the CLI can complete Turnstile verification
- listing, reading, or updating collections
- obtaining a short-lived Turnstile token for the next supported group write flow
- producing machine-readable output with `--json`
- using setup and install-path commands when the task is about making the CLI executable available
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
3. Check Access Token state before write operations.
4. Prefer direct IDs or topic IDs for deterministic actions.
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
- `bgm auth session-status`

If `bgm` is not installed but `./bgm` exists, switch to `./bgm`.

If the user wants writes and Access Token auth is missing, guide them toward:

- `bgm auth set-token <access_token>`
- `bgm --init`

Prefer direct access-token login over OAuth helper flows.

If the user needs group writes, also explain whether they already have:

- `--turnstile-token <token>`
- or a local terminal environment where `bgm auth turnstile` or the group write command itself can complete browser verification
- or an optional `p1` session via `bgm auth session-login` when troubleshooting private API session issues

### 2. Prefer JSON for agent consumption

For agent-driven tasks, default to:

- `bgm --json user me`
- `bgm --json user get <username>`
- `bgm --json config show`
- `bgm --json auth session-status`
- `bgm --json subject get <subject_id>`
- `bgm --json subject list --type anime --sort rank --limit 10`
- `bgm --json subject search "<keyword>" --type anime --limit 5`
- `bgm --json group list --sort members --limit 10`
- `bgm --json group get <group_name>`
- `bgm --json group topics <group_name> --limit 20`
- `bgm --json group topic <topic_id>`
- `bgm --json collection list ...`
- `bgm --json collection get <subject_id>`

Only use human-readable output when the user explicitly wants terminal-style output.

### 3. Resolve the target deterministically

Prefer exact IDs:

- subject: `bgm subject get <subject_id>`
- collection: `bgm collection get <subject_id>`
- group topic: `bgm group topic <topic_id>`

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
- `bgm group create-topic <group_name> "Title" "Content" --turnstile-token <token>`
- `bgm group reply <topic_id> "Content" --turnstile-token <token>`

Use the narrowest command that matches the request.

For group writes, prefer an explicit Turnstile token when the user already has one. Otherwise let the built-in verification flow open automatically if the task environment can complete a local browser verification flow.

## Behavioral Rules

- Prefer non-interactive commands.
- Prefer `--json` for agent reasoning and follow-up checks.
- Treat access-token auth as the stable default path.
- Treat `session-login` as an optional `p1` helper, not a replacement for Access Token login.
- Do not assume repository checkout is required; this skill is about operating the CLI, not hacking on it.
- Do not route automation through `bgm tui`.
- When a write matters, verify by reading the result back if the command output is ambiguous.
- Treat group topic creation and replies as Turnstile-gated operations that may require extra user coordination.
- Use `bgm setup install-path` only when the user explicitly wants this checkout exposed as a global `bgm` executable.

## Command Coverage

Read [references/commands.md](references/commands.md) for the command groups and recommended patterns.

Read [references/community-boundaries.md](references/community-boundaries.md) before promising community-related operations beyond the documented group and collection surfaces.

## Known Limits

- Private collection visibility depends on the authenticated user.
- Collection timestamps are not always reliable for "last updated" semantics.
- Search-based workflows are less deterministic than ID-based workflows.
- Group writes require a valid Turnstile token or a local/manual Turnstile verification flow.
- A saved `p1` session does not remove the Turnstile requirement for group writes.
- Some Bangumi community surfaces are still not exposed as stable public CLI/API operations.

## Output Expectations

When using this CLI on behalf of another agent or user:

- say which executable was used: `bgm` or `./bgm`
- say whether auth was required
- say which commands were run
- say whether results came from JSON output or human-readable output
- mention any operations that could not be completed because of missing auth, missing installation, or unavailable public API support
