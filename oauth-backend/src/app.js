import { Hono } from "hono";
import { createAuthorizeUrl, exchangeAuthorizationCode } from "./bangumi-oauth.js";
import { createTurnstileAuthorizeUrl } from "./bangumi-turnstile.js";
import { decryptJson, encryptJson } from "./crypto.js";
import { loadConfig } from "./config.js";

export function createApp(runtimeEnv = {}) {
  const config = loadConfig(runtimeEnv);
  const app = new Hono();

  app.onError((error, c) => {
    console.error("oauth-backend request failed", {
      method: c.req.method,
      path: c.req.path,
      message: error?.message,
      stack: error?.stack,
      cause: error?.cause,
    });
    return c.text("Internal Server Error", 500);
  });

  app.get("/healthz", (c) => {
    return c.json({
      ok: true,
      service: "bgm-oauth-backend",
      features: {
        oauth: true,
        turnstile: true,
      },
      storage: "stateless-relay",
      timestamp: new Date().toISOString(),
    });
  });

  app.post("/api/oauth/session", async (c) => {
    const body = await safeParseJson(c);
    const relayUrl = normalizeRelayUrl(body?.relay_url ?? body?.relayUrl);
    if (!relayUrl) {
      return c.json({ error: "missing_relay_url" }, 400);
    }

    const expiresAt = new Date(Date.now() + config.sessionTtlSeconds * 1000).toISOString();
    const state = await encryptJson(
      {
        kind: "oauth",
        relayUrl,
        expiresAt,
      },
      config.sessionEncryptionSecret,
    );

    return c.json({
      authorize_url: createAuthorizeUrl(config, state),
      relay_url: relayUrl,
      expires_at: expiresAt,
      mode: "stateless-relay",
    });
  });

  app.get("/api/oauth/callback", async (c) => {
    const state = c.req.query("state");
    const code = c.req.query("code");
    const error = c.req.query("error");
    const errorDescription = c.req.query("error_description");

    if (!state) {
      return c.html(renderHtml("Missing state", "No OAuth state was provided."), 400);
    }

    let relay;
    try {
      relay = await decodeRelayState(config, state, "oauth");
    } catch (decodeError) {
      return c.html(renderHtml("Invalid state", escapeHtml(decodeError.message)), 400);
    }

    if (error) {
      const detail = errorDescription ? `${error}: ${errorDescription}` : error;
      return c.html(
        renderRelayPage({
          title: "Authorization failed",
          relayUrl: relay.relayUrl,
          payload: { error: detail },
          successMessage: "",
          failureMessage: `Bangumi returned: ${escapeHtml(detail)}`,
        }),
        400,
      );
    }

    if (!code) {
      return c.html(renderHtml("Missing code", "Bangumi did not return an authorization code."), 400);
    }

    try {
      const token = await exchangeAuthorizationCode(config, code);
      return c.html(
        renderRelayPage({
          title: "Authorization completed",
          relayUrl: relay.relayUrl,
          payload: token,
          successMessage: "Authorization completed. The token payload was sent back to the local CLI relay.",
          failureMessage: "Automatic relay failed. Keep this page open and inspect the payload below.",
        }),
        200,
      );
    } catch (exchangeError) {
      return c.html(
        renderRelayPage({
          title: "Authorization failed",
          relayUrl: relay.relayUrl,
          payload: { error: exchangeError.message },
          successMessage: "",
          failureMessage: escapeHtml(exchangeError.message),
        }),
        500,
      );
    }
  });

  app.post("/api/oauth/session/:id/claim", (c) => c.json({ error: "stateless_relay_no_claim" }, 410));
  app.get("/api/oauth/session/:id", (c) => c.json({ error: "stateless_relay_no_status" }, 410));

  app.post("/api/turnstile/session", async (c) => {
    const body = await safeParseJson(c);
    const relayUrl = normalizeRelayUrl(body?.relay_url ?? body?.relayUrl);
    if (!relayUrl) {
      return c.json({ error: "missing_relay_url" }, 400);
    }

    const expiresAt = new Date(Date.now() + config.turnstileSessionTtlSeconds * 1000).toISOString();
    const relay = await encryptJson(
      {
        kind: "turnstile",
        relayUrl,
        expiresAt,
      },
      config.sessionEncryptionSecret,
    );

    const callbackUrl = new URL(config.turnstileRedirectUri);
    callbackUrl.searchParams.set("relay", relay);

    return c.json({
      redirect_uri: callbackUrl.toString(),
      authorize_url: createTurnstileAuthorizeUrl(config, callbackUrl.toString()),
      relay_url: relayUrl,
      expires_at: expiresAt,
      mode: "stateless-relay",
    });
  });

  app.get("/api/turnstile/callback", async (c) => {
    const relayState = c.req.query("relay");
    if (!relayState) {
      return c.html(renderHtml("Missing relay", "No relay metadata was attached to this callback."), 400);
    }

    let relay;
    try {
      relay = await decodeRelayState(config, relayState, "turnstile");
    } catch (decodeError) {
      return c.html(renderHtml("Invalid relay", escapeHtml(decodeError.message)), 400);
    }

    return c.html(
      renderTurnstileRelayPage({
        relayUrl: relay.relayUrl,
      }),
      200,
    );
  });

  app.post("/api/turnstile/session/:id/complete", (c) => c.json({ error: "stateless_relay_no_complete" }, 410));
  app.get("/api/turnstile/session/:id", (c) => c.json({ error: "stateless_relay_no_status" }, 410));
  app.post("/api/turnstile/session/:id/claim", (c) => c.json({ error: "stateless_relay_no_claim" }, 410));

  return app;
}

async function safeParseJson(c) {
  try {
    return await c.req.json();
  } catch {
    return {};
  }
}

async function decodeRelayState(config, value, expectedKind) {
  const payload = await decryptJson(String(value), config.sessionEncryptionSecret);
  if (!payload || payload.kind !== expectedKind) {
    throw new Error("relay kind mismatch");
  }
  if (!normalizeRelayUrl(payload.relayUrl)) {
    throw new Error("relay URL is invalid");
  }
  const expiresAt = new Date(payload.expiresAt).getTime();
  if (Number.isNaN(expiresAt) || expiresAt < Date.now()) {
    throw new Error("relay state expired");
  }
  return payload;
}

function normalizeRelayUrl(value) {
  if (!value) {
    return "";
  }

  try {
    const url = new URL(String(value));
    if (!["http:", "https:"].includes(url.protocol)) {
      return "";
    }
    return url.toString();
  } catch {
    return "";
  }
}

function renderHtml(title, message) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      :root { color-scheme: light; font-family: ui-sans-serif, system-ui, sans-serif; }
      body { margin: 0; background: linear-gradient(135deg, #f7f4ec, #dfe8f7); color: #17212b; }
      main { max-width: 42rem; margin: 12vh auto; background: rgba(255,255,255,.9); border: 1px solid rgba(23,33,43,.08); border-radius: 20px; padding: 2rem; box-shadow: 0 16px 48px rgba(23,33,43,.08); }
      h1 { margin-top: 0; font-size: 1.5rem; }
      p { line-height: 1.6; }
      pre { white-space: pre-wrap; word-break: break-word; background: #0f172a; color: #e2e8f0; border-radius: 12px; padding: 1rem; overflow: auto; }
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

function renderRelayPage({ title, relayUrl, payload, successMessage, failureMessage }) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      :root { color-scheme: light; font-family: ui-sans-serif, system-ui, sans-serif; }
      body { margin: 0; background: linear-gradient(135deg, #f7f4ec, #dfe8f7); color: #17212b; }
      main { max-width: 56rem; margin: 6vh auto; background: rgba(255,255,255,.92); border: 1px solid rgba(23,33,43,.08); border-radius: 20px; padding: 2rem; box-shadow: 0 16px 48px rgba(23,33,43,.08); }
      h1 { margin-top: 0; font-size: 1.5rem; }
      p { line-height: 1.6; }
      .status { margin: 1rem 0; padding: .875rem 1rem; border-radius: 12px; background: #eef2ff; border: 1px solid #c7d2fe; font-weight: 600; }
      pre { white-space: pre-wrap; word-break: break-word; background: #0f172a; color: #e2e8f0; border-radius: 12px; padding: 1rem; overflow: auto; }
    </style>
  </head>
  <body>
    <main>
      <h1>${escapeHtml(title)}</h1>
      <div id="status" class="status">Relaying payload to the local CLI receiver...</div>
      <p>${escapeHtml(failureMessage)}</p>
      <pre id="payloadBox"></pre>
    </main>
    <script>
      const relayUrl = ${JSON.stringify(relayUrl)};
      const payload = ${JSON.stringify(payload)};
      const status = document.getElementById('status');
      document.getElementById('payloadBox').textContent = JSON.stringify(payload, null, 2);

      fetch(relayUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).then(async (response) => {
        if (!response.ok) {
          throw new Error('relay_failed_' + response.status);
        }
        status.textContent = ${JSON.stringify(successMessage || "Payload relayed successfully. Return to the terminal.")};
      }).catch((error) => {
        status.textContent = 'Automatic relay failed: ' + (error && error.message ? error.message : 'unknown_error');
      });
    </script>
  </body>
</html>`;
}

function renderTurnstileRelayPage({ relayUrl }) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Bangumi Turnstile Callback</title>
    <style>
      :root { color-scheme: light; font-family: ui-sans-serif, system-ui, sans-serif; }
      body { margin: 0; background: linear-gradient(135deg, #f7f4ec, #dfe8f7); color: #17212b; }
      main { max-width: 56rem; margin: 6vh auto; background: rgba(255,255,255,.92); border: 1px solid rgba(23,33,43,.08); border-radius: 20px; padding: 2rem; box-shadow: 0 16px 48px rgba(23,33,43,.08); }
      h1 { margin-top: 0; font-size: 1.5rem; }
      p { line-height: 1.6; }
      .status { margin: 1rem 0; padding: .875rem 1rem; border-radius: 12px; background: #eef2ff; border: 1px solid #c7d2fe; font-weight: 600; }
      .card { margin-top: 1rem; padding: 1rem; border-radius: 14px; background: #f8fafc; border: 1px solid #e2e8f0; }
      textarea { width: 100%; min-height: 10rem; box-sizing: border-box; border: 1px solid #cbd5e1; border-radius: 12px; padding: 0.75rem; font: 13px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; }
      button { appearance: none; border: 1px solid #2563eb; background: #2563eb; color: white; border-radius: 10px; padding: .7rem 1rem; cursor: pointer; font: inherit; }
      pre { white-space: pre-wrap; word-break: break-word; background: #0f172a; color: #e2e8f0; border-radius: 12px; padding: 1rem; overflow: auto; }
    </style>
  </head>
  <body>
    <main>
      <h1>Bangumi Turnstile Callback</h1>
      <div id="status" class="status">Inspecting callback URL...</div>
      <div class="card">
        <strong>Manual fallback</strong>
        <p>If the token is not auto-detected from the callback URL, paste it here manually and submit.</p>
        <textarea id="tokenInput" placeholder="Paste turnstile token here if you captured it manually"></textarea>
        <p><button type="button" id="submitButton">Submit token</button></p>
      </div>
      <div class="card">
        <strong>Observed callback URL data</strong>
        <pre id="debugBox"></pre>
      </div>
    </main>
    <script>
      const relayUrl = ${JSON.stringify(relayUrl)};
      function setStatus(message) { document.getElementById('status').textContent = message; }
      function safeEntries(params) { return Array.from(params.entries()).reduce((a,[k,v]) => { a[k]=v; return a; }, {}); }
      function parseHashParams() { const rawHash = window.location.hash || ''; const normalized = rawHash.startsWith('#') ? rawHash.slice(1) : rawHash; return new URLSearchParams(normalized); }
      function detectToken(searchParams, hashParams) {
        const candidates = [['query','turnstileToken'],['query','turnstile_token'],['query','token'],['query','cf-turnstile-response'],['hash','turnstileToken'],['hash','turnstile_token'],['hash','token'],['hash','cf-turnstile-response']];
        for (const [source, field] of candidates) { const params = source === 'query' ? searchParams : hashParams; const value = params.get(field); if (value) return { token: value, detectedFrom: source + ':' + field }; }
        return { token: '', detectedFrom: '' };
      }
      async function submitToken(token, detectedFrom) {
        const trimmed = String(token || '').trim();
        if (!trimmed) { setStatus('No token available yet.'); return; }
        setStatus('Submitting token to the local CLI relay...');
        const response = await fetch(relayUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ turnstileToken: trimmed, detectedFrom, rawQuery: window.location.search || '', rawHash: window.location.hash || '' }) });
        if (!response.ok) { throw new Error('relay_failed_' + response.status); }
        setStatus('Token relayed successfully. Return to the terminal.');
      }
      const searchParams = new URLSearchParams(window.location.search);
      const hashParams = parseHashParams();
      const detected = detectToken(searchParams, hashParams);
      document.getElementById('debugBox').textContent = JSON.stringify({ href: window.location.href, search: window.location.search, hash: window.location.hash, queryParams: safeEntries(searchParams), hashParams: safeEntries(hashParams), detectedFrom: detected.detectedFrom }, null, 2);
      document.getElementById('submitButton').addEventListener('click', async () => { try { await submitToken(document.getElementById('tokenInput').value, 'manual'); } catch (error) { setStatus('Submission failed: ' + (error && error.message ? error.message : 'unknown_error')); } });
      if (detected.token) { submitToken(detected.token, detected.detectedFrom).catch((error) => { setStatus('Auto-submit failed: ' + (error && error.message ? error.message : 'unknown_error')); }); } else { setStatus('Callback loaded. No known token field found automatically. Inspect the debug box or paste a token manually.'); }
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
