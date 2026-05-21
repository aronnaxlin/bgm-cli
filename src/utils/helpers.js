/**
 * General helper utilities.
 */

import { spawnSync } from "node:child_process";
import { chmodSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import {
  getConfig,
  getConfigFilePath,
  getConfigSourceFilePath,
} from "../core/config.js";
import { CommandError } from "../core/output.js";
import { DEFAULT_TURNSTILE_TIMEOUT_MS } from "../core/turnstile.js";
import { fallbackUserAgent } from "./auth.js";

export function delayMs(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function normalizeConfigKey(key) {
  const aliasMap = {
    clientid: "clientId",
    clientsecret: "clientSecret",
    redirecturi: "redirectUri",
    oauthserverbaseurl: "oauthServerBaseUrl",
    accesstoken: "accessToken",
    refreshtoken: "refreshToken",
    tokentype: "tokenType",
    useragent: "userAgent",
    timezone: "timezone",
  };

  const condensed = String(key).replace(/[-_]/g, "").toLowerCase();
  const normalized = aliasMap[condensed];
  if (!normalized) {
    throw new CommandError(`Unsupported config key: ${key}`);
  }
  return normalized;
}

export function previewToken(token) {
  const value = String(token);
  if (value.length <= 10) {
    return value;
  }
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

export function formatPlatformName(platform) {
  switch (platform) {
    case "darwin":
      return "macOS";
    case "win32":
      return "Windows";
    default:
      return "Linux";
  }
}

export function pathsEqual(left, right) {
  if (process.platform === "win32") {
    return path.resolve(left).toLowerCase() === path.resolve(right).toLowerCase();
  }

  return path.resolve(left) === path.resolve(right);
}

export function ensureExecutable(filePath) {
  try {
    chmodSync(filePath, 0o755);
  } catch {
    // Best effort only. If chmod fails, the installer may still succeed on systems
    // where executable bits are already correct.
  }
}

export function hasSavedConfigValue(value) {
  return typeof value === "string" ? value.trim().length > 0 : Boolean(value);
}

export function writeProgress(context, message) {
  const output = context?.json ? console.error : console.log;
  output(message);
}

export function tryOpenExternalUrl(url) {
  const platform = process.platform;
  const command = platform === "darwin"
    ? "open"
    : platform === "win32"
      ? "cmd"
      : "xdg-open";
  const commandArgs = platform === "win32"
    ? ["/c", "start", "", url]
    : [url];

  const result = spawnSync(command, commandArgs, {
    stdio: "ignore",
  });

  return !result.error && result.status === 0;
}

export function compareStrings(left, right) {
  return String(left).localeCompare(String(right), "zh-Hans-CN");
}

export function parseOptionalInteger(value) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const parsed = Number.parseInt(String(value), 10);
  if (Number.isNaN(parsed)) {
    throw new CommandError(`Expected integer, received: ${value}`);
  }
  return parsed;
}

export function normalizeNonNegativeInteger(value, label) {
  const parsed = parseOptionalInteger(value);
  if (parsed === undefined) {
    return undefined;
  }
  if (parsed < 0) {
    throw new CommandError(`Expected ${label} to be >= 0, received: ${value}`);
  }
  return parsed;
}

export function normalizePositiveInteger(value, label) {
  const parsed = parseOptionalInteger(value);
  if (parsed === undefined) {
    return undefined;
  }
  if (parsed <= 0) {
    throw new CommandError(`Expected ${label} to be > 0, received: ${value}`);
  }
  return parsed;
}

export function normalizePageSize(value) {
  const parsed = normalizeNonNegativeInteger(value, "limit");
  if (parsed === undefined) {
    return undefined;
  }
  if (parsed > 100) {
    throw new CommandError(`Expected limit to be <= 100, received: ${value}`);
  }
  return parsed;
}

export function normalizeEpisodePageSize(value) {
  const parsed = normalizeNonNegativeInteger(value, "limit");
  if (parsed === undefined) {
    return undefined;
  }
  if (parsed === 0 || parsed > 200) {
    throw new CommandError(`Expected limit to be between 1 and 200, received: ${value}`);
  }
  return parsed;
}

export function normalizePositiveNumber(value, label) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const parsed = Number(value);
  if (Number.isNaN(parsed) || parsed <= 0) {
    throw new CommandError(`Expected ${label} to be > 0, received: ${value}`);
  }
  return parsed;
}

export function normalizeRateValue(value) {
  const parsed = parseOptionalInteger(value);
  if (parsed === undefined || parsed < 0 || parsed > 10) {
    throw new CommandError(`Expected rate to be between 0 and 10, received: ${value}`);
  }
  return parsed;
}

export function parseOptionalBoolean(value) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (typeof value === "boolean") {
    return value;
  }

  const normalized = String(value).toLowerCase();
  if (["true", "1", "yes", "y"].includes(normalized)) {
    return true;
  }
  if (["false", "0", "no", "n"].includes(normalized)) {
    return false;
  }

  throw new CommandError(`Expected boolean, received: ${value}`);
}

export function toBoolean(value, fallback) {
  if (value === undefined) {
    return fallback;
  }
  return parseOptionalBoolean(value);
}

export function normalizeTurnstileTimeoutMs(value) {
  const seconds = normalizePositiveInteger(value, "timeout-seconds");
  if (seconds === undefined) {
    return DEFAULT_TURNSTILE_TIMEOUT_MS;
  }
  return seconds * 1000;
}

export function inferConfigScope(configFile, repoRoot) {
  return configFile.startsWith(`${repoRoot}${path.sep}`) ? "project" : "global";
}

export function buildVersionStatusPayload(repoRoot) {
  const config = getConfig();
  const configFile = getConfigFilePath();
  const configSourceFile = getConfigSourceFilePath();

  return {
    resource: "version-status",
    name: config.appName ?? "bgm-cli",
    version: config.appVersion ?? "0.1.6",
    configScope: inferConfigScope(configFile, repoRoot),
    configFile,
    configSourceFile,
    accessTokenSaved: hasSavedConfigValue(config.accessToken),
    refreshTokenSaved: hasSavedConfigValue(config.refreshToken),
    privateSessionSaved: hasSavedConfigValue(config.privateSessionId),
    oauthAppConfigured:
      hasSavedConfigValue(config.clientId) &&
      hasSavedConfigValue(config.clientSecret) &&
      hasSavedConfigValue(config.redirectUri),
    oauthServerBaseUrl: config.oauthServerBaseUrl ?? null,
    timezone: config.timezone ?? null,
    userAgent: config.userAgent ?? fallbackUserAgent(config),
  };
}
