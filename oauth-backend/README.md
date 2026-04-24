# OAuth And Turnstile Backend

Portable Bangumi OAuth backend designed to run on both:

- Vercel Functions
- Cloudflare Workers

The service keeps `client_secret` on the server and uses a hosted callback page
to relay OAuth and Turnstile results back to a local CLI receiver.

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
  Receives Bangumi OAuth redirect, exchanges `code` for token, and relays the result back to the local CLI receiver.
- `GET /api/oauth/session/:id`
  Legacy polling endpoint. Returns a stateless relay error in the current implementation.
- `POST /api/oauth/session/:id/claim`
  Legacy polling endpoint. Returns a stateless relay error in the current implementation.

### Official Turnstile

- `POST /api/turnstile/session`
  Creates a short-lived Turnstile relay session and returns the official Bangumi `/p1/turnstile` URL with an encrypted relay callback URL.
- `GET /api/turnstile/callback`
  Hosted callback page for Bangumi's official Turnstile redirect. It inspects the callback URL, tries to auto-detect a token, and relays it to the local CLI receiver.
- `POST /api/turnstile/session/:id/complete`
  Legacy polling endpoint. Returns a stateless relay error in the current implementation.
- `GET /api/turnstile/session/:id?secret=...`
  Legacy polling endpoint. Returns a stateless relay error in the current implementation.
- `POST /api/turnstile/session/:id/claim?secret=...`
  Legacy polling endpoint. Returns a stateless relay error in the current implementation.

- `GET /healthz`
  Simple health check.

## Required Environment Variables

- `BGM_CLIENT_ID`
- `BGM_CLIENT_SECRET`
- `BGM_REDIRECT_URI`
- `BGM_OAUTH_SERVER_BASE_URL`
- `BGM_TURNSTILE_REDIRECT_URI`
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
2. CLI passes its local relay URL to the backend
3. CLI opens `authorize_url`
4. User logs into Bangumi on Bangumi's official website
5. Bangumi redirects to `/api/oauth/callback`
6. The backend exchanges `code` for token server-side
7. The hosted callback page posts the final token payload back to the local CLI receiver
8. CLI stores token locally

### Official Turnstile

1. CLI calls `POST /api/turnstile/session`
2. CLI passes its local relay URL to the backend
3. Backend returns an official Bangumi `/p1/turnstile?redirect_uri=...` URL whose callback already contains encrypted relay metadata
4. CLI opens that official URL in the browser
5. Bangumi redirects to the hosted `BGM_TURNSTILE_REDIRECT_URI`, preserving the original callback query string and appending the verified `token`
6. The hosted callback page inspects `location.search` and `location.hash`
7. If a token is found, the page posts it back to the local CLI receiver
8. CLI uses the returned `turnstileToken` immediately for the next write action

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
  "relay_url": "http://127.0.0.1:43199/callback",
  "authorize_url": "https://bgm.tv/oauth/authorize?...",
  "expires_at": "2026-03-30T12:00:00.000Z",
  "mode": "stateless-relay"
}
```

## Example `POST /api/turnstile/session`

Response:

```json
{
  "relay_url": "http://127.0.0.1:43199/callback",
  "redirect_uri": "https://example.com/api/turnstile/callback?relay=<encrypted-relay>",
  "authorize_url": "https://next.bgm.tv/p1/turnstile?redirect_uri=https%3A%2F%2Fexample.com%2Fapi%2Fturnstile%2Fcallback%3Frelay%3D...",
  "expires_at": "2026-03-30T12:00:00.000Z",
  "mode": "stateless-relay"
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
