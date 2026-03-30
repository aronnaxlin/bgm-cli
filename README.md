# bgm-cli

Bangumi CLI scaffold for:

- generating OAuth authorization URLs
- exchanging or refreshing Bangumi access tokens
- querying token status
- fetching current user info with token
- fetching public user info by username or available user id path
- searching and fetching Bangumi subjects

## Usage

Run inside this repo:

```bash
./bgm --help
./bgm --init
```

Or install/link the package command:

```bash
bgm --help
bgm --init
```

By default, command output is rendered in a human-friendly terminal format. Use `--json` only when you want the raw API-style JSON output.

## Global Command

If you want to use `bgm` globally from this checkout without installing an npm package:

- Linux / macOS:

```bash
bgm setup install-path
bgm --help
```

- Windows PowerShell:

```powershell
bgm setup install-path
bgm --help
```

You can still run the raw scripts directly if needed:

- [install-global-bgm.sh](/home/aronnax/code/bgm-cli/scripts/install-global-bgm.sh)
- [install-global-bgm.ps1](/home/aronnax/code/bgm-cli/scripts/install-global-bgm.ps1)

The repository includes both:

- [bgm](/home/aronnax/code/bgm-cli/bgm) for POSIX shells
- [bgm.cmd](/home/aronnax/code/bgm-cli/bgm.cmd) for Windows shells

## OAuth Backend

This repository now also includes a portable OAuth backend scaffold in [oauth-backend/README.md](/home/aronnax/code/bgm-cli/oauth-backend/README.md).

Status:

- Experimental only
- Not recommended for ordinary users
- Keep it for self-hosting experiments, debugging, or future Bangumi OAuth compatibility work

It is designed for:

- Vercel Functions
- Cloudflare Workers

And uses:

- Bangumi official OAuth
- Upstash Redis REST API for short-lived login sessions
- a CLI-friendly polling flow so local terminals and VPS environments can both log in without exposing `client_secret`

## First-time setup

Use the interactive initialization wizard:

```bash
./bgm --init
```

The wizard will:

- let you choose `填写用户自己的 access token (Recommended)` or `使用项目 OAuth 服务网页授权 (Experimental, Not Recommended)`
- always collect `userAgent`
- if `oauthServerBaseUrl` is configured, webpage authorization can use the hosted OAuth backend and the CLI polls for completion
- only ask for `clientId`, `clientSecret`, and `redirectUri` when webpage OAuth authorization is selected and the project does not already provide them
- save the selected config into local config
- generate the Bangumi OAuth authorization URL
- if `redirectUri` is local like `http://localhost/callback`, it can automatically listen for the OAuth callback and receive the returned `code`
- keep a manual fallback where you can paste the callback URL or only the returned `code`, which is suitable for VPS and remote terminals
- save `accessToken` and `refreshToken` when available

You can run `--init` again later to reconfigure authorization.

Recommended local setup:

```bash
./bgm --init
```

Then choose:

- `1` for `填写用户自己的 access token (Recommended)`

VPS or remote shell setup:

```bash
./bgm --init
```

Then choose:

- `1` for `填写用户自己的 access token (Recommended)`

Or directly choose:

- `2` for `使用项目 OAuth 服务网页授权 (Experimental, Not Recommended)`

Current recommendation:

- Ordinary users should use `填写用户自己的 access token`
- Treat hosted OAuth as a debugging or research path only

Note:

- `网页登录授权` means opening Bangumi's official authorization page in the browser. The Bangumi account and password are entered on Bangumi's site, not in this CLI.
- If the project provides `oauthServerBaseUrl`, that hosted backend is experimental and currently unreliable because Bangumi's authorize flow has not been consistently working in testing.
- This repository ships a committed [bangumi-project.env](/home/aronnax/code/bgm-cli/bangumi-project.env) with only public-safe defaults, so ordinary users can use the hosted backend without receiving any secret material.
- Maintainers or self-hosters can create an untracked `bangumi-development.env` with their own OAuth app credentials or alternate backend URL.
- Ordinary users should use `填写用户自己的 access token`.

## Config

Configuration is stored at:

```text
./.bgm-cli/config.json
```

You can override the config directory with `BGM_CONFIG_DIR=/your/path`.

### Config Files

This repository currently uses several config files with different purposes:

- [bangumi-project.env](/home/aronnax/code/bgm-cli/bangumi-project.env)
  Committed project defaults.
  Safe to commit.
  Use it for public-safe values such as `BGM_OAUTH_SERVER_BASE_URL`, app name, homepage, developer id, and version.
  Ordinary users can rely on this file without receiving any secret material.

- `bangumi-development.env`
  Local maintainer or self-host override file.
  Must not be committed.
  Use it for private or machine-specific overrides such as `BGM_CLIENT_ID`, `BGM_CLIENT_SECRET`, `BGM_REDIRECT_URI`, alternate backend URLs, or temporary local testing values.

- [bangumi-development.env.example](/home/aronnax/code/bgm-cli/bangumi-development.env.example)
  Template for `bangumi-development.env`.
  Safe to commit.
  Use it as a starting point when you need your own private override file.

- [config.json](/home/aronnax/code/bgm-cli/.bgm-cli/config.json)
  Runtime config generated by CLI commands such as `bgm --init`, `bgm config set`, or token save flows.
  Local only.
  Must not be committed.
  This is where the CLI persists the user's selected token and saved runtime configuration.

- [oauth-backend/.env.example](/home/aronnax/code/bgm-cli/oauth-backend/.env.example)
  Template for self-hosting the OAuth backend.
  Safe to commit.
  Use it to prepare Vercel or Cloudflare Worker backend environment variables.

- `oauth-backend/.env` and `oauth-backend/.env.local`
  Local backend validation files.
  Must not be committed.
  These are intended only for local checks such as `npm run check:env`.

- `oauth-backend/.vercel/`
  Local Vercel project metadata pulled by the Vercel CLI.
  Must not be committed.
  This is only for linking your local checkout to a Vercel project.

The committed project bootstrap format is `./bangumi-project.env`:

```text
BGM_APP_NAME=bgm-cli
BGM_OAUTH_SERVER_BASE_URL=https://your-oauth-backend.example.com
BGM_HOMEPAGE_LINK=https://github.com/yourname/bgm-cli
BGM_DEVELOPER_ID=yourname
BGM_APP_VERSION=0.1.0
```

For private maintainer or self-hosted overrides, use `./bangumi-development.env`:

```text
BGM_CLIENT_ID=your_bangumi_app_id
BGM_CLIENT_SECRET=your_bangumi_app_secret
BGM_REDIRECT_URI=https://your-oauth-backend.example.com/api/oauth/callback
BGM_OAUTH_SERVER_BASE_URL=https://your-oauth-backend.example.com
```

You can inspect or update it:

```bash
./bgm config show
./bgm config set clientId your_app_id
./bgm config set clientSecret your_app_secret
./bgm config set redirectUri https://example.com/callback
./bgm config set userAgent yourname/bgm-cli/0.1.0
```

Config precedence is:

- process environment
- local config file under `./.bgm-cli/config.json`
- untracked `./bangumi-development.env`
- committed `./bangumi-project.env`

In practice:

- `bangumi-project.env` provides repository defaults
- `bangumi-development.env` overrides them for maintainers or self-hosters
- `./.bgm-cli/config.json` stores user choices made at runtime
- exported environment variables override everything else

Environment variables override config:

- `BGM_ACCESS_TOKEN`
- `BGM_REFRESH_TOKEN`
- `BGM_CLIENT_ID`
- `BGM_CLIENT_SECRET`
- `BGM_REDIRECT_URI`
- `BGM_OAUTH_SERVER_BASE_URL`
- `BGM_USER_AGENT`

## Auth

Generate authorization URL:

```bash
./bgm auth login-url --state random-state
```

Exchange authorization `code` for token and persist it:

```bash
./bgm auth token --code YOUR_CODE --save
```

Refresh access token:

```bash
./bgm auth refresh --save
```

Set an existing developer token directly:

```bash
./bgm auth set-token YOUR_ACCESS_TOKEN
```

Inspect current token:

```bash
./bgm auth status
```

## Users

Current authorized user:

```bash
./bgm user me
```

Public user by username. Numeric `uid` only works for accounts that still use the initial uid-based username; after a user sets a username, the numeric path no longer works in `/v0/users/{username}`:

```bash
./bgm user get sai
./bgm user get 123456
```

## Subjects

Fetch a subject:

```bash
./bgm subject get 12
```

Browse subjects:

```bash
./bgm subject list --type anime --sort rank --limit 10
```

Search subjects:

```bash
./bgm subject search "攻壳机动队"
./bgm subject search "高达" --type anime --sort rank --limit 5 --tag 机战 --tag 科幻
```

Raw JSON output:

```bash
./bgm --json user me
```

## Notes

- OAuth endpoints use `https://bgm.tv`.
- API endpoints use `https://api.bgm.tv/v0`.
- Bangumi recommends setting a custom `User-Agent` containing your developer id and app name.
