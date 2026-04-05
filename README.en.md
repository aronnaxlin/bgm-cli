# bgm-cli

[简体中文](./README.md) | [繁體中文（台灣）](./README.zh-TW.md) | [English](./README.en.md)

## Skill Usage

- If you are a user and want an agent to operate `bgm-cli` for you, start with [`SKILLS.md`](./SKILLS.md)
- If you are developing this repository and want an agent to help edit it, start with [`SKILLS.md`](./SKILLS.md) and [`docs/skills/README.md`](./docs/skills/README.md)
- `docs/skills/bgm-cli-cli-operator/SKILL.md` is for operating the CLI
- `docs/skills/bgm-cli-development-onboarding/SKILL.md` is for fast repository onboarding
- `docs/skills/bgm-cli-development-conventions/SKILL.md` is for development conventions and change boundaries

`bgm-cli` is a command-line tool for Bangumi.

You can use it from a terminal to handle common Bangumi workflows, including:

- signing in and checking auth status
- reading the current account and public user profiles
- getting subjects by id, listing subjects, and searching subjects
- listing, reading, and updating collections
- browsing groups, topics, and members
- creating group topics and replying to group topics
- switching between normal terminal output and machine-readable `--json`

The project is built as a plain Node.js CLI. It prints human-readable output by default and also supports machine-friendly JSON output through `--json`.

## Recommended Path

- For ordinary users, Access Token is the recommended default
- For automation and scripting, prefer standard CLI commands with `--json`
- Use `bgm tui` only when you want an interactive terminal workflow
- The `next.bgm.tv` private session is only an auxiliary option and does not replace Access Token
- Turnstile is only a one-off verification step for sensitive write actions such as group posting
- OAuth-related flows are currently experimental and should not be treated as the default path
- The bundled `oauth-backend` is only for self-hosting experiments and OAuth debugging

## What You Can Do

- Interactive first-run setup with `bgm --init`
- Direct access token support
- Bangumi OAuth URL generation, authorization-code exchange, and token refresh
- Current-user and public-user lookup
- Subject get, list, and search commands
- Group list, group detail, topic, and member commands
- Group topic creation and replies with Turnstile-gated write flows
- Collection list, get, collect, comment, rate, and status commands
- Human-readable output and machine-friendly `--json`
- Optional hosted OAuth backend scaffold for self-hosting experiments

## Requirements

- Node.js `>= 20`

## Installation

### Remote one-line install

macOS / Linux:

```bash
curl -fsSL https://raw.githubusercontent.com/aronnaxlin/bgm-cli/main/scripts/install-remote.sh | sh
```

Windows PowerShell:

```powershell
irm https://raw.githubusercontent.com/aronnaxlin/bgm-cli/main/scripts/install-remote.ps1 | iex
```

This command does not require `git clone`. It downloads the `main` branch into a local user directory and then runs the normal global install flow automatically. The installer itself is a `sh` script, so `| sh` also works fine in zsh-based environments.

### Run from the repository

```bash
git clone <your-fork-or-repo-url>
cd bgm-cli
./bgm --help
```

### One-click install

macOS / Linux:

```bash
./install.sh
```

Windows PowerShell:

```powershell
./install.ps1
```

These scripts reuse the repository's existing global install flow, add this checkout to PATH, and enable global config mode.

### Expose `bgm` globally from this checkout

```bash
bgm setup install-path
bgm --help
```

Repository entrypoints:

- [`bgm`](./bgm) for POSIX shells
- [`bgm.cmd`](./bgm.cmd) for Windows shells
- [`install.sh`](./install.sh) for one-click install on macOS / Linux
- [`install.ps1`](./install.ps1) for one-click install on Windows PowerShell

Installer scripts:

- [`scripts/install-global-bgm.sh`](./scripts/install-global-bgm.sh)
- [`scripts/install-global-bgm.ps1`](./scripts/install-global-bgm.ps1)
- [`scripts/install-remote.sh`](./scripts/install-remote.sh)
- [`scripts/install-remote.ps1`](./scripts/install-remote.ps1)

## Quick Start

### 1. Check the help output after installation

```bash
bgm --help
```

### 2. Set up authentication first

```bash
bgm --init
```

For most users, the recommended path is to paste an existing Bangumi access token.

If you already have a token, you can save it directly:

```bash
bgm auth set-token YOUR_ACCESS_TOKEN
bgm auth status
```

### 3. Verify the current account

```bash
bgm user me
```

### 4. Search and read subjects

```bash
bgm subject search "Heike Monogatari" --type anime --limit 5
bgm subject get 348335
```

### 5. Read or update a collection entry

```bash
bgm collection get 348335
bgm collection collect 348335 collect
bgm collection comment 348335 "Backfill"
bgm collection rate 348335 8
bgm collection status 348335 doing
```

### 6. Browse groups or topics

```bash
bgm group list --sort members --limit 10
bgm group get boring
bgm group topics boring --limit 20
bgm group topic 498114
```

### 7. Use JSON for scripts and tooling

```bash
bgm --json user me
bgm --json subject search "Gundam" --type anime --limit 5
bgm --json collection get 348335
```

## Command Overview

### Command Table

| Group | Command | Description |
| --- | --- | --- |
| Global | `bgm --help` | Show help text |
| Global | `bgm --json <command...>` | Print any supported command result as JSON |
| Global | `bgm --init` | Start the interactive setup wizard |
| Global | `bgm tui` | Open the interactive TUI |
| Setup | `bgm setup install-path` | Add the current checkout to PATH and enable global config mode |
| Config | `bgm config show` | Show the effective config |
| Config | `bgm config set <key> <value>` | Save one config value |
| Config | `bgm config unset <key>` | Remove one config value |
| Auth | `bgm auth login-url [--client-id xxx] [--redirect-uri xxx] [--state xxx]` | Generate a Bangumi OAuth authorization URL |
| Auth | `bgm auth token --code <code> [--save]` | Exchange an authorization code for access and refresh tokens |
| Auth | `bgm auth refresh [--save]` | Refresh the saved access token |
| Auth | `bgm auth turnstile [--manual] [--listen-host <host>] [--port n] [--public-origin <url>] [--timeout-seconds <n>]` | Open a local helper page and acquire one short-lived Turnstile token for the next write action |
| Auth | `bgm auth set-token <access_token>` | Save an existing access token directly |
| Auth | `bgm auth session-login [--manual]` | Open the official private API login page and save an auxiliary session |
| Auth | `bgm auth set-session <chiiNextSessionID|cookie_string>` | Save a private API session manually |
| Auth | `bgm auth session-status` | Check whether an auxiliary private API session is saved |
| Auth | `bgm auth status` | Check the current Access Token state |
| Users | `bgm user me` | Fetch the current authenticated user |
| Users | `bgm user get <username_or_uid>` | Fetch one public user profile |
| Subjects | `bgm subject get <subject_id>` | Fetch one subject by id |
| Subjects | `bgm subject list --type <book\|anime\|music\|game\|real> [--sort date\|rank] [--year yyyy] [--month mm] [--limit n]` | Browse subjects by type and filters |
| Subjects | `bgm subject search <keyword> [--type ...] [--sort match\|heat\|rank\|score] [--tag xxx] [--limit n]` | Search subjects |
| Groups | `bgm group list [--mode <all\|joined\|managed>] [--sort <created\|updated\|posts\|topics\|members>] [--limit n] [--offset n]` | List groups |
| Groups | `bgm group get <group_name>` | Fetch one group by slug |
| Groups | `bgm group topics <group_name> [--limit n] [--offset n]` | List topics in one group |
| Groups | `bgm group topic <topic_id> [--reply-limit n]` | Fetch one group topic detail with body and reply excerpts |
| Groups | `bgm group create-topic <group_name> <title> <content> [--turnstile-token <token>] [--manual]` | Create a new topic; if no token is provided, the CLI will open a local helper page with step-by-step guidance |
| Groups | `bgm group reply <topic_id> <content> [--reply-to <reply_id>] [--turnstile-token <token>] [--manual]` | Reply to one topic; if no token is provided, the CLI will open a local helper page with step-by-step guidance |
| Groups | `bgm group members <group_name> [--role <visitor\|guest\|member\|creator\|moderator\|blocked>] [--limit n] [--offset n]` | List members of one group |
| Groups | `bgm group recent-topics [--mode <all\|joined\|created\|replied>] [--limit n] [--offset n]` | List recent group topics |
| Groups | `bgm group latest-replies [--mode <all\|joined\|created\|replied>] [--limit n] [--scan n]` | List recently bumped group topics with replies |
| Groups | `bgm group hot [--window <day\|week\|month>] [--mode <all\|joined\|created\|replied>] [--limit n] [--scan n]` | Rank the hottest groups from recent activity |
| Groups | `bgm group hot-topics [--window <day\|week\|month>] [--mode <all\|joined\|created\|replied>] [--limit n] [--scan n]` | Rank the hottest group topics from recent activity |
| Collections | `bgm collection list [--user <username>] [--status <wish\|collect\|doing\|on_hold\|dropped>] [--type <book\|anime\|music\|game\|real>] [--sort <updated\|name\|rank\|community_score\|user_score\|date>] [--order <asc\|desc>] [--limit n]` | List one user's collections |
| Collections | `bgm collection get <subject_id>` | Show the current user's collection detail for one subject |
| Collections | `bgm collection get --search <keyword> [--pick n]` | Search first, then show the current user's collection detail |
| Collections | `bgm collection collect <subject_id> [<wish\|collect\|doing\|on_hold\|dropped>]` | Create or update a collection, with optional positional status |
| Collections | `bgm collection collect --search <keyword> [--status <wish\|collect\|doing\|on_hold\|dropped>] [--pick n]` | Search first, then create or update a collection |
| Collections | `bgm collection comment <subject_id> <comment>` | Update a collection comment |
| Collections | `bgm collection comment --search <keyword> <comment> [--pick n]` | Search first, then update a collection comment |
| Collections | `bgm collection rate <subject_id> <0-10>` | Update a collection rating, where `0` clears the rating |
| Collections | `bgm collection rate --search <keyword> <0-10> [--pick n]` | Search first, then update a collection rating |
| Collections | `bgm collection status <subject_id> <wish\|collect\|doing\|on_hold\|dropped>` | Update a collection status |
| Collections | `bgm collection status --search <keyword> <wish\|collect\|doing\|on_hold\|dropped> [--pick n]` | Search first, then update a collection status |

### Global

```bash
bgm --help
bgm --json <command...>
bgm --init
bgm tui
```

### Config

```bash
bgm config show
bgm config set userAgent yourname/bgm-cli/0.1.0
bgm config set timezone Asia/Tokyo
bgm config unset userAgent
```

### Auth

```bash
bgm auth login-url --state random-state
bgm auth token --code YOUR_CODE --save
bgm auth refresh --save
bgm auth turnstile --manual --port 8765
bgm auth set-token YOUR_ACCESS_TOKEN
bgm auth session-login
bgm auth session-status
bgm auth status
```

For remote or VPS usage, fix the port and open the helper page manually through SSH tunneling, for example `ssh -L 8765:127.0.0.1:8765 your-server` and then `bgm auth turnstile --manual --port 8765`.

Notes:

- Access Token is the recommended and most stable default path
- `bgm auth status` checks the saved Access Token status
- `bgm auth session-login` / `bgm auth session-status` are only optional helpers for `next.bgm.tv/p1` session usage
- That private session does not replace Access Token and does not remove the need for Turnstile on group writes
- `bgm auth turnstile` opens a local helper page with a next.bgm.tv jump, a one-click console script copy action, and token return guidance
- The returned `turnstileToken` is short-lived and intended for the next write operation only

### Users

```bash
bgm user me
bgm user get sai
bgm user get 123456
```

Note: numeric `uid` paths only work for accounts that still use the original uid-based username. Once a user has set a custom username, use that username in `/v0/users/{username}`.

### Subjects

```bash
bgm subject get 12
bgm subject list --type anime --sort rank --limit 10
bgm subject search "Ghost in the Shell"
bgm subject search "Gundam" --type anime --sort rank --limit 5 --tag mecha --tag sci-fi
```

### Groups

```bash
bgm group list --sort members --limit 10
bgm group get boring
bgm group topics boring --limit 20
bgm group topic 498114
bgm group create-topic boring "Title" "Content"
bgm group members boring --role member --limit 20
bgm group recent-topics --mode all --limit 10
bgm group latest-replies --limit 10
bgm group hot --window day --limit 10
bgm group hot-topics --window week --limit 10
```

Write operations support either passing `--turnstile-token` directly or letting the CLI open a local helper page automatically. The helper page provides a next.bgm.tv jump, a one-click script copy action, and a manual paste fallback. Use `--manual` for remote environments.

### Collections

List collections:

```bash
bgm collection list --status doing --type anime --sort updated
```

Operate by subject id:

```bash
bgm collection get 348335
bgm collection collect 348335 collect
bgm collection comment 348335 "Backfill"
bgm collection rate 348335 7
bgm collection status 348335 doing
```

Search first, then select a target:

```bash
bgm collection get --search "Heike Monogatari" --pick 1
bgm collection status --search "Gundam" doing --pick 1
```

In an interactive terminal, when `--search` returns multiple subjects and `--pick` is omitted, the CLI will prompt for a selection.

### JSON output

```bash
bgm --json user me
bgm --json subject get 348335
```

## Collection Command Semantics

Some Bangumi behaviors are enforced server-side and are reflected by this CLI:

- rating is not accepted while a collection is in `wish` state
- `rate 0` clears the rating
- `collection collect <subject_id> collect` is supported as a shorthand for setting collection status without requiring `--status`
- collection write commands validate the persisted result by reading the collection back, instead of assuming success from the write request alone

Subject uncollect is intentionally not exposed at the moment because Bangumi's public v0 subject collection documentation does not provide a confirmed delete path for this operation.

## Authentication

### Recommended: access token

The most reliable setup is:

1. sign in to Bangumi in a browser
2. open `https://next.bgm.tv/demo/access-token`
3. copy the token
4. run `bgm --init` and choose the access-token flow

Or save a token directly:

```bash
bgm auth set-token YOUR_ACCESS_TOKEN
```

### Browser OAuth

The CLI also supports Bangumi OAuth helper commands:

- authorization URL generation
- authorization-code exchange
- token refresh

If a local redirect URI is configured, the CLI can listen for the callback automatically. Otherwise it supports manual callback URL / code pasting.

This path is still experimental and is not the recommended default for ordinary users.

### Hosted OAuth backend

This repository includes an optional hosted OAuth backend scaffold in [`oauth-backend/`](./oauth-backend).

This backend is intended for:

- self-hosting experiments
- debugging OAuth flows
- future work on more portable browser-based authorization

It is not the recommended authentication method for ordinary users and should not replace Access Token as the default path.

See [`oauth-backend/README.md`](./oauth-backend/README.md) for backend deployment details.

## Configuration

The project now uses a simpler configuration model with two runtime locations and one development override file.

### Runtime config location

When the global install script has been executed, `bgm-cli` treats the installation as global and stores runtime config in the user config directory:

```text
~/.config/bgm-cli/config.json
```

On Windows, the equivalent user config location is under `%APPDATA%\bgm-cli\config.json`.

When the global install script has not been executed, the CLI uses the project-local runtime config file:

```text
./.bgm-cli/config.json
```

The global install flow also writes a local marker file under `./.bgm-cli/.global-install-enabled` for this checkout so the CLI can consistently decide whether this repository is operating in project-local mode or global mode.

### Development overrides

Development-only overrides live in:

```text
./bgm-dev.env
```

Use it for:

- local OAuth app credentials
- redirect URI overrides
- temporary backend overrides
- local User-Agent or app metadata overrides during development

Start from:

- [`bgm-dev.env.example`](./bgm-dev.env.example)

### Config sources

At runtime, the effective configuration is merged in this order:

1. built-in project defaults
2. `bgm-dev.env`
3. active runtime `config.json`
4. environment variables

In practice:

- built-in defaults cover app metadata and the default hosted OAuth backend URL
- `bgm-dev.env` is for development-only overrides
- the active `config.json` stores values written by CLI commands such as `bgm --init` or `bgm auth set-token`
- environment variables remain the highest-precedence override layer

### Important files

- `./.bgm-cli/config.json`
  Project-local runtime config, used when the CLI is not in global-install mode.

- `~/.config/bgm-cli/config.json`
  User-level runtime config, used after global install mode is enabled.

- [`bgm-dev.env.example`](./bgm-dev.env.example)
  Template for local development overrides.

- `./bgm-dev.env`
  Untracked development-only overrides.

- [`oauth-backend/.env.example`](./oauth-backend/.env.example)
  Template for the optional hosted OAuth backend.

### Supported environment variables

- `BGM_ACCESS_TOKEN`
- `BGM_REFRESH_TOKEN`
- `BGM_CLIENT_ID`
- `BGM_CLIENT_SECRET`
- `BGM_REDIRECT_URI`
- `BGM_OAUTH_SERVER_BASE_URL`
- `BGM_USER_AGENT`

## Output Model

By default, commands render human-readable terminal output.

Use `--json` when:

- integrating with scripts
- inspecting raw response payloads
- piping output to other tools

Example:

```bash
bgm --json collection get 348335
```

## Development

If you only want to use the CLI, the earlier sections should be enough.

If you want to develop this repository itself, start here.

### Run locally

```bash
node src/cli.js --help
node src/cli.js user me
```

### Useful commands

```bash
node src/cli.js --help
node src/cli.js collection get 348335
node src/cli.js group list --limit 5
node src/cli.js --json user me
node --check src/cli.js
node --check src/core/client.js
node --check src/core/config.js
node --check src/core/http.js
node --check src/core/output.js
```

### Development entrypoints

- Start with [`SKILLS.md`](./SKILLS.md)
- For repository onboarding, read [`docs/skills/bgm-cli-development-onboarding/SKILL.md`](./docs/skills/bgm-cli-development-onboarding/SKILL.md)
- For repository conventions, read [`docs/skills/bgm-cli-development-conventions/SKILL.md`](./docs/skills/bgm-cli-development-conventions/SKILL.md)
- If the task is to operate the CLI instead of changing code, read [`docs/skills/bgm-cli-cli-operator/SKILL.md`](./docs/skills/bgm-cli-cli-operator/SKILL.md)

### Project structure

```text
src/
  cli.js           Main CLI entrypoint and command routing
  core/
    client.js      Bangumi API and OAuth client helpers
    config.js      Config loading and persistence
    http.js        HTTP wrapper and error normalization
    output.js      Human-readable and JSON output formatting
oauth-backend/
  ...              Optional hosted OAuth backend scaffold
bangumi-api/
  ...              Local Bangumi API references used during development
```

## Notes

- OAuth endpoints use `https://bgm.tv`
- API endpoints use `https://api.bgm.tv/v0`
- Bangumi recommends a custom `User-Agent` that identifies the developer and app

## License

This repository is licensed under `AGPL-3.0-only`. See [LICENSE](./LICENSE).

## Additional Docs

- [`docs/README.md`](./docs/README.md)
- [`SKILLS.md`](./SKILLS.md)
- [`docs/skills/README.md`](./docs/skills/README.md)
- [`docs/skills/bgm-cli-development-onboarding/SKILL.md`](./docs/skills/bgm-cli-development-onboarding/SKILL.md)
- [`docs/skills/bgm-cli-development-conventions/SKILL.md`](./docs/skills/bgm-cli-development-conventions/SKILL.md)
