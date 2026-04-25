import { BangumiApiError, requestJson, requestText } from "./http.js";
import { CommandError } from "./output.js";

const API_BASE_URL = "https://api.bgm.tv";
const PRIVATE_API_BASE_URL = "https://next.bgm.tv";
const OAUTH_BASE_URL = "https://bgm.tv";
const STATUS_BASE_URL = "https://bgm-status.ry.mk";
const STATUS_FEED_URL = `${STATUS_BASE_URL}/api/feed.atom`;
const STATUS_API_URL = `${STATUS_BASE_URL}/api/status`;

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

  async listGroups(query) {
    return this.request("/p1/groups", {
      query,
    });
  }

  async getGroup(groupName) {
    if (!groupName) {
      throw new CommandError("Missing groupName.");
    }

    return this.request(`/p1/groups/${encodeURIComponent(String(groupName))}`);
  }

  async listGroupMembers(groupName, query) {
    if (!groupName) {
      throw new CommandError("Missing groupName.");
    }

    return this.request(`/p1/groups/${encodeURIComponent(String(groupName))}/members`, {
      query,
    });
  }

  async listGroupTopics(groupName, query) {
    if (!groupName) {
      throw new CommandError("Missing groupName.");
    }

    return this.request(`/p1/groups/${encodeURIComponent(String(groupName))}/topics`, {
      query,
    });
  }

  async createGroupTopic(groupName, payload = {}) {
    if (!groupName) {
      throw new CommandError("Missing groupName.");
    }

    return this.request(`/p1/groups/${encodeURIComponent(String(groupName))}/topics`, {
      method: "POST",
      auth: true,
      body: payload,
    });
  }

  async listRecentGroupTopics(query) {
    return this.request("/p1/groups/-/topics", {
      query,
    });
  }

  async getGroupTopic(topicId) {
    if (!topicId) {
      throw new CommandError("Missing topicId.");
    }

    return this.request(`/p1/groups/-/topics/${encodeURIComponent(String(topicId))}`);
  }

  async createGroupReply(topicId, payload = {}) {
    if (!topicId) {
      throw new CommandError("Missing topicId.");
    }

    return this.request(`/p1/groups/-/topics/${encodeURIComponent(String(topicId))}/replies`, {
      method: "POST",
      auth: true,
      body: payload,
    });
  }

  async listUserBlogs(username, query) {
    if (!username) {
      throw new CommandError("Missing username. Pass a username or log in first.");
    }

    return this.request(`/p1/users/${encodeURIComponent(String(username))}/blogs`, {
      auth: true,
      query,
    });
  }

  async listTimeline(query) {
    return this.request("/p1/timeline", {
      auth: true,
      query,
    });
  }

  async createTimeline(payload = {}) {
    return this.request("/p1/timeline", {
      method: "POST",
      auth: true,
      body: payload,
    });
  }

  async listUserTimeline(username, query) {
    if (!username) {
      throw new CommandError("Missing username. Pass a username or log in first.");
    }

    return this.request(`/p1/users/${encodeURIComponent(String(username))}/timeline`, {
      auth: true,
      query,
    });
  }

  async listTimelineReplies(timelineId) {
    if (!timelineId) {
      throw new CommandError("Missing timelineId.");
    }

    return this.request(`/p1/timeline/${encodeURIComponent(String(timelineId))}/replies`, {
      auth: true,
    });
  }

  async createTimelineReply(timelineId, payload = {}) {
    if (!timelineId) {
      throw new CommandError("Missing timelineId.");
    }

    return this.request(`/p1/timeline/${encodeURIComponent(String(timelineId))}/replies`, {
      method: "POST",
      auth: true,
      body: payload,
    });
  }

  async deleteTimeline(timelineId) {
    if (!timelineId) {
      throw new CommandError("Missing timelineId.");
    }

    return this.request(`/p1/timeline/${encodeURIComponent(String(timelineId))}`, {
      method: "DELETE",
      auth: true,
    });
  }

  async likeTimeline(timelineId, value) {
    if (!timelineId) {
      throw new CommandError("Missing timelineId.");
    }

    return this.request(`/p1/timeline/${encodeURIComponent(String(timelineId))}/like`, {
      method: "PUT",
      auth: true,
      body: { value },
    });
  }

  async unlikeTimeline(timelineId) {
    if (!timelineId) {
      throw new CommandError("Missing timelineId.");
    }

    return this.request(`/p1/timeline/${encodeURIComponent(String(timelineId))}/like`, {
      method: "DELETE",
      auth: true,
    });
  }

  async getBlogEntry(entryId) {
    if (!entryId) {
      throw new CommandError("Missing entryId.");
    }

    return this.request(`/p1/blogs/${encodeURIComponent(String(entryId))}`, {
      auth: true,
    });
  }

  async listBlogComments(entryId) {
    if (!entryId) {
      throw new CommandError("Missing entryId.");
    }

    return this.request(`/p1/blogs/${encodeURIComponent(String(entryId))}/comments`, {
      auth: true,
    });
  }

  async createBlogComment(entryId, payload = {}) {
    if (!entryId) {
      throw new CommandError("Missing entryId.");
    }

    return this.request(`/p1/blogs/${encodeURIComponent(String(entryId))}/comments`, {
      method: "POST",
      auth: true,
      body: payload,
    });
  }

  async updateBlogComment(commentId, payload = {}) {
    if (!commentId) {
      throw new CommandError("Missing commentId.");
    }

    return this.request(`/p1/blogs/-/comments/${encodeURIComponent(String(commentId))}`, {
      method: "PUT",
      auth: true,
      body: payload,
    });
  }

  async deleteBlogComment(commentId) {
    if (!commentId) {
      throw new CommandError("Missing commentId.");
    }

    return this.request(`/p1/blogs/-/comments/${encodeURIComponent(String(commentId))}`, {
      method: "DELETE",
      auth: true,
    });
  }

  async listBlogPhotos(entryId, query) {
    if (!entryId) {
      throw new CommandError("Missing entryId.");
    }

    return this.request(`/p1/blogs/${encodeURIComponent(String(entryId))}/photos`, {
      auth: true,
      query,
    });
  }

  async listBlogSubjects(entryId) {
    if (!entryId) {
      throw new CommandError("Missing entryId.");
    }

    return this.request(`/p1/blogs/${encodeURIComponent(String(entryId))}/subjects`, {
      auth: true,
    });
  }

  async createIndex(payload = {}) {
    return this.request("/p1/indexes", {
      method: "POST",
      auth: true,
      body: payload,
    });
  }

  async getIndex(indexId) {
    if (!indexId) {
      throw new CommandError("Missing indexId.");
    }

    return this.request(`/p1/indexes/${encodeURIComponent(String(indexId))}`, {
      auth: true,
    });
  }

  async updateIndex(indexId, payload = {}) {
    if (!indexId) {
      throw new CommandError("Missing indexId.");
    }

    return this.request(`/p1/indexes/${encodeURIComponent(String(indexId))}`, {
      method: "PATCH",
      auth: true,
      body: payload,
    });
  }

  async deleteIndex(indexId) {
    if (!indexId) {
      throw new CommandError("Missing indexId.");
    }

    return this.request(`/p1/indexes/${encodeURIComponent(String(indexId))}`, {
      method: "DELETE",
      auth: true,
    });
  }

  async listIndexComments(indexId) {
    if (!indexId) {
      throw new CommandError("Missing indexId.");
    }

    return this.request(`/p1/indexes/${encodeURIComponent(String(indexId))}/comments`, {
      auth: true,
    });
  }

  async createIndexComment(indexId, payload = {}) {
    if (!indexId) {
      throw new CommandError("Missing indexId.");
    }

    return this.request(`/p1/indexes/${encodeURIComponent(String(indexId))}/comments`, {
      method: "POST",
      auth: true,
      body: payload,
    });
  }

  async updateIndexComment(commentId, payload = {}) {
    if (!commentId) {
      throw new CommandError("Missing commentId.");
    }

    return this.request(`/p1/indexes/-/comments/${encodeURIComponent(String(commentId))}`, {
      method: "PUT",
      auth: true,
      body: payload,
    });
  }

  async deleteIndexComment(commentId) {
    if (!commentId) {
      throw new CommandError("Missing commentId.");
    }

    return this.request(`/p1/indexes/-/comments/${encodeURIComponent(String(commentId))}`, {
      method: "DELETE",
      auth: true,
    });
  }

  async listIndexRelated(indexId, query) {
    if (!indexId) {
      throw new CommandError("Missing indexId.");
    }

    return this.request(`/p1/indexes/${encodeURIComponent(String(indexId))}/related`, {
      auth: true,
      query,
    });
  }

  async addIndexRelated(indexId, payload = {}) {
    if (!indexId) {
      throw new CommandError("Missing indexId.");
    }

    return this.request(`/p1/indexes/${encodeURIComponent(String(indexId))}/related`, {
      method: "PUT",
      auth: true,
      body: payload,
    });
  }

  async updateIndexRelated(indexId, relatedId, payload = {}) {
    if (!indexId) {
      throw new CommandError("Missing indexId.");
    }
    if (!relatedId) {
      throw new CommandError("Missing relatedId.");
    }

    return this.request(
      `/p1/indexes/${encodeURIComponent(String(indexId))}/related/${encodeURIComponent(String(relatedId))}`,
      {
        method: "PATCH",
        auth: true,
        body: payload,
      },
    );
  }

  async deleteIndexRelated(indexId, relatedId) {
    if (!indexId) {
      throw new CommandError("Missing indexId.");
    }
    if (!relatedId) {
      throw new CommandError("Missing relatedId.");
    }

    return this.request(
      `/p1/indexes/${encodeURIComponent(String(indexId))}/related/${encodeURIComponent(String(relatedId))}`,
      {
        method: "DELETE",
        auth: true,
      },
    );
  }

  async listCollections(username, query) {
    if (!username) {
      throw new CommandError("Missing username. Pass a username or log in first.");
    }

    return this.request(`/v0/users/${encodeURIComponent(String(username))}/collections`, {
      auth: true,
      query,
    });
  }

  async getUserCollection(username, subjectId) {
    if (!username) {
      throw new CommandError("Missing username. Pass a username or log in first.");
    }
    if (!subjectId) {
      throw new CommandError("Missing subjectId.");
    }

    return this.request(
      `/v0/users/${encodeURIComponent(String(username))}/collections/${encodeURIComponent(String(subjectId))}`,
      {
        auth: true,
      },
    );
  }

  async upsertMyCollection(subjectId, payload = {}) {
    if (!subjectId) {
      throw new CommandError("Missing subjectId.");
    }

    return this.request(`/v0/users/-/collections/${encodeURIComponent(String(subjectId))}`, {
      method: "POST",
      auth: true,
      body: payload,
    });
  }

  async patchMyCollection(subjectId, payload = {}) {
    if (!subjectId) {
      throw new CommandError("Missing subjectId.");
    }

    return this.request(`/v0/users/-/collections/${encodeURIComponent(String(subjectId))}`, {
      method: "PATCH",
      auth: true,
      body: payload,
    });
  }

  async request(path, options = {}) {
    const headers = createHeaders(this.config, { auth: options.auth, path });
    return requestJson(`${resolveApiBaseUrl(path)}${path}`, {
      method: options.method ?? "GET",
      headers,
      query: options.query,
      body: options.body,
    });
  }
}

export class BangumiStatusClient {
  constructor(config = {}) {
    this.config = config;
  }

  async getCurrentStatus() {
    return requestJson(STATUS_API_URL, {
      headers: {
        Accept: "application/json",
        "User-Agent": fallbackUserAgent(this.config),
      },
    });
  }

  async listIncidents() {
    const xml = await requestText(STATUS_FEED_URL, {
      headers: {
        Accept: "application/atom+xml, application/xml;q=0.9, text/xml;q=0.8, text/plain;q=0.1",
        "User-Agent": fallbackUserAgent(this.config),
      },
    });

    return parseStatusFeed(xml);
  }
}

function resolveApiBaseUrl(path) {
  return String(path).startsWith("/p1/") ? PRIVATE_API_BASE_URL : API_BASE_URL;
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

    try {
      const me = await requestJson(`${API_BASE_URL}/v0/me`, {
        method: "GET",
        headers: createHeaders(this.config, {
          auth: true,
          accessToken,
        }),
      });

      return {
        resource: "access-token-status",
        valid: true,
        accessToken,
        user: me,
      };
    } catch (error) {
      if (error instanceof BangumiApiError && error.status === 401) {
        return {
          resource: "access-token-status",
          valid: false,
          accessToken,
          error: error.message,
          details: error.details,
        };
      }
      throw error;
    }
  }
}

export class OAuthBackendClient {
  constructor(config = {}) {
    this.config = config;
  }

  async createSession({ relayUrl } = {}) {
    const baseUrl = this.getBaseUrl();
    return requestJson(`${baseUrl}/api/oauth/session`, {
      method: "POST",
      headers: createHeaders(this.config, { auth: false }),
      body: relayUrl ? { relay_url: relayUrl } : undefined,
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

  async createTurnstileSession({ relayUrl } = {}) {
    const baseUrl = this.getBaseUrl();
    return requestJson(`${baseUrl}/api/turnstile/session`, {
      method: "POST",
      headers: createHeaders(this.config, { auth: false }),
      body: relayUrl ? { relay_url: relayUrl } : undefined,
    });
  }

  async getTurnstileSession(sessionId, sessionSecret) {
    const baseUrl = this.getBaseUrl();
    const url = new URL(`${baseUrl}/api/turnstile/session/${encodeURIComponent(String(sessionId))}`);
    url.searchParams.set("secret", String(sessionSecret));
    return requestJson(url.toString(), {
      method: "GET",
      headers: createHeaders(this.config, { auth: false }),
    });
  }

  async claimTurnstileSession(sessionId, sessionSecret) {
    const baseUrl = this.getBaseUrl();
    const url = new URL(`${baseUrl}/api/turnstile/session/${encodeURIComponent(String(sessionId))}/claim`);
    url.searchParams.set("secret", String(sessionSecret));
    return requestJson(url.toString(), {
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
    "User-Agent": userAgent,
  };

  if (options.contentType) {
    headers["Content-Type"] = options.contentType;
  } else if (options.hasBody) {
    headers["Content-Type"] = "application/json";
  }

  const accessToken = options.accessToken ?? config.accessToken;
  const shouldAttachAuth = options.auth !== false && Boolean(accessToken);
  if (shouldAttachAuth) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const privateSessionId = typeof config.privateSessionId === "string" ? config.privateSessionId.trim() : "";
  if (privateSessionId && typeof options.path === "string" && options.path.startsWith("/p1/")) {
    headers.Cookie = `chiiNextSessionID=${privateSessionId}`;
  }

  return headers;
}

function fallbackUserAgent(config) {
  const developerId = deriveDeveloperId(config);
  const appName = config.appName ?? "bgm-cli";
  const version = config.appVersion ?? "0.1.2";
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

function parseStatusFeed(xml) {
  const entries = matchAllBlocks(xml, "entry").map((entryXml) => parseStatusEntry(entryXml));

  return {
    title: decodeXmlText(extractTagText(xml, "title") ?? "Bangumi Status · Incidents"),
    id: decodeXmlText(extractTagText(xml, "id") ?? ""),
    updatedAt: decodeXmlText(extractTagText(xml, "updated") ?? ""),
    link: extractAlternateLink(xml) ?? STATUS_BASE_URL,
    feedUrl: STATUS_FEED_URL,
    entries,
  };
}

function parseStatusEntry(entryXml) {
  const title = decodeXmlText(extractTagText(entryXml, "title") ?? "");
  const summary = decodeXmlText(extractTagText(entryXml, "summary") ?? "");
  const content = decodeXmlText(extractTagText(entryXml, "content") ?? "");
  const id = decodeXmlText(extractTagText(entryXml, "id") ?? "");
  const { severity, site, audience } = parseStatusTitle(title);
  const { date, target } = parseStatusEntryId(id);

  return {
    id,
    title,
    summary,
    content,
    updatedAt: decodeXmlText(extractTagText(entryXml, "updated") ?? ""),
    link: extractAlternateLink(entryXml) ?? STATUS_BASE_URL,
    severity,
    site,
    audience,
    date,
    target,
  };
}

function parseStatusTitle(title) {
  const match = String(title).match(/^(.+?)\s+[—-]\s+(.+?)\s+[·•]\s+(.+)$/);
  if (!match) {
    return {
      severity: null,
      site: null,
      audience: null,
    };
  }

  return {
    severity: match[1].trim(),
    site: match[2].trim(),
    audience: match[3].trim(),
  };
}

function parseStatusEntryId(id) {
  const match = String(id).match(/^tag:bgm-status\.ry\.mk,(\d{4}-\d{2}-\d{2}):(.*)$/);
  if (!match) {
    return {
      date: null,
      target: null,
    };
  }

  return {
    date: match[1],
    target: match[2] || null,
  };
}

function matchAllBlocks(xml, tagName) {
  const pattern = new RegExp(`<${tagName}\\b[^>]*>[\\s\\S]*?<\\/${tagName}>`, "g");
  return Array.from(String(xml).matchAll(pattern), (match) => match[0]);
}

function extractTagText(xml, tagName) {
  const match = String(xml).match(new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i"));
  if (!match) {
    return null;
  }
  return stripXmlTags(match[1]).trim();
}

function extractAlternateLink(xml) {
  const linkTags = Array.from(String(xml).matchAll(/<link\b([^>]*)>/gi), (match) => match[1]);

  for (const tag of linkTags) {
    const attributes = parseXmlAttributes(tag);
    if (attributes.rel === "alternate" && attributes.href) {
      return decodeXmlText(attributes.href);
    }
  }

  for (const tag of linkTags) {
    const attributes = parseXmlAttributes(tag);
    if (attributes.href) {
      return decodeXmlText(attributes.href);
    }
  }

  return null;
}

function parseXmlAttributes(source) {
  const attributes = {};
  const pattern = /(\w+)="([^"]*)"/g;

  for (const match of String(source).matchAll(pattern)) {
    attributes[match[1]] = match[2];
  }

  return attributes;
}

function stripXmlTags(value) {
  return String(value).replace(/<[^>]+>/g, "");
}

function decodeXmlText(value) {
  return String(value)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}
