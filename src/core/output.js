import { getConfig } from "./config.js";

export class CommandError extends Error {
  constructor(message) {
    super(message);
    this.name = "CommandError";
  }
}

const SUBJECT_TYPE_LABELS = {
  1: "Book",
  2: "Anime",
  3: "Music",
  4: "Game",
  6: "Real",
};

const SUBJECT_TYPE_ORDER = [2, 1, 3, 4, 6];

const COLLECTION_STATUS_LABELS = {
  1: "Wish",
  2: "Collect",
  3: "Doing",
  4: "On hold",
  5: "Dropped",
};

const GROUP_MEMBER_ROLE_LABELS = {
  [-2]: "Visitor",
  [-1]: "Guest",
  0: "Member",
  1: "Creator",
  2: "Moderator",
  3: "Blocked",
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
    bgm [--json] collection get <subject_id>
      Show the current user's collection detail for one subject.
    bgm [--json] collection collect <subject_id>|--search <keyword> [--status <wish|collect|doing|on_hold|dropped>]
      Create or update one subject collection. Default status is wish.
    bgm [--json] collection comment <subject_id>|--search <keyword> <comment>
      Update one subject collection comment.
    bgm [--json] collection rate <subject_id>|--search <keyword> <0-10>
      Update one subject collection rating. Use 0 to clear rating.
    bgm [--json] collection status <subject_id>|--search <keyword> <wish|collect|doing|on_hold|dropped>
      Update one subject collection watching/reading status.

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

  Groups
    bgm [--json] group list [--mode <all|joined|managed>] [--sort <created|updated|posts|topics|members>] [--limit n] [--offset n]
      List Bangumi groups from the private API.
    bgm [--json] group get <group_name>
      Fetch one Bangumi group by slug.
    bgm [--json] group topics <group_name> [--limit n] [--offset n]
      List topics inside one group.
    bgm [--json] group topic <topic_id> [--reply-limit n]
      Fetch one group topic detail.
    bgm [--json] group create-topic <group_name> <title> <content> --turnstile-token <token>
      Create one group topic.
    bgm [--json] group reply <topic_id> <content> [--reply-to <reply_id>] --turnstile-token <token>
      Reply to one group topic.
    bgm [--json] group members <group_name> [--role <visitor|guest|member|creator|moderator|blocked>] [--limit n] [--offset n]
      List members of one group.
    bgm [--json] group recent-topics [--mode <all|joined|created|replied>] [--limit n] [--offset n]
      List the latest group topics across Bangumi.
    bgm [--json] group latest-replies [--mode <all|joined|created|replied>] [--limit n] [--scan n]
      List topics that were recently bumped by replies, excluding reply-less new topics.
    bgm [--json] group hot [--window <day|week|month>] [--mode <all|joined|created|replied>] [--limit n] [--scan n]
      Rank the hottest groups from recent topic activity.
    bgm [--json] group hot-topics [--window <day|week|month>] [--mode <all|joined|created|replied>] [--limit n] [--scan n]
      Rank the hottest group topics from recent topic activity.

Examples:
  bgm --init
  bgm tui
  bgm config show
  bgm config set timezone Asia/Tokyo
  bgm setup install-path
  bgm collection list --status doing --type anime --sort updated
  bgm collection collect 12 --status wish
  bgm collection rate --search "Heike Monogatari" 8
  bgm collection comment 12 "Backfill"
  bgm collection status --search "Heike Monogatari" collect
  bgm user me
  bgm subject get 12
  bgm subject search "Ghost in the Shell" --type anime --limit 5
  bgm group list --sort members --limit 10
  bgm group get boring
  bgm group recent-topics --mode all --limit 5
  bgm group latest-replies --limit 10
  bgm group hot --window day --limit 10
  bgm group hot-topics --window week --limit 10
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

  if (isCollectionMutationPayload(value)) {
    return formatCollectionMutation(value);
  }

  if (isGroupListPayload(value)) {
    return formatGroupList(value);
  }

  if (isGroupHotPayload(value)) {
    return formatGroupHot(value);
  }

  if (isGroupHotTopicsPayload(value)) {
    return formatGroupHotTopics(value);
  }

  if (isGroupLatestRepliesPayload(value)) {
    return formatGroupLatestReplies(value);
  }

  if (isGroupMembersPayload(value)) {
    return formatGroupMembers(value);
  }

  if (isGroupTopicsPayload(value)) {
    return formatGroupTopics(value);
  }

  if (isGroupPayload(value)) {
    return formatGroup(value);
  }

  if (isGroupTopicPayload(value)) {
    return formatGroupTopic(value);
  }

  if (isGroupTopicMutationPayload(value)) {
    return formatGroupTopicMutation(value);
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
  if (payload.configSourceFile && payload.configSourceFile !== payload.configFile) {
    lines.push(`  Loaded from: ${payload.configSourceFile}`);
  }
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
  const lines = [
    "Global command setup completed",
    `  Platform: ${payload.platform}`,
    `  Repository: ${payload.repoDir}`,
    `  Active config file: ${payload.configFile}`,
  "",
  ];

  if (payload.migratedConfig) {
    lines.push("Existing project config was migrated to the global config file.");
    lines.push("");
  }

  lines.push(payload.output);
  lines.push("");
  lines.push(payload.shellHint);
  return lines.join("\n");
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

  lines.push("Collections");
  lines.push(`  Total: ${items.length}`);
  if (filters.user) {
    lines.push(`  User: ${filters.user}`);
  }
  lines.push(`  Sort: ${filters.sort ?? "updated"} / ${filters.order ?? "desc"}`);

  if (Array.isArray(filters.status) && filters.status.length > 0) {
    lines.push(`  Status filter: ${filters.status.map((value) => formatCollectionStatus(value)).join(", ")}`);
  } else {
    lines.push("  Status filter: All");
  }

  if (Array.isArray(filters.subjectType) && filters.subjectType.length > 0) {
    lines.push(`  Type filter: ${filters.subjectType.map((value) => formatSubjectType(value)).join(", ")}`);
  } else {
    lines.push("  Type filter: All");
  }

  if (items.length === 0) {
    lines.push("");
    lines.push("No matching collections.");
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
      pieces.push(`my ${item.rate}`);
    }
    if (subject.score !== undefined) {
      pieces.push(`community ${subject.score}`);
    }
    if (subject.rank) {
      pieces.push(`rank #${subject.rank}`);
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
      lines.push(`    Episode progress: ${item.ep_status}`);
    }
    if (item.vol_status) {
      lines.push(`    Volume progress: ${item.vol_status}`);
    }
    if (Array.isArray(item.tags) && item.tags.length > 0) {
      lines.push(`    Tags: ${item.tags.join(", ")}`);
    }
    if (item.comment) {
      lines.push(`    Comment: ${item.comment}`);
    }
  }

  return lines.join("\n");
}

function formatCollectionMutation(payload) {
  const lines = [];
  const action = payload.actionLabel ?? payload.action ?? "Collection action";
  const collection = payload.collection ?? null;
  const subject = collection?.subject ?? payload.subject ?? {};

  lines.push(action);
  lines.push(`  Subject: #${payload.subjectId ?? collection?.subject_id ?? subject?.id ?? "-"}`);
  lines.push(`  Name: ${subject?.name_cn || subject?.name || payload.subjectName || "-"}`);

  if (subject?.name && subject?.name_cn && subject.name !== subject.name_cn) {
    lines.push(`  Original name: ${subject.name}`);
  }

  if (collection) {
    lines.push(`  Type: ${formatSubjectType(collection.subject_type ?? subject?.type)}`);
    lines.push(`  Status: ${formatCollectionStatus(collection.type)}`);
    lines.push(`  My rating: ${collection.rate ?? 0}`);
    lines.push(`  Private: ${collection.private ? "Yes" : "No"}`);
    if (collection.comment) {
      lines.push(`  Comment: ${collection.comment}`);
    }
    if (Array.isArray(collection.tags) && collection.tags.length > 0) {
      lines.push(`  Tags: ${collection.tags.join(", ")}`);
    }
    if (collection.ep_status !== undefined) {
      lines.push(`  Episode progress: ${collection.ep_status}`);
    }
    if (collection.vol_status !== undefined) {
      lines.push(`  Volume progress: ${collection.vol_status}`);
    }
    if (collection.updated_at) {
      lines.push(`  Updated at: ${collection.updated_at}`);
    }
  }

  return lines.join("\n");
}

function formatGroupList(payload) {
  const lines = [
    "Groups",
    `  Range: ${formatPageRange(payload.offset ?? payload.filters?.offset, payload.data?.length, payload.total)}`,
    `  Mode: ${payload.filters?.mode ?? "all"}`,
    `  Sort: ${payload.filters?.sort ?? "created"}`,
  ];
  const groups = Array.isArray(payload.data) ? payload.data : [];

  if (groups.length === 0) {
    lines.push("No results.");
    return lines.join("\n");
  }

  for (const group of groups) {
    const pieces = [
      `#${group.id ?? "-"}`,
      group.title || "-",
      `(${group.name || "-"})`,
      `${group.members ?? 0} members`,
      `${group.topics ?? 0} topics`,
    ];

    if (group.createdAt) {
      pieces.push(`created ${formatTimestamp(group.createdAt)}`);
    }

    lines.push("");
    lines.push(`• ${pieces.join("  ")}`);
  }

  return lines.join("\n");
}

function formatGroup(group) {
  const lines = [
    `Group #${group.id ?? "-"}`,
    `  Title: ${group.title ?? "-"}`,
    `  Slug: ${group.name ?? "-"}`,
    `  Members: ${group.members ?? 0}`,
    `  Topics: ${group.topics ?? 0}`,
    `  Posts: ${group.posts ?? 0}`,
    `  Accessible: ${group.accessible ? "Yes" : "No"}`,
    `  NSFW: ${group.nsfw ? "Yes" : "No"}`,
  ];

  if (group.creator) {
    lines.push(`  Creator: ${formatUserLabel(group.creator)}`);
  } else if (group.creatorID) {
    lines.push(`  Creator ID: ${group.creatorID}`);
  }
  if (group.createdAt) {
    lines.push(`  Created at: ${formatTimestamp(group.createdAt)}`);
  }
  if (group.membership?.role !== undefined) {
    lines.push(`  My role: ${formatGroupMemberRole(group.membership.role)}`);
  }
  if (group.description) {
    lines.push("");
    lines.push("Description");
    lines.push(indentBlock(truncateText(group.description.trim(), 800), 2));
  }
  if (group.name) {
    lines.push(`  URL: https://bgm.tv/group/${group.name}`);
  }

  return lines.join("\n");
}

function formatGroupHot(payload) {
  const lines = [
    `Hot groups (${payload.filters?.window ?? "day"})`,
    `  Topics sampled: ${payload.filters?.sampledTopics ?? payload.data?.length ?? 0}`,
    `  Mode: ${payload.filters?.mode ?? "all"}`,
    `  Scan cap: ${payload.filters?.scan ?? "-"}`,
  ];
  const groups = Array.isArray(payload.data) ? payload.data : [];

  if (groups.length === 0) {
    lines.push("No results.");
    return lines.join("\n");
  }

  for (const [index, group] of groups.entries()) {
    const pieces = [
      `#${index + 1}`,
      `${group.title ?? "-"}${group.name ? ` (${group.name})` : ""}`,
      `hot ${formatHotScore(group.hotScore)}`,
      `${group.topicCount ?? 0} active topics`,
      `${group.replyCount ?? 0} replies`,
    ];
    if (group.members) {
      pieces.push(`${group.members} members`);
    }
    if (group.latestActivityAt) {
      pieces.push(`last ${formatTimestamp(group.latestActivityAt)}`);
    }

    lines.push("");
    lines.push(`• ${pieces.join("  ")}`);

    if (Array.isArray(group.topTopics) && group.topTopics.length > 0) {
      lines.push(`  Top topics: ${group.topTopics.map((topic) => `#${topic.id} ${topic.title}`).join(" | ")}`);
    }
  }

  return lines.join("\n");
}

function formatGroupLatestReplies(payload) {
  const lines = [
    "Latest replied group topics",
    `  Returned: ${payload.data?.length ?? 0}`,
    `  Mode: ${payload.filters?.mode ?? "all"}`,
    `  Scan cap: ${payload.filters?.scan ?? "-"}`,
  ];
  const topics = Array.isArray(payload.data) ? payload.data : [];

  if (topics.length === 0) {
    lines.push("No results.");
    return lines.join("\n");
  }

  for (const topic of topics) {
    lines.push("");
    lines.push(`• ${formatTopicLine(topic)}`);
  }

  return lines.join("\n");
}

function formatGroupMembers(payload) {
  const lines = [
    `Group members: ${payload.groupName ?? "-"}`,
    `  Range: ${formatPageRange(payload.offset ?? payload.filters?.offset, payload.data?.length, payload.total)}`,
    `  Role filter: ${formatGroupMemberRole(payload.filters?.role)}`,
  ];
  const members = Array.isArray(payload.data) ? payload.data : [];

  if (members.length === 0) {
    lines.push("No results.");
    return lines.join("\n");
  }

  for (const member of members) {
    const user = member.user ?? {};
    const pieces = [
      formatUserLabel(user, member.uid),
      `[${formatGroupMemberRole(member.role)}]`,
    ];
    if (member.joinedAt) {
      pieces.push(`joined ${formatTimestamp(member.joinedAt)}`);
    }

    lines.push("");
    lines.push(`• ${pieces.join("  ")}`);
  }

  return lines.join("\n");
}

function formatGroupTopics(payload) {
  const lines = [
    payload.resource === "group-recent-topics" ? "Recent group topics" : `Group topics: ${payload.groupName ?? "-"}`,
    `  Range: ${formatPageRange(payload.offset ?? payload.filters?.offset, payload.data?.length, payload.total)}`,
  ];

  if (payload.resource === "group-recent-topics") {
    lines.push(`  Mode: ${payload.filters?.mode ?? "all"}`);
  }

  const topics = Array.isArray(payload.data) ? payload.data : [];
  if (topics.length === 0) {
    lines.push("No results.");
    return lines.join("\n");
  }

  for (const topic of topics) {
    lines.push("");
    lines.push(`• ${formatTopicLine(topic)}`);
  }

  return lines.join("\n");
}

function formatGroupHotTopics(payload) {
  const lines = [
    `Hot group topics (${payload.filters?.window ?? "day"})`,
    `  Topics sampled: ${payload.filters?.sampledTopics ?? payload.data?.length ?? 0}`,
    `  Mode: ${payload.filters?.mode ?? "all"}`,
    `  Scan cap: ${payload.filters?.scan ?? "-"}`,
  ];
  const topics = Array.isArray(payload.data) ? payload.data : [];

  if (topics.length === 0) {
    lines.push("No results.");
    return lines.join("\n");
  }

  for (const [index, topic] of topics.entries()) {
    const pieces = [
      `#${index + 1}`,
      `topic ${topic.id ?? "-"}`,
      topic.title ?? "-",
      `hot ${formatHotScore(topic.hotScore)}`,
      `${topic.replyCount ?? 0} replies`,
    ];

    if (topic.group?.title) {
      pieces.push(`[${topic.group.title}]`);
    }
    if (topic.creator || topic.creatorID) {
      pieces.push(`by ${formatUserLabel(topic.creator, topic.creatorID)}`);
    }
    if (topic.updatedAt) {
      pieces.push(`updated ${formatTimestamp(topic.updatedAt)}`);
    }

    lines.push("");
    lines.push(`• ${pieces.join("  ")}`);
  }

  return lines.join("\n");
}

function formatGroupTopic(topic) {
  const lines = [
    `Group topic #${topic.id ?? "-"}`,
    `  Title: ${topic.title ?? "-"}`,
    `  Group: ${topic.group?.title || "-"}${topic.group?.name ? ` (${topic.group.name})` : ""}`,
    `  Author: ${formatUserLabel(topic.creator, topic.creatorID)}`,
    `  Replies: ${topic.replyCount ?? topic.replies?.length ?? 0}`,
    `  Created at: ${formatTimestamp(topic.createdAt)}`,
    `  Updated at: ${formatTimestamp(topic.updatedAt)}`,
    `  URL: https://bgm.tv/group/topic/${topic.id ?? ""}`,
  ];

  if (topic.content) {
    lines.push("");
    lines.push("Content");
    lines.push(indentBlock(truncateText(topic.content.trim(), 4000), 2));
  }

  const replies = Array.isArray(topic.replies) ? topic.replies : [];
  const replyLimit = Number(topic.filters?.replyLimit ?? 20);
  if (replies.length > 0) {
    lines.push("");
    lines.push("Replies");
    for (const reply of replies.slice(0, replyLimit)) {
      lines.push(`  • ${formatReplyLine(reply)}`);
      if (reply.content) {
        lines.push(indentBlock(truncateText(reply.content.trim(), 600), 4));
      }
    }
    if (replies.length > replyLimit) {
      lines.push(`  ... ${replies.length - replyLimit} more replies`);
    }
  }

  return lines.join("\n");
}

function formatGroupTopicMutation(payload) {
  if (payload.action === "create-topic") {
    return [
      "Group topic created",
      `  Group: ${payload.groupName ?? "-"}`,
      `  Topic ID: ${payload.topicId ?? "-"}`,
      `  Title: ${payload.title ?? "-"}`,
      `  URL: ${payload.url ?? "-"}`,
    ].join("\n");
  }

  if (payload.action === "reply") {
    return [
      "Group reply created",
      `  Topic ID: ${payload.topicId ?? "-"}`,
      `  Post ID: ${payload.postId ?? "-"}`,
      `  Reply to: ${payload.replyTo ?? 0}`,
      `  Topic URL: ${payload.url ?? "-"}`,
    ].join("\n");
  }

  return JSON.stringify(payload, null, 2);
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
    lines.push(`  Chinese name: ${subject.name_cn}`);
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
  const filters = payload.filters ?? {};

  if (filters.mode === "search" && filters.keyword) {
    lines.push(`  Keyword: ${filters.keyword}`);
  }
  if (filters.type !== undefined) {
    lines.push(`  Type: ${filters.type ? formatSubjectType(filters.type) : "All"}`);
  }
  if (filters.sort) {
    lines.push(`  Sort: ${filters.sort}`);
  }
  if (filters.year !== undefined && filters.year !== null) {
    lines.push(`  Year: ${filters.year}`);
  }
  if (filters.month !== undefined && filters.month !== null) {
    lines.push(`  Month: ${filters.month}`);
  }
  if (filters.platform) {
    lines.push(`  Platform: ${filters.platform}`);
  }
  if (filters.cat) {
    lines.push(`  Category: ${filters.cat}`);
  }
  if (filters.series !== undefined) {
    lines.push(`  Series: ${filters.series ? "true" : "false"}`);
  }
  if (Array.isArray(filters.tag) && filters.tag.length > 0) {
    lines.push(`  Tag: ${filters.tag.join(", ")}`);
  }
  if (Array.isArray(filters.metaTags) && filters.metaTags.length > 0) {
    lines.push(`  Meta tags: ${filters.metaTags.join(", ")}`);
  }
  if (Array.isArray(filters.airDate) && filters.airDate.length > 0) {
    lines.push(`  Air date: ${filters.airDate.join(", ")}`);
  }
  if (Array.isArray(filters.rating) && filters.rating.length > 0) {
    lines.push(`  Rating filter: ${filters.rating.join(", ")}`);
  }
  if (Array.isArray(filters.ratingCount) && filters.ratingCount.length > 0) {
    lines.push(`  Rating count: ${filters.ratingCount.join(", ")}`);
  }
  if (Array.isArray(filters.rank) && filters.rank.length > 0) {
    lines.push(`  Rank filter: ${filters.rank.join(", ")}`);
  }
  if (filters.nsfw !== undefined) {
    lines.push(`  NSFW: ${filters.nsfw ? "true" : "false"}`);
  }

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

  if (key === "timezone") {
    return `${String(value)} (${formatTimezoneOffset(String(value))})`;
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

  const timezone = getConfig().timezone;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const lookup = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));

  return `${lookup.year}-${lookup.month}-${lookup.day} ${lookup.hour}:${lookup.minute}:${lookup.second} ${formatTimezoneLabel(timezone)}`;
}

function formatTimezoneLabel(timezone) {
  if (timezone === "Asia/Shanghai") {
    return "CST (UTC+08:00)";
  }

  return formatTimezoneOffset(timezone);
}

function formatTimezoneOffset(timezone) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      timeZoneName: "shortOffset",
    }).formatToParts(new Date());
    const zoneName = parts.find((part) => part.type === "timeZoneName")?.value ?? timezone;
    return zoneName.replace(/^GMT/i, "UTC").replace(/^(UTC[+-])(\d{1,2})$/, "$10$2:00");
  } catch {
    return timezone;
  }
}

function formatPageRange(offsetValue, lengthValue, totalValue) {
  const offset = Number(offsetValue ?? 0);
  const length = Number(lengthValue ?? 0);
  const total = totalValue ?? length;
  return `${offset}-${Math.min(offset + length, total)} / ${total}`;
}

function formatHotScore(value) {
  return Number(value ?? 0).toFixed(4);
}

function formatSubjectType(type) {
  return SUBJECT_TYPE_LABELS[type] ?? String(type ?? "-");
}

function formatCollectionStatus(type) {
  return COLLECTION_STATUS_LABELS[type] ?? String(type ?? "-");
}

function formatGroupMemberRole(role) {
  if (role === undefined || role === null || role === "") {
    return "All";
  }

  return GROUP_MEMBER_ROLE_LABELS[role] ?? String(role);
}

function formatUserLabel(user, fallbackId) {
  if (!isObject(user)) {
    return fallbackId ? `#${fallbackId}` : "-";
  }

  const pieces = [];
  if (user.nickname) {
    pieces.push(user.nickname);
  }
  if (user.username) {
    pieces.push(`@${user.username}`);
  } else if (user.id ?? fallbackId) {
    pieces.push(`#${user.id ?? fallbackId}`);
  }
  return pieces.join(" ") || "-";
}

function formatTopicLine(topic) {
  const pieces = [
    `#${topic.id ?? "-"}`,
    topic.title ?? "-",
  ];

  if (topic.group?.title) {
    pieces.push(`[${topic.group.title}]`);
  }
  if (topic.replyCount !== undefined) {
    pieces.push(`${topic.replyCount} replies`);
  }
  if (topic.creator || topic.creatorID) {
    pieces.push(`by ${formatUserLabel(topic.creator, topic.creatorID)}`);
  }
  if (topic.updatedAt) {
    pieces.push(`updated ${formatTimestamp(topic.updatedAt)}`);
  }

  return pieces.join("  ");
}

function formatReplyLine(reply) {
  const pieces = [
    `#${reply.id ?? "-"}`,
    `by ${formatUserLabel(reply.creator, reply.creatorID)}`,
  ];

  if (reply.createdAt) {
    pieces.push(formatTimestamp(reply.createdAt));
  }

  return pieces.join("  ");
}

function isConfigShowPayload(value) {
  return isObject(value) && "configFile" in value && "config" in value;
}

function isConfigMutationPayload(value) {
  return isObject(value) && "configFile" in value && ("updated" in value || "removed" in value);
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
  return (
    isObject(value) &&
    Array.isArray(value.data) &&
    isObject(value.filters) &&
    ("user" in value.filters || "status" in value.filters || "subjectType" in value.filters || "order" in value.filters)
  );
}

function isCollectionMutationPayload(value) {
  return isObject(value) && typeof value.action === "string" && "subjectId" in value;
}

function isGroupListPayload(value) {
  return isObject(value) && value.resource === "group-list" && Array.isArray(value.data);
}

function isGroupHotPayload(value) {
  return isObject(value) && value.resource === "group-hot" && Array.isArray(value.data);
}

function isGroupHotTopicsPayload(value) {
  return isObject(value) && value.resource === "group-hot-topics" && Array.isArray(value.data);
}

function isGroupLatestRepliesPayload(value) {
  return isObject(value) && value.resource === "group-latest-replies" && Array.isArray(value.data);
}

function isGroupMembersPayload(value) {
  return isObject(value) && value.resource === "group-members" && Array.isArray(value.data);
}

function isGroupTopicsPayload(value) {
  return isObject(value) && ["group-topics", "group-recent-topics"].includes(value.resource) && Array.isArray(value.data);
}

function isGroupPayload(value) {
  return isObject(value) && "title" in value && "members" in value && "topics" in value && "posts" in value && "accessible" in value;
}

function isGroupTopicPayload(value) {
  return isObject(value) && "title" in value && "parentID" in value && "replyCount" in value && "updatedAt" in value && "group" in value && "replies" in value;
}

function isGroupTopicMutationPayload(value) {
  return isObject(value) && value.resource === "group-topic-mutation" && typeof value.action === "string";
}

function isOAuthTokenPayload(value) {
  return isObject(value) && "access_token" in value && ("refresh_token" in value || "expires_in" in value);
}

function isUserPayload(value) {
  return isObject(value) && "id" in value && "username" in value && "nickname" in value;
}

function isPagedSubjectPayload(value) {
  return isObject(value) && Array.isArray(value.data) && ("total" in value || "limit" in value || "filters" in value);
}

function isSubjectPayload(value) {
  return isObject(value) && "id" in value && "name" in value && "type" in value;
}

function isObject(value) {
  return typeof value === "object" && value !== null;
}
