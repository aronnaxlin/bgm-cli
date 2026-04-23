# OAuth And Turnstile Backend

Portable Bangumi OAuth backend designed to run on both:

- Vercel Functions
- Cloudflare Workers

The service keeps `client_secret` on the server, uses Upstash Redis REST API
for short-lived OAuth and Turnstile relay sessions, and exposes CLI-friendly polling flows.

Status:

- Experimental
- Not recommended as the primary login path for ordinary users
- Intended for self-hosting experiments and future compatibility work

Important:

- Bangumi's browser authorize flow has been unreliable in testing.
- This backend scaffold is kept in the repository because the architecture is still useful, but successful deployment does not guarantee successful end-user authorization.
- Ordinary users should prefer manual access token login in `bgm --init`.

## Endpoints

### OAuth

- `POST /api/oauth/session`
  Creates a short-lived OAuth session and returns the Bangumi authorization URL.
- `GET /api/oauth/callback`
  Receives Bangumi OAuth redirect, exchanges `code` for token, and stores the result.
- `GET /api/oauth/session/:id`
  Poll current OAuth session status.
- `POST /api/oauth/session/:id/claim`
  Returns the token payload once and deletes the session.

### Official Turnstile

- `POST /api/turnstile/session`
  Creates a short-lived Turnstile relay session and returns the official Bangumi `/p1/turnstile` URL with a session-bound callback URL.
- `GET /api/turnstile/callback`
  Hosted callback page for Bangumi's official Turnstile redirect. It inspects the callback URL, tries to auto-detect a token, and relays it into the pending session.
- `POST /api/turnstile/session/:id/complete`
  Internal callback relay endpoint used by the hosted callback page.
- `GET /api/turnstile/session/:id?secret=...`
  Poll current Turnstile session status.
- `POST /api/turnstile/session/:id/claim?secret=...`
  Returns the Turnstile payload once and deletes the session.

- `GET /healthz`
  Simple health check.

## Required Environment Variables

- `BGM_CLIENT_ID`
- `BGM_CLIENT_SECRET`
- `BGM_REDIRECT_URI`
- `BGM_OAUTH_SERVER_BASE_URL`
- `BGM_TURNSTILE_REDIRECT_URI`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `SESSION_ENCRYPTION_SECRET`

Optional:

- `BGM_SESSION_TTL_SECONDS`
- `BGM_TURNSTILE_SESSION_TTL_SECONDS`
- `BGM_TURNSTILE_THEME`

See [oauth-backend/.env.example](/home/aronnax/code/bgm-cli/oauth-backend/.env.example) for a minimal template.

Helpful local commands:

- `npm run generate:secret`
- `npm run check:env`

## Intended Flow

### OAuth

1. CLI calls `POST /api/oauth/session`
2. CLI opens `authorize_url`
3. User logs into Bangumi on Bangumi's official website
4. Bangumi redirects to `/api/oauth/callback`
5. CLI polls `GET /api/oauth/session/:id`
6. CLI calls `POST /api/oauth/session/:id/claim`
7. CLI stores token locally

### Official Turnstile

1. CLI calls `POST /api/turnstile/session`
2. Backend returns an official Bangumi `/p1/turnstile?redirect_uri=...` URL whose callback already contains the relay session metadata
3. CLI opens that official URL in the browser
4. Bangumi redirects to the hosted `BGM_TURNSTILE_REDIRECT_URI`, preserving the original callback query string and appending the verified `token`
6. The hosted callback page inspects `location.search` and `location.hash`
7. If a token is found, the page relays it to `POST /api/turnstile/session/:id/complete`
8. CLI polls `GET /api/turnstile/session/:id?secret=...`
9. CLI calls `POST /api/turnstile/session/:id/claim?secret=...`
10. CLI uses the returned `turnstileToken` immediately for the next write action

Important:

- Bangumi's `/p1/turnstile` requires a whitelisted `redirect_uri`
- Successful deployment does not mean the Turnstile redirect is usable yet
- You must whitelist `BGM_TURNSTILE_REDIRECT_URI` with Bangumi before the official flow can complete end-to-end
- Upstream `server-private` currently checks whitelist membership with `startsWith`, so a whitelisted callback prefix can still carry relay query parameters such as `session` and `secret`
- The hosted callback page is intentionally observation-friendly because the exact callback field shape must still be verified against the real redirect

## Example `POST /api/oauth/session`

Response:

```json
{
  "session_id": "sess_xxx",
  "authorize_url": "https://bgm.tv/oauth/authorize?...",
  "expires_at": "2026-03-30T12:00:00.000Z",
  "poll_interval_ms": 2000,
  "status_url": "https://example.com/api/oauth/session/sess_xxx",
  "claim_url": "https://example.com/api/oauth/session/sess_xxx/claim"
}
```

## Example `POST /api/turnstile/session`

Response:

```json
{
  "session_id": "tsess_xxx",
  "session_secret": "tsec_xxx",
  "redirect_uri": "https://example.com/api/turnstile/callback?session=tsess_xxx&secret=tsec_xxx",
  "authorize_url": "https://next.bgm.tv/p1/turnstile?redirect_uri=https%3A%2F%2Fexample.com%2Fapi%2Fturnstile%2Fcallback%3Fsession%3Dtsess_xxx%26secret%3Dtsec_xxx",
  "expires_at": "2026-03-30T12:00:00.000Z",
  "poll_interval_ms": 2000,
  "status_url": "https://example.com/api/turnstile/session/tsess_xxx?secret=tsec_xxx",
  "claim_url": "https://example.com/api/turnstile/session/tsess_xxx/claim?secret=tsec_xxx"
}
```

## Deploying On Vercel

Deployment only proves the backend is reachable. It does not prove Bangumi's authorize step will succeed for end users.

1. Create a separate Vercel project using `oauth-backend/` as the root directory.
2. Generate a strong session secret locally:

```bash
npm run generate:secret
```

3. Set the required environment variables in Vercel Project Settings or with the CLI:

```bash
vercel env add BGM_CLIENT_ID
vercel env add BGM_CLIENT_SECRET
vercel env add BGM_REDIRECT_URI
vercel env add BGM_OAUTH_SERVER_BASE_URL
vercel env add BGM_TURNSTILE_REDIRECT_URI
vercel env add BGM_TURNSTILE_THEME
vercel env add UPSTASH_REDIS_REST_URL
vercel env add UPSTASH_REDIS_REST_TOKEN
vercel env add SESSION_ENCRYPTION_SECRET
vercel env add BGM_SESSION_TTL_SECONDS
vercel env add BGM_TURNSTILE_SESSION_TTL_SECONDS
```

4. Pull the configured environment and validate it before deploying:

```bash
vercel env pull .env.local
cp .env.local .env
npm run check:env
```

`check:env` reads `.env`, `.env.local`, and exported process environment values.

5. Deploy.

Recommended values:

- `BGM_OAUTH_SERVER_BASE_URL=https://<your-project>.vercel.app`
- `BGM_REDIRECT_URI=https://<your-project>.vercel.app/api/oauth/callback`
- `BGM_TURNSTILE_REDIRECT_URI=https://<your-project>.vercel.app/api/turnstile/callback`
- `BGM_SESSION_TTL_SECONDS=300`
- `BGM_TURNSTILE_SESSION_TTL_SECONDS=300`
- `BGM_TURNSTILE_THEME=auto`

If you are self-hosting for testing, make sure Bangumi's registered callback URL exactly matches `BGM_REDIRECT_URI`.

For official Turnstile support, you also need Bangumi to whitelist:

- `BGM_TURNSTILE_REDIRECT_URI`

Without that whitelist entry, the backend is deployed correctly but the official `/p1/turnstile` flow still cannot complete.

## Deploying On Cloudflare Workers

1. Create a Worker from `oauth-backend/`.
2. Set non-sensitive values with `vars` or dashboard config.
3. Set secrets:

```bash
wrangler secret put BGM_CLIENT_SECRET
wrangler secret put UPSTASH_REDIS_REST_TOKEN
wrangler secret put SESSION_ENCRYPTION_SECRET
```

4. Deploy with `wrangler deploy`.
