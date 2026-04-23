import { readFileSync } from "node:fs";
import path from "node:path";
import { loadConfig } from "../src/config.js";

const cwd = process.cwd();
const fileEnv = {
  ...readEnvFileSafe(path.join(cwd, ".env")),
  ...readEnvFileSafe(path.join(cwd, ".env.local")),
};
const providedEnv = {
  ...fileEnv,
  ...Object.fromEntries(
    Object.entries(process.env).filter(([, value]) => value !== undefined && value !== ""),
  ),
};

try {
  const config = loadConfig(providedEnv);

  assertCallbackMatchesBaseUrl(config);

  console.log("Environment looks valid for bgm-oauth-backend.");
  console.log(`Base URL: ${config.publicBaseUrl}`);
  console.log(`Callback URL: ${config.bgmRedirectUri}`);
  console.log(`Turnstile callback URL: ${config.turnstileRedirectUri}`);
  console.log(`Session TTL: ${config.sessionTtlSeconds}s`);
  console.log(`Turnstile session TTL: ${config.turnstileSessionTtlSeconds}s`);
  console.log(`Upstash REST URL: ${maskUrl(config.upstashUrl)}`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}

function assertCallbackMatchesBaseUrl(config) {
  const expectedCallback = `${config.publicBaseUrl}/api/oauth/callback`;
  if (config.bgmRedirectUri !== expectedCallback) {
    throw new Error(
      [
        "BGM_REDIRECT_URI does not match the deployed base URL.",
        `Expected: ${expectedCallback}`,
        `Received: ${config.bgmRedirectUri}`,
      ].join("\n"),
    );
  }

  const expectedTurnstileCallback = `${config.publicBaseUrl}/api/turnstile/callback`;
  if (config.turnstileRedirectUri !== expectedTurnstileCallback) {
    throw new Error(
      [
        "BGM_TURNSTILE_REDIRECT_URI does not match the deployed base URL.",
        `Expected: ${expectedTurnstileCallback}`,
        `Received: ${config.turnstileRedirectUri}`,
      ].join("\n"),
    );
  }
}

function maskUrl(url) {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}/...`;
  } catch {
    return url;
  }
}

function readEnvFileSafe(filePath) {
  try {
    const content = readFileSync(filePath, "utf8");
    return parseEnvFile(content);
  } catch {
    return {};
  }
}

function parseEnvFile(content) {
  const env = {};

  for (const line of String(content).split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    env[key] = stripQuotes(rawValue);
  }

  return env;
}

function stripQuotes(value) {
  const trimmed = String(value).trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}
