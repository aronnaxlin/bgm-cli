import path from "node:path";
import { readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const CONFIG_DIR = resolveConfigDir();
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");
const DEVELOPMENT_ENV_FILE = path.join(process.cwd(), "bangumi-development.env");

const ENV_TO_KEY = {
  BGM_ACCESS_TOKEN: "accessToken",
  BGM_REFRESH_TOKEN: "refreshToken",
  BGM_CLIENT_ID: "clientId",
  BGM_CLIENT_SECRET: "clientSecret",
  BGM_REDIRECT_URI: "redirectUri",
  BGM_OAUTH_SERVER_BASE_URL: "oauthServerBaseUrl",
  BGM_USER_AGENT: "userAgent",
};

export function getConfigFilePath() {
  return CONFIG_FILE;
}

export function getConfig() {
  const developmentConfig = readDevelopmentEnvConfigSafe();
  const fileConfig = readConfigSyncSafe();
  const envConfig = {};

  for (const [envName, key] of Object.entries(ENV_TO_KEY)) {
    const value = process.env[envName];
    if (value !== undefined && value !== "") {
      envConfig[key] = value;
    }
  }

  const merged = {
    ...developmentConfig,
    ...fileConfig,
    ...envConfig,
  };

  return {
    ...merged,
    userAgent: normalizeUserAgent(merged),
  };
}

export async function setConfigValues(partial) {
  const current = readConfigSyncSafe();
  const next = {
    ...current,
    ...partial,
  };

  await mkdir(CONFIG_DIR, { recursive: true });
  await writeFile(CONFIG_FILE, `${JSON.stringify(next, null, 2)}\n`, "utf8");
}

export async function clearConfigValue(key) {
  const current = readConfigSyncSafe();
  delete current[key];

  await mkdir(CONFIG_DIR, { recursive: true });
  await writeFile(CONFIG_FILE, `${JSON.stringify(current, null, 2)}\n`, "utf8");
}

function readConfigSyncSafe() {
  try {
    const content = readFileSync(CONFIG_FILE, "utf8");
    return JSON.parse(content);
  } catch {
    return {};
  }
}

function readDevelopmentEnvConfigSafe() {
  try {
    const content = readFileSync(DEVELOPMENT_ENV_FILE, "utf8");
    return parseDevelopmentEnvConfig(content);
  } catch {
    return {};
  }
}

function parseDevelopmentEnvConfig(content) {
  const config = {};
  const lines = String(content).split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const rawKey = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    const value = stripQuotedValue(rawValue);

    if (!value) {
      continue;
    }

    switch (rawKey) {
      case "BGM_APP_NAME":
        config.appName = value;
        break;
      case "BGM_ACCESS_TOKEN":
        config.accessToken = value;
        config.tokenType = config.tokenType ?? "Bearer";
        break;
      case "BGM_CLIENT_ID":
        config.clientId = value;
        break;
      case "BGM_CLIENT_SECRET":
        config.clientSecret = value;
        break;
      case "BGM_REDIRECT_URI":
        config.redirectUri = value;
        break;
      case "BGM_HOMEPAGE_LINK":
        config.homepageLink = value;
        break;
      case "BGM_OAUTH_SERVER_BASE_URL":
        config.oauthServerBaseUrl = value.replace(/\/+$/, "");
        break;
      case "BGM_DEVELOPER_ID":
        config.developerId = value;
        break;
      case "BGM_APP_VERSION":
        config.appVersion = value;
        break;
      case "BGM_USER_AGENT":
        config.userAgent = value;
        break;
      default:
        break;
    }
  }

  return config;
}

function resolveConfigDir() {
  if (process.env.BGM_CONFIG_DIR) {
    return process.env.BGM_CONFIG_DIR;
  }

  if (process.env.XDG_CONFIG_HOME) {
    return path.join(process.env.XDG_CONFIG_HOME, "bgm-cli");
  }

  return path.join(process.cwd(), ".bgm-cli");
}

export async function readConfig() {
  try {
    const content = await readFile(CONFIG_FILE, "utf8");
    return JSON.parse(content);
  } catch {
    return {};
  }
}

function normalizeUserAgent(config) {
  const current = config.userAgent;
  const recommended = buildRecommendedUserAgent(config);

  if (!current) {
    return recommended;
  }

  const appName = config.appName ?? "bgm-cli";
  const version = config.appVersion ?? "0.1.0";
  const genericValues = new Set([
    `${appName}/${version}`,
    "bgm-cli/0.1.0",
    "yourname/bgm-cli/0.1.0",
  ]);

  if (genericValues.has(current) && recommended) {
    return recommended;
  }

  return current;
}

function buildRecommendedUserAgent(config) {
  const developerId = config.developerId ?? extractGithubUsername(config.homepageLink);
  const appName = config.appName ?? "bgm-cli";
  const version = config.appVersion ?? "0.1.0";
  const homepageLink = config.homepageLink;

  let userAgent = developerId ? `${developerId}/${appName}/${version}` : `${appName}/${version}`;

  if (homepageLink) {
    userAgent += ` (${homepageLink})`;
  }

  return userAgent;
}

function extractGithubUsername(homepageLink) {
  if (!homepageLink) {
    return null;
  }

  const githubMatch = String(homepageLink).match(/^https?:\/\/github\.com\/([^/]+)/i);
  return githubMatch?.[1] ?? null;
}

function stripQuotedValue(value) {
  const trimmed = String(value).trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}
