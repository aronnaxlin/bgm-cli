const DEFAULT_SESSION_TTL_SECONDS = 300;

export function loadConfig(runtimeEnv = {}) {
  const env = createEnvReader(runtimeEnv);

  const config = {
    bgmClientId: env("BGM_CLIENT_ID"),
    bgmClientSecret: env("BGM_CLIENT_SECRET"),
    bgmRedirectUri: env("BGM_REDIRECT_URI"),
    publicBaseUrl: stripTrailingSlash(env("BGM_OAUTH_SERVER_BASE_URL")),
    upstashUrl: stripTrailingSlash(env("UPSTASH_REDIS_REST_URL")),
    upstashToken: env("UPSTASH_REDIS_REST_TOKEN"),
    sessionEncryptionSecret: env("SESSION_ENCRYPTION_SECRET"),
    sessionTtlSeconds: parseInteger(env("BGM_SESSION_TTL_SECONDS")) ?? DEFAULT_SESSION_TTL_SECONDS,
  };

  validateConfig(config);
  return config;
}

function createEnvReader(runtimeEnv) {
  return (key) => {
    if (runtimeEnv && runtimeEnv[key] !== undefined) {
      return normalizeEnvValue(runtimeEnv[key]);
    }
    if (typeof process !== "undefined" && process.env?.[key] !== undefined) {
      return normalizeEnvValue(process.env[key]);
    }
    return undefined;
  };
}

function validateConfig(config) {
  const requiredKeys = [
    "bgmClientId",
    "bgmClientSecret",
    "bgmRedirectUri",
    "publicBaseUrl",
    "upstashUrl",
    "upstashToken",
    "sessionEncryptionSecret",
  ];

  for (const key of requiredKeys) {
    if (!config[key]) {
      throw new Error(`Missing required backend config: ${key}`);
    }
  }
}

function parseInteger(value) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  const parsed = Number.parseInt(String(value), 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function stripTrailingSlash(value) {
  if (!value) {
    return value;
  }
  return String(value).replace(/\/+$/, "");
}

function normalizeEnvValue(value) {
  if (value === undefined || value === null) {
    return value;
  }
  return String(value)
    .trim()
    .replace(/^(?:\\r|\\n)+/, "")
    .replace(/(?:\\r|\\n)+$/, "");
}
