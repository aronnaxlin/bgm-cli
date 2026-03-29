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

export function printUsage() {
  console.log(`bgm-cli

Usage:
  bgm --init
  bgm [--json] config show
  bgm [--json] config set <key> <value>
  bgm [--json] config unset <key>
  bgm [--json] auth login-url [--client-id xxx] [--redirect-uri xxx] [--state xxx]
  bgm [--json] auth token --code <code> [--save]
  bgm [--json] auth refresh [--save]
  bgm [--json] auth set-token <access_token>
  bgm [--json] auth status
  bgm [--json] user me
  bgm [--json] user get <username_or_initial_uid>
  bgm [--json] subject get <subject_id>
  bgm [--json] subject list --type <book|anime|music|game|real> [--sort date|rank] [--limit n]
  bgm [--json] subject search <keyword> [--type anime] [--sort match|heat|rank|score] [--tag xxx]

Examples:
  bgm --init
  bgm config show
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

  console.log(formatValue(value, context));
}

function formatValue(value, context) {
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
  const lines = [`Config file: ${payload.configFile}`];
  const config = payload.config ?? {};
  const entries = Object.entries(config);

  if (entries.length === 0) {
    lines.push("Config: empty");
    return lines.join("\n");
  }

  lines.push("Config:");
  for (const [key, rawValue] of entries) {
    lines.push(`- ${key}: ${formatConfigValue(key, rawValue)}`);
  }
  return lines.join("\n");
}

function formatConfigMutation(payload) {
  if (payload.updated) {
    return [
      "Config updated",
      `Key: ${payload.updated}`,
      `Value: ${formatConfigValue(payload.updated, payload.value)}`,
      `Config file: ${payload.configFile}`,
    ].join("\n");
  }

  if (payload.removed) {
    return [
      "Config removed",
      `Key: ${payload.removed}`,
      `Config file: ${payload.configFile}`,
    ].join("\n");
  }

  return JSON.stringify(payload, null, 2);
}

function formatTokenStatus(payload) {
  return [
    "Token status",
    `User ID: ${payload.user_id ?? "-"}`,
    `Client ID: ${payload.client_id ?? "-"}`,
    `Expires: ${formatTimestamp(payload.expires)}`,
    `Scope: ${payload.scope ?? "-"}`,
    `Access token: ${maskToken(payload.access_token)}`,
  ].join("\n");
}

function formatOAuthToken(payload) {
  return [
    "OAuth token",
    `Access token: ${maskToken(payload.access_token)}`,
    `Refresh token: ${maskToken(payload.refresh_token)}`,
    `Token type: ${payload.token_type ?? "-"}`,
    `Expires in: ${payload.expires_in ? `${payload.expires_in}s` : "-"}`,
    `User ID: ${payload.user_id ?? "-"}`,
    `Scope: ${payload.scope ?? "-"}`,
  ].join("\n");
}

function formatUser(user, context) {
  const title = context.rawArgs?.[1] === "me" ? "Current user" : "User";
  const lines = [
    title,
    `Nickname: ${user.nickname ?? "-"}`,
    `Username: ${user.username ?? "-"}`,
    `User ID: ${user.id ?? "-"}`,
    `Profile: ${user.url ?? "-"}`,
    `User group: ${user.user_group ?? "-"}`,
  ];

  if (user.sign) {
    lines.push(`Sign: ${user.sign}`);
  }
  if (user.email) {
    lines.push(`Email: ${user.email}`);
  }
  if (user.reg_time) {
    lines.push(`Registered: ${user.reg_time}`);
  }
  if (user.time_offset !== undefined) {
    lines.push(`Time offset: GMT${user.time_offset >= 0 ? "+" : ""}${user.time_offset}`);
  }
  if (user.avatar?.large) {
    lines.push(`Avatar: ${user.avatar.large}`);
  }

  return lines.join("\n");
}

function formatSubject(subject) {
  const lines = [
    `Subject #${subject.id ?? "-"}`,
    `Name: ${subject.name ?? "-"}`,
  ];

  if (subject.name_cn) {
    lines.push(`中文名: ${subject.name_cn}`);
  }

  lines.push(`Type: ${formatSubjectType(subject.type)}`);

  if (subject.date) {
    lines.push(`Date: ${subject.date}`);
  }
  if (subject.platform) {
    lines.push(`Platform: ${subject.platform}`);
  }
  if (subject.rating?.score !== undefined) {
    lines.push(`Rating: ${subject.rating.score} (${subject.rating.total ?? 0} votes)`);
  }
  if (subject.rating?.rank) {
    lines.push(`Rank: #${subject.rating.rank}`);
  }
  if (subject.collection) {
    lines.push(
      `Collections: collect ${subject.collection.collect ?? 0}, wish ${subject.collection.wish ?? 0}, doing ${subject.collection.doing ?? 0}, on_hold ${subject.collection.on_hold ?? 0}, dropped ${subject.collection.dropped ?? 0}`,
    );
  }
  if (subject.url) {
    lines.push(`URL: ${subject.url}`);
  } else if (subject.id) {
    lines.push(`URL: https://bgm.tv/subject/${subject.id}`);
  }
  if (subject.summary) {
    lines.push("");
    lines.push(truncateText(subject.summary.trim(), 400));
  }
  if (Array.isArray(subject.meta_tags) && subject.meta_tags.length > 0) {
    lines.push("");
    lines.push(`Tags: ${subject.meta_tags.slice(0, 10).join(", ")}`);
  }

  return lines.join("\n");
}

function formatPagedSubjects(payload) {
  const lines = [
    `Subjects ${payload.offset ?? 0}-${Math.min((payload.offset ?? 0) + (payload.data?.length ?? 0), payload.total ?? payload.data?.length ?? 0)} / ${payload.total ?? payload.data?.length ?? 0}`,
  ];

  const subjects = Array.isArray(payload.data) ? payload.data : [];
  if (subjects.length === 0) {
    lines.push("No results.");
    return lines.join("\n");
  }

  for (const subject of subjects) {
    const pieces = [
      `#${subject.id}`,
      subject.name_cn || subject.name || "-",
    ];

    if (subject.name && subject.name_cn && subject.name !== subject.name_cn) {
      pieces.push(`(${subject.name})`);
    }

    pieces.push(`[${formatSubjectType(subject.type)}]`);

    if (subject.rating?.score !== undefined) {
      pieces.push(`score ${subject.rating.score}`);
    }
    if (subject.rating?.rank) {
      pieces.push(`rank #${subject.rating.rank}`);
    }
    if (subject.date) {
      pieces.push(subject.date);
    }

    lines.push(`- ${pieces.join("  ")}`);
  }

  return lines.join("\n");
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

function isConfigShowPayload(value) {
  return isObject(value) && "configFile" in value && "config" in value;
}

function isConfigMutationPayload(value) {
  return isObject(value) && ("updated" in value || "removed" in value);
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
