/**
 * OAuth and Turnstile authorization flow utilities.
 */

import http from "node:http";
import { BangumiApiError as ApiError } from "../core/http.js";
import { CommandError } from "../core/output.js";
import { escapeHtml, sleep, writeProgress } from "./helpers.js";
import {
  buildHostedRelayCorsHeaders,
  readHostedRelayJsonBody,
  respondHostedRelayJson,
  respondHostedRelayPreflight,
  respondHtml,
} from "./relay.js";

export async function waitForAuthorizationCode({ redirectUri, expectedState, timeoutMs = 300000 }) {
  const callbackUrl = new URL(redirectUri);
  const hostname = callbackUrl.hostname;
  const port = Number(callbackUrl.port || (callbackUrl.protocol === "https:" ? 443 : 80));
  const pathName = callbackUrl.pathname || "/";

  console.log(`Waiting for callback on ${hostname}:${port}${pathName}`);

  const result = await new Promise((resolve, reject) => {
    let settled = false;
    const server = http.createServer((req, res) => {
      try {
        const requestUrl = new URL(req.url ?? "/", redirectUri);
        if (requestUrl.pathname !== pathName) {
          respondHtml(res, 404, "Not Found", "<h1>Not Found</h1>");
          return;
        }

        const error = requestUrl.searchParams.get("error");
        const code = requestUrl.searchParams.get("code");
        const state = requestUrl.searchParams.get("state");

        if (error) {
          respondHtml(
            res,
            400,
            "Authorization failed",
            `<h1>Authorization failed</h1><p>${escapeHtml(error)}</p>`,
          );
          finishReject(new CommandError(`Bangumi authorization failed: ${error}`));
          return;
        }

        if (!code) {
          respondHtml(
            res,
            400,
            "Missing code",
            "<h1>Missing code</h1><p>No authorization code was returned.</p>",
          );
          finishReject(new CommandError("Authorization callback did not contain code."));
          return;
        }

        if (expectedState && state !== expectedState) {
          respondHtml(
            res,
            400,
            "Invalid state",
            "<h1>Invalid state</h1><p>State verification failed.</p>",
          );
          finishReject(new CommandError("Authorization callback state mismatch."));
          return;
        }

        respondHtml(
          res,
          200,
          "Authorization completed",
          "<h1>Authorization completed</h1><p>You can now return to the terminal.</p>",
        );
        finishResolve(code);
      } catch (error) {
        finishReject(error);
      }
    });

    server.once("error", (error) => {
      finishReject(
        new CommandError(
          `Failed to listen on redirect URI ${redirectUri}: ${error.message}. Use manual callback mode instead.`,
        ),
      );
    });

    const timeout = setTimeout(() => {
      finishReject(new CommandError("Timed out waiting for OAuth callback. Rerun `bgm --init` and choose manual callback mode if needed."));
    }, timeoutMs);

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
      resolve(value);
    }

    function finishReject(error) {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      reject(error);
    }

    server.listen(port, hostname);
  });

  return result;
}

export async function waitForHostedOAuthAuthorization(backend, session) {
  const startedAt = Date.now();
  const pollIntervalMs = session.poll_interval_ms ?? 2000;
  const expiresAt = session.expires_at ? new Date(session.expires_at).getTime() : Date.now() + 300000;

  while (Date.now() <= expiresAt) {
    let status;
    try {
      status = await backend.getSession(session.session_id);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404 && error.details?.status === "expired") {
        throw new CommandError("OAuth session expired before authorization completed.");
      }
      throw error;
    }

    if (status.status === "authorized") {
      return backend.claimSession(session.session_id);
    }

    if (status.status === "failed") {
      throw new CommandError(`OAuth authorization failed: ${status.error ?? "unknown_error"}`);
    }

    if (status.status === "expired") {
      throw new CommandError("OAuth session expired before authorization completed.");
    }

    if (Date.now() - startedAt < 1000 || (Date.now() - startedAt) % 10000 < pollIntervalMs) {
      console.log(`Waiting for authorization... session ${session.session_id}`);
    }

    await sleep(pollIntervalMs);
  }

  throw new CommandError("Timed out waiting for the hosted OAuth backend to finish authorization.");
}

export async function waitForHostedTurnstileAuthorization(backend, session, context = {}) {
  const startedAt = Date.now();
  const pollIntervalMs = session.poll_interval_ms ?? 2000;
  const expiresAt = session.expires_at ? new Date(session.expires_at).getTime() : Date.now() + 300000;

  while (Date.now() <= expiresAt) {
    let status;
    try {
      status = await backend.getTurnstileSession(session.session_id, session.session_secret);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404 && error.details?.status === "expired") {
        throw new CommandError("Turnstile session expired before verification completed.");
      }
      throw error;
    }

    if (status.status === "completed") {
      return backend.claimTurnstileSession(session.session_id, session.session_secret);
    }

    if (status.status === "failed") {
      throw new CommandError(`Turnstile verification failed: ${status.error ?? "unknown_error"}`);
    }

    if (status.status === "expired") {
      throw new CommandError("Turnstile session expired before verification completed.");
    }

    if (Date.now() - startedAt < 1000 || (Date.now() - startedAt) % 10000 < pollIntervalMs) {
      writeProgress(context, `Waiting for Turnstile verification... session ${session.session_id}`);
    }

    await sleep(pollIntervalMs);
  }

  throw new CommandError("Timed out waiting for the hosted Turnstile backend to finish verification.");
}

export async function startHostedRelayReceiver({ kind, timeoutMs = 300000 }) {
  const hostname = "0.0.0.0";
  const server = http.createServer();
  let settled = false;
  let timeout = null;
  let resolveCompletion;
  let rejectCompletion;

  const completion = new Promise((resolve, reject) => {
    resolveCompletion = resolve;
    rejectCompletion = reject;
  });

  server.on("request", async (req, res) => {
    try {
      const origin = callbackUrl ? new URL(callbackUrl).origin : `http://${hostname}`;
      const requestUrl = new URL(req.url ?? "/", origin);

      if (req.method === "OPTIONS" && requestUrl.pathname === "/callback") {
        respondHostedRelayPreflight(req, res);
        return;
      }

      if (req.method === "POST" && requestUrl.pathname === "/callback") {
        const payload = await readHostedRelayJsonBody(req);

        if (kind === "oauth") {
          if (!payload || typeof payload.access_token !== "string") {
            respondHostedRelayJson(req, res, 400, { error: "missing_access_token" });
            return;
          }
        }

        if (kind === "turnstile") {
          if (!payload || typeof payload.turnstileToken !== "string") {
            respondHostedRelayJson(req, res, 400, { error: "missing_turnstile_token" });
            return;
          }
        }

        respondHostedRelayJson(req, res, 200, {
          ok: true,
          message: "Payload received. You can return to the terminal.",
        });
        finishResolve(payload);
        return;
      }

      if (req.method === "GET" && requestUrl.pathname === "/health") {
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ ok: true, kind }));
        return;
      }

      respondHtml(res, 404, "Not Found", "<h1>Not Found</h1>");
    } catch (error) {
      finishReject(error);
      respondHostedRelayJson(req, res, 500, { error: "internal_error" });
    }
  });

  await new Promise((resolve, reject) => {
    const onError = (error) => reject(new CommandError(`Failed to start local relay receiver: ${error.message}`));
    server.once("error", onError);
    server.listen(0, hostname, () => resolve());
    server.once("listening", () => {
      server.off("error", onError);
    });
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new CommandError("Failed to determine local relay receiver address.");
  }

  const callbackUrl = `http://${hostname}:${address.port}/callback`;
  timeout = setTimeout(() => {
    finishReject(new CommandError(`Timed out waiting for the hosted ${kind} callback relay.`));
  }, timeoutMs);

  return {
    callbackUrl,
    completion,
    timeoutMs,
    close: cleanup,
  };

  function cleanup() {
    if (timeout) {
      clearTimeout(timeout);
    }
    server.close();
  }

  function finishResolve(value) {
    if (settled) {
      return;
    }
    settled = true;
    cleanup();
    resolveCompletion(value);
  }

  function finishReject(error) {
    if (settled) {
      return;
    }
    settled = true;
    cleanup();
    rejectCompletion(error);
  }
}
