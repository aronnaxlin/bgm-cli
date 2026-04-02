# bgm-cli

[简体中文](./README.md) | [繁體中文（台灣）](./README.zh-TW.md) | [English](./README.en.md)

Read this first if an agent is touching the repo:

- [`./SKILLS.md`](./SKILLS.md) is now an agent skill index, not an auto-trigger development skill entrypoint for this repository
- If you want an agent to use `bgm-cli` as a Bangumi operation tool, have it read [`SKILLS.md`](./SKILLS.md) first
- If you want an agent to develop this repository itself, have it read `README.md` and the docs under `docs/ai/bgm-cli-non-tui/` directly instead of treating the operator skill as a development skill
- The project narrative is not just "a Bangumi CLI", but "a toolchain that lets a user or agent operate Bangumi workflows from a normal CLI surface"

`bgm-cli` is the human-facing entrypoint for that capability, and the operating surface an agent can reliably use. It focuses on:

- authenticating with Bangumi
- inspecting the current account and public user profiles
- searching and reading subject data
- listing collections
- updating collection status, comments, and ratings from the terminal

The project is built as a plain Node.js CLI with human-readable terminal output by default and JSON output available via `--json`. It is also documented so agents can either operate the CLI deliberately or develop the repository without mixing those two roles.

## What You Can Do

- Interactive first-run setup with `bgm --init`
- Direct access token support
- Bangumi OAuth URL generation and token exchange
- Current-user and public-user lookup
- Subject get, list, and search commands
- Collection list, get, collect, comment, rate, and status commands
- Human-readable output and machine-friendly `--json`
- Optional hosted OAuth backend scaffold for self-hosting experiments

## Recommended Usage

- Use direct access-token login if you already have a Bangumi token
- Use standard CLI commands for reliable automation and scripting
- Use `bgm tui` when you want an interactive terminal workflow
- Use the bundled OAuth backend only if you need to experiment with self-hosted OAuth helpers

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

These commands do not require `git clone`. They download the `main` branch into a local user directory and then run the normal global install flow automatically.

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

### 1. Initialize the CLI

```bash
./bgm --init
```

For most users, the recommended path is to paste an existing Bangumi access token.

### 2. Verify the current account

```bash
./bgm user me
```

### 3. Search for a subject

```bash
./bgm subject search "Heike Monogatari" --type anime --limit 5
```

### 4. Read or update a collection entry

```bash
./bgm collection get 348335
./bgm collection collect 348335 collect
./bgm collection comment 348335 "Backfill"
./bgm collection rate 348335 8
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
| Auth | `bgm auth set-token <access_token>` | Save an existing access token directly |
| Auth | `bgm auth status` | Check the current token state |
| Users | `bgm user me` | Fetch the current authenticated user |
| Users | `bgm user get <username_or_uid>` | Fetch one public user profile |
| Subjects | `bgm subject get <subject_id>` | Fetch one subject by id |
| Subjects | `bgm subject list --type <book\|anime\|music\|game\|real> [--sort date\|rank] [--year yyyy] [--month mm] [--limit n]` | Browse subjects by type and filters |
| Subjects | `bgm subject search <keyword> [--type ...] [--sort match\|heat\|rank\|score] [--tag xxx] [--limit n]` | Search subjects |
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
bgm config unset userAgent
```

### Auth

```bash
bgm auth login-url --state random-state
bgm auth token --code YOUR_CODE --save
bgm auth refresh --save
bgm auth set-token YOUR_ACCESS_TOKEN
bgm auth status
```

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

### Hosted OAuth backend

This repository includes an optional hosted OAuth backend scaffold in [`oauth-backend/`](./oauth-backend).

This backend is intended for:

- self-hosting experiments
- debugging OAuth flows
- future work on more portable browser-based authorization

It is not the recommended authentication method for ordinary users.

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

### Run locally

```bash
node src/cli.js --help
node src/cli.js user me
```

### Useful commands

```bash
node src/cli.js --help
node src/cli.js collection get 348335
node --check src/cli.js
node --check src/core/output.js
```

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
- [`docs/ai/bgm-cli-non-tui/README.md`](./docs/ai/bgm-cli-non-tui/README.md)
- [`docs/ai/bgm-cli-non-tui/references/source-map.md`](./docs/ai/bgm-cli-non-tui/references/source-map.md)
- [`docs/ai/bgm-cli-non-tui/references/config-and-auth.md`](./docs/ai/bgm-cli-non-tui/references/config-and-auth.md)
- [`docs/ai/bgm-cli-non-tui/references/collection-semantics.md`](./docs/ai/bgm-cli-non-tui/references/collection-semantics.md)
