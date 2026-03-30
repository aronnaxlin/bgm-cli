import { Hono } from "hono";
import { createAuthorizeUrl, exchangeAuthorizationCode } from "./bangumi-oauth.js";
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

  return app;
}

function createRandomToken(prefix) {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const body = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${prefix}_${body}`;
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

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
