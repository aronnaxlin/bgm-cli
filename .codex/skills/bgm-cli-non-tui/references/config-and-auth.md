# Config And Auth

## Config model

The effective config is merged in this order:

1. built-in defaults
2. `bgm-dev.env`
3. active runtime `config.json`
4. environment variables

Higher layers win.

## Runtime config locations

Project-local mode:

- `./.bgm-cli/config.json`

Global-install mode:

- `~/.config/bgm-cli/config.json` on typical Unix-like systems
- `%APPDATA%\\bgm-cli\\config.json` on Windows

Global mode is detected by the marker file:

- `./.bgm-cli/.global-install-enabled`

There is also a legacy marker under the user config directory that still enables global mode.

## Important config keys

- `accessToken`
- `refreshToken`
- `clientId`
- `clientSecret`
- `redirectUri`
- `oauthServerBaseUrl`
- `userAgent`
- `appName`
- `appVersion`
- `developerId`
- `homepageLink`

`userAgent` is normalized from config metadata if not provided explicitly.

## Recommended auth path

The repository treats direct access-token login as the recommended path, and for practical use it is the most mature auth path in this codebase:

1. user obtains an access token from Bangumi in the browser
2. CLI stores it with `bgm --init` or `bgm auth set-token`

Use this as the default assumption for agents.

## Auth maturity guidance

Auth options are not equally mature:

- direct access-token login: mature, preferred, default
- CLI OAuth helper flows: supported but less mature
- hosted `oauth-backend`: experimental, not a default end-user path

When an auth-related task is ambiguous, bias toward preserving or improving the token path rather than expanding OAuth complexity.

## CLI OAuth helpers

`src/core/client.js` provides `BangumiOAuthClient` for:

- authorization URL generation
- authorization code exchange
- refresh token exchange
- token status lookup

These commands live in `runAuthCommand` inside `src/cli.js`.

Treat these helpers as secondary to token auth. They are valid engineering surfaces, but not the primary user success path.

## Hosted OAuth backend

The optional backend is experimental and exists for self-hosting experiments.

It should be discussed or modified only when the task is specifically about:

- self-hosting
- OAuth architecture
- browser callback debugging
- session polling and claiming

Session flow:

1. CLI calls `POST /api/oauth/session`
2. backend creates a session and returns `authorize_url`
3. user completes Bangumi auth in the browser
4. Bangumi redirects to `/api/oauth/callback`
5. backend exchanges code and stores the token payload
6. CLI polls `GET /api/oauth/session/:id`
7. CLI claims token via `POST /api/oauth/session/:id/claim`

## Required backend env

- `BGM_CLIENT_ID`
- `BGM_CLIENT_SECRET`
- `BGM_REDIRECT_URI`
- `BGM_OAUTH_SERVER_BASE_URL`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `SESSION_ENCRYPTION_SECRET`

Optional:

- `BGM_SESSION_TTL_SECONDS`

## Auth-related implementation cautions

- CLI OAuth calls use `https://bgm.tv`.
- Backend OAuth calls use `https://bangumi.tv`.
- `OAuthBackendClient.getBaseUrl()` throws if `oauthServerBaseUrl` is missing.
- `auth token` and `auth refresh` save tokens by default unless `--save` is explicitly disabled.
- `--init` is interactive and must not be treated as a script-friendly path.
- `--json` does not apply to `--init` or `bgm tui`.

## Verification suggestions

Static:

- `node --check src/core/config.js`
- `node --check src/core/client.js`
- `node --check oauth-backend/src/app.js`

Behavioral without TUI:

- `node src/cli.js auth login-url --state test`
- `node src/cli.js config show`
- `node src/cli.js --json auth status`
