/**
 * Turnstile token acquisition flow utilities.
 */

import { OAuthBackendClient } from "../core/client.js";
import { BangumiApiError as ApiError } from "../core/http.js";
import { getConfig } from "../core/config.js";
import { DEFAULT_TURNSTILE_TIMEOUT_MS, startTurnstileFlow } from "../core/turnstile.js";
import {
  normalizeTurnstileTimeoutMs,
  previewToken,
  toBoolean,
  tryOpenExternalUrl,
  writeProgress,
} from "./helpers.js";
import { CommandError } from "../core/output.js";
import process from "node:process";
import { startHostedRelayReceiver } from "./auth-flow.js";

export function shouldUseHostedTurnstileBackend(options, config) {
  if (!config?.oauthServerBaseUrl) {
    return false;
  }

  if (toBoolean(options.manual, false)) {
    return false;
  }

  if (toBoolean(options.localHelper, false)) {
    return false;
  }

  if (options.listenHost !== undefined || options.port !== undefined || options.publicOrigin !== undefined) {
    return false;
  }

  return true;
}

export function shouldFallbackFromHostedTurnstile(error) {
  if (!(error instanceof ApiError)) {
    return false;
  }

  return error.status === 404 || error.status === 405 || error.status === 501 || error.status >= 500;
}

export async function acquireTurnstileToken(options, context = {}, meta = {}) {
  if (shouldUseHostedTurnstileBackend(options, getConfig())) {
    try {
      return await acquireHostedTurnstileToken(context, meta);
    } catch (error) {
      if (shouldFallbackFromHostedTurnstile(error)) {
        writeProgress(context, "The hosted official Turnstile flow is unavailable right now. bgm-cli will fall back to the local helper flow.");
      } else {
        throw error;
      }
    }
  }

  const timeoutMs = normalizeTurnstileTimeoutMs(options.timeoutSeconds);
  const flow = await startTurnstileFlow({
    listenHost: options.listenHost,
    port: options.port,
    publicOrigin: options.publicOrigin,
    timeoutMs,
    actionLabel: meta.actionLabel,
  });

  const manualOnly = toBoolean(options.manual, false);
  let openedBrowser = false;

  writeProgress(context, `${meta.actionLabel ? `Turnstile verification is required to ${meta.actionLabel}.` : "Turnstile verification is required."}`);
  writeProgress(context, "Mode: local fallback helper");
  writeProgress(context, `Helper page: ${flow.verificationUrl}`);
  writeProgress(context, `Listening on: ${flow.listenHost}:${flow.port}`);
  writeProgress(context, "The token is short-lived and is intended for the next write operation only.");
  writeProgress(context, "The helper page shows a copyable browser script, a next.bgm.tv shortcut, and a manual paste box.");
  writeProgress(context, "If the page does not open automatically, open the helper URL yourself in a browser.");
  writeProgress(context, "bgm-cli is now waiting for the helper page to send a token back.");
  writeProgress(context, "For remote or VPS usage, rerun with `--manual --port 8765` and open the helper page through an SSH tunnel, or provide `--public-origin`.");

  if (!manualOnly) {
    openedBrowser = tryOpenExternalUrl(flow.verificationUrl);
    writeProgress(context, openedBrowser ? "Browser opened." : "Automatic browser launch failed or is unavailable.");
  }

  const result = await flow.completion;
  writeProgress(context, "Turnstile verification completed.");

  return {
    ...result,
    openedBrowser,
    timeoutMs,
  };
}

export async function acquireHostedTurnstileToken(context = {}, meta = {}) {
  const config = getConfig();
  const backend = new OAuthBackendClient(config);
  const relay = await startHostedRelayReceiver({
    kind: "turnstile",
    timeoutMs: DEFAULT_TURNSTILE_TIMEOUT_MS,
  });
  const session = await backend.createTurnstileSession({
    relayUrl: relay.callbackUrl,
  });
  const authorizeUrl = session.authorize_url;
  let openedBrowser = false;

  writeProgress(context, `${meta.actionLabel ? `Turnstile verification is required to ${meta.actionLabel}.` : "Turnstile verification is required."}`);
  writeProgress(context, "Mode: hosted official Bangumi Turnstile");
  writeProgress(context, `Turnstile backend: ${config.oauthServerBaseUrl}`);
  writeProgress(context, `Open this official URL in your browser: ${authorizeUrl}`);
  writeProgress(context, "Bangumi will show the official Turnstile verification page, then redirect back to the hosted callback.");
  writeProgress(context, "The token is short-lived and is intended for the next write operation only.");
  writeProgress(context, "After verification succeeds, the hosted callback page will try to send the token back to this terminal automatically.");

  openedBrowser = tryOpenExternalUrl(authorizeUrl);
  writeProgress(context, openedBrowser ? "Browser opened." : "Automatic browser launch failed or is unavailable.");

  const result = await relay.completion;
  writeProgress(context, "Turnstile verification completed.");

  return {
    token: result.turnstileToken,
    tokenPreview: previewToken(result.turnstileToken),
    authorizeUrl,
    redirectUri: session.redirect_uri,
    openedBrowser,
    timeoutMs: relay.timeoutMs,
    backendBaseUrl: config.oauthServerBaseUrl,
  };
}

export async function resolveTurnstileTokenForMutation(options, { actionLabel, context }) {
  const explicitToken = typeof options.turnstileToken === "string" ? options.turnstileToken.trim() : "";
  if (explicitToken) {
    return explicitToken;
  }

  if (!process.stdin.isTTY && !process.stdout.isTTY) {
    throw new CommandError(`Turnstile verification is required to ${actionLabel}. Run this command in a terminal so bgm-cli can open the official verification page or the local fallback helper, or pass --turnstile-token explicitly.`);
  }

  if (toBoolean(options.manual, false)) {
    writeProgress(context, `No --turnstile-token provided. Because you passed --manual, bgm-cli will skip the hosted official flow and use the local helper fallback to ${actionLabel}.`);
  } else if (!toBoolean(options.interactive, false)) {
    writeProgress(context, `No --turnstile-token provided. bgm-cli will first try Bangumi's official hosted Turnstile flow to ${actionLabel}.`);
  }

  const result = await acquireTurnstileToken(options, context, { actionLabel });
  return result.token;
}
