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

## First-time setup

Use the interactive initialization wizard:

```bash
./bgm --init
```

The wizard will:

- let you choose `使用项目内置开发者应用网页授权 (Recommended)` or `填写用户自己的 access token`
- always collect `userAgent`
- if the project ships `clientId`, `clientSecret`, and `redirectUri`, webpage OAuth authorization will use those bundled developer credentials directly
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

- `1` for `使用项目内置开发者应用网页授权 (Recommended)`
- `1` again for `自动接收回调参数 (Recommended)` if you are on a local machine and your redirect URI points to `localhost` or `127.0.0.1`

VPS or remote shell setup:

```bash
./bgm --init
```

Then choose:

- `1` for `使用项目内置开发者应用网页授权 (Recommended)`
- `2` for `手动粘贴回调 URL / code`

Or directly choose:

- `2` for `填写用户自己的 access token`

Note:

- `网页登录授权` means opening Bangumi's official authorization page in the browser. The Bangumi account and password are entered on Bangumi's site, not in this CLI.
- If the project provides a local `bangumi-development` file with OAuth app credentials, users can authorize with the project's developer app without applying for their own app.
- Users can always skip OAuth and choose `填写用户自己的 access token`.

## Config

Configuration is stored at:

```text
./.bgm-cli/config.json
```

You can override the config directory with `BGM_CONFIG_DIR=/your/path`.

The CLI also supports project-local bootstrap values from `./bangumi-development`, for example:

```text
App-Name: bgm-cli
Client-Id: your_bangumi_app_id
Client-Secret: your_bangumi_app_secret
Redirect-Uri: http://localhost/callback
Access-Token: your_token_here
```

You can inspect or update it:

```bash
./bgm config show
./bgm config set clientId your_app_id
./bgm config set clientSecret your_app_secret
./bgm config set redirectUri https://example.com/callback
./bgm config set userAgent yourname/bgm-cli/0.1.0
```

Environment variables override config:

- `BGM_ACCESS_TOKEN`
- `BGM_REFRESH_TOKEN`
- `BGM_CLIENT_ID`
- `BGM_CLIENT_SECRET`
- `BGM_REDIRECT_URI`
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
