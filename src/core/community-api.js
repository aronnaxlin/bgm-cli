/**
 * Bangumi SearchEncore!! Community API Client
 *
 * ⚠️ 第三方非官方接口 / Third-party unofficial API
 * 本模块封装的是社区维护的 Bangumi 增强搜索服务（bgmdb.ry.mk）。
 * 所有数据均来自第三方爬取/聚合，非 bangumi.tv 官方提供。
 *
 * 设计原则：
 * - 与 src/core/client.js 的 BangumiClient 保持 API 风格一致。
 * - 响应格式统一适配为官方 API 的扁平结构（{ data, total, limit, offset }），
 *   抹平第三方 envelope 差异（pagination / meta）。
 * - 不携带任何认证信息（该服务为公开 API）。
 */

import { requestJson, BangumiApiError } from "./http.js";

const COMMUNITY_API_BASE_URL = "https://bgmdb.ry.mk/v1";

export class BangumiCommunityApiError extends Error {
  constructor(message, { status, details, source = "community-api" } = {}) {
    super(message);
    this.name = "BangumiCommunityApiError";
    this.status = status;
    this.details = details;
    this.source = source;
  }
}

/**
 * 标识常量：用于 UI 侧判断数据来源。
 * 所有通过本模块返回的结果都会带有此标记。
 */
export const COMMUNITY_API_SOURCE_TAG = "bgmdb.ry.mk";

/* ------------------------------------------------------------------ */
/* 通用请求与适配                                                       */
/* ------------------------------------------------------------------ */

async function communityRequest(path, options = {}) {
  const url = `${COMMUNITY_API_BASE_URL}${path}`;

  try {
    const raw = await requestJson(url, {
      method: options.method ?? "GET",
      query: options.query,
      body: options.body,
    });

    return adaptEnvelope(raw);
  } catch (error) {
    if (error instanceof BangumiApiError) {
      throw new BangumiCommunityApiError(error.message, {
        status: error.status,
        details: error.details,
      });
    }
    throw new BangumiCommunityApiError(
      `Community API request failed: ${error?.message ?? "unknown error"}`,
      {
        details: { url, path, originalError: error?.message },
      },
    );
  }
}

/**
 * 将第三方的 envelope 格式适配为官方风格：
 *   原始: { data, pagination: { total, limit, offset }, meta: { executionMs } }
 *   输出: { data, total, limit, offset, _meta: { executionMs, source } }
 *
 * 若原始已经是扁平结构，则直接透传并追加 source 标记。
 */
function adaptEnvelope(raw) {
  if (!raw || typeof raw !== "object") {
    return raw;
  }

  const pagination = raw.pagination;
  const isPaginated =
    pagination &&
    typeof pagination === "object" &&
    ("total" in pagination || "limit" in pagination || "offset" in pagination);

  const base = isPaginated
    ? {
        data: Array.isArray(raw.data) ? raw.data : [],
        total: pagination.total ?? 0,
        limit: pagination.limit ?? 20,
        offset: pagination.offset ?? 0,
      }
    : { ...raw };

  // 注入来源标记，供 UI / CLI 输出层识别
  base._meta = {
    ...(raw.meta ?? {}),
    source: COMMUNITY_API_SOURCE_TAG,
    isThirdParty: true,
  };

  return base;
}

function encode(key) {
  return encodeURIComponent(String(key));
}

function buildSearchQuery(params = {}) {
  const q = {};
  if (params.q !== undefined && params.q !== "") q.q = params.q;
  if (params.limit !== undefined) q.limit = params.limit;
  if (params.offset !== undefined) q.offset = params.offset;
  if (params.sort !== undefined) q.sort = params.sort;
  return q;
}

/* ------------------------------------------------------------------ */
/* 搜索接口                                                             */
/* ------------------------------------------------------------------ */

/**
 * 搜索条目（番剧、游戏、书籍等）。
 * 对应官方搜索能力的增强版，支持更灵活的排序和过滤。
 */
export async function searchSubjects(params = {}) {
  return communityRequest("/search/subjects", {
    query: buildSearchQuery(params),
  });
}

/**
 * 搜索用户。
 */
export async function searchUsers(params = {}) {
  return communityRequest("/search/users", {
    query: buildSearchQuery(params),
  });
}

/**
 * 搜索小组。
 */
export async function searchGroups(params = {}) {
  return communityRequest("/search/groups", {
    query: buildSearchQuery(params),
  });
}

/**
 * 搜索回复内容。
 */
export async function searchReplies(params = {}) {
  return communityRequest("/search/replies", {
    query: buildSearchQuery(params),
  });
}

/**
 * 搜索小组话题。
 */
export async function searchGroupTopics(params = {}) {
  return communityRequest("/search/group-topics", {
    query: buildSearchQuery(params),
  });
}

/**
 * 搜索条目话题。
 */
export async function searchSubjectTopics(params = {}) {
  return communityRequest("/search/subject-topics", {
    query: buildSearchQuery(params),
  });
}

/**
 * 搜索目录。
 */
export async function searchIndexes(params = {}) {
  return communityRequest("/search/indexes", {
    query: buildSearchQuery(params),
  });
}

/**
 * 搜索日志。
 */
export async function searchBlogs(params = {}) {
  return communityRequest("/search/blogs", {
    query: buildSearchQuery(params),
  });
}

/* ------------------------------------------------------------------ */
/* 列表接口                                                             */
/* ------------------------------------------------------------------ */

/**
 * 获取最新的小组话题列表。
 */
export async function listRecentGroupTopics(query = {}) {
  return communityRequest("/groups/-/topics", { query });
}

/**
 * 获取指定小组的话题列表。
 */
export async function listGroupTopics(groupKey, query = {}) {
  return communityRequest(`/groups/${encode(groupKey)}/topics`, { query });
}

/**
 * 获取指定用户的所有小组话题。
 */
export async function listUserGroupTopics(userKey, query = {}) {
  return communityRequest(`/users/${encode(userKey)}/group-topics`, { query });
}

/**
 * 获取最新的条目话题列表。
 */
export async function listRecentSubjectTopics(query = {}) {
  return communityRequest("/subjects/-/topics", { query });
}

/**
 * 获取指定条目的话题列表。
 */
export async function listSubjectTopics(subjectId, query = {}) {
  return communityRequest(`/subjects/${encode(subjectId)}/topics`, { query });
}

/**
 * 获取指定用户的所有条目话题。
 */
export async function listUserSubjectTopics(userKey, query = {}) {
  return communityRequest(`/users/${encode(userKey)}/subject-topics`, { query });
}

/**
 * 获取指定用户的目录列表。
 */
export async function listUserIndexes(userKey, query = {}) {
  return communityRequest(`/users/${encode(userKey)}/indexes`, { query });
}

/**
 * 获取指定用户的日志列表。
 */
export async function listUserBlogs(userKey, query = {}) {
  return communityRequest(`/users/${encode(userKey)}/blogs`, { query });
}

/* ------------------------------------------------------------------ */
/* 详情接口                                                             */
/* ------------------------------------------------------------------ */

/**
 * 获取单个用户信息。
 */
export async function getUser(userKey) {
  if (!userKey) {
    throw new BangumiCommunityApiError("Missing userKey.");
  }
  return communityRequest(`/users/${encode(userKey)}`);
}

/**
 * 获取用户头像历史记录。
 */
export async function getUserAvatarHistory(userKey) {
  if (!userKey) {
    throw new BangumiCommunityApiError("Missing userKey.");
  }
  return communityRequest(`/users/${encode(userKey)}/avatars`);
}

/**
 * 获取单个小组信息。
 */
export async function getGroup(groupKey) {
  if (!groupKey) {
    throw new BangumiCommunityApiError("Missing groupKey.");
  }
  return communityRequest(`/groups/${encode(groupKey)}`);
}

/**
 * 获取单个小组话题详情。
 */
export async function getGroupTopic(topicId) {
  if (!topicId) {
    throw new BangumiCommunityApiError("Missing topicId.");
  }
  return communityRequest(`/groups/-/topics/${encode(topicId)}`);
}

/**
 * 获取小组话题的回复列表。
 */
export async function listGroupTopicReplies(topicId, query = {}) {
  if (!topicId) {
    throw new BangumiCommunityApiError("Missing topicId.");
  }
  return communityRequest(`/groups/-/topics/${encode(topicId)}/replies`, { query });
}

/**
 * 获取单个条目话题详情。
 */
export async function getSubjectTopic(topicId) {
  if (!topicId) {
    throw new BangumiCommunityApiError("Missing topicId.");
  }
  return communityRequest(`/subjects/-/topics/${encode(topicId)}`);
}

/**
 * 获取条目话题的回复列表。
 */
export async function listSubjectTopicReplies(topicId, query = {}) {
  if (!topicId) {
    throw new BangumiCommunityApiError("Missing topicId.");
  }
  return communityRequest(`/subjects/-/topics/${encode(topicId)}/replies`, { query });
}

/**
 * 获取单个目录详情。
 */
export async function getIndex(indexId) {
  if (!indexId) {
    throw new BangumiCommunityApiError("Missing indexId.");
  }
  return communityRequest(`/indexes/${encode(indexId)}`);
}

/**
 * 获取单篇日志详情。
 */
export async function getBlog(blogId) {
  if (!blogId) {
    throw new BangumiCommunityApiError("Missing blogId.");
  }
  return communityRequest(`/blogs/${encode(blogId)}`);
}

/* ------------------------------------------------------------------ */
/* 健康检查                                                             */
/* ------------------------------------------------------------------ */

/**
 * 快速探测社区 API 可用性。
 * 返回 { ok: boolean, latencyMs?: number, error?: string }
 */
export async function probeCommunityApi() {
  const start = performance.now();
  try {
    const result = await requestJson("https://bgmdb.ry.mk/health", {
      method: "GET",
    });
    return {
      ok: result?.status === "ok",
      latencyMs: Math.round(performance.now() - start),
    };
  } catch (error) {
    return {
      ok: false,
      latencyMs: Math.round(performance.now() - start),
      error: error?.message ?? "unreachable",
    };
  }
}
