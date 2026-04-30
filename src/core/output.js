import process from "node:process";
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

const EPISODE_TYPE_LABELS = {
  0: "Main",
  1: "SP",
  2: "OP",
  3: "ED",
  4: "Trailer",
  5: "MAD",
  6: "Other",
};

const EPISODE_COLLECTION_STATUS_LABELS = {
  0: "Removed",
  1: "Queue",
  2: "Watched",
  3: "Dropped",
};

const GROUP_MEMBER_ROLE_LABELS = {
  [-2]: "Visitor",
  [-1]: "Guest",
  0: "Member",
  1: "Creator",
  2: "Moderator",
  3: "Blocked",
};

const TIMELINE_CAT_LABELS = {
  1: "Daily",
  2: "Wiki",
  3: "Subject",
  4: "Progress",
  5: "Status",
  6: "Blog",
  7: "Index",
  8: "Mono",
  9: "Doujin",
};

export function printUsage(target) {
  console.log(buildUsageText(target));
}

function buildUsageText(target) {
  const normalized = normalizeUsageTarget(target);

  switch (normalized) {
    case "auth":
      return buildGroupUsage("Auth", [
        ["bgm [--json] auth set-token <access_token>", "Save an existing Bangumi access token directly."],
        ["bgm [--json] auth status", "Check the current saved access token status and expiry."],
        ["bgm [--json] auth clear", "Remove saved auth state for clean testing."],
        ["bgm [--json] auth login-url [--client-id xxx] [--redirect-uri xxx] [--state xxx]", "Generate a Bangumi OAuth authorization URL for manual testing."],
        ["bgm [--json] auth token --code <code> [--save]", "Exchange an OAuth authorization code for access and refresh tokens."],
        ["bgm [--json] auth refresh [--save]", "Refresh the saved OAuth access token with the refresh token."],
        ["bgm [--json] auth turnstile [--manual] [--listen-host <host>] [--port n] [--public-origin <url>] [--timeout-seconds <n>]", "Prefer the hosted official Bangumi Turnstile flow and fall back to the local helper when needed."],
        ["bgm auth session-login [--manual]", "Open the official private API demo login page, then save a pasted chiiNextSessionID."],
        ["bgm [--json] auth set-session <chiiNextSessionID|cookie_string>", "Save a private API session cookie value for p1 requests."],
        ["bgm [--json] auth session-status", "Show whether an optional private API session is currently saved."],
      ]);
    case "config":
      return buildGroupUsage("Config", [
        ["bgm [--json] config show", "Show the effective local runtime config used by the CLI."],
        ["bgm [--json] config set <key> <value>", "Save one config value into the local CLI config file."],
        ["bgm [--json] config unset <key>", "Remove one config value from the local CLI config file."],
      ]);
    case "setup":
      return buildGroupUsage("Setup", [
        ["bgm [--json] --version", "Show CLI version and local config/auth summary."],
        ["bgm --init", "Run the interactive setup wizard for login and local CLI setup."],
        ["bgm [--json] setup install-path", "Add this repository to PATH so you can run bgm globally."],
        ["bgm [--json] setup update", "Download and reinstall the latest managed bgm-cli copy without removing config."],
        ["bgm tui", "Open the interactive TUI for non-login operations."],
      ]);
    case "subject":
      return buildGroupUsage("Subject", [
        ["bgm [--json] subject get <subject_id> [--verbose]", "Fetch one Bangumi subject by subject ID. Add --verbose for infobox, tags, rating distribution, and images."],
        ["bgm [--json] subject list --type <book|anime|music|game|real> [--sort date|rank] [--limit n]", "Browse public Bangumi subjects by type and list filters."],
        ["bgm [--json] subject search <keyword> [--type anime] [--sort match|heat|rank|score] [--tag xxx]", "Search Bangumi subjects by keyword with optional filters."],
      ]);
    case "episode":
    case "ep":
      return buildGroupUsage("Episode", [
        ["bgm [--json] episode list <subject_id> [--type <main|sp|op|ed|op_ed|trailer|pv|mad|other>] [--limit n] [--offset n]", "List episodes for one subject. If an access token is saved, the request also carries it for NSFW subjects."],
        ["bgm [--json] episode status <episode_id> <queue|watched|drop|remove>", "Update one episode collection status."],
        ["bgm [--json] episode watch <subject_id> <episode_number>", "Mark one main episode number as watched without looking up the episode ID manually."],
      ], [
        "Notes",
        "  NSFW/R18 subjects may require a saved access token.",
        "  Bangumi may return a misleading 404 when episode listing is blocked by auth or account eligibility.",
      ]);
    case "collection":
      return buildGroupUsage("Collection", [
        ["bgm [--json] collection list [--user <username>] [--status <wish|collect|doing|on_hold|dropped>] [--type <book|anime|music|game|real>] [--sort <updated|name|rank|community_score|user_score|date>] [--order <asc|desc>] [--limit n] [--offset n]", "List a user's collections, with optional filters and sorting."],
        ["bgm [--json] collection get <subject_id>", "Show the current user's collection detail for one subject."],
        ["bgm [--json] collection collect <subject_id>|--search <keyword> [--status <wish|collect|doing|on_hold|dropped>]", "Create or update one subject collection. Default status is wish."],
        ["bgm [--json] collection comment <subject_id>|--search <keyword> <comment>", "Update one subject collection comment."],
        ["bgm [--json] collection rate <subject_id>|--search <keyword> <0-10>", "Update one subject collection rating. Use 0 to clear rating."],
        ["bgm [--json] collection status <subject_id>|--search <keyword> <wish|collect|doing|on_hold|dropped>", "Update one subject collection watching/reading status."],
      ]);
    case "user":
      return buildGroupUsage("User", [
        ["bgm [--json] user me", "Show the current authenticated user profile."],
        ["bgm [--json] user get <username_or_initial_uid>", "Fetch one public Bangumi user profile by username or numeric ID."],
      ]);
    case "group":
      return buildGroupUsage("Group", [
        ["bgm [--json] group list [--mode <all|joined|managed>] [--sort <created|updated|posts|topics|members>] [--limit n] [--offset n]", "List Bangumi groups from the private API."],
        ["bgm [--json] group get <group_name>", "Fetch one Bangumi group by slug."],
        ["bgm [--json] group topics <group_name> [--limit n] [--offset n]", "List topics inside one group."],
        ["bgm [--json] group topic <topic_id> [--reply-limit n]", "Fetch one group topic detail."],
        ["bgm [--json] group create-topic <group_name> <title> <content> [--turnstile-token <token>] [--manual]", "Create one group topic."],
        ["bgm [--json] group reply <topic_id> <content> [--reply-to <reply_id>] [--turnstile-token <token>] [--manual]", "Reply to one group topic."],
        ["bgm [--json] group members <group_name> [--role <visitor|guest|member|creator|moderator|blocked>] [--limit n] [--offset n]", "List members of one group."],
        ["bgm [--json] group recent-topics [--mode <all|joined|created|replied>] [--limit n] [--offset n]", "List the latest group topics across Bangumi."],
        ["bgm [--json] group latest-replies [--mode <all|joined|created|replied>] [--limit n] [--scan n]", "List topics that were recently bumped by replies."],
        ["bgm [--json] group hot [--window <day|week|month>] [--mode <all|joined|created|replied>] [--limit n] [--scan n]", "Rank the hottest groups from recent topic activity."],
        ["bgm [--json] group hot-topics [--window <day|week|month>] [--mode <all|joined|created|replied>] [--limit n] [--scan n]", "Rank the hottest group topics from recent topic activity."],
      ]);
    case "blog":
      return buildGroupUsage("Blog", [
        ["bgm [--json] blog list [--user <username>] [--limit n] [--offset n]", "List one user's blog entries. Defaults to the current user."],
        ["bgm [--json] blog get <blog_id>", "Fetch one Bangumi blog entry by ID."],
        ["bgm [--json] blog comments <blog_id>", "List comments under one blog entry."],
        ["bgm [--json] blog reply <blog_id> <content> [--reply-to <comment_id>] [--turnstile-token <token>] [--manual]", "Experimental: reply to one blog entry or one existing blog comment."],
        ["bgm [--json] blog edit-comment <comment_id> <content>", "Experimental: edit one of your blog comments."],
        ["bgm [--json] blog delete-comment <comment_id>", "Experimental: delete one of your blog comments."],
        ["bgm [--json] blog photos <blog_id> [--limit n] [--offset n]", "List photos attached to one blog entry."],
        ["bgm [--json] blog subjects <blog_id>", "List subjects related to one blog entry."],
      ]);
    case "index":
      return buildGroupUsage("Index", [
        ["bgm [--json] index create <title> <desc> [--private <true|false>]", "Create one index."],
        ["bgm [--json] index get <index_id>", "Fetch one index by ID."],
        ["bgm [--json] index update <index_id> [--title <title>] [--desc <desc>] [--private <true|false>]", "Update one of your indexes."],
        ["bgm [--json] index delete <index_id>", "Delete one of your indexes."],
        ["bgm [--json] index comments <index_id>", "List comments under one index."],
        ["bgm [--json] index comment <index_id> <content> [--reply-to <comment_id>] [--turnstile-token <token>] [--manual]", "Create one index comment."],
        ["bgm [--json] index edit-comment <comment_id> <content>", "Edit one of your index comments."],
        ["bgm [--json] index delete-comment <comment_id>", "Delete one of your index comments."],
        ["bgm [--json] index related <index_id> [--cat <subject|character|person|ep|blog|group_topic|subject_topic>] [--type <book|anime|music|game|real>] [--limit n] [--offset n]", "List related content inside one index."],
        ["bgm [--json] index add-related <index_id> --cat <subject|character|person|ep|blog|group_topic|subject_topic> --sid <sid> [--order <n>] [--comment <text>] [--award <text>]", "Add one related item to an index."],
        ["bgm [--json] index update-related <index_id> <related_id> --order <n> --comment <text>", "Update one index related item."],
        ["bgm [--json] index delete-related <index_id> <related_id>", "Delete one index related item."],
      ]);
    case "timeline":
      return buildGroupUsage("Timeline", [
        ["bgm [--json] timeline list [--mode <all|friends>] [--limit n] [--until <timeline_id>]", "List timeline entries from the private API."],
        ["bgm [--json] timeline user <username> [--limit n] [--until <timeline_id>]", "List timeline entries posted by one user."],
        ["bgm [--json] timeline replies <timeline_id>", "List replies under one timeline entry."],
        ["bgm [--json] timeline say <content> [--turnstile-token <token>] [--manual]", "Create one timeline status."],
        ["bgm [--json] timeline reply <timeline_id> <content> [--reply-to <comment_id>] [--turnstile-token <token>] [--manual]", "Reply to one timeline entry."],
        ["bgm [--json] timeline delete <timeline_id>", "Delete one of your timeline entries."],
        ["bgm [--json] timeline like <timeline_id> <value>", "React to one timeline entry with a numeric reaction value."],
        ["bgm [--json] timeline unlike <timeline_id>", "Remove your reaction from one timeline entry."],
      ]);
    case "status":
      return buildGroupUsage("Status", [
        ["bgm [--json] status [--site <bgm.tv|bangumi.tv|chii.in>] [--audience <guest|auth|authenticated>]", "Show current service health from the community-run Bangumi status service."],
        ["bgm [--json] status current [--site <bgm.tv|bangumi.tv|chii.in>] [--audience <guest|auth|authenticated>]", "Show current service health explicitly."],
        ["bgm [--json] status incidents [--site <bgm.tv|bangumi.tv|chii.in>] [--audience <guest|auth|authenticated>] [--limit n]", "Show recent incidents only."],
      ]);
    case "calendar":
      return buildGroupUsage("Calendar", [
        ["bgm [--json] calendar [today]", "Show today's anime broadcast schedule (default)."],
        ["bgm [--json] calendar all", "Show the full weekly anime broadcast calendar."],
        ["bgm [--json] calendar <weekday>", "Show schedule for a specific day: monday/mon, tuesday/tue, wednesday/wed, thursday/thu, friday/fri, saturday/sat, sunday/sun."],
      ]);
    default:
      return buildMainUsage();
  }
}

function buildMainUsage() {
  return `bgm-cli

Usage
  bgm <command> [subcommand] [options]
  bgm <command> --help

Core
  bgm --init
    Run the interactive setup wizard for login and local CLI setup.
  bgm [--json] auth set-token <access_token>
    Save an existing Bangumi access token directly.
  bgm [--json] user me
    Show the current authenticated user profile.
  bgm [--json] subject search <keyword> [--type anime] [--limit n]
    Search Bangumi subjects by keyword.
  bgm [--json] subject get <subject_id> [--verbose]
    Fetch one Bangumi subject by subject ID. Add --verbose for detailed info.
  bgm [--json] collection get <subject_id>
    Show the current user's collection detail for one subject.
  bgm [--json] collection status <subject_id> <wish|collect|doing|on_hold|dropped>
    Update one subject collection status.
  bgm [--json] episode watch <subject_id> <episode_number>
    Mark one main episode as watched.
  bgm [--json] group list [--limit n]
    List Bangumi groups.
  bgm [--json] status
    Show current Bangumi service health.

Commands
  auth        Login, token, session, and Turnstile helpers
  config      Local runtime config read/write
  setup       Init and install-path helpers
  user        User profile reads
  subject     Subject reads and search
  collection  Subject collection reads and writes
  episode     Episode list and progress writes
  group       Group reads and writes
  blog        Blog reads and comment writes
  index       Index reads and writes
  timeline    Timeline reads and writes
  status      Community status service reads
  calendar    Weekly anime broadcast calendar
  tui         Interactive terminal UI

Examples
  bgm subject search "Ghost in the Shell" --type anime --limit 5
  bgm collection status 12 doing
  bgm episode watch 12 1
  bgm group list --limit 10
  bgm blog --help
  bgm episode --help`;
}

function buildGroupUsage(title, commands, extraLines = []) {
  const lines = [`${title} commands`, "", "Usage"];

  for (const [command, description] of commands) {
    lines.push(`  ${command}`);
    lines.push(`    ${description}`);
  }

  lines.push("");
  lines.push("Tip");
  lines.push("  Add `--json` for machine-readable output.");

  if (Array.isArray(extraLines) && extraLines.length > 0) {
    lines.push("");
    lines.push(...extraLines);
  }

  return lines.join("\n");
}

function normalizeUsageTarget(target) {
  if (!target) {
    return "";
  }

  return String(target).toLowerCase();
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

  if (isVersionStatusPayload(value)) {
    return formatVersionStatus(value);
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

  if (isPrivateSessionMutationPayload(value)) {
    return formatPrivateSessionMutation(value);
  }

  if (isPrivateSessionStatusPayload(value)) {
    return formatPrivateSessionStatus(value);
  }

  if (isAuthClearPayload(value)) {
    return formatAuthClear(value);
  }

  if (isBlogListPayload(value)) {
    return formatBlogList(value);
  }

  if (isBlogCommentsPayload(value)) {
    return formatBlogComments(value);
  }

  if (isBlogPhotosPayload(value)) {
    return formatBlogPhotos(value);
  }

  if (isBlogSubjectsPayload(value)) {
    return formatBlogSubjects(value);
  }

  if (isBlogCommentMutationPayload(value)) {
    return formatBlogCommentMutation(value);
  }

  if (isBlogPayload(value)) {
    return formatBlog(value);
  }

  if (isIndexCommentsPayload(value)) {
    return formatIndexComments(value);
  }

  if (isIndexRelatedPayload(value)) {
    return formatIndexRelated(value);
  }

  if (isIndexMutationPayload(value)) {
    return formatIndexMutation(value);
  }

  if (isIndexCommentMutationPayload(value)) {
    return formatIndexCommentMutation(value);
  }

  if (isIndexRelatedMutationPayload(value)) {
    return formatIndexRelatedMutation(value);
  }

  if (isIndexPayload(value)) {
    return formatIndex(value);
  }

  if (isTimelineListPayload(value)) {
    return formatTimelineList(value);
  }

  if (isTimelineRepliesPayload(value)) {
    return formatTimelineReplies(value);
  }

  if (isTimelineMutationPayload(value)) {
    return formatTimelineMutation(value);
  }

  if (isStatusIncidentsPayload(value)) {
    return formatStatusIncidents(value);
  }

  if (isStatusCurrentPayload(value)) {
    return formatStatusCurrent(value);
  }

  if (isCollectionListPayload(value)) {
    return formatCollectionList(value);
  }

  if (isCollectionMutationPayload(value)) {
    return formatCollectionMutation(value);
  }

  if (isEpisodeListPayload(value)) {
    return formatEpisodeList(value);
  }

  if (isEpisodeMutationPayload(value)) {
    return formatEpisodeMutation(value);
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

  if (isTurnstileTokenPayload(value)) {
    return formatTurnstileToken(value);
  }

  if (isOAuthTokenPayload(value)) {
    return formatOAuthToken(value);
  }

  if (isPagedSubjectPayload(value)) {
    return formatPagedSubjects(value);
  }

  if (isSubjectPayload(value)) {
    return formatSubject(value, context);
  }

  if (isUserPayload(value)) {
    return formatUser(value, context);
  }

  if (isCalendarPayload(value)) {
    return formatCalendar(value);
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
  if (payload.action === "update") {
    return [
      "bgm-cli updated",
      `  Platform: ${payload.platform}`,
      `  Install dir: ${payload.installDir ?? payload.repoDir}`,
      `  Active config file: ${payload.configFile}`,
      "",
      payload.output,
      "",
      payload.shellHint,
    ].join("\n");
  }

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

function formatVersionStatus(payload) {
  return [
    `${payload.name ?? "bgm-cli"} ${payload.version ?? "-"}`,
    `  Config scope: ${payload.configScope ?? "-"}`,
    `  Config file: ${payload.configFile ?? "-"}`,
    payload.configSourceFile && payload.configSourceFile !== payload.configFile
      ? `  Config source: ${payload.configSourceFile}`
      : null,
    `  Access token: ${payload.accessTokenSaved ? "Saved" : "Not saved"}`,
    `  Refresh token: ${payload.refreshTokenSaved ? "Saved" : "Not saved"}`,
    `  Private session: ${payload.privateSessionSaved ? "Saved" : "Not saved"}`,
    `  OAuth app: ${payload.oauthAppConfigured ? "Configured" : "Not configured"}`,
    `  OAuth backend: ${payload.oauthServerBaseUrl ?? "-"}`,
    `  Timezone: ${payload.timezone ?? "-"}`,
    `  User-Agent: ${payload.userAgent ?? "-"}`,
  ].filter(Boolean).join("\n");
}

function formatTokenStatus(payload) {
  if (payload.resource === "access-token-status") {
    return [
      "Access token status",
      `  Valid: ${payload.valid ? "Yes" : "No"}`,
      `  Access token: ${maskToken(payload.accessToken)}`,
      payload.user ? `  User ID: ${payload.user.id ?? "-"}` : null,
      payload.user ? `  Username: ${payload.user.username ?? "-"}` : null,
      payload.user ? `  Nickname: ${payload.user.nickname ?? "-"}` : null,
      payload.error ? `  Error: ${payload.error}` : null,
    ].filter(Boolean).join("\n");
  }

  return [
    "Access token status",
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

function formatPrivateSessionMutation(payload) {
  return [
    "Private API session saved",
    `  Session: ${payload.sessionPreview}`,
    `  Config file: ${payload.configFile}`,
    "  Purpose: optional next.bgm.tv/p1 session support only",
    payload.loginUrl ? `  Login URL: ${payload.loginUrl}` : null,
  ].filter(Boolean).join("\n");
}

function formatPrivateSessionStatus(payload) {
  return [
    "Private API session status",
    `  Saved: ${payload.saved ? "Yes" : "No"}`,
    `  Session: ${payload.sessionPreview ?? "-"}`,
    `  Updated at: ${formatTimestamp(payload.updatedAt)}`,
    "  Purpose: optional next.bgm.tv/p1 session support only",
    payload.loginUrl ? `  Login URL: ${payload.loginUrl}` : null,
  ].filter(Boolean).join("\n");
}

function formatAuthClear(payload) {
  return [
    "Auth config cleared",
    `  Config file: ${payload.configFile}`,
    `  Cleared: ${Array.isArray(payload.cleared) ? payload.cleared.join(", ") : "-"}`,
    "  Preserved: oauthServerBaseUrl, app metadata, timezone, and other non-auth config",
  ].join("\n");
}

function formatStatusIncidents(payload) {
  const lines = [
    "Bangumi status incidents",
    `  Source: ${payload.source ?? "-"}`,
    `  Feed: ${payload.feedUrl ?? "-"}`,
    `  Feed updated: ${formatTimestamp(payload.feedUpdatedAt)}`,
    `  Showing: ${payload.data?.length ?? 0} of ${payload.total ?? 0}`,
  ];

  if (payload.filters?.site) {
    lines.push(`  Site filter: ${payload.filters.site}`);
  }
  if (payload.filters?.audience) {
    lines.push(`  Audience filter: ${payload.filters.audience}`);
  }

  const incidents = Array.isArray(payload.data) ? payload.data : [];
  lines.push("");
  lines.push("Recent incidents");
  if (incidents.length === 0) {
    lines.push("No incidents matched the current filters.");
    return lines.join("\n");
  }

  for (const incident of incidents) {
    lines.push("");
    lines.push(`${incident.severity ?? "Incident"} | ${incident.site ?? "-"} | ${incident.audience ?? "-"}`);
    lines.push(`  Date: ${incident.date ?? "-"}`);
    lines.push(`  Updated: ${formatTimestamp(incident.updatedAt)}`);
    if (incident.summary) {
      lines.push(`  Summary: ${incident.summary}`);
    }
    if (incident.link) {
      lines.push(`  Link: ${incident.link}`);
    }
  }

  return lines.join("\n");
}

function formatStatusCurrent(payload) {
  const lines = [
    "Bangumi current status",
    `  Source: ${payload.source ?? "-"}`,
    `  Current status: ${formatCurrentStatusLabel(payload.status)}`,
    `  Monitored: ${payload.monitored ?? 0}`,
    `  Affected now: ${payload.affected ?? 0}`,
    `  Updated: ${formatTimestamp(payload.updatedAt)}`,
  ];

  if (payload.upstreamMessage) {
    lines.push(`  Summary: ${payload.upstreamMessage}`);
  }
  if (payload.filters?.site) {
    lines.push(`  Site filter: ${payload.filters.site}`);
  }
  if (payload.filters?.audience) {
    lines.push(`  Audience filter: ${payload.filters.audience}`);
  }

  const affectedComponents = Array.isArray(payload.affectedComponents) ? payload.affectedComponents : [];
  lines.push("");
  lines.push("Affected services now");
  if (affectedComponents.length === 0) {
    lines.push("  None. No monitored service is currently marked as degraded or down in the selected scope.");
  } else {
    for (const component of affectedComponents) {
      lines.push(
        `  - ${component.label ?? "-"} | ${formatCurrentStatusLabel(component.status)} | last check ${formatTimestamp(component.lastCheck)}`,
      );
    }
  }

  const unresolvedIncidents = Array.isArray(payload.unresolvedIncidents) ? payload.unresolvedIncidents : [];
  if (unresolvedIncidents.length > 0) {
    lines.push("");
    lines.push("Unresolved incidents now");
    for (const incident of unresolvedIncidents) {
      lines.push(
        `  - ${incident.label ?? "-"} | ${formatCurrentStatusLabel(incident.status)} | since ${formatTimestamp(incident.startTs)}`,
      );
    }
  }

  return lines.join("\n");
}

function formatCurrentStatusLabel(value) {
  switch (value) {
    case "ok":
      return colorizeStatusLabel("Operational", "ok");
    case "degraded":
      return colorizeStatusLabel("Degraded", "degraded");
    case "down":
      return colorizeStatusLabel("Outage", "down");
    default:
      return String(value ?? "-");
  }
}

function colorizeStatusLabel(label, status) {
  if (!shouldUseColor()) {
    return label;
  }

  const colors = {
    ok: "\u001b[32m",
    degraded: "\u001b[33m",
    down: "\u001b[31m",
  };
  const color = colors[status];
  if (!color) {
    return label;
  }

  return `${color}${label}\u001b[0m`;
}

function shouldUseColor() {
  if (!process.stdout.isTTY) {
    return false;
  }
  if (process.env.NO_COLOR) {
    return false;
  }
  if (process.env.FORCE_COLOR === "0") {
    return false;
  }
  return true;
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

  const rows = items.map((item) => {
    const subject = item.subject ?? {};
    return {
      id: item.subject_id ?? subject.id ?? "-",
      name: subject.name_cn || subject.name || "-",
      type: formatSubjectType(item.subject_type ?? subject.type),
      status: formatCollectionStatus(item.type),
      my: item.rate ? String(item.rate) : "",
      score: subject.score !== undefined ? String(subject.score) : "",
      rank: subject.rank ? `#${subject.rank}` : "",
      date: subject.date ?? "",
    };
  });

  const table = formatTable(rows, [
    { key: "id", header: "#", minWidth: 5, align: "right" },
    { key: "name", header: "Name", minWidth: 8, maxWidth: 32, align: "left" },
    { key: "type", header: "Type", minWidth: 5, align: "left" },
    { key: "status", header: "Status", minWidth: 7, align: "left" },
    { key: "my", header: "My", minWidth: 3, align: "right" },
    { key: "score", header: "Score", minWidth: 5, align: "right" },
    { key: "rank", header: "Rank", minWidth: 5, align: "right" },
    { key: "date", header: "Date", minWidth: 10, align: "left" },
  ]);

  lines.push("");
  lines.push(table);

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

function formatEpisodeList(payload) {
  const lines = [
    `Episodes: #${payload.subjectId ?? "-"}`,
    `  Range: ${formatPageRange(payload.offset ?? payload.filters?.offset, payload.data?.length, payload.total)}`,
  ];
  const episodes = Array.isArray(payload.data) ? payload.data : [];

  if (payload.filters?.type !== undefined) {
    lines.push(`  Type filter: ${formatEpisodeTypeFilter(payload.filters.type)}`);
  }

  if (episodes.length === 0) {
    lines.push("No episodes found.");
    return lines.join("\n");
  }

  for (const episode of episodes) {
    const pieces = [
      `#${episode.id ?? "-"}`,
      `[${formatEpisodeType(episode.type)}]`,
      formatEpisodeNumber(episode),
      episode.name_cn || episode.name || "-",
    ].filter(Boolean);

    if (episode.name && episode.name_cn && episode.name !== episode.name_cn) {
      pieces.push(`(${episode.name})`);
    }
    if (episode.airdate) {
      pieces.push(episode.airdate);
    }
    if (episode.duration) {
      pieces.push(episode.duration);
    }
    if (episode.comment !== undefined) {
      pieces.push(`${episode.comment} comments`);
    }

    lines.push("");
    lines.push(`• ${pieces.join("  ")}`);
    if (episode.desc) {
      lines.push(`  ${truncateText(episode.desc.trim(), 240)}`);
    }
  }

  return lines.join("\n");
}

function formatEpisodeMutation(payload) {
  const lines = [];
  const episode = payload.collection?.episode ?? payload.episode ?? {};

  lines.push(payload.actionLabel ?? "Episode updated");
  lines.push(`  Episode: #${payload.episodeId ?? episode.id ?? "-"}`);
  if (payload.subjectId || episode.subject_id) {
    lines.push(`  Subject: #${payload.subjectId ?? episode.subject_id ?? "-"}`);
  }
  lines.push(`  Type: ${formatEpisodeType(episode.type)}`);
  lines.push(`  Number: ${formatEpisodeNumber(episode) || "-"}`);
  lines.push(`  Name: ${episode.name_cn || episode.name || "-"}`);
  lines.push(`  Status: ${formatEpisodeCollectionStatus(payload.collection?.type ?? payload.status)}`);
  if (payload.collection?.updated_at) {
    lines.push(`  Updated at: ${formatTimestamp(payload.collection.updated_at)}`);
  }
  if (episode.airdate) {
    lines.push(`  Airdate: ${episode.airdate}`);
  }

  return lines.join("\n");
}

function formatBlogList(payload) {
  const lines = [
    `Blogs: ${payload.filters?.user ?? "-"}`,
    `  Range: ${formatPageRange(payload.offset ?? payload.filters?.offset, payload.data?.length, payload.total)}`,
  ];
  const blogs = Array.isArray(payload.data) ? payload.data : [];

  if (blogs.length === 0) {
    lines.push("No results.");
    return lines.join("\n");
  }

  const rows = blogs.map((entry) => ({
    id: entry.id ?? "-",
    title: entry.title ?? "-",
    replies: String(entry.replies ?? 0),
    visibility: entry.public ? "public" : "private",
    updated: entry.updatedAt ? formatTimestamp(entry.updatedAt).split(" ")[0] : "",
  }));

  const table = formatTable(rows, [
    { key: "id", header: "#", minWidth: 5, align: "right" },
    { key: "title", header: "Title", minWidth: 8, maxWidth: 32, align: "left" },
    { key: "replies", header: "Replies", minWidth: 7, align: "right" },
    { key: "visibility", header: "Visibility", minWidth: 10, align: "left" },
    { key: "updated", header: "Updated", minWidth: 10, align: "left" },
  ]);

  lines.push("");
  lines.push(table);

  return lines.join("\n");
}

function formatBlog(entry) {
  const lines = [
    `Blog #${entry.id ?? "-"}`,
    `  Title: ${entry.title ?? "-"}`,
    `  Author: ${formatUserLabel(entry.user, entry.uid)}`,
    `  Replies: ${entry.replies ?? 0}`,
    `  Views: ${entry.views ?? 0}`,
    `  Public: ${entry.public ? "Yes" : "No"}`,
    `  No reply: ${entry.noreply ? "Yes" : "No"}`,
    `  Related: ${entry.related ?? 0}`,
    `  Created at: ${formatTimestamp(entry.createdAt)}`,
    `  Updated at: ${formatTimestamp(entry.updatedAt)}`,
    `  URL: https://bgm.tv/blog/${entry.id ?? ""}`,
  ];

  if (Array.isArray(entry.tags) && entry.tags.length > 0) {
    lines.push(`  Tags: ${entry.tags.join(", ")}`);
  }

  if (entry.content) {
    lines.push("");
    lines.push("Content");
    lines.push(indentBlock(truncateText(entry.content.trim(), 4000), 2));
  }

  return lines.join("\n");
}

function formatBlogComments(payload) {
  const lines = [
    `Blog comments: #${payload.entryId ?? "-"}`,
    `  Count: ${payload.data?.length ?? 0}`,
  ];
  const comments = Array.isArray(payload.data) ? payload.data : [];

  if (comments.length === 0) {
    lines.push("No comments.");
    return lines.join("\n");
  }

  for (const comment of comments) {
    lines.push("");
    lines.push(`• ${formatBlogCommentLine(comment)}`);
    if (comment.content) {
      lines.push(indentBlock(truncateText(comment.content.trim(), 800), 2));
    }

    const replies = Array.isArray(comment.replies) ? comment.replies : [];
    for (const reply of replies) {
      lines.push(`  - ${formatBlogCommentLine(reply)}`);
      if (reply.content) {
        lines.push(indentBlock(truncateText(reply.content.trim(), 500), 4));
      }
    }
  }

  return lines.join("\n");
}

function formatBlogPhotos(payload) {
  const lines = [
    `Blog photos: #${payload.entryId ?? "-"}`,
    `  Range: ${formatPageRange(payload.offset ?? payload.filters?.offset, payload.data?.length, payload.total)}`,
  ];
  const photos = Array.isArray(payload.data) ? payload.data : [];

  if (photos.length === 0) {
    lines.push("No results.");
    return lines.join("\n");
  }

  for (const photo of photos) {
    const pieces = [
      `#${photo.id ?? "-"}`,
      `${photo.vote ?? 0} votes`,
    ];

    if (photo.createdAt) {
      pieces.push(`created ${formatTimestamp(photo.createdAt)}`);
    }

    lines.push("");
    lines.push(`• ${pieces.join("  ")}`);
    lines.push(`  ${photo.target ?? photo.icon ?? "-"}`);
  }

  return lines.join("\n");
}

function formatBlogSubjects(payload) {
  const lines = [
    `Blog subjects: #${payload.entryId ?? "-"}`,
    `  Count: ${payload.data?.length ?? 0}`,
  ];
  const subjects = Array.isArray(payload.data) ? payload.data : [];

  if (subjects.length === 0) {
    lines.push("No results.");
    return lines.join("\n");
  }

  for (const subject of subjects) {
    const pieces = [
      `#${subject.id ?? "-"}`,
      subject.nameCN || subject.name || "-",
      `[${formatSubjectType(subject.type)}]`,
    ];

    if (subject.name && subject.nameCN && subject.name !== subject.nameCN) {
      pieces.push(`(${subject.name})`);
    }
    if (subject.date) {
      pieces.push(subject.date);
    }

    lines.push("");
    lines.push(`• ${pieces.join("  ")}`);
  }

  return lines.join("\n");
}

function formatBlogCommentMutation(payload) {
  if (payload.action === "reply") {
    return [
      "Blog reply created",
      `  Blog ID: ${payload.entryId ?? "-"}`,
      `  Comment ID: ${payload.commentId ?? "-"}`,
      `  Reply to: ${payload.replyTo ?? 0}`,
      `  Blog URL: ${payload.url ?? "-"}`,
    ].join("\n");
  }

  if (payload.action === "edit") {
    return [
      "Blog comment updated",
      `  Comment ID: ${payload.commentId ?? "-"}`,
    ].join("\n");
  }

  if (payload.action === "delete") {
    return [
      "Blog comment deleted",
      `  Comment ID: ${payload.commentId ?? "-"}`,
    ].join("\n");
  }

  return JSON.stringify(payload, null, 2);
}

function formatIndex(index) {
  const lines = [
    `Index #${index.id ?? "-"}`,
    `  Title: ${index.title ?? "-"}`,
    `  Author: ${formatUserLabel(index.user, index.uid)}`,
    `  Type: ${formatIndexType(index.type)}`,
    `  Private: ${index.private ? "Yes" : "No"}`,
    `  Total related: ${index.total ?? 0}`,
    `  Replies: ${index.replies ?? 0}`,
    `  Collects: ${index.collects ?? 0}`,
    `  Created at: ${formatTimestamp(index.createdAt)}`,
    `  Updated at: ${formatTimestamp(index.updatedAt)}`,
    `  URL: https://bgm.tv/index/${index.id ?? ""}`,
  ];

  if (index.stats && typeof index.stats === "object") {
    const stats = Object.entries(index.stats).filter(([, value]) => Number(value) > 0);
    if (stats.length > 0) {
      lines.push(`  Stats: ${stats.map(([key, value]) => `${key} ${value}`).join(", ")}`);
    }
  }

  if (index.desc) {
    lines.push("");
    lines.push("Description");
    lines.push(indentBlock(truncateText(index.desc.trim(), 4000), 2));
  }

  return lines.join("\n");
}

function formatIndexComments(payload) {
  const lines = [
    `Index comments: #${payload.indexId ?? "-"}`,
    `  Count: ${payload.data?.length ?? 0}`,
  ];
  const comments = Array.isArray(payload.data) ? payload.data : [];

  if (comments.length === 0) {
    lines.push("No comments.");
    return lines.join("\n");
  }

  for (const comment of comments) {
    lines.push("");
    lines.push(`• ${formatBlogCommentLine(comment)}`);
    if (comment.content) {
      lines.push(indentBlock(truncateText(comment.content.trim(), 800), 2));
    }

    const replies = Array.isArray(comment.replies) ? comment.replies : [];
    for (const reply of replies) {
      lines.push(`  - ${formatBlogCommentLine(reply)}`);
      if (reply.content) {
        lines.push(indentBlock(truncateText(reply.content.trim(), 500), 4));
      }
    }
  }

  return lines.join("\n");
}

function formatIndexRelated(payload) {
  const lines = [
    `Index related: #${payload.indexId ?? "-"}`,
    `  Range: ${formatPageRange(payload.offset ?? payload.filters?.offset, payload.data?.length, payload.total)}`,
  ];
  if (payload.filters?.cat !== undefined) {
    lines.push(`  Category: ${formatIndexRelatedCategory(payload.filters.cat)}`);
  }
  if (payload.filters?.type !== undefined) {
    lines.push(`  Type: ${formatSubjectType(payload.filters.type)}`);
  }

  const items = Array.isArray(payload.data) ? payload.data : [];
  if (items.length === 0) {
    lines.push("No results.");
    return lines.join("\n");
  }

  for (const item of items) {
    const pieces = [
      `#${item.id ?? "-"}`,
      `[${formatIndexRelatedCategory(item.cat)}]`,
      `target ${item.sid ?? "-"}`,
      describeIndexRelatedTarget(item),
    ].filter(Boolean);

    if (item.order !== undefined) {
      pieces.push(`order ${item.order}`);
    }
    if (item.createdAt) {
      pieces.push(`created ${formatTimestamp(item.createdAt)}`);
    }

    lines.push("");
    lines.push(`• ${pieces.join("  ")}`);
    if (item.comment) {
      lines.push(`  Comment: ${item.comment}`);
    }
    if (item.award) {
      lines.push(`  Award: ${item.award}`);
    }
  }

  return lines.join("\n");
}

function formatIndexMutation(payload) {
  if (payload.action === "create") {
    return [
      "Index created",
      `  Index ID: ${payload.indexId ?? "-"}`,
      `  Title: ${payload.title ?? "-"}`,
      `  Private: ${payload.private ? "Yes" : "No"}`,
      `  URL: https://bgm.tv/index/${payload.indexId ?? ""}`,
    ].join("\n");
  }

  if (payload.action === "update") {
    return [
      "Index updated",
      `  Index ID: ${payload.indexId ?? "-"}`,
    ].join("\n");
  }

  if (payload.action === "delete") {
    return [
      "Index deleted",
      `  Index ID: ${payload.indexId ?? "-"}`,
    ].join("\n");
  }

  return JSON.stringify(payload, null, 2);
}

function formatIndexCommentMutation(payload) {
  if (payload.action === "reply") {
    return [
      "Index comment created",
      `  Index ID: ${payload.indexId ?? "-"}`,
      `  Comment ID: ${payload.commentId ?? "-"}`,
      `  Reply to: ${payload.replyTo ?? 0}`,
      `  Index URL: ${payload.url ?? "-"}`,
    ].join("\n");
  }

  if (payload.action === "edit") {
    return [
      "Index comment updated",
      `  Comment ID: ${payload.commentId ?? "-"}`,
    ].join("\n");
  }

  if (payload.action === "delete") {
    return [
      "Index comment deleted",
      `  Comment ID: ${payload.commentId ?? "-"}`,
    ].join("\n");
  }

  return JSON.stringify(payload, null, 2);
}

function formatIndexRelatedMutation(payload) {
  if (payload.action === "add") {
    return [
      "Index related item added",
      `  Index ID: ${payload.indexId ?? "-"}`,
      `  Related ID: ${payload.relatedId ?? "-"}`,
      `  Category: ${formatIndexRelatedCategory(payload.cat)}`,
      `  Target ID: ${payload.sid ?? "-"}`,
      `  Order: ${payload.order ?? 0}`,
    ].join("\n");
  }

  if (payload.action === "update") {
    return [
      "Index related item updated",
      `  Index ID: ${payload.indexId ?? "-"}`,
      `  Related ID: ${payload.relatedId ?? "-"}`,
      `  Order: ${payload.order ?? "-"}`,
    ].join("\n");
  }

  if (payload.action === "delete") {
    return [
      "Index related item deleted",
      `  Index ID: ${payload.indexId ?? "-"}`,
      `  Related ID: ${payload.relatedId ?? "-"}`,
    ].join("\n");
  }

  return JSON.stringify(payload, null, 2);
}

function formatTimelineList(payload) {
  const title = payload.resource === "timeline-user-list"
    ? `Timeline: ${payload.filters?.user ?? "-"}`
    : "Timeline";
  const lines = [
    title,
    `  Returned: ${payload.data?.length ?? 0}`,
  ];

  if (payload.resource === "timeline-list") {
    lines.push(`  Mode: ${payload.filters?.mode ?? "all"}`);
  }
  if (payload.filters?.until !== undefined) {
    lines.push(`  Until: #${payload.filters.until}`);
  }

  const entries = Array.isArray(payload.data) ? payload.data : [];
  if (entries.length === 0) {
    lines.push("No results.");
    return lines.join("\n");
  }

  for (const entry of entries) {
    lines.push("");
    lines.push(`• ${formatTimelineLine(entry)}`);

    const memoSummary = formatTimelineMemoSummary(entry.memo);
    if (memoSummary) {
      lines.push(`  ${truncateText(memoSummary, 240)}`);
    }

    if (entry.source?.name || entry.source?.url) {
      lines.push(`  Source: ${formatTimelineSource(entry.source)}`);
    }
  }

  return lines.join("\n");
}

function formatTimelineReplies(payload) {
  const lines = [
    `Timeline replies: #${payload.timelineId ?? "-"}`,
    `  Count: ${payload.data?.length ?? 0}`,
  ];
  const comments = Array.isArray(payload.data) ? payload.data : [];

  if (comments.length === 0) {
    lines.push("No replies.");
    return lines.join("\n");
  }

  for (const comment of comments) {
    lines.push("");
    lines.push(`• ${formatBlogCommentLine(comment)}`);
    if (comment.content) {
      lines.push(indentBlock(truncateText(comment.content.trim(), 800), 2));
    }

    const replies = Array.isArray(comment.replies) ? comment.replies : [];
    for (const reply of replies) {
      lines.push(`  - ${formatBlogCommentLine(reply)}`);
      if (reply.content) {
        lines.push(indentBlock(truncateText(reply.content.trim(), 500), 4));
      }
    }
  }

  return lines.join("\n");
}

function formatTimelineMutation(payload) {
  if (payload.action === "say") {
    return [
      "Timeline status created",
      `  Timeline ID: ${payload.timelineId ?? "-"}`,
    ].join("\n");
  }

  if (payload.action === "reply") {
    return [
      "Timeline reply created",
      `  Timeline ID: ${payload.timelineId ?? "-"}`,
      `  Comment ID: ${payload.commentId ?? "-"}`,
      `  Reply to: ${payload.replyTo ?? 0}`,
    ].join("\n");
  }

  if (payload.action === "delete") {
    return [
      "Timeline deleted",
      `  Timeline ID: ${payload.timelineId ?? "-"}`,
    ].join("\n");
  }

  if (payload.action === "like") {
    return [
      "Timeline reaction saved",
      `  Timeline ID: ${payload.timelineId ?? "-"}`,
      `  Value: ${payload.value ?? "-"}`,
    ].join("\n");
  }

  if (payload.action === "unlike") {
    return [
      "Timeline reaction removed",
      `  Timeline ID: ${payload.timelineId ?? "-"}`,
    ].join("\n");
  }

  return JSON.stringify(payload, null, 2);
}

function describeIndexRelatedTarget(item) {
  if (item.subject) {
    return item.subject.nameCN || item.subject.name || null;
  }
  if (item.character) {
    return item.character.nameCN || item.character.name || null;
  }
  if (item.person) {
    return item.person.nameCN || item.person.name || null;
  }
  if (item.episode) {
    return item.episode.nameCN || item.episode.name || `Episode #${item.episode.id ?? item.sid}`;
  }
  if (item.blog) {
    return item.blog.title || null;
  }
  if (item.groupTopic) {
    return item.groupTopic.title || null;
  }
  if (item.subjectTopic) {
    return item.subjectTopic.title || null;
  }
  return null;
}

function formatIndexType(value) {
  return {
    0: "User",
    1: "Public",
    2: "Award",
  }[value] ?? String(value ?? "-");
}

function formatIndexRelatedCategory(value) {
  return {
    0: "Subject",
    1: "Character",
    2: "Person",
    3: "Episode",
    4: "Blog",
    5: "Group Topic",
    6: "Subject Topic",
  }[value] ?? String(value ?? "-");
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

  const rows = groups.map((group) => ({
    id: group.id ?? "-",
    title: group.title || "-",
    slug: group.name || "-",
    members: String(group.members ?? 0),
    topics: String(group.topics ?? 0),
    created: group.createdAt ? formatTimestamp(group.createdAt).split(" ")[0] : "",
  }));

  const table = formatTable(rows, [
    { key: "id", header: "#", minWidth: 5, align: "right" },
    { key: "title", header: "Title", minWidth: 8, maxWidth: 24, align: "left" },
    { key: "slug", header: "Slug", minWidth: 8, maxWidth: 16, align: "left" },
    { key: "members", header: "Members", minWidth: 7, align: "right" },
    { key: "topics", header: "Topics", minWidth: 6, align: "right" },
    { key: "created", header: "Created", minWidth: 10, align: "left" },
  ]);

  lines.push("");
  lines.push(table);

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

  const rows = members.map((member) => {
    const user = member.user ?? {};
    return {
      user: formatUserLabel(user, member.uid),
      role: formatGroupMemberRole(member.role),
      joined: member.joinedAt ? formatTimestamp(member.joinedAt).split(" ")[0] : "",
    };
  });

  const table = formatTable(rows, [
    { key: "user", header: "User", minWidth: 8, maxWidth: 24, align: "left" },
    { key: "role", header: "Role", minWidth: 6, align: "left" },
    { key: "joined", header: "Joined", minWidth: 10, align: "left" },
  ]);

  lines.push("");
  lines.push(table);

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

  const rows = topics.map((topic) => ({
    id: topic.id ?? "-",
    title: topic.title ?? "-",
    replies: topic.replyCount !== undefined ? String(topic.replyCount) : "",
    author: topic.creator || topic.creatorID ? formatUserLabel(topic.creator, topic.creatorID) : "",
    updated: topic.updatedAt ? formatTimestamp(topic.updatedAt).split(" ")[0] : "",
  }));

  const table = formatTable(rows, [
    { key: "id", header: "#", minWidth: 5, align: "right" },
    { key: "title", header: "Title", minWidth: 8, maxWidth: 32, align: "left" },
    { key: "replies", header: "Replies", minWidth: 7, align: "right" },
    { key: "author", header: "Author", minWidth: 8, maxWidth: 16, align: "left" },
    { key: "updated", header: "Updated", minWidth: 10, align: "left" },
  ]);

  lines.push("");
  lines.push(table);

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

function formatTurnstileToken(payload) {
  const lines = [
    "Turnstile token acquired",
    `  Token: ${payload.token ?? payload.tokenPreview ?? "-"}`,
    "  Note: this token is short-lived and should be used immediately for one write operation.",
  ];

  if (payload.backendBaseUrl) {
    lines.push("  Mode: hosted official Bangumi Turnstile");
    lines.push(`  Backend: ${payload.backendBaseUrl}`);
  } else if (payload.verificationUrl) {
    lines.push("  Mode: local helper fallback");
  }
  if (payload.authorizeUrl) {
    lines.push(`  Authorize URL: ${payload.authorizeUrl}`);
  }
  if (payload.redirectUri) {
    lines.push(`  Callback URL: ${payload.redirectUri}`);
  }
  if (payload.sessionId) {
    lines.push(`  Session ID: ${payload.sessionId}`);
  }
  if (payload.verificationUrl) {
    lines.push(`  Helper URL: ${payload.verificationUrl}`);
  }
  if (payload.listenHost || payload.port !== undefined) {
    lines.push(`  Listen address: ${payload.listenHost ?? "-"}:${payload.port ?? "-"}`);
  }
  lines.push(`  Browser opened: ${payload.openedBrowser ? "yes" : "no"}`);
  lines.push(`  Timeout: ${payload.timeoutSeconds ?? "-"} seconds`);

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

function formatCalendar(payload) {
  const lines = [];
  for (const day of payload.data) {
    const weekday = day.weekday;
    lines.push(`\n${weekday.en}`);
    const items = day.items ?? [];
    if (items.length === 0) {
      lines.push("  (no items)");
      continue;
    }
    const rows = items.map((item) => {
      const name = item.name_cn || item.name;
      const score = item.rating?.score ?? "-";
      const doing = item.collection?.doing ?? 0;
      return {
        id: String(item.id),
        name: truncateDisplay(name, 40),
        score: score !== "-" ? String(score) : "-",
        doing: String(doing),
      };
    });
    lines.push(
      formatTable(rows, [
        { key: "id", header: "ID", minWidth: 8, maxWidth: 10 },
        { key: "name", header: "Name", minWidth: 20, maxWidth: 40 },
        { key: "score", header: "Score", minWidth: 5, maxWidth: 6 },
        { key: "doing", header: "Doing", minWidth: 5, maxWidth: 7 },
      ]),
    );
  }
  return lines.join("\n").trim();
}

function formatSubject(subject, context = {}) {
  const verbose = Boolean(context?.verbose);
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
  if (subject.eps || subject.total_episodes) {
    lines.push(`  Episodes: ${subject.total_episodes ?? subject.eps ?? "-"}`);
  }
  if (subject.volumes) {
    lines.push(`  Volumes: ${subject.volumes}`);
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

  if (verbose) {
    if (subject.images) {
      lines.push("");
      lines.push("Images");
      if (subject.images.large) lines.push(`  Large: ${subject.images.large}`);
      if (subject.images.medium) lines.push(`  Medium: ${subject.images.medium}`);
      if (subject.images.common) lines.push(`  Common: ${subject.images.common}`);
    }

    if (Array.isArray(subject.infobox) && subject.infobox.length > 0) {
      lines.push("");
      lines.push(`Infobox (${subject.infobox.length} entries)`);
      for (const item of subject.infobox) {
        const key = item.key ?? "";
        const value = item.value;
        let displayValue;
        if (Array.isArray(value)) {
          displayValue = value
            .map((v) => (typeof v === "object" && v !== null ? v.v ?? "" : String(v)))
            .filter(Boolean)
            .join(", ");
        } else {
          displayValue = String(value ?? "");
        }
        if (displayValue) {
          lines.push(`  ${key}: ${displayValue}`);
        }
      }
    }

    if (Array.isArray(subject.tags) && subject.tags.length > 0) {
      lines.push("");
      lines.push("Tags");
      const topTags = subject.tags.slice(0, 15);
      for (const tag of topTags) {
        lines.push(`  ${tag.name ?? "-"}: ${tag.count ?? 0}`);
      }
    }

    if (subject.rating?.count) {
      lines.push("");
      lines.push("Rating Distribution");
      const counts = subject.rating.count;
      for (let score = 1; score <= 10; score += 1) {
        lines.push(`  ${score}: ${counts[String(score)] ?? 0}`);
      }
    }
  }

  if (subject.summary) {
    lines.push("");
    lines.push("Summary");
    lines.push(indentBlock(truncateText(subject.summary.trim(), verbose ? 800 : 400), 2));
  }

  if (Array.isArray(subject.meta_tags) && subject.meta_tags.length > 0) {
    lines.push("");
    lines.push("Meta Tags");
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

  const rows = subjects.map((subject) => ({
    id: subject.id ?? "-",
    name: subject.name_cn || subject.name || "-",
    type: formatSubjectType(subject.type),
    score: subject.rating?.score !== undefined ? String(subject.rating.score) : "",
    rank: subject.rating?.rank ? `#${subject.rating.rank}` : "",
    date: subject.date ?? "",
  }));

  const table = formatTable(rows, [
    { key: "id", header: "#", minWidth: 6, align: "right" },
    { key: "name", header: "Name", minWidth: 8, maxWidth: 32, align: "left" },
    { key: "type", header: "Type", minWidth: 5, align: "left" },
    { key: "score", header: "Score", minWidth: 5, align: "right" },
    { key: "rank", header: "Rank", minWidth: 5, align: "right" },
    { key: "date", header: "Date", minWidth: 10, align: "left" },
  ]);

  lines.push("");
  lines.push(table);

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
    "privateSessionId",
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

  const date = parseTimestampValue(value);
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

function parseTimestampValue(value) {
  if (value instanceof Date) {
    return value;
  }

  if (typeof value === "number") {
    return new Date(value * 1000);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
      return new Date(Number(trimmed) * 1000);
    }

    return new Date(trimmed);
  }

  return new Date(Number(value) * 1000);
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

function formatEpisodeType(type) {
  return EPISODE_TYPE_LABELS[type] ?? String(type ?? "-");
}

function formatEpisodeTypeFilter(type) {
  if (type === undefined || type === null || type === "") {
    return "All";
  }
  if (type === "op_ed") {
    return "OP/ED";
  }
  return formatEpisodeType(type);
}

function formatEpisodeNumber(episode) {
  if (!isObject(episode)) {
    return "";
  }
  if (Number(episode.type) === 0 && episode.ep !== undefined && episode.ep !== null) {
    return `EP ${episode.ep}`;
  }
  if (episode.sort !== undefined && episode.sort !== null) {
    return `Sort ${episode.sort}`;
  }
  return "";
}

function formatCollectionStatus(type) {
  return COLLECTION_STATUS_LABELS[type] ?? String(type ?? "-");
}

function formatEpisodeCollectionStatus(type) {
  return EPISODE_COLLECTION_STATUS_LABELS[type] ?? String(type ?? "-");
}

function formatGroupMemberRole(role) {
  if (role === undefined || role === null || role === "") {
    return "All";
  }

  return GROUP_MEMBER_ROLE_LABELS[role] ?? String(role);
}

function formatTimelineCat(cat) {
  return TIMELINE_CAT_LABELS[cat] ?? String(cat ?? "-");
}

function formatTimelineLine(entry) {
  const pieces = [
    `#${entry.id ?? "-"}`,
    `[${formatTimelineCat(entry.cat)}]`,
  ];

  if (entry.user || entry.uid) {
    pieces.push(`by ${formatUserLabel(entry.user, entry.uid)}`);
  }
  pieces.push(`${entry.replies ?? 0} replies`);
  if (entry.createdAt) {
    pieces.push(formatTimestamp(entry.createdAt));
  }

  return pieces.join("  ");
}

function formatTimelineMemoSummary(memo) {
  if (!isObject(memo)) {
    return "";
  }

  if (memo.status?.tsukkomi) {
    return memo.status.tsukkomi;
  }
  if (memo.status?.sign) {
    return `Sign: ${memo.status.sign}`;
  }
  if (memo.status?.nickname) {
    return `Nickname: ${memo.status.nickname.before ?? "-"} -> ${memo.status.nickname.after ?? "-"}`;
  }
  if (memo.blog?.title) {
    return `Blog: ${memo.blog.title}`;
  }
  if (memo.index?.title) {
    return `Index: ${memo.index.title}`;
  }
  if (Array.isArray(memo.subject) && memo.subject.length > 0) {
    const names = memo.subject
      .map((item) => formatSlimSubjectLabel(item?.subject))
      .filter(Boolean)
      .slice(0, 3);
    if (names.length > 0) {
      return `Subjects: ${names.join(" | ")}`;
    }
  }
  if (memo.progress?.single?.subject || memo.progress?.single?.episode) {
    const subject = formatSlimSubjectLabel(memo.progress.single.subject);
    const episode = memo.progress.single.episode;
    const episodeLabel = episode ? `EP ${episode.sort ?? episode.id ?? "-"} ${episode.nameCN || episode.name || ""}`.trim() : "";
    return ["Progress:", subject, episodeLabel].filter(Boolean).join(" ");
  }
  if (memo.progress?.batch?.subject) {
    const subject = formatSlimSubjectLabel(memo.progress.batch.subject);
    const updates = [];
    if (memo.progress.batch.epsUpdate) {
      updates.push(`+${memo.progress.batch.epsUpdate} eps`);
    }
    if (memo.progress.batch.volsUpdate) {
      updates.push(`+${memo.progress.batch.volsUpdate} vols`);
    }
    return ["Progress:", subject, updates.join(" ")].filter(Boolean).join(" ");
  }
  if (memo.wiki?.subject) {
    return `Wiki: ${formatSlimSubjectLabel(memo.wiki.subject)}`;
  }
  if (memo.daily?.users || memo.daily?.groups) {
    const users = Array.isArray(memo.daily.users) ? memo.daily.users.map((user) => formatUserLabel(user)).filter(Boolean) : [];
    const groups = Array.isArray(memo.daily.groups)
      ? memo.daily.groups.map((group) => group?.title || group?.name).filter(Boolean)
      : [];
    return [
      users.length > 0 ? `Users: ${users.slice(0, 3).join(", ")}` : "",
      groups.length > 0 ? `Groups: ${groups.slice(0, 3).join(", ")}` : "",
    ]
      .filter(Boolean)
      .join(" | ");
  }
  if (memo.mono?.characters || memo.mono?.persons) {
    const characters = Array.isArray(memo.mono.characters)
      ? memo.mono.characters.map((character) => character?.nameCN || character?.name).filter(Boolean)
      : [];
    const persons = Array.isArray(memo.mono.persons)
      ? memo.mono.persons.map((person) => person?.nameCN || person?.name).filter(Boolean)
      : [];
    return [
      characters.length > 0 ? `Characters: ${characters.slice(0, 3).join(", ")}` : "",
      persons.length > 0 ? `Persons: ${persons.slice(0, 3).join(", ")}` : "",
    ]
      .filter(Boolean)
      .join(" | ");
  }

  return "";
}

function formatTimelineSource(source) {
  if (!isObject(source)) {
    return "-";
  }

  const pieces = [];
  if (source.name) {
    pieces.push(source.name);
  }
  if (source.url) {
    pieces.push(source.url);
  }
  return pieces.join("  ") || "-";
}

function formatSlimSubjectLabel(subject) {
  if (!isObject(subject)) {
    return "";
  }

  const name = subject.nameCN || subject.name;
  if (!name) {
    return subject.id ? `#${subject.id}` : "";
  }

  return subject.id ? `#${subject.id} ${name}` : name;
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

function formatBlogCommentLine(comment) {
  const pieces = [
    `#${comment.id ?? "-"}`,
    `by ${formatUserLabel(comment.user, comment.creatorID)}`,
  ];

  if (comment.createdAt) {
    pieces.push(formatTimestamp(comment.createdAt));
  }
  if (comment.relatedID) {
    pieces.push(`reply to #${comment.relatedID}`);
  }

  return pieces.join("  ");
}

function isConfigShowPayload(value) {
  return isObject(value) && "configFile" in value && "config" in value;
}

function isConfigMutationPayload(value) {
  return isObject(value) && "configFile" in value && ("updated" in value || "removed" in value);
}

function isVersionStatusPayload(value) {
  return isObject(value) && value.resource === "version-status";
}

function isInstallPathPayload(value) {
  return isObject(value)
    && ["install-path", "update"].includes(value.action)
    && ("configFile" in value || "platform" in value || "repoDir" in value || "installDir" in value);
}

function isLoginUrlPayload(value) {
  return isObject(value) && typeof value.loginUrl === "string" && !("resource" in value);
}

function isTokenSetPayload(value) {
  return isObject(value) && "saved" in value && "accessTokenPreview" in value;
}

function isTokenStatusPayload(value) {
  return isObject(value) && (("client_id" in value && "expires" in value) || value.resource === "access-token-status");
}

function isPrivateSessionMutationPayload(value) {
  return isObject(value) && value.resource === "private-session-mutation" && typeof value.sessionPreview === "string";
}

function isPrivateSessionStatusPayload(value) {
  return isObject(value) && value.resource === "private-session-status" && typeof value.saved === "boolean";
}

function isAuthClearPayload(value) {
  return isObject(value) && value.resource === "auth-clear" && Array.isArray(value.cleared);
}

function isStatusIncidentsPayload(value) {
  return isObject(value) && value.resource === "status-incidents" && Array.isArray(value.data);
}

function isStatusCurrentPayload(value) {
  return isObject(value) && value.resource === "status-current" && Array.isArray(value.affectedComponents);
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
  return isObject(value) && typeof value.action === "string" && "subjectId" in value && value.resource !== "episode-mutation";
}

function isEpisodeListPayload(value) {
  return isObject(value) && value.resource === "episode-list" && Array.isArray(value.data);
}

function isEpisodeMutationPayload(value) {
  return isObject(value) && value.resource === "episode-mutation" && typeof value.action === "string";
}

function isBlogListPayload(value) {
  return isObject(value) && value.resource === "blog-list" && Array.isArray(value.data);
}

function isIndexPayload(value) {
  return isObject(value) && "title" in value && "desc" in value && "collects" in value && "stats" in value && "replies" in value;
}

function isIndexCommentsPayload(value) {
  return isObject(value) && value.resource === "index-comments" && Array.isArray(value.data);
}

function isIndexRelatedPayload(value) {
  return isObject(value) && value.resource === "index-related" && Array.isArray(value.data);
}

function isIndexMutationPayload(value) {
  return isObject(value) && value.resource === "index-mutation" && typeof value.action === "string";
}

function isIndexCommentMutationPayload(value) {
  return isObject(value) && value.resource === "index-comment-mutation" && typeof value.action === "string";
}

function isIndexRelatedMutationPayload(value) {
  return isObject(value) && value.resource === "index-related-mutation" && typeof value.action === "string";
}

function isBlogCommentsPayload(value) {
  return isObject(value) && value.resource === "blog-comments" && Array.isArray(value.data);
}

function isBlogPhotosPayload(value) {
  return isObject(value) && value.resource === "blog-photos" && Array.isArray(value.data);
}

function isBlogSubjectsPayload(value) {
  return isObject(value) && value.resource === "blog-subjects" && Array.isArray(value.data);
}

function isBlogCommentMutationPayload(value) {
  return isObject(value) && value.resource === "blog-comment-mutation" && typeof value.action === "string";
}

function isBlogPayload(value) {
  return isObject(value) && "title" in value && "content" in value && "views" in value && "public" in value && "user" in value;
}

function isTimelineListPayload(value) {
  return isObject(value) && ["timeline-list", "timeline-user-list"].includes(value.resource) && Array.isArray(value.data);
}

function isTimelineRepliesPayload(value) {
  return isObject(value) && value.resource === "timeline-replies" && Array.isArray(value.data);
}

function isTimelineMutationPayload(value) {
  return isObject(value) && value.resource === "timeline-mutation" && typeof value.action === "string";
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

function isTurnstileTokenPayload(value) {
  return isObject(value) && value.resource === "turnstile-token" && typeof value.token === "string";
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

function isCalendarPayload(value) {
  return isObject(value) && value.resource === "calendar" && Array.isArray(value.data);
}

function isObject(value) {
  return typeof value === "object" && value !== null;
}

// ── Table formatting (CJK-safe) ────────────────────────────────

function displayWidth(str) {
  let width = 0;
  for (const char of String(str)) {
    const cp = char.codePointAt(0);
    if (
      (cp >= 0x2E80 && cp <= 0x9FFF) ||
      (cp >= 0xAC00 && cp <= 0xD7FF) ||
      (cp >= 0xF900 && cp <= 0xFAFF) ||
      (cp >= 0xFE30 && cp <= 0xFE6F) ||
      (cp >= 0xFF00 && cp <= 0xFFEF) ||
      (cp >= 0x20000 && cp <= 0x2FA1F)
    ) {
      width += 2;
    } else {
      width += 1;
    }
  }
  return width;
}

function padDisplay(str, targetWidth, align = "left") {
  const strW = displayWidth(str);
  const pad = targetWidth - strW;
  if (pad <= 0) return str;
  const spaces = " ".repeat(pad);
  return align === "right" ? spaces + str : str + spaces;
}

function truncateDisplay(str, maxWidth) {
  const totalW = displayWidth(str);
  if (totalW <= maxWidth) return str;

  let result = "";
  let w = 0;
  for (const char of String(str)) {
    const cw = displayWidth(char);
    if (w + cw > maxWidth - 1) {
      result += "…";
      break;
    }
    result += char;
    w += cw;
  }
  return result;
}

function formatTable(rows, columns) {
  // columns: [{ key, header, minWidth, maxWidth, align }]
  const widths = columns.map((col) => {
    const headerW = displayWidth(col.header);
    const maxDataW = rows.reduce((max, row) => {
      const cell = String(row[col.key] ?? "");
      return Math.max(max, displayWidth(cell));
    }, 0);
    let w = Math.max(headerW, maxDataW, col.minWidth ?? 3) + 2;
    if (col.maxWidth) {
      w = Math.min(w, col.maxWidth + 2);
    }
    return w;
  });

  // Build lines
  const lines = [];

  // Header
  const headerLine = columns
    .map((col, i) => " " + padDisplay(col.header, widths[i] - 2, col.align ?? "left") + " ")
    .join("│");
  lines.push("│" + headerLine + "│");

  // Separator
  const sepLine = widths.map((w) => "─".repeat(w)).join("┼");
  lines.push("├" + sepLine + "┤");

  // Rows
  for (const row of rows) {
    const cells = columns.map((col, i) => {
      const raw = String(row[col.key] ?? "");
      const truncated = truncateDisplay(raw, widths[i] - 2);
      return " " + padDisplay(truncated, widths[i] - 2, col.align ?? "left") + " ";
    });
    lines.push("│" + cells.join("│") + "│");
  }

  // Bottom border
  const bottomLine = widths.map((w) => "─".repeat(w)).join("┴");
  lines.push("└" + bottomLine + "┘");

  return lines.join("\n");
}
