# OAuth Backend

Portable Bangumi OAuth backend designed to run on both:

- Vercel Functions
- Cloudflare Workers

The service keeps `client_secret` on the server, uses Upstash Redis REST API
for short-lived OAuth sessions, and exposes a CLI-friendly polling flow.

## Endpoints

- `POST /api/oauth/session`
  Creates a short-lived OAuth session and returns the Bangumi authorization URL.
- `GET /api/oauth/callback`
  Receives Bangumi OAuth redirect, exchanges `code` for token, and stores the result.
- `GET /api/oauth/session/:id`
  Poll current OAuth session status.
- `POST /api/oauth/session/:id/claim`
  Returns the token payload once and deletes the session.
- `GET /healthz`
  Simple health check.

## Required Environment Variables

- `BGM_CLIENT_ID`
- `BGM_CLIENT_SECRET`
- `BGM_REDIRECT_URI`
- `BGM_OAUTH_SERVER_BASE_URL`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `SESSION_ENCRYPTION_SECRET`

Optional:

- `BGM_SESSION_TTL_SECONDS`

See [oauth-backend/.env.example](/home/aronnax/code/bgm-cli/oauth-backend/.env.example) for a minimal template.

Helpful local commands:

- `npm run generate:secret`
- `npm run check:env`

## Recommended Flow

1. CLI calls `POST /api/oauth/session`
2. CLI opens `authorize_url`
3. User logs into Bangumi on Bangumi's official website
4. Bangumi redirects to `/api/oauth/callback`
5. CLI polls `GET /api/oauth/session/:id`
6. CLI calls `POST /api/oauth/session/:id/claim`
7. CLI stores token locally

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

## Deploying On Vercel

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
vercel env add UPSTASH_REDIS_REST_URL
vercel env add UPSTASH_REDIS_REST_TOKEN
vercel env add SESSION_ENCRYPTION_SECRET
vercel env add BGM_SESSION_TTL_SECONDS
```

4. Pull the configured environment and validate it before deploying:

```bash
vercel env pull .env.local
cp .env.local .env
npm run check:env
```

5. Deploy.

Recommended values:

- `BGM_OAUTH_SERVER_BASE_URL=https://<your-project>.vercel.app`
- `BGM_REDIRECT_URI=https://<your-project>.vercel.app/api/oauth/callback`
- `BGM_SESSION_TTL_SECONDS=300`

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
