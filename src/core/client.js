import { requestJson } from "./http.js";
import { CommandError } from "./output.js";

const API_BASE_URL = "https://api.bgm.tv";
const OAUTH_BASE_URL = "https://bgm.tv";

export class BangumiClient {
  constructor(config = {}) {
    this.config = config;
  }

  async getMe() {
    return this.request("/v0/me", {
      auth: true,
    });
  }

  async getUser(username) {
    return this.request(`/v0/users/${encodeURIComponent(String(username))}`);
  }

  async getSubject(subjectId) {
    return this.request(`/v0/subjects/${encodeURIComponent(String(subjectId))}`);
  }

  async listSubjects(query) {
    return this.request("/v0/subjects", {
      query,
    });
  }

  async searchSubjects({ limit, offset, keyword, sort, filter }) {
    return this.request("/v0/search/subjects", {
      method: "POST",
      query: { limit, offset },
      body: {
        keyword,
        sort,
        filter: Object.keys(filter ?? {}).length > 0 ? filter : undefined,
      },
    });
  }

  async request(path, options = {}) {
    const headers = createHeaders(this.config, { auth: options.auth });
    return requestJson(`${API_BASE_URL}${path}`, {
      method: options.method ?? "GET",
      headers,
      query: options.query,
      body: options.body,
    });
  }
}

export class BangumiOAuthClient {
  constructor(config = {}) {
    this.config = config;
  }

  createAuthorizationUrl({ clientId, redirectUri, state }) {
    if (!clientId) {
      throw new CommandError("Missing clientId. Set it in config or pass --client-id.");
    }

    const url = new URL(`${OAUTH_BASE_URL}/oauth/authorize`);
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("response_type", "code");
    if (redirectUri) {
      url.searchParams.set("redirect_uri", redirectUri);
    }
    if (state) {
      url.searchParams.set("state", state);
    }
    return url.toString();
  }

  async exchangeCode({ code, clientId, clientSecret, redirectUri }) {
    assertOAuthCredentials({ code, clientId, clientSecret, redirectUri });

    return requestJson(`${OAUTH_BASE_URL}/oauth/access_token`, {
      method: "POST",
      headers: createHeaders(this.config),
      body: {
        grant_type: "authorization_code",
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      },
    });
  }

  async refreshToken({ refreshToken, clientId, clientSecret, redirectUri }) {
    if (!refreshToken) {
      throw new CommandError("Missing refreshToken. Set it in config or pass --refresh-token.");
    }
    if (!clientId) {
      throw new CommandError("Missing clientId. Set it in config or pass --client-id.");
    }
    if (!clientSecret) {
      throw new CommandError("Missing clientSecret. Set it in config or pass --client-secret.");
    }
    if (!redirectUri) {
      throw new CommandError("Missing redirectUri. Set it in config or pass --redirect-uri.");
    }

    return requestJson(`${OAUTH_BASE_URL}/oauth/access_token`, {
      method: "POST",
      headers: createHeaders(this.config),
      body: {
        grant_type: "refresh_token",
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        redirect_uri: redirectUri,
      },
    });
  }

  async getTokenStatus({ accessToken }) {
    if (!accessToken) {
      throw new CommandError("Missing accessToken. Set it in config or pass --access-token.");
    }

    return requestJson(`${OAUTH_BASE_URL}/oauth/token_status`, {
      method: "POST",
      headers: createHeaders(this.config, {
        auth: false,
        contentType: "application/x-www-form-urlencoded",
      }),
      form: {
        access_token: accessToken,
      },
    });
  }
}

export class OAuthBackendClient {
  constructor(config = {}) {
    this.config = config;
  }

  async createSession() {
    const baseUrl = this.getBaseUrl();
    return requestJson(`${baseUrl}/api/oauth/session`, {
      method: "POST",
      headers: createHeaders(this.config, { auth: false }),
    });
  }

  async getSession(sessionId) {
    const baseUrl = this.getBaseUrl();
    return requestJson(`${baseUrl}/api/oauth/session/${encodeURIComponent(String(sessionId))}`, {
      method: "GET",
      headers: createHeaders(this.config, { auth: false }),
    });
  }

  async claimSession(sessionId) {
    const baseUrl = this.getBaseUrl();
    return requestJson(`${baseUrl}/api/oauth/session/${encodeURIComponent(String(sessionId))}/claim`, {
      method: "POST",
      headers: createHeaders(this.config, { auth: false }),
    });
  }

  getBaseUrl() {
    const baseUrl = this.config.oauthServerBaseUrl;
    if (!baseUrl) {
      throw new CommandError("Missing oauthServerBaseUrl. Set it in config or bangumi-development.");
    }
    return String(baseUrl).replace(/\/+$/, "");
  }
}

function assertOAuthCredentials({ code, clientId, clientSecret, redirectUri }) {
  if (!code) {
    throw new CommandError("Missing authorization code. Pass --code.");
  }
  if (!clientId) {
    throw new CommandError("Missing clientId. Set it in config or pass --client-id.");
  }
  if (!clientSecret) {
    throw new CommandError("Missing clientSecret. Set it in config or pass --client-secret.");
  }
  if (!redirectUri) {
    throw new CommandError("Missing redirectUri. Set it in config or pass --redirect-uri.");
  }
}

function createHeaders(config, options = {}) {
  const userAgent = config.userAgent ?? fallbackUserAgent(config);
  const headers = {
    Accept: "application/json",
    "Content-Type": options.contentType ?? "application/json",
    "User-Agent": userAgent,
  };

  const accessToken = config.accessToken;
  const shouldAttachAuth = options.auth !== false && Boolean(accessToken);
  if (shouldAttachAuth) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  return headers;
}

function fallbackUserAgent(config) {
  const developerId = deriveDeveloperId(config);
  const appName = config.appName ?? "bgm-cli";
  const version = config.appVersion ?? "0.1.0";
  const homepageLink = config.homepageLink;

  let userAgent = developerId
    ? `${developerId}/${appName}/${version}`
    : `${appName}/${version}`;

  if (homepageLink) {
    userAgent += ` (${homepageLink})`;
  }

  return userAgent;
}

function deriveDeveloperId(config) {
  if (config.developerId) {
    return config.developerId;
  }

  if (config.homepageLink) {
    const githubMatch = String(config.homepageLink).match(/^https?:\/\/github\.com\/([^/]+)/i);
    if (githubMatch) {
      return githubMatch[1];
    }
  }

  return null;
}
