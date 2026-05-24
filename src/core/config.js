import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";

export class ConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = "ConfigError";
  }
}

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(MODULE_DIR, "../..");
const USER_CONFIG_DIR = resolveUserConfigDir();
const USER_CONFIG_FILE = path.join(USER_CONFIG_DIR, "config.json");
const PROJECT_CONFIG_DIR = path.join(REPO_ROOT, ".bgm-cli");
const PROJECT_CONFIG_FILE = path.join(PROJECT_CONFIG_DIR, "config.json");
const GLOBAL_INSTALL_MARKER = path.join(PROJECT_CONFIG_DIR, ".global-install-enabled");
const LEGACY_GLOBAL_INSTALL_MARKER = path.join(USER_CONFIG_DIR, ".global-install-enabled");
const DEV_ENV_FILE = path.join(REPO_ROOT, "bgm-dev.env");

const DEFAULT_CONFIG = {
  appName: "bgm-cli",
  appVersion: "0.1.9",
  homepageLink: "https://github.com/aronnaxlin/bgm-cli",
  developerId: "aronnaxlin",
  oauthServerBaseUrl: "https://oauth-backend-jet.vercel.app",
  timezone: "Asia/Shanghai",
};

const ENV_TO_KEY = {
  BGM_ACCESS_TOKEN: "accessToken",
  BGM_REFRESH_TOKEN: "refreshToken",
  BGM_PRIVATE_SESSION_ID: "privateSessionId",
  BGM_CLIENT_ID: "clientId",
  BGM_CLIENT_SECRET: "clientSecret",
  BGM_REDIRECT_URI: "redirectUri",
  BGM_HOMEPAGE_LINK: "homepageLink",
  BGM_OAUTH_SERVER_BASE_URL: "oauthServerBaseUrl",
  BGM_DEVELOPER_ID: "developerId",
  BGM_APP_NAME: "appName",
  BGM_APP_VERSION: "appVersion",
  BGM_USER_AGENT: "userAgent",
  BGM_TIMEZONE: "timezone",
};

export function getConfigFilePath() {
  return getActiveRuntimeConfigMeta().writeFile;
}

export function getConfigSourceFilePath() {
  return getActiveRuntimeConfigMeta().sourceFile;
}

export function getConfig() {
  const runtimeConfig = getActiveRuntimeConfigMeta().config;
  const devConfig = readEnvConfigFileSafe(DEV_ENV_FILE);
  const envConfig = {};

  for (const [envName, key] of Object.entries(ENV_TO_KEY)) {
    const value = process.env[envName];
    if (value !== undefined && value !== "") {
      envConfig[key] = normalizeEnvValue(key, value);
    }
  }

  const merged = {
    ...DEFAULT_CONFIG,
    ...devConfig,
    ...runtimeConfig,
    ...envConfig,
  };

  return {
    ...merged,
    timezone: normalizeTimezone(merged.timezone),
    userAgent: normalizeUserAgent(merged),
  };
}

export function normalizeConfigValue(key, value) {
  if (key === "timezone") {
    return normalizeTimezone(value);
  }

  return value;
}

export function normalizeTimezone(value) {
  if (value === undefined || value === null || value === "") {
    return DEFAULT_CONFIG.timezone;
  }

  const raw = String(value).trim();
  const aliasMap = {
    cst: "Asia/Shanghai",
    "utc+8": "Asia/Shanghai",
    "utc+08:00": "Asia/Shanghai",
    "gmt+8": "Asia/Shanghai",
    "gmt+08:00": "Asia/Shanghai",
    beijing: "Asia/Shanghai",
    shanghai: "Asia/Shanghai",
    "asia/shanghai": "Asia/Shanghai",
  };
  const normalized = aliasMap[raw.toLowerCase()] ?? raw;

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: normalized }).format(new Date());
    return normalized;
  } catch {
    throw new ConfigError(`Unsupported timezone: ${value}`);
  }
}

export async function setConfigValues(partial) {
  const runtimeMeta = getActiveRuntimeConfigMeta();
  const configFile = runtimeMeta.writeFile;
  const configDir = path.dirname(configFile);
  const current = runtimeMeta.config;
  const next = {
    ...current,
    ...partial,
  };

  await mkdir(configDir, { recursive: true });
  await writeFile(configFile, `${JSON.stringify(next, null, 2)}\n`, "utf8");
}

export async function clearConfigValue(key) {
  const runtimeMeta = getActiveRuntimeConfigMeta();
  const configFile = runtimeMeta.writeFile;
  const configDir = path.dirname(configFile);
  const current = { ...runtimeMeta.config };
  delete current[key];

  await mkdir(configDir, { recursive: true });
  await writeFile(configFile, `${JSON.stringify(current, null, 2)}\n`, "utf8");
}

export async function clearConfigValues(keys) {
  const runtimeMeta = getActiveRuntimeConfigMeta();
  const configFile = runtimeMeta.writeFile;
  const configDir = path.dirname(configFile);
  const current = { ...runtimeMeta.config };

  for (const key of keys) {
    delete current[key];
  }

  await mkdir(configDir, { recursive: true });
  await writeFile(configFile, `${JSON.stringify(current, null, 2)}\n`, "utf8");
}

export async function readConfig() {
  return getActiveRuntimeConfigMeta().config;
}

export async function enableGlobalConfigMode() {
  await mkdir(PROJECT_CONFIG_DIR, { recursive: true });
  await writeFile(GLOBAL_INSTALL_MARKER, "enabled\n", "utf8");

  const userState = readJsonFileState(USER_CONFIG_FILE);
  if (userState.exists) {
    if (!userState.ok) {
      throw new ConfigError(`Failed to parse global config file: ${USER_CONFIG_FILE}`);
    }
    return {
      markerFile: GLOBAL_INSTALL_MARKER,
      configFile: USER_CONFIG_FILE,
      migrated: false,
    };
  }

  const projectState = readJsonFileState(PROJECT_CONFIG_FILE);
  if (projectState.exists) {
    if (!projectState.ok) {
      throw new ConfigError(`Failed to parse project config file: ${PROJECT_CONFIG_FILE}`);
    }

    await mkdir(USER_CONFIG_DIR, { recursive: true });
    await writeFile(USER_CONFIG_FILE, `${JSON.stringify(projectState.value, null, 2)}\n`, "utf8");
    return {
      markerFile: GLOBAL_INSTALL_MARKER,
      configFile: USER_CONFIG_FILE,
      migrated: true,
    };
  }

  return {
    markerFile: GLOBAL_INSTALL_MARKER,
    configFile: USER_CONFIG_FILE,
    migrated: false,
  };
}

function getActiveRuntimeConfigMeta() {
  if (isGlobalInstallEnabled()) {
    return getGlobalRuntimeConfigMeta();
  }
  return getProjectRuntimeConfigMeta();
}

function getGlobalRuntimeConfigMeta() {
  const userState = readJsonFileState(USER_CONFIG_FILE);
  if (userState.exists) {
    if (!userState.ok) {
      throw new ConfigError(`Failed to parse global config file: ${USER_CONFIG_FILE}`);
    }
    return {
      config: userState.value,
      sourceFile: USER_CONFIG_FILE,
      writeFile: USER_CONFIG_FILE,
    };
  }

  const projectState = readJsonFileState(PROJECT_CONFIG_FILE);
  if (projectState.exists) {
    if (!projectState.ok) {
      throw new ConfigError(`Failed to parse project config file: ${PROJECT_CONFIG_FILE}`);
    }
    return {
      config: projectState.value,
      sourceFile: PROJECT_CONFIG_FILE,
      writeFile: USER_CONFIG_FILE,
    };
  }

  return {
    config: {},
    sourceFile: USER_CONFIG_FILE,
    writeFile: USER_CONFIG_FILE,
  };
}

function getProjectRuntimeConfigMeta() {
  const projectState = readJsonFileState(PROJECT_CONFIG_FILE);
  if (projectState.exists) {
    if (!projectState.ok) {
      throw new ConfigError(`Failed to parse project config file: ${PROJECT_CONFIG_FILE}`);
    }
    return {
      config: projectState.value,
      sourceFile: PROJECT_CONFIG_FILE,
      writeFile: PROJECT_CONFIG_FILE,
    };
  }

  return {
    config: {},
    sourceFile: PROJECT_CONFIG_FILE,
    writeFile: PROJECT_CONFIG_FILE,
  };
}

function isGlobalInstallEnabled() {
  return existsSync(GLOBAL_INSTALL_MARKER) || existsSync(LEGACY_GLOBAL_INSTALL_MARKER);
}

function resolveUserConfigDir() {
  if (process.platform === "win32" && process.env.APPDATA) {
    return path.join(process.env.APPDATA, "bgm-cli");
  }

  return path.join(os.homedir(), ".config", "bgm-cli");
}

function readJsonFileState(filePath) {
  if (!existsSync(filePath)) {
    return {
      exists: false,
      ok: true,
      value: {},
    };
  }

  try {
    const content = readFileSync(filePath, "utf8");
    return {
      exists: true,
      ok: true,
      value: JSON.parse(content),
    };
  } catch {
    return {
      exists: true,
      ok: false,
      value: {},
    };
  }
}

function readEnvConfigFileSafe(filePath) {
  try {
    const content = readFileSync(filePath, "utf8");
    return parseEnvConfig(content);
  } catch {
    return {};
  }
}

function parseEnvConfig(content) {
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

    const key = ENV_TO_KEY[rawKey];
    if (key) {
      config[key] = normalizeEnvValue(key, value);
    }
  }

  return config;
}

function normalizeEnvValue(key, value) {
  if (key === "oauthServerBaseUrl") {
    return String(value).replace(/\/+$/, "");
  }

  if (key === "accessToken") {
    return String(value);
  }

  if (key === "timezone") {
    return normalizeTimezone(value);
  }

  return value;
}

function normalizeUserAgent(config) {
  const current = config.userAgent;
  const recommended = buildRecommendedUserAgent(config);
  const legacyRecommended = buildRecommendedUserAgent({
    ...config,
    appVersion: "0.1.0",
  });

  if (!current) {
    return recommended;
  }

  const appName = config.appName ?? "bgm-cli";
  const version = config.appVersion ?? "0.1.9";
  const genericValues = new Set([
    `${appName}/${version}`,
    `${appName}/0.1.0`,
    "bgm-cli/0.1.3",
    "bgm-cli/0.1.0",
    "yourname/bgm-cli/0.1.3",
    "yourname/bgm-cli/0.1.0",
  ]);

  if ((genericValues.has(current) || current === legacyRecommended) && recommended) {
    return recommended;
  }

  return current;
}

function buildRecommendedUserAgent(config) {
  const developerId = config.developerId ?? extractGithubUsername(config.homepageLink);
  const appName = config.appName ?? "bgm-cli";
  const version = config.appVersion ?? "0.1.9";
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
