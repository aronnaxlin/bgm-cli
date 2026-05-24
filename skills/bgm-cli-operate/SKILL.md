---
name: "bgm-cli-operate"
description: "Use when an agent needs to get a user to a working bgm CLI and then operate it safely: detect availability, install bgm-cli if missing, set up Bangumi auth, run reads or writes, prefer JSON for automation, and troubleshoot install, auth, hosted OAuth, session, or Turnstile issues."
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
- reading user, subject, episode, group, collection, blog, index, and timeline data
- performing supported collection writes, episode-progress writes, group writes, index writes, experimental blog comment writes, and supported timeline writes
- using Bangumi emote codes like `(bgm54)` in comments, where the site renders them as emojis
- using reaction-style `like` commands with target-specific numeric sticker values
- preferring `--json` for agent consumption
- troubleshooting PATH, Node, auth, hosted OAuth, session, and Turnstile problems

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
- remember that `bgm --help` is now only a compact overview; use `bgm <group> --help` for full command details such as `bgm episode --help` or `bgm blog --help`

### 5. Verify important writes

For collection, episode-progress, group, timeline, or experimental blog-comment writes, read back the final state when the result matters.

Examples:

```bash
bgm --json collection get 348335
bgm --json episode list 348335 --type main --limit 5
bgm --json group topic 498114
```

## Operational Rules

- If installation is required and terminal access is available, perform the installation.
- If auth is required and missing, ask for the minimal missing input early, usually an Access Token.
- Treat direct Access Token login as the stable default.
- Treat `session-login` as optional helper state, not as a replacement for Access Token login.
- Treat episode progress as separate from the subject collection `ep_status` field for non-book subjects; prefer the dedicated `episode` commands.
- Treat episode writes as requiring that the parent subject is already in the user's collection.
- Do not assume the parent collection must be `doing`; Bangumi currently allows episode writes under `wish`, `collect`, `doing`, `on_hold`, and `dropped` as long as the subject is collected.
- Treat `episode watch` as a main-story helper only. For SP / OP / ED writes, use `episode status <episode_id> ...` directly.
- Treat NSFW episode listing as auth-sensitive. Without a token, Bangumi may return a misleading `404` instead of a clear auth error.
- Treat reaction-style `like` values as target-specific. Some endpoints accept only the smaller sticker subset, and subject collection reactions are narrower than topic/post reactions.
- Treat `bgm auth turnstile` as official-hosted-first and local-helper-second. Use `--manual` only when you explicitly need to force the local helper path.
- Treat group topic creation and replies as Turnstile-gated operations.
- Treat blog comment writes as experimental Turnstile-gated operations.
- Treat timeline `say` and `reply` as Turnstile-gated operations.
- Use `bgm setup update` only for managed installs created by the remote installer.
- Use `bgm setup install-path` only when the user wants the current checkout exposed as global `bgm`.
- **Agent Turnstile human-in-the-loop for posting**: The agent cannot complete Cloudflare Turnstile CAPTCHA automatically. When the user asks to create a group topic (`group create-topic`) or reply (`group reply`), and the CLI returns a Turnstile-required error, the agent must: 1) run `bgm auth turnstile` to generate the official verification URL; 2) send the URL to the user; 3) wait for the user to complete verification manually and return the token; 4) re-run the post/reply command with `--turnstile-token`. Do not rely on the terminal auto-callback succeeding, because automatic browser launch is usually unavailable in agent environments.
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
bgm --json episode list 253 --type main --limit 5
bgm --json episode list 253 --type op_ed --limit 10
bgm --json collection get 253
bgm --json group topics boring --limit 20
bgm --json blog get 371953
bgm --json index get 1
bgm --json timeline list --mode friends --limit 10
bgm --json timeline user sai --limit 10
bgm --json timeline replies 123456
bgm --json calendar
bgm --json calendar all
```

### Common writes

```bash
bgm collection status 253 doing
bgm episode watch 253 1
bgm episode status 103232 watched
bgm collection rate 253 8
bgm collection comment 253 "Backfill"
bgm group reply 498114 "Reply content" --turnstile-token YOUR_TOKEN
bgm blog reply 371953 "Test comment" --turnstile-token YOUR_TOKEN
bgm timeline say "off work" --turnstile-token YOUR_TOKEN
bgm timeline reply 123456 "seen" --turnstile-token YOUR_TOKEN
bgm index comment 1 "Nice index" --turnstile-token YOUR_TOKEN
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
- for episode operations, whether the parent subject was already collected and whether NSFW auth restrictions affected the task
- what could not be completed because of missing auth, install failure, or unsupported CLI scope
