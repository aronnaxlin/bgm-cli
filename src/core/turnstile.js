import http from "node:http";
import { randomUUID } from "node:crypto";
import { CommandError } from "./output.js";

export const TURNSTILE_SITE_KEY = "0x4AAAAAAABkMYinukE8nzYS";
export const DEFAULT_TURNSTILE_TIMEOUT_MS = 300000;
export const TURNSTILE_MANUAL_PAGE_URL = "https://next.bgm.tv/";
export const TURNSTILE_MANUAL_DOC_PATH = "docs/research/turnstile-manual-token.zh-CN.md";

export async function startTurnstileFlow(options = {}) {
  const listenHost = normalizeListenHost(options.listenHost);
  const requestedPort = normalizePort(options.port);
  const timeoutMs = normalizeTimeoutMs(options.timeoutMs);
  const state = randomUUID();
  let timeout = null;
  let settled = false;
  let resolveToken;
  let rejectToken;

  const completion = new Promise((resolve, reject) => {
    resolveToken = resolve;
    rejectToken = reject;
  });

  const server = http.createServer(async (req, res) => {
    try {
      const requestUrl = new URL(req.url ?? "/", origin);

      if (req.method === "GET" && requestUrl.pathname === "/") {
        res.writeHead(302, {
          Location: verificationPath,
        });
        res.end();
        return;
      }

      if (req.method === "GET" && requestUrl.pathname === "/turnstile") {
        if (requestUrl.searchParams.get("state") !== state) {
          respondHtml(res, 400, "Invalid state", "<h1>Invalid state</h1><p>This verification link is no longer valid.</p>");
          return;
        }

        respondHtml(
          res,
          200,
          "Turnstile helper",
          renderTurnstilePage({
            state,
            callbackUrl: `${origin}/callback`,
            actionLabel: options.actionLabel,
          }),
        );
        return;
      }

      if (req.method === "OPTIONS" && requestUrl.pathname === "/callback") {
        respondCallbackPreflight(req, res);
        return;
      }

      if (req.method === "POST" && requestUrl.pathname === "/callback") {
        const body = await readJsonBody(req);
        if (body.state !== state) {
          respondCallbackJson(req, res, 400, { error: "invalid_state" });
          return;
        }

        const token = typeof body.token === "string" ? body.token.trim() : "";
        if (!token) {
          respondCallbackJson(req, res, 400, { error: "missing_token" });
          return;
        }

        respondCallbackJson(req, res, 200, {
          ok: true,
          message: "Token received. You can return to the terminal.",
        });
        finishResolve({
          token,
          tokenPreview: previewToken(token),
          verificationUrl,
          listenHost,
          port,
        });
        return;
      }

      if (req.method === "GET" && requestUrl.pathname === "/health") {
        respondJson(res, 200, { ok: true });
        return;
      }

      respondHtml(res, 404, "Not Found", "<h1>Not Found</h1>");
    } catch (error) {
      finishReject(error);
      respondJson(res, 500, { error: "internal_error" });
    }
  });

  await new Promise((resolve, reject) => {
    const onListenError = (error) => {
      reject(new CommandError(`Failed to start Turnstile helper on ${listenHost}:${requestedPort}: ${error.message}`));
    };

    server.once("error", onListenError);
    server.listen(requestedPort, listenHost, () => resolve());
    server.once("listening", () => {
      server.off("error", onListenError);
    });
  }).catch((error) => {
    throw error instanceof CommandError
      ? error
      : new CommandError(`Failed to start Turnstile helper on ${listenHost}:${requestedPort}: ${error.message}`);
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new CommandError("Failed to determine Turnstile helper listen address.");
  }

  const port = address.port;
  const origin = normalizePublicOrigin(options.publicOrigin, listenHost, port);
  const verificationPath = `/turnstile?state=${encodeURIComponent(state)}`;
  const verificationUrl = `${origin}${verificationPath}`;

  timeout = setTimeout(() => {
    finishReject(new CommandError("Timed out waiting for Turnstile verification."));
  }, timeoutMs);

  server.on("error", (error) => {
    finishReject(new CommandError(`Turnstile helper failed: ${error.message}`));
  });

  return {
    verificationUrl,
    listenHost,
    port,
    timeoutMs,
    close: cleanup,
    completion,
  };

  function cleanup() {
    clearTimeout(timeout);
    server.close();
  }

  function finishResolve(value) {
    if (settled) {
      return;
    }
    settled = true;
    cleanup();
    resolveToken(value);
  }

  function finishReject(error) {
    if (settled) {
      return;
    }
    settled = true;
    cleanup();
    rejectToken(error);
  }
}

function normalizeListenHost(value) {
  const host = String(value ?? "127.0.0.1").trim();
  return host || "127.0.0.1";
}

function normalizePort(value) {
  if (value === undefined || value === null || value === "") {
    return 0;
  }

  const parsed = Number.parseInt(String(value), 10);
  if (Number.isNaN(parsed) || parsed < 0 || parsed > 65535) {
    throw new CommandError(`Expected port to be between 0 and 65535, received: ${value}`);
  }
  return parsed;
}

function normalizeTimeoutMs(value) {
  if (value === undefined || value === null || value === "") {
    return DEFAULT_TURNSTILE_TIMEOUT_MS;
  }

  const parsed = Number.parseInt(String(value), 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    throw new CommandError(`Expected timeout to be > 0, received: ${value}`);
  }
  return parsed;
}

function normalizePublicOrigin(publicOrigin, listenHost, port) {
  if (publicOrigin !== undefined && publicOrigin !== null && publicOrigin !== "") {
    const url = new URL(String(publicOrigin));
    return String(url).replace(/\/$/, "");
  }

  const host = ["0.0.0.0", "::"].includes(listenHost) ? "127.0.0.1" : listenHost;
  return `http://${host}:${port}`;
}

async function readJsonBody(req) {
  const chunks = [];
  let size = 0;

  for await (const chunk of req) {
    size += chunk.length;
    if (size > 64 * 1024) {
      throw new CommandError("Turnstile callback body is too large.");
    }
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw);
  } catch {
    throw new CommandError("Turnstile callback payload is not valid JSON.");
  }
}

function renderTurnstilePage({ state, actionLabel, callbackUrl }) {
  const normalizedActionLabel = actionLabel ? String(actionLabel) : "complete the next write operation";
  const consoleScript = buildTurnstileConsoleScript({
    state,
    callbackUrl,
  });

  return `
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Bangumi Turnstile Helper</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; margin: 40px auto; max-width: 880px; padding: 0 16px; line-height: 1.6; color: #1f2937; }
          .card { border: 1px solid #d1d5db; border-radius: 12px; padding: 24px; }
          h1 { font-size: 24px; margin-top: 0; }
          .muted { color: #6b7280; }
          .actions { display: flex; gap: 12px; flex-wrap: wrap; margin: 16px 0; }
          .button, button { appearance: none; border: 1px solid #2563eb; background: #2563eb; color: white; border-radius: 10px; padding: 10px 14px; cursor: pointer; font: inherit; text-decoration: none; }
          .button.secondary, button.secondary { background: white; color: #2563eb; }
          textarea { width: 100%; min-height: 220px; font: 13px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; border: 1px solid #d1d5db; border-radius: 10px; padding: 12px; box-sizing: border-box; }
          #tokenInput { min-height: 110px; }
          #status { margin-top: 16px; font-weight: 600; }
          #details { margin-top: 8px; color: #374151; white-space: pre-wrap; }
          code { background: #f3f4f6; padding: 2px 6px; border-radius: 6px; }
          ol { padding-left: 20px; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>Bangumi Turnstile Helper</h1>
          <p>bgm-cli needs a short-lived <code>turnstileToken</code> to ${escapeHtml(normalizedActionLabel)}.</p>
          <p class="muted">This helper page does not try to run Turnstile on localhost. Instead, it helps you run the verification inside the real <code>${TURNSTILE_MANUAL_PAGE_URL}</code> page context and send the token back to bgm-cli.</p>
          <ol>
            <li>Click <strong>Open next.bgm.tv</strong>.</li>
            <li>Open DevTools Console on that page.</li>
            <li>Click <strong>Copy console script</strong> on this helper page, then paste it into Console and press Enter.</li>
            <li>Complete the Turnstile widget shown on <code>next.bgm.tv</code>.</li>
            <li>If bgm-cli does not continue automatically, paste the token into the fallback box below and submit it manually.</li>
          </ol>
          <div class="actions">
            <a class="button" href="${TURNSTILE_MANUAL_PAGE_URL}" target="_blank" rel="noreferrer">Open next.bgm.tv</a>
            <button class="secondary" type="button" id="copyScriptButton">Copy console script</button>
            <a class="button secondary" href="${TURNSTILE_MANUAL_PAGE_URL}" target="_blank" rel="noreferrer">Open page again</a>
          </div>
          <label for="scriptBox"><strong>Console script</strong></label>
          <textarea id="scriptBox" readonly>${escapeHtml(consoleScript)}</textarea>
          <div class="actions">
            <button type="button" id="submitTokenButton">Submit token manually</button>
          </div>
          <label for="tokenInput"><strong>Fallback: paste a token manually</strong></label>
          <textarea id="tokenInput" placeholder="Paste turnstileToken here if automatic submission from next.bgm.tv fails"></textarea>
          <div id="status">Waiting for a Turnstile token...</div>
          <div id="details" class="muted"></div>
        </div>
        <script>
          const state = ${JSON.stringify(state)};
          const callbackUrl = ${JSON.stringify(callbackUrl)};
          const docsPath = ${JSON.stringify(TURNSTILE_MANUAL_DOC_PATH)};
          const scriptText = ${JSON.stringify(consoleScript)};

          function setStatus(title, detail) {
            const status = document.getElementById('status');
            const details = document.getElementById('details');
            status.textContent = title;
            details.textContent = detail || '';
          }

          document.getElementById('scriptBox').value = scriptText;

          document.getElementById('copyScriptButton').addEventListener('click', async () => {
            try {
              await navigator.clipboard.writeText(scriptText);
              setStatus('Console script copied.', 'Switch to next.bgm.tv, paste the script into DevTools Console, and complete the Turnstile check.');
            } catch {
              const textarea = document.getElementById('scriptBox');
              textarea.focus();
              textarea.select();
              setStatus('Clipboard copy failed.', 'The script text has been selected. Copy it manually, then paste it into DevTools Console on next.bgm.tv.');
            }
          });

          async function submitToken(token, source) {
            const trimmed = String(token || '').trim();
            if (!trimmed) {
              setStatus('Token required.', 'Paste a non-empty turnstileToken, then submit again.');
              return;
            }

            setStatus('Submitting token to bgm-cli...', '');

            try {
              const response = await fetch(callbackUrl, {
                method: 'POST',
                mode: 'cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: trimmed, state, source }),
              });
              const payload = await response.json().catch(() => ({}));
              if (!response.ok) {
                throw new Error(payload.error || 'verification_failed');
              }
              setStatus('Token submitted.', payload.message || 'bgm-cli should continue automatically now.');
            } catch (error) {
              setStatus(
                'Automatic submission failed.',
                (error && error.message ? error.message : 'unknown_error') + '\\n\\nKeep the token and submit it again manually, or rerun the command. See ' + docsPath,
              );
            }
          }

          document.getElementById('submitTokenButton').addEventListener('click', () => {
            submitToken(document.getElementById('tokenInput').value, 'helper-page');
          });

          setStatus('Waiting for a Turnstile token...', 'Open next.bgm.tv, run the copied script, and complete the Turnstile check. If automatic submission fails, paste the token here manually.');
        </script>
      </body>
    </html>
  `;
}

function buildTurnstileConsoleScript({ state, callbackUrl }) {
  return `(() => {
  const callbackUrl = ${JSON.stringify(callbackUrl)};
  const state = ${JSON.stringify(state)};
  const sitekey = ${JSON.stringify(TURNSTILE_SITE_KEY)};

  function log(message, ...rest) {
    console.log('[bgm-cli]', message, ...rest);
  }

  function waitForTurnstile() {
    if (window.turnstile) return Promise.resolve();
    let script = document.querySelector('script[src*="challenges.cloudflare.com/turnstile"]');
    if (!script) {
      script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    return new Promise((resolve, reject) => {
      const startedAt = Date.now();
      const timer = setInterval(() => {
        if (window.turnstile) {
          clearInterval(timer);
          resolve();
          return;
        }
        if (Date.now() - startedAt > 10000) {
          clearInterval(timer);
          reject(new Error('turnstile did not become available'));
        }
      }, 100);
    });
  }

  function ensureContainer() {
    const old = document.getElementById('bgm-cli-turnstile-box');
    if (old) old.remove();

    const box = document.createElement('div');
    box.id = 'bgm-cli-turnstile-box';
    box.style.cssText = [
      'position:fixed',
      'right:16px',
      'bottom:16px',
      'z-index:2147483647',
      'width:360px',
      'padding:16px',
      'background:#fff',
      'color:#111827',
      'border:1px solid #d1d5db',
      'border-radius:12px',
      'box-shadow:0 12px 32px rgba(0,0,0,.2)',
      'font:14px/1.5 -apple-system, BlinkMacSystemFont, sans-serif'
    ].join(';');
    box.innerHTML = [
      '<div style="font-weight:700;margin-bottom:8px">bgm-cli Turnstile Helper<\/div>',
      '<div style="margin-bottom:8px">Complete the verification below. bgm-cli will try to receive the token automatically.<\/div>',
      '<div id="bgm-cli-turnstile-widget"><\/div>',
      '<div id="bgm-cli-turnstile-status" style="margin-top:10px;color:#4b5563">Waiting for verification...<\/div>'
    ].join('');
    document.body.appendChild(box);
    return box;
  }

  async function submitToken(token, box) {
    window.__bgmCliTurnstileToken = token;
    const status = box.querySelector('#bgm-cli-turnstile-status');
    status.textContent = 'Submitting token back to bgm-cli...';

    try {
      const response = await fetch(callbackUrl, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, state, source: 'next.bgm.tv-console' }),
      });

      if (!response.ok) {
        throw new Error('local helper rejected the token with status ' + response.status);
      }

      status.textContent = 'Token sent to bgm-cli. You can return to the terminal.';
      log('turnstile token submitted to bgm-cli automatically');
      return;
    } catch (error) {
      status.textContent = 'Auto-submit failed. Copy the token from console and paste it into the helper page.';
      log('auto-submit failed:', error);
      log('turnstile token:', token);
      log('copy with: copy(window.__bgmCliTurnstileToken)');
    }
  }

  waitForTurnstile().then(() => {
    const box = ensureContainer();
    window.__bgmCliTurnstileToken = '';
    window.turnstile.render('#bgm-cli-turnstile-widget', {
      sitekey,
      theme: 'auto',
      callback(token) {
        submitToken(token, box);
      },
      'error-callback'(code) {
        box.querySelector('#bgm-cli-turnstile-status').textContent = 'Turnstile error: ' + code;
        log('turnstile error:', code);
      },
      'expired-callback'() {
        box.querySelector('#bgm-cli-turnstile-status').textContent = 'Token expired. Re-run the script if needed.';
        log('turnstile token expired');
      },
    });
  }).catch((error) => {
    log('failed to initialize turnstile helper:', error);
  });
})();`;
}

function respondHtml(res, statusCode, statusMessage, body) {
  res.writeHead(statusCode, statusMessage, {
    "Content-Type": "text/html; charset=utf-8",
  });
  res.end(`<!doctype html>${body}`);
}

function respondJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
  });
  res.end(JSON.stringify(payload));
}

function respondCallbackPreflight(req, res) {
  res.writeHead(204, buildCallbackCorsHeaders(req));
  res.end();
}

function respondCallbackJson(req, res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    ...buildCallbackCorsHeaders(req),
  });
  res.end(JSON.stringify(payload));
}

function buildCallbackCorsHeaders(req) {
  const requestOrigin = typeof req.headers.origin === "string" ? req.headers.origin : "*";
  return {
    "Access-Control-Allow-Origin": requestOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Private-Network": "true",
    Vary: "Origin",
  };
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function previewToken(token) {
  const value = String(token ?? "");
  if (value.length <= 10) {
    return value;
  }
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}
