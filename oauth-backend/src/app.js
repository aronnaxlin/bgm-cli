import { Hono } from "hono";
import { createAuthorizeUrl, exchangeAuthorizationCode } from "./bangumi-oauth.js";
import { createTurnstileAuthorizeUrl } from "./bangumi-turnstile.js";
import { loadConfig } from "./config.js";
import { UpstashSessionStore } from "./upstash-session-store.js";

export function createApp(runtimeEnv = {}) {
  const config = loadConfig(runtimeEnv);
  const store = new UpstashSessionStore(config);

  const app = new Hono();

  app.get("/healthz", (c) => {
    return c.json({
      ok: true,
      service: "bgm-oauth-backend",
      features: {
        oauth: true,
        turnstile: true,
      },
      timestamp: new Date().toISOString(),
    });
  });

  app.post("/api/oauth/session", async (c) => {
    const sessionId = createRandomToken("sess");
    const state = createRandomToken("state");
    const expiresAt = new Date(Date.now() + config.sessionTtlSeconds * 1000).toISOString();

    await store.createPendingSession({
      id: sessionId,
      state,
      status: "pending",
      createdAt: new Date().toISOString(),
      expiresAt,
      error: null,
      tokenPayload: null,
      authorizedAt: null,
    });

    return c.json({
      session_id: sessionId,
      authorize_url: createAuthorizeUrl(config, state),
      expires_at: expiresAt,
      poll_interval_ms: 2000,
      status_url: `${config.publicBaseUrl}/api/oauth/session/${sessionId}`,
      claim_url: `${config.publicBaseUrl}/api/oauth/session/${sessionId}/claim`,
    });
  });

  app.get("/api/oauth/callback", async (c) => {
    const state = c.req.query("state");
    const code = c.req.query("code");
    const error = c.req.query("error");
    const errorDescription = c.req.query("error_description");

    if (error && !state) {
      const detail = errorDescription ? `${error}: ${errorDescription}` : error;
      return c.html(
        renderHtml(
          "Authorization failed",
          `Bangumi returned an error before a valid session state was attached: ${escapeHtml(detail)}`,
        ),
        400,
      );
    }

    if (!state) {
      return c.html(renderHtml("Missing state", "No OAuth state was provided."), 400);
    }

    const session = await store.getSessionByState(state);
    if (!session) {
      return c.html(renderHtml("Session expired", "This login session no longer exists or has expired."), 404);
    }

    if (error) {
      const detail = errorDescription ? `${error}: ${errorDescription}` : error;
      await store.markFailed(session.id, detail);
      return c.html(renderHtml("Authorization failed", `Bangumi returned: ${escapeHtml(detail)}`), 400);
    }

    if (!code) {
      await store.markFailed(session.id, "missing_code");
      return c.html(renderHtml("Missing code", "Bangumi did not return an authorization code."), 400);
    }

    try {
      await store.markAuthorized(session.id, await exchangeAuthorizationCode(config, code));
      return c.html(renderHtml("Authorization completed", "You can now return to the CLI and continue."), 200);
    } catch (exchangeError) {
      await store.markFailed(session.id, exchangeError.message);
      return c.html(renderHtml("Authorization failed", escapeHtml(exchangeError.message)), 500);
    }
  });

  app.get("/api/oauth/session/:id", async (c) => {
    const session = await store.getSessionById(c.req.param("id"));
    if (!session) {
      return c.json(
        {
          status: "expired",
          error: "session_not_found",
        },
        404,
      );
    }

    return c.json({
      session_id: session.id,
      status: session.status,
      expires_at: session.expiresAt,
      authorized_at: session.authorizedAt,
      error: session.error,
    });
  });

  app.post("/api/oauth/session/:id/claim", async (c) => {
    const claimed = await store.claimAuthorizedSession(c.req.param("id"));
    if (!claimed) {
      return c.json(
        {
          error: "session_not_found",
        },
        404,
      );
    }

    if (claimed.session.status !== "authorized" || !claimed.token) {
      return c.json(
        {
          status: claimed.session.status,
          error: claimed.session.error,
        },
        409,
      );
    }

    return c.json(claimed.token);
  });

  app.post("/api/turnstile/session", async (c) => {
    const sessionId = createRandomToken("tsess");
    const sessionSecret = createRandomToken("tsec");
    const expiresAt = new Date(Date.now() + config.turnstileSessionTtlSeconds * 1000).toISOString();
    const callbackUrl = createTurnstileCallbackUrl(config, sessionId, sessionSecret);

    await store.createPendingTurnstileSession({
      id: sessionId,
      secret: sessionSecret,
      status: "pending",
      createdAt: new Date().toISOString(),
      expiresAt,
      error: null,
      tokenPayload: null,
      completedAt: null,
    });

    return c.json({
      session_id: sessionId,
      session_secret: sessionSecret,
      redirect_uri: callbackUrl,
      authorize_url: createTurnstileAuthorizeUrl(config, callbackUrl),
      expires_at: expiresAt,
      poll_interval_ms: 2000,
      status_url: `${config.publicBaseUrl}/api/turnstile/session/${sessionId}?secret=${encodeURIComponent(sessionSecret)}`,
      claim_url: `${config.publicBaseUrl}/api/turnstile/session/${sessionId}/claim?secret=${encodeURIComponent(sessionSecret)}`,
    });
  });

  app.get("/api/turnstile/callback", async (c) => {
    const sessionId = c.req.query("session") || c.req.query("session_id");
    const sessionSecret = c.req.query("secret") || c.req.query("session_secret");

    if (!sessionId || !sessionSecret) {
      return c.html(
        renderHtml(
          "Missing Turnstile session",
          "This callback URL does not include the expected session metadata. Check the redirect URI template and try again.",
        ),
        400,
      );
    }

    const session = await store.getTurnstileSessionById(sessionId);
    if (!session) {
      return c.html(
        renderHtml(
          "Turnstile session expired",
          "This Turnstile session no longer exists or has expired. Start a new session from the CLI and try again.",
        ),
        404,
      );
    }

    if (!secretsMatch(session.secret, sessionSecret)) {
      return c.html(renderHtml("Invalid session secret", "The callback secret does not match the pending session."), 403);
    }

    return c.html(
      renderTurnstileCallbackPage({
        sessionId,
        sessionSecret,
      }),
      200,
    );
  });

  app.post("/api/turnstile/session/:id/complete", async (c) => {
    const session = await store.getTurnstileSessionById(c.req.param("id"));
    if (!session) {
      return c.json({ error: "session_not_found" }, 404);
    }

    let body;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "invalid_json" }, 400);
    }

    const sessionSecret = normalizeString(body.session_secret ?? body.sessionSecret);
    if (!secretsMatch(session.secret, sessionSecret)) {
      return c.json({ error: "invalid_session_secret" }, 403);
    }

    const turnstileToken = normalizeString(body.turnstile_token ?? body.turnstileToken);
    if (!turnstileToken) {
      return c.json({ error: "missing_turnstile_token" }, 400);
    }

    await store.markTurnstileCompleted(session.id, {
      turnstileToken,
      detectedFrom: normalizeString(body.detected_from ?? body.detectedFrom) || null,
      rawQuery: normalizeString(body.raw_query ?? body.rawQuery) || "",
      rawHash: normalizeString(body.raw_hash ?? body.rawHash) || "",
      queryParams: isPlainObject(body.query_params ?? body.queryParams) ? body.query_params ?? body.queryParams : {},
      hashParams: isPlainObject(body.hash_params ?? body.hashParams) ? body.hash_params ?? body.hashParams : {},
      completedAt: new Date().toISOString(),
    });

    return c.json({ ok: true, message: "Turnstile token received. You can now return to the CLI." });
  });

  app.get("/api/turnstile/session/:id", async (c) => {
    const session = await store.getTurnstileSessionById(c.req.param("id"));
    if (!session) {
      return c.json({ status: "expired", error: "session_not_found" }, 404);
    }

    if (!secretsMatch(session.secret, c.req.query("secret"))) {
      return c.json({ error: "invalid_session_secret" }, 403);
    }

    return c.json({
      session_id: session.id,
      status: session.status,
      expires_at: session.expiresAt,
      completed_at: session.completedAt,
      error: session.error,
    });
  });

  app.post("/api/turnstile/session/:id/claim", async (c) => {
    const session = await store.getTurnstileSessionById(c.req.param("id"));
    if (!session) {
      return c.json({ error: "session_not_found" }, 404);
    }

    if (!secretsMatch(session.secret, c.req.query("secret"))) {
      return c.json({ error: "invalid_session_secret" }, 403);
    }

    const claimed = await store.claimCompletedTurnstileSession(session.id);
    if (!claimed) {
      return c.json({ error: "session_not_found" }, 404);
    }

    if (claimed.session.status !== "completed" || !claimed.token) {
      return c.json(
        {
          status: claimed.session.status,
          error: claimed.session.error,
        },
        409,
      );
    }

    return c.json(claimed.token);
  });

  return app;
}

function createRandomToken(prefix) {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const body = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${prefix}_${body}`;
}

function createTurnstileCallbackUrl(config, sessionId, sessionSecret) {
  const url = new URL(config.turnstileRedirectUri);
  url.searchParams.set("session", sessionId);
  url.searchParams.set("secret", sessionSecret);
  return url.toString();
}

function renderHtml(title, message) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      :root {
        color-scheme: light;
        font-family: ui-sans-serif, system-ui, sans-serif;
      }
      body {
        margin: 0;
        background: linear-gradient(135deg, #f7f4ec, #dfe8f7);
        color: #17212b;
      }
      main {
        max-width: 42rem;
        margin: 12vh auto;
        background: rgba(255, 255, 255, 0.9);
        border: 1px solid rgba(23, 33, 43, 0.08);
        border-radius: 20px;
        padding: 2rem;
        box-shadow: 0 16px 48px rgba(23, 33, 43, 0.08);
      }
      h1 {
        margin-top: 0;
        font-size: 1.5rem;
      }
      p {
        line-height: 1.6;
      }
      code {
        background: #f3f4f6;
        padding: 2px 6px;
        border-radius: 6px;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>${escapeHtml(title)}</h1>
      <p>${message}</p>
    </main>
  </body>
</html>`;
}

function renderTurnstileCallbackPage({ sessionId, sessionSecret }) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Bangumi Turnstile Callback</title>
    <style>
      :root {
        color-scheme: light;
        font-family: ui-sans-serif, system-ui, sans-serif;
      }
      body {
        margin: 0;
        background: linear-gradient(135deg, #f7f4ec, #dfe8f7);
        color: #17212b;
      }
      main {
        max-width: 56rem;
        margin: 6vh auto;
        background: rgba(255, 255, 255, 0.92);
        border: 1px solid rgba(23, 33, 43, 0.08);
        border-radius: 20px;
        padding: 2rem;
        box-shadow: 0 16px 48px rgba(23, 33, 43, 0.08);
      }
      h1 {
        margin-top: 0;
        font-size: 1.5rem;
      }
      p, li {
        line-height: 1.6;
      }
      .muted {
        color: #52606d;
      }
      .status {
        margin: 1rem 0;
        padding: 0.875rem 1rem;
        border-radius: 12px;
        background: #eef2ff;
        border: 1px solid #c7d2fe;
        font-weight: 600;
      }
      .card {
        margin-top: 1rem;
        padding: 1rem;
        border-radius: 14px;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
      }
      textarea {
        width: 100%;
        min-height: 10rem;
        box-sizing: border-box;
        border: 1px solid #cbd5e1;
        border-radius: 12px;
        padding: 0.75rem;
        font: 13px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace;
      }
      button {
        appearance: none;
        border: 1px solid #2563eb;
        background: #2563eb;
        color: white;
        border-radius: 10px;
        padding: 0.7rem 1rem;
        cursor: pointer;
        font: inherit;
      }
      pre {
        white-space: pre-wrap;
        word-break: break-word;
        background: #0f172a;
        color: #e2e8f0;
        border-radius: 12px;
        padding: 1rem;
        overflow: auto;
      }
      code {
        background: #f1f5f9;
        padding: 0.125rem 0.375rem;
        border-radius: 6px;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>Bangumi Turnstile Callback</h1>
      <p class="muted">This page is the hosted callback target for the official <code>/p1/turnstile</code> flow. It will inspect the redirect URL, try to find a token, and relay it back to the CLI session.</p>
      <div id="status" class="status">Inspecting callback URL...</div>

      <div class="card">
        <strong>Session</strong>
        <p><code>${escapeHtml(sessionId)}</code></p>
      </div>

      <div class="card">
        <strong>Detected token</strong>
        <p id="detectedTokenSummary" class="muted">Waiting...</p>
      </div>

      <div class="card">
        <strong>Manual fallback</strong>
        <p class="muted">If the token is not auto-detected from the callback URL, paste it here manually and submit.</p>
        <textarea id="tokenInput" placeholder="Paste turnstile token here if you captured it manually"></textarea>
        <p><button type="button" id="submitButton">Submit token</button></p>
      </div>

      <div class="card">
        <strong>Observed callback URL data</strong>
        <pre id="debugBox"></pre>
      </div>
    </main>

    <script>
      const sessionId = ${JSON.stringify(sessionId)};
      const sessionSecret = ${JSON.stringify(sessionSecret)};
      const completeUrl = ${JSON.stringify(`/api/turnstile/session/${sessionId}/complete`)};

      function setStatus(message) {
        document.getElementById('status').textContent = message;
      }

      function safeEntries(params) {
        return Array.from(params.entries()).reduce((accumulator, [key, value]) => {
          accumulator[key] = value;
          return accumulator;
        }, {});
      }

      function parseHashParams() {
        const rawHash = window.location.hash || '';
        const normalized = rawHash.startsWith('#') ? rawHash.slice(1) : rawHash;
        return new URLSearchParams(normalized);
      }

      function detectToken(searchParams, hashParams) {
        const candidates = [
          ['query', 'turnstileToken'],
          ['query', 'turnstile_token'],
          ['query', 'token'],
          ['query', 'cf-turnstile-response'],
          ['hash', 'turnstileToken'],
          ['hash', 'turnstile_token'],
          ['hash', 'token'],
          ['hash', 'cf-turnstile-response'],
        ];

        for (const [source, field] of candidates) {
          const params = source === 'query' ? searchParams : hashParams;
          const value = params.get(field);
          if (value) {
            return { token: value, detectedFrom: source + ':' + field };
          }
        }

        return { token: '', detectedFrom: '' };
      }

      async function submitToken(token, detectedFrom) {
        const trimmed = String(token || '').trim();
        if (!trimmed) {
          setStatus('No token available yet.');
          return;
        }

        setStatus('Submitting token to relay backend...');
        const searchParams = new URLSearchParams(window.location.search);
        const hashParams = parseHashParams();

        const response = await fetch(completeUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            session_id: sessionId,
            session_secret: sessionSecret,
            turnstile_token: trimmed,
            detected_from: detectedFrom || 'manual',
            raw_query: window.location.search || '',
            raw_hash: window.location.hash || '',
            query_params: safeEntries(searchParams),
            hash_params: safeEntries(hashParams),
          }),
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload.error || 'turnstile_submit_failed');
        }

        setStatus(payload.message || 'Token submitted. Return to the CLI.');
      }

      const searchParams = new URLSearchParams(window.location.search);
      const hashParams = parseHashParams();
      const detected = detectToken(searchParams, hashParams);
      document.getElementById('detectedTokenSummary').textContent = detected.token
        ? 'Detected automatically from ' + detected.detectedFrom
        : 'No known token field detected automatically.';
      document.getElementById('debugBox').textContent = JSON.stringify({
        href: window.location.href,
        search: window.location.search,
        hash: window.location.hash,
        queryParams: safeEntries(searchParams),
        hashParams: safeEntries(hashParams),
        detectedFrom: detected.detectedFrom,
      }, null, 2);

      document.getElementById('submitButton').addEventListener('click', async () => {
        try {
          await submitToken(document.getElementById('tokenInput').value, 'manual');
        } catch (error) {
          setStatus('Submission failed: ' + (error && error.message ? error.message : 'unknown_error'));
        }
      });

      if (detected.token) {
        submitToken(detected.token, detected.detectedFrom).catch((error) => {
          setStatus('Auto-submit failed: ' + (error && error.message ? error.message : 'unknown_error'));
        });
      } else {
        setStatus('Callback loaded. No known token field found automatically. Inspect the debug box or paste a token manually.');
      }
    </script>
  </body>
</html>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function secretsMatch(expected, actual) {
  return typeof expected === "string" && expected.length > 0 && expected === normalizeString(actual);
}


function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
