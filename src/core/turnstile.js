import http from "node:http";
import { randomUUID } from "node:crypto";
import { CommandError } from "./output.js";

export const TURNSTILE_SITE_KEY = "0x4AAAAAAABkMYinukE8nzYS";
export const DEFAULT_TURNSTILE_TIMEOUT_MS = 300000;

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

        respondHtml(res, 200, "Turnstile verification", renderTurnstilePage({ state }));
        return;
      }

      if (req.method === "POST" && requestUrl.pathname === "/callback") {
        const body = await readJsonBody(req);
        if (body.state !== state) {
          respondJson(res, 400, { error: "invalid_state" });
          return;
        }

        const token = typeof body.token === "string" ? body.token.trim() : "";
        if (!token) {
          respondJson(res, 400, { error: "missing_token" });
          return;
        }

        respondJson(res, 200, {
          ok: true,
          message: "Verification completed. You can return to the terminal.",
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

function renderTurnstilePage({ state }) {
  return `
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Bangumi Turnstile Verification</title>
        <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; margin: 40px auto; max-width: 640px; padding: 0 16px; line-height: 1.6; color: #1f2937; }
          .card { border: 1px solid #d1d5db; border-radius: 12px; padding: 24px; }
          h1 { font-size: 24px; margin-top: 0; }
          .muted { color: #6b7280; }
          #status { margin-top: 16px; font-weight: 600; }
          #details { margin-top: 8px; color: #374151; white-space: pre-wrap; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>Bangumi verification</h1>
          <p>Complete the Turnstile check below. After it succeeds, you can return to the terminal.</p>
          <div class="cf-turnstile" data-sitekey="${TURNSTILE_SITE_KEY}" data-callback="onTurnstileSuccess"></div>
          <div id="status">Waiting for verification...</div>
          <div id="details" class="muted"></div>
        </div>
        <script>
          const state = ${JSON.stringify(state)};
          async function onTurnstileSuccess(token) {
            const status = document.getElementById('status');
            const details = document.getElementById('details');
            status.textContent = 'Submitting verification token...';
            details.textContent = '';

            try {
              const response = await fetch('/callback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, state }),
              });
              const payload = await response.json().catch(() => ({}));
              if (!response.ok) {
                throw new Error(payload.error || 'verification_failed');
              }
              status.textContent = 'Verification completed.';
              details.textContent = payload.message || 'You can now return to the terminal.';
            } catch (error) {
              status.textContent = 'Verification submission failed.';
              details.textContent = error && error.message ? error.message : 'unknown_error';
            }
          }
        </script>
      </body>
    </html>
  `;
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

function previewToken(token) {
  const value = String(token ?? "");
  if (value.length <= 10) {
    return value;
  }
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}
