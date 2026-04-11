---
name: "bgm-cli-operate"
description: "Use when an agent needs to get a user to a working bgm CLI and then operate it safely: detect availability, install bgm-cli if missing, set up Bangumi auth, run reads or writes, prefer JSON for automation, and troubleshoot install, auth, or Turnstile issues."
---

# bgm-cli Operate

This is the main published end-user skill for `bgm-cli`.

Use it when the task is to operate `bgm` for a user, including first-time installation and setup.

If the CLI is missing and terminal access is available, install it instead of only describing the steps.

## Use This Skill For

- detecting whether `bgm` or `./bgm` is available
- installing `bgm-cli` on macOS, Linux, or Windows when needed
- choosing between remote managed install and repository-local install-path setup
- setting or checking Bangumi auth
- reading user, subject, group, collection, and new blog data
- performing supported collection writes and group writes, plus experimental blog comment writes
- preferring `--json` for agent consumption
- troubleshooting PATH, Node, auth, session, and Turnstile problems

## Do Not Use This Skill For

- editing the `bgm-cli` repository itself
- changing command behavior or output contracts
- debugging source-level implementation details
- promising Bangumi site features that the CLI does not expose

## Primary Contract

An agent using only this skill should be able to:

1. detect the usable executable
2. install `bgm-cli` if it is missing
3. bring the user to a usable auth state
4. run the requested task with the narrowest correct command
5. verify important writes and report unsupported scope plainly

## Default Workflow

### 1. Detect the executable first

Try in this order:

1. `bgm --help`
2. `./bgm --help` when operating from a repository checkout

Once one works, use that executable consistently.

Preferred order:

1. `bgm`
2. `./bgm`

### 2. Install if missing

If neither executable works, install the CLI.

Preferred install choice:

1. remote managed install when the user just wants a working `bgm`
2. repository-local install-path setup when the user is already in a cloned checkout and wants that checkout exposed as `bgm`
3. direct `./bgm` use when the user only needs commands inside the current checkout

Use `references/install-and-auth.md`.

### 3. Establish auth before real work

Preferred auth path:

1. `bgm auth set-token <access_token>`
2. `bgm --init` when the user wants guided interactive setup
3. OAuth helper flows only when the user explicitly wants them

Verify auth before important writes:

```bash
bgm auth status
bgm user me
```

If private `p1` session state matters, also check:

```bash
bgm auth session-status
```

### 4. Prefer deterministic commands

- prefer ordinary CLI commands over `bgm tui`
- prefer `--json` for agent reasoning and follow-up checks
- prefer exact subject IDs and topic IDs over search-based resolution
- keep search result sets small when the user does not know an exact ID

### 5. Verify important writes

For collection, group, or experimental blog-comment writes, read back the final state when the result matters.

Examples:

```bash
bgm --json collection get 348335
bgm --json group topic 498114
```

## Operational Rules

- If installation is required and terminal access is available, perform the installation.
- If auth is required and missing, ask for the minimal missing input early, usually an Access Token.
- Treat direct Access Token login as the stable default.
- Treat `session-login` as optional helper state, not as a replacement for Access Token login.
- Treat group topic creation and replies as Turnstile-gated operations.
- Treat blog comment writes as experimental Turnstile-gated operations.
- Use `bgm setup update` only for managed installs created by the remote installer.
- Use `bgm setup install-path` only when the user wants the current checkout exposed as global `bgm`.
- Do not infer unsupported community actions from the Bangumi website alone.

## Fast Start Commands

### Capability and auth

```bash
bgm --help
bgm auth status
```

### Minimum ready state from zero

```bash
bgm auth set-token YOUR_ACCESS_TOKEN
bgm auth status
bgm user me
```

### Common reads

```bash
bgm --json user me
bgm --json subject search "Gundam" --type anime --limit 5
bgm --json subject get 253
bgm --json collection get 253
bgm --json group topics boring --limit 20
bgm --json blog get 371953
```

### Common writes

```bash
bgm collection status 253 doing
bgm collection rate 253 8
bgm collection comment 253 "Backfill"
bgm group reply 498114 "Reply content" --turnstile-token YOUR_TOKEN
bgm blog reply 371953 "Test comment" --turnstile-token YOUR_TOKEN
```

## Command Coverage

Read these references before guessing:

- `references/install-and-auth.md`
- `references/commands.md`
- `references/troubleshooting.md`
- `references/community-boundaries.md`

## Output Expectations

When reporting back to a user or another agent, always say:

- which executable was used: `bgm` or `./bgm`
- whether installation was needed
- whether auth was already present or had to be set up
- which commands were run
- whether results came from JSON output or human-readable output
- what could not be completed because of missing auth, install failure, or unsupported CLI scope
