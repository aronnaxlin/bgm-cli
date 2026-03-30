export class CommandError extends Error {
  constructor(message) {
    super(message);
    this.name = "CommandError";
  }
}

const SUBJECT_TYPE_LABELS = {
  1: "书籍",
  2: "动画",
  3: "音乐",
  4: "游戏",
  6: "三次元",
};

const SUBJECT_TYPE_ORDER = [2, 1, 3, 4, 6];

const COLLECTION_STATUS_LABELS = {
  1: "想看",
  2: "看过",
  3: "在看",
  4: "搁置",
  5: "抛弃",
};

export function printUsage() {
  console.log(`bgm-cli

Usage
  Setup
    bgm --init
      Run the interactive setup wizard for login and local CLI setup.
    bgm [--json] setup install-path
      Add this repository to PATH so you can run bgm globally.
    bgm tui
      Open the interactive TUI for non-login operations.

  Config
    bgm [--json] config show
      Show the effective local runtime config used by the CLI.
    bgm [--json] config set <key> <value>
      Save one config value into the local CLI config file.
    bgm [--json] config unset <key>
      Remove one config value from the local CLI config file.

  Auth
    bgm [--json] auth login-url [--client-id xxx] [--redirect-uri xxx] [--state xxx]
      Generate a Bangumi OAuth authorization URL for manual testing.
    bgm [--json] auth token --code <code> [--save]
      Exchange an OAuth authorization code for access and refresh tokens.
    bgm [--json] auth refresh [--save]
      Refresh the saved OAuth access token with the refresh token.
    bgm [--json] auth set-token <access_token>
      Save an existing Bangumi access token directly without OAuth.
    bgm [--json] auth status
      Check the current access token status and expiry.

  Collections
    bgm [--json] collection list [--user <username>] [--status <wish|collect|doing|on_hold|dropped>] [--type <book|anime|music|game|real>] [--sort <updated|name|rank|community_score|user_score|date>] [--order <asc|desc>] [--limit n]
      List a user's collections, with optional filters and sorting.

  Users
    bgm [--json] user me
      Show the current authenticated user profile.
    bgm [--json] user get <username_or_initial_uid>
      Fetch one public Bangumi user profile by username or numeric ID.

  Subjects
    bgm [--json] subject get <subject_id>
      Fetch one Bangumi subject by subject ID.
    bgm [--json] subject list --type <book|anime|music|game|real> [--sort date|rank] [--limit n]
      Browse public Bangumi subjects by type and list filters.
    bgm [--json] subject search <keyword> [--type anime] [--sort match|heat|rank|score] [--tag xxx]
      Search Bangumi subjects by keyword with optional filters.

Examples:
  bgm --init
  bgm tui
  bgm config show
  bgm setup install-path
  bgm collection list --status doing --type anime --sort updated
  bgm user me
  bgm subject get 12
  bgm subject search "攻壳机动队" --type anime --limit 5
  bgm --json user me`);
}

export function printResult(value, context = {}) {
  if (context.json) {
    console.log(JSON.stringify(value, null, 2));
    return;
  }

  console.log(formatDisplayResult(value, context));
}

export function formatDisplayResult(value, context = {}) {
  if (value === null || value === undefined) {
    return String(value);
  }

  if (typeof value === "string") {
    return value;
  }

  if (isConfigShowPayload(value)) {
    return formatConfigShow(value);
  }

  if (isConfigMutationPayload(value)) {
    return formatConfigMutation(value);
  }

  if (isInstallPathPayload(value)) {
    return formatInstallPath(value);
  }

  if (isLoginUrlPayload(value)) {
    return `Authorization URL\n${value.loginUrl}`;
  }

  if (isTokenSetPayload(value)) {
    return [
      "Access token saved",
      `Config file: ${value.configFile}`,
      `Token: ${value.accessTokenPreview}`,
    ].join("\n");
  }

  if (isTokenStatusPayload(value)) {
    return formatTokenStatus(value);
  }

  if (isCollectionListPayload(value)) {
    return formatCollectionList(value);
  }

  if (isOAuthTokenPayload(value)) {
    return formatOAuthToken(value);
  }

  if (isPagedSubjectPayload(value)) {
    return formatPagedSubjects(value);
  }

  if (isSubjectPayload(value)) {
    return formatSubject(value);
  }

  if (isUserPayload(value)) {
    return formatUser(value, context);
  }

  return JSON.stringify(value, null, 2);
}

function formatConfigShow(payload) {
  const lines = ["Config", `  File: ${payload.configFile}`];
  const config = payload.config ?? {};
  const entries = Object.entries(config);

  if (entries.length === 0) {
    lines.push("  Values: empty");
    return lines.join("\n");
  }

  lines.push("  Values:");
  for (const [key, rawValue] of entries) {
    lines.push(`    ${key}: ${formatConfigValue(key, rawValue)}`);
  }
  return lines.join("\n");
}

function formatInstallPath(payload) {
  return [
    "全局命令安装完成",
    `  平台: ${payload.platform}`,
    `  仓库目录: ${payload.repoDir}`,
    "",
    payload.output,
    "",
    payload.shellHint,
  ].join("\n");
}

function formatConfigMutation(payload) {
  if (payload.updated) {
    return [
      "Config updated",
      `  Key: ${payload.updated}`,
      `  Value: ${formatConfigValue(payload.updated, payload.value)}`,
      `  Config file: ${payload.configFile}`,
    ].join("\n");
  }

  if (payload.removed) {
    return [
      "Config removed",
      `  Key: ${payload.removed}`,
      `  Config file: ${payload.configFile}`,
    ].join("\n");
  }

  return JSON.stringify(payload, null, 2);
}

function formatTokenStatus(payload) {
  return [
    "Token status",
    `  User ID: ${payload.user_id ?? "-"}`,
    `  Client ID: ${payload.client_id ?? "-"}`,
    `  Expires: ${formatTimestamp(payload.expires)}`,
    `  Scope: ${payload.scope ?? "-"}`,
    `  Access token: ${maskToken(payload.access_token)}`,
  ].join("\n");
}

function formatOAuthToken(payload) {
  return [
    "OAuth token",
    `  Access token: ${maskToken(payload.access_token)}`,
    `  Refresh token: ${maskToken(payload.refresh_token)}`,
    `  Token type: ${payload.token_type ?? "-"}`,
    `  Expires in: ${payload.expires_in ? `${payload.expires_in}s` : "-"}`,
    `  User ID: ${payload.user_id ?? "-"}`,
    `  Scope: ${payload.scope ?? "-"}`,
  ].join("\n");
}

function formatCollectionList(payload) {
  const lines = [];
  const items = Array.isArray(payload.data) ? payload.data : [];
  const filters = payload.filters ?? {};

  lines.push("收藏列表");
  lines.push(`  共 ${items.length} 项`);
  if (filters.user) {
    lines.push(`  用户: ${filters.user}`);
  }
  lines.push(`  排序: ${filters.sort ?? "updated"} / ${filters.order ?? "desc"}`);

  if (Array.isArray(filters.status) && filters.status.length > 0) {
    lines.push(`  状态筛选: ${filters.status.map((value) => formatCollectionStatus(value)).join(", ")}`);
  } else {
    lines.push("  状态筛选: 全部");
  }

  if (Array.isArray(filters.subjectType) && filters.subjectType.length > 0) {
    lines.push(`  类型筛选: ${filters.subjectType.map((value) => formatSubjectType(value)).join(", ")}`);
  } else {
    lines.push("  类型筛选: 全部");
  }

  if (items.length === 0) {
    lines.push("");
    lines.push("没有符合条件的收藏。");
    return lines.join("\n");
  }

  for (const item of items) {
    const subject = item.subject ?? {};
    const pieces = [
      `#${item.subject_id ?? subject.id ?? "-"}`,
      subject.name_cn || subject.name || "-",
      `[${formatSubjectType(item.subject_type ?? subject.type)}]`,
      `[${formatCollectionStatus(item.type)}]`,
    ];

    if (subject.name && subject.name_cn && subject.name !== subject.name_cn) {
      pieces.push(`(${subject.name})`);
    }
    if (item.rate) {
      pieces.push(`我的评分 ${item.rate}`);
    }
    if (subject.score !== undefined) {
      pieces.push(`社区评分 ${subject.score}`);
    }
    if (subject.rank) {
      pieces.push(`社区排名 #${subject.rank}`);
    }
    if (subject.date) {
      pieces.push(subject.date);
    }
    if (item.updated_at) {
      pieces.push(`updated ${item.updated_at}`);
    }

    lines.push("");
    lines.push(`• ${pieces.join("  ")}`);

    if (item.ep_status) {
      lines.push(`    章节进度: ${item.ep_status}`);
    }
    if (item.vol_status) {
      lines.push(`    卷数进度: ${item.vol_status}`);
    }
    if (Array.isArray(item.tags) && item.tags.length > 0) {
      lines.push(`    标签: ${item.tags.join(", ")}`);
    }
    if (item.comment) {
      lines.push(`    评论: ${item.comment}`);
    }
  }

  return lines.join("\n");
}

function formatUser(user, context) {
  const title = context.rawArgs?.[1] === "me" ? "Current user" : "User";
  const lines = [
    title,
    `  Nickname: ${user.nickname ?? "-"}`,
    `  Username: ${user.username ?? "-"}`,
    `  User ID: ${user.id ?? "-"}`,
    `  Profile: ${user.url ?? "-"}`,
    `  User group: ${user.user_group ?? "-"}`,
  ];

  if (user.sign) {
    lines.push(`  Sign: ${user.sign}`);
  }
  if (user.email) {
    lines.push(`  Email: ${user.email}`);
  }
  if (user.reg_time) {
    lines.push(`  Registered: ${user.reg_time}`);
  }
  if (user.time_offset !== undefined) {
    lines.push(`  Time offset: GMT${user.time_offset >= 0 ? "+" : ""}${user.time_offset}`);
  }
  if (user.avatar?.large) {
    lines.push(`  Avatar: ${user.avatar.large}`);
  }

  return lines.join("\n");
}

function formatSubject(subject) {
  const lines = [
    `Subject #${subject.id ?? "-"}`,
    `  Name: ${subject.name ?? "-"}`,
  ];

  if (subject.name_cn) {
    lines.push(`  中文名: ${subject.name_cn}`);
  }

  lines.push(`  Type: ${formatSubjectType(subject.type)}`);

  if (subject.date) {
    lines.push(`  Date: ${subject.date}`);
  }
  if (subject.platform) {
    lines.push(`  Platform: ${subject.platform}`);
  }
  if (subject.rating?.score !== undefined) {
    lines.push(`  Rating: ${subject.rating.score} (${subject.rating.total ?? 0} votes)`);
  }
  if (subject.rating?.rank) {
    lines.push(`  Rank: #${subject.rating.rank}`);
  }
  if (subject.collection) {
    lines.push(
      `  Collections: collect ${subject.collection.collect ?? 0}, wish ${subject.collection.wish ?? 0}, doing ${subject.collection.doing ?? 0}, on_hold ${subject.collection.on_hold ?? 0}, dropped ${subject.collection.dropped ?? 0}`,
    );
  }
  if (subject.url) {
    lines.push(`  URL: ${subject.url}`);
  } else if (subject.id) {
    lines.push(`  URL: https://bgm.tv/subject/${subject.id}`);
  }
  if (subject.summary) {
    lines.push("");
    lines.push("Summary");
    lines.push(indentBlock(truncateText(subject.summary.trim(), 400), 2));
  }
  if (Array.isArray(subject.meta_tags) && subject.meta_tags.length > 0) {
    lines.push("");
    lines.push("Tags");
    lines.push(`  ${subject.meta_tags.slice(0, 10).join(", ")}`);
  }

  return lines.join("\n");
}

function formatPagedSubjects(payload) {
  const lines = [
    "Subjects",
    `  Range: ${payload.offset ?? 0}-${Math.min((payload.offset ?? 0) + (payload.data?.length ?? 0), payload.total ?? payload.data?.length ?? 0)} / ${payload.total ?? payload.data?.length ?? 0}`,
  ];

  const subjects = Array.isArray(payload.data) ? payload.data : [];
  if (subjects.length === 0) {
    lines.push("No results.");
    return lines.join("\n");
  }

  const grouped = groupSubjectsByType(subjects);

  for (const group of grouped) {
    lines.push("");
    lines.push(`[ ${formatSubjectType(group.type)} ]`);
    for (const subject of group.items) {
      const pieces = [
        `#${subject.id}`,
        subject.name_cn || subject.name || "-",
      ];

      if (subject.name && subject.name_cn && subject.name !== subject.name_cn) {
        pieces.push(`(${subject.name})`);
      }

      if (subject.rating?.score !== undefined) {
        pieces.push(`score ${subject.rating.score}`);
      }
      if (subject.rating?.rank) {
        pieces.push(`rank #${subject.rating.rank}`);
      }
      if (subject.date) {
        pieces.push(subject.date);
      }

      lines.push(`• ${pieces.join("  ")}`);
    }
  }

  return lines.join("\n");
}

function groupSubjectsByType(subjects) {
  const map = new Map();

  for (const subject of subjects) {
    const type = Number(subject?.type ?? -1);
    if (!map.has(type)) {
      map.set(type, []);
    }
    map.get(type).push(subject);
  }

  return [...map.entries()]
    .sort((left, right) => compareSubjectTypeOrder(left[0], right[0]))
    .map(([type, items]) => ({ type, items: sortSubjectsWithinType(items) }));
}

function compareSubjectTypeOrder(left, right) {
  const leftIndex = SUBJECT_TYPE_ORDER.indexOf(left);
  const rightIndex = SUBJECT_TYPE_ORDER.indexOf(right);
  const normalizedLeft = leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex;
  const normalizedRight = rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex;

  if (normalizedLeft !== normalizedRight) {
    return normalizedLeft - normalizedRight;
  }

  return left - right;
}

function sortSubjectsWithinType(subjects) {
  return [...subjects].sort((left, right) => {
    const leftRank = Number(left?.rating?.rank ?? left?.rank ?? Number.MAX_SAFE_INTEGER);
    const rightRank = Number(right?.rating?.rank ?? right?.rank ?? Number.MAX_SAFE_INTEGER);

    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }

    const leftScore = Number(left?.rating?.score ?? -1);
    const rightScore = Number(right?.rating?.score ?? -1);
    if (leftScore !== rightScore) {
      return rightScore - leftScore;
    }

    const leftName = String(left?.name_cn || left?.name || "");
    const rightName = String(right?.name_cn || right?.name || "");
    return leftName.localeCompare(rightName, "zh-Hans-CN");
  });
}

function formatConfigValue(key, value) {
  if (value === undefined || value === null || value === "") {
    return "-";
  }

  const sensitiveKeys = new Set([
    "accessToken",
    "refreshToken",
    "clientSecret",
    "tokenType",
  ]);

  if (sensitiveKeys.has(key)) {
    if (key === "tokenType") {
      return String(value);
    }
    return maskToken(String(value));
  }

  return String(value);
}

function maskToken(token) {
  if (!token) {
    return "-";
  }

  const value = String(token);
  if (value.length <= 10) {
    return `${value.slice(0, 2)}***`;
  }

  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function truncateText(text, maxLength) {
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength).trimEnd()}...`;
}

function indentBlock(text, spaces = 2) {
  const prefix = " ".repeat(spaces);
  return String(text)
    .split("\n")
    .map((line) => `${prefix}${line}`)
    .join("\n");
}

function formatTimestamp(value) {
  if (!value) {
    return "-";
  }

  const date = new Date(Number(value) * 1000);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toISOString();
}

function formatSubjectType(type) {
  return SUBJECT_TYPE_LABELS[type] ?? String(type ?? "-");
}

function formatCollectionStatus(type) {
  return COLLECTION_STATUS_LABELS[type] ?? String(type ?? "-");
}

function isConfigShowPayload(value) {
  return isObject(value) && "configFile" in value && "config" in value;
}

function isConfigMutationPayload(value) {
  return isObject(value) && ("updated" in value || "removed" in value);
}

function isInstallPathPayload(value) {
  return isObject(value) && value.action === "install-path";
}

function isLoginUrlPayload(value) {
  return isObject(value) && typeof value.loginUrl === "string";
}

function isTokenSetPayload(value) {
  return isObject(value) && "saved" in value && "accessTokenPreview" in value;
}

function isTokenStatusPayload(value) {
  return isObject(value) && "client_id" in value && "expires" in value;
}

function isCollectionListPayload(value) {
  return isObject(value) && Array.isArray(value.data) && isObject(value.filters);
}

function isOAuthTokenPayload(value) {
  return isObject(value) && "access_token" in value && ("refresh_token" in value || "expires_in" in value);
}

function isUserPayload(value) {
  return isObject(value) && "id" in value && "username" in value && "nickname" in value;
}

function isPagedSubjectPayload(value) {
  return isObject(value) && Array.isArray(value.data) && ("total" in value || "limit" in value);
}

function isSubjectPayload(value) {
  return isObject(value) && "id" in value && "name" in value && "type" in value;
}

function isObject(value) {
  return typeof value === "object" && value !== null;
}
