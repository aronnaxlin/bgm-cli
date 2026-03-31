# Source Map

## Main entrypoints

- `bgm`
  POSIX launcher for the CLI.
- `bgm.cmd`
  Windows launcher for the CLI.
- `src/cli.js`
  Main command entrypoint. This file contains both non-TUI and TUI code, so be deliberate about which section you touch.

## Non-TUI ownership map

### `src/core/client.js`

Owns three client types:

- `BangumiClient`
  REST API calls for user, subject, and collection workflows.
- `BangumiOAuthClient`
  Authorization URL creation, code exchange, token refresh, token status lookup.
- `OAuthBackendClient`
  Session creation, polling, and claiming against the optional hosted backend.

This is the right place for reusable API behavior. If multiple commands need the same Bangumi interaction, add it here instead of duplicating fetch logic in `src/cli.js`.

### `src/core/http.js`

Owns:

- query-string serialization
- JSON and form request bodies
- `fetch` invocation
- network failure wrapping
- API error message extraction

Edit here when the task is about transport behavior or request/response normalization.

### `src/core/config.js`

Owns:

- default config values
- config file location logic
- global-install marker behavior
- runtime config writes
- `bgm-dev.env` and environment variable merge behavior

Read this file before changing anything related to auth credentials, user agent, install mode, or dev overrides.

### `src/core/output.js`

Owns:

- CLI usage text
- human-readable result formatting
- JSON passthrough
- payload-specific renderers

If a command's output contract changes, update this file with the command implementation.

### `src/cli.js`

Non-TUI sections to care about:

- global arg parsing
- `config`, `auth`, `setup`, `subject`, `collection`, `user` command handlers
- init wizard
- collection target resolution
- subject search and filtering helpers
- collection validation and post-write verification

Avoid editing TUI-only sections unless required for consistency. Search for command handlers first:

- `runConfigCommand`
- `runAuthCommand`
- `runSetupCommand`
- `runSubjectCommand`
- `runCollectionCommand`
- `runUserCommand`

## OAuth backend ownership map

### `oauth-backend/src/app.js`

Hono app and HTTP routes:

- `POST /api/oauth/session`
- `GET /api/oauth/callback`
- `GET /api/oauth/session/:id`
- `POST /api/oauth/session/:id/claim`
- `GET /healthz`

### `oauth-backend/src/config.js`

Runtime env loading and validation for the deployed backend.

### `oauth-backend/src/bangumi-oauth.js`

Backend-side Bangumi OAuth authorize URL creation and code exchange.

### `oauth-backend/src/upstash-session-store.js`

Session persistence and one-time claim behavior.

### `oauth-backend/src/worker.js`

Cloudflare Worker adapter that exposes the Hono app.

## Shell and deployment helpers

- `scripts/install-global-bgm.sh`
- `scripts/install-global-bgm.ps1`
- `oauth-backend/scripts/check-env.js`
- `oauth-backend/scripts/generate-secret.js`

Use these instead of inventing new manual setup steps when the existing helpers already match the task.
