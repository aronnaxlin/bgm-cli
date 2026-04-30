/**
 * Hosted OAuth/Turnstile relay callback utilities.
 */

import { CommandError } from "../core/output.js";
import { DEFAULT_TURNSTILE_TIMEOUT_MS } from "../core/turnstile.js";

export function computeHostedSessionTimeoutMs(expiresAt) {
  if (!expiresAt) {
    return DEFAULT_TURNSTILE_TIMEOUT_MS;
  }

  const parsed = new Date(expiresAt).getTime();
  if (Number.isNaN(parsed)) {
    return DEFAULT_TURNSTILE_TIMEOUT_MS;
  }

  return Math.max(parsed - Date.now(), 0);
}

export async function readHostedRelayJsonBody(req) {
  const chunks = [];
  let size = 0;

  for await (const chunk of req) {
    size += chunk.length;
    if (size > 256 * 1024) {
      throw new CommandError("Hosted relay callback body is too large.");
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
    throw new CommandError("Hosted relay callback payload is not valid JSON.");
  }
}

export function respondHostedRelayPreflight(req, res) {
  res.writeHead(204, buildHostedRelayCorsHeaders(req));
  res.end();
}

export function respondHostedRelayJson(req, res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    ...buildHostedRelayCorsHeaders(req),
  });
  res.end(JSON.stringify(payload));
}

export function buildHostedRelayCorsHeaders(req) {
  const requestOrigin = typeof req.headers.origin === "string" ? req.headers.origin : "*";
  return {
    "Access-Control-Allow-Origin": requestOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Private-Network": "true",
    Vary: "Origin",
  };
}

export function respondHtml(res, statusCode, statusMessage, body) {
  res.writeHead(statusCode, statusMessage, {
    "Content-Type": "text/html; charset=utf-8",
  });
  res.end(`<!doctype html><html><body>${body}</body></html>`);
}
