#!/usr/bin/env node

import http from "node:http";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { chmodSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import readline from "node:readline/promises";
import { emitKeypressEvents } from "node:readline";
import { fileURLToPath } from "node:url";
import { BangumiClient, BangumiOAuthClient, BangumiStatusClient, OAuthBackendClient } from "./core/client.js";
import { BangumiApiError as ApiError } from "./core/http.js";
import { DEFAULT_TURNSTILE_TIMEOUT_MS, startTurnstileFlow } from "./core/turnstile.js";
import {
  ConfigError,
  clearConfigValue,
  clearConfigValues,
  enableGlobalConfigMode,
  getConfig,
  getConfigFilePath,
  getConfigSourceFilePath,
  normalizeConfigValue,
  setConfigValues,
} from "./core/config.js";
import { CommandError, formatDisplayResult, printResult, printUsage } from "./core/output.js";
import {
  ensureArray,
  firstPositional,
  getPositional,
  hasHelpFlag,
  parseFlags,
  parseGlobalArgs,
  resolveHelpTarget,
  splitFilterValues,
  storeFlagValue,
} from "./utils/args.js";
import {
  buildVersionStatusPayload,
  compareStrings,
  delayMs,
  ensureExecutable,
  escapeHtml,
  formatPlatformName,
  hasSavedConfigValue,
  inferConfigScope,
  normalizeConfigKey,
  normalizeEpisodePageSize,
  normalizeNonNegativeInteger,
  normalizePageSize,
  normalizePositiveInteger,
  normalizePositiveNumber,
  normalizeRateValue,
  normalizeTurnstileTimeoutMs,
  parseOptionalBoolean,
  parseOptionalInteger,
  pathsEqual,
  previewToken,
  sleep,
  toBoolean,
  tryOpenExternalUrl,
  writeProgress,
} from "./utils/helpers.js";
import {
  COLLECTION_STATUS_MAP,
  EPISODE_COLLECTION_STATUS_MAP,
  EPISODE_TYPE_MAP,
  GROUP_HOT_WINDOWS,
  GROUP_LIST_MODE_VALUES,
  GROUP_MEMBER_ROLE_MAP,
  GROUP_SORT_VALUES,
  GROUP_TOPIC_MODE_VALUES,
  INDEX_RELATED_CATEGORY_MAP,
  SUBJECT_TYPE_MAP,
  TIMELINE_MODE_VALUES,
  normalizeCollectionSort,
  normalizeCollectionStatusFilter,
  normalizeCollectionStatusValue,
  normalizeEpisodeCollectionStatusValue,
  normalizeEpisodeTypeFilter,
  normalizeGroupHotWindow,
  normalizeGroupListMode,
  normalizeGroupMemberRole,
  normalizeGroupSort,
  normalizeGroupTopicMode,
  normalizeHotResultLimit,
  normalizeHotScanLimit,
  normalizeIndexRelatedCategory,
  normalizeSortOrder,
  normalizeStatusAudience,
  normalizeStatusSite,
  normalizeSubjectType,
  normalizeSubjectTypeFilter,
  normalizeTimelineLimit,
  normalizeTimelineMode,
} from "./utils/validators.js";
import {
  aggregateHotGroups,
  computeHotCutoffTimestamp,
  fetchRecentRepliedTopics,
  fetchTopicsForHotWindow,
  rankHotTopics,
} from "./utils/hot.js";
import {
  fetchAllCollections,
  fetchAllEpisodes,
  fetchAllSubjects,
  sortCollections,
  sortSubjectsByRank,
} from "./utils/collection.js";
import {
  createState,
  extractAuthorizationInput,
  extractPrivateSessionId,
  fallbackUserAgent,
  getPrivateDemoLoginUrl,
  isLocalRedirectUri,
} from "./utils/auth.js";
import {
  resolveWeekdaySubcommand,
  todayWeekdayId,
} from "./utils/calendar.js";
import {
  clearScreen,
  drawBoxLine,
  drawBoxText,
  drawDivider,
  drawSectionTitle,
  inverse,
  isTuiBackAction,
  renderTuiHeader,
  renderTuiInputScreen,
  renderTuiResultScreen,
} from "./utils/tui-render.js";
import {
  buildPagedMenu,
  formatCollectionMenuLabel,
  formatCollectionSnapshotSummary,
  formatCollectionStatusLabel,
  formatCriteriaSummary,
  formatGroupMenuLabel,
  formatGroupTopicMenuLabel,
  formatPageSummary,
  formatSubjectMenuLabel,
  formatSubjectTypeLabel,
} from "./utils/formatters.js";
import {
  getManagedInstallDir,
  getShellReloadHint,
  getUpdateShellHint,
} from "./utils/install.js";
import {
  askChoice,
  askOptional,
  askRequired,
} from "./utils/prompts.js";
import {
  buildHostedRelayCorsHeaders,
  computeHostedSessionTimeoutMs,
  readHostedRelayJsonBody,
  respondHostedRelayJson,
  respondHostedRelayPreflight,
  respondHtml,
} from "./utils/relay.js";
import {
  buildCollectionActionResult,
  buildEpisodeActionResult,
  fetchMyEpisodeCollection,
  fetchMyEpisodeCollectionVerified,
  fetchMySubjectCollection,
  fetchMySubjectCollectionVerified,
  formatCollectionStatusForError,
  formatEpisodeCollectionStatusForError,
  handleEpisodeListError,
  mapEpisodeMutationError,
} from "./utils/collection-ops.js";
import {
  buildStatusCurrentPayload,
  summarizeCurrentStatus,
} from "./utils/status.js";

const CLI_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(CLI_DIR, "..");

const REMOTE_INSTALL_SCRIPT_BASE_URL = "https://raw.githubusercontent.com/aronnaxlin/bgm-cli/main/scripts";
const DEFAULT_LOCAL_OAUTH_REDIRECT_URI = "http://127.0.0.1:8787/callback";
const AUTH_CONFIG_KEYS = [
  "accessToken",
  "refreshToken",
  "tokenType",
  "privateSessionId",
  "privateSessionUpdatedAt",
  "clientId",
  "clientSecret",
  "redirectUri",
];

async function main(argv) {
  const parsed = parseGlobalArgs(argv);
  const context = {
    json: parsed.json,
    rawArgs: parsed.args,
  };

  if (parsed.version) {
    printResult(buildVersionStatusPayload(REPO_ROOT), context);
    return;
  }

  if (parsed.init) {
    await runInitWizard(context);
    return;
  }

  if (parsed.args.length === 0) {
    printUsage();
    return;
  }

  if (hasHelpFlag(parsed.args)) {
    printUsage(resolveHelpTarget(parsed.args));
    return;
  }

  const [group, command, ...rest] = parsed.args;

  switch (group) {
    case "tui":
      await runTui(context);
      return;
    case "config":
      await runConfigCommand(command, rest, context);
      return;
    case "auth":
      await runAuthCommand(command, rest, context);
      return;
    case "setup":
      await runSetupCommand(command, rest, context);
      return;
    case "subject":
      await runSubjectCommand(command, rest, context);
      return;
    case "episode":
    case "ep":
      await runEpisodeCommand(command, rest, context);
      return;
    case "group":
      await runGroupCommand(command, rest, context);
      return;
    case "blog":
      await runBlogCommand(command, rest, context);
      return;
    case "timeline":
      await runTimelineCommand(command, rest, context);
      return;
    case "index":
      await runIndexCommand(command, rest, context);
      return;
    case "collection":
      await runCollectionCommand(command, rest, context);
      return;
    case "status":
      await runStatusCommand(command, rest, context);
      return;
    case "user":
      await runUserCommand(command, rest, context);
      return;
    case "calendar":
      await runCalendarCommand(command, rest, context);
      return;
    default:
      throw new CommandError(`Unknown command group: ${group}`);
  }
}

async function runInitWizard(context) {
  if (context.json) {
    throw new CommandError("--init does not support --json because it requires interactive prompts.");
  }

  const currentConfig = getConfig();
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    console.log("Bangumi CLI initialization");
    console.log(`Config file: ${getConfigFilePath()}`);
    console.log("");

    const hasHostedOAuthBackend = Boolean(currentConfig.oauthServerBaseUrl);
    const hasBundledOAuthApp = Boolean(
      currentConfig.clientId && currentConfig.clientSecret && currentConfig.redirectUri,
    );

    const authMode = await askChoice(
      rl,
      "Choose a login method",
      [
        {
          key: "1",
          label: "Paste your own access token (Recommended)",
          value: "token",
        },
        {
          key: "2",
          label: hasHostedOAuthBackend
            ? "Use the project's hosted OAuth flow (Experimental, Not Recommended)"
            : hasBundledOAuthApp
              ? "Use the bundled developer app OAuth flow (Experimental, Not Recommended)"
              : "Browser OAuth authorization (Experimental, Not Recommended)",
          value: "web",
        },
      ],
      "1",
    );

    const userAgent = currentConfig.userAgent ?? fallbackUserAgent(currentConfig);

    if (authMode === "token") {
      const confirmedUserAgent = userAgent;
      console.log("The CLI will use this User-Agent:");
      console.log(confirmedUserAgent);
      console.log("");
      console.log("Recommended steps to get an access token:");
      console.log("1. Sign in to Bangumi in your browser");
      console.log("2. Open the access token page");
      console.log("3. Copy the token and paste it here");
      console.log("");
      console.log("Access token page:");
      console.log("https://next.bgm.tv/demo/access-token");
      console.log("");
      console.log("If you do not want to continue right now, press Ctrl+C to exit.");
      console.log("");

      await setConfigValues({
        userAgent: confirmedUserAgent,
      });

      if (currentConfig.accessToken) {
        console.log("A local access token is already saved.");
        console.log("Enter a new token to replace it.");
        console.log("Press Ctrl+C to keep the current token unchanged.");
        console.log("");
      }

      const manualToken = await askRequired(rl, "Enter access token");
      await setConfigValues({
        accessToken: manualToken,
        tokenType: "Bearer",
        userAgent: confirmedUserAgent,
      });
      console.log("Access token saved.");

      const installPathChoice = await askChoice(
        rl,
        "Optional: add this repository to PATH so you can run bgm from any directory",
        [
          {
            key: "1",
            label: "Run global command setup now (Recommended)",
            value: "install",
          },
          {
            key: "2",
            label: "Skip for now",
            value: "skip",
          },
        ],
        "1",
      );

      if (installPathChoice === "install") {
        console.log("");
        printResult(await runInstallPathSetup(), context);
      }
      return;
    }

    await setConfigValues({
      userAgent,
    });

    if (hasHostedOAuthBackend) {
      await runHostedOAuthInit(currentConfig, userAgent, context, rl);
      return;
    }

    let clientId = currentConfig.clientId;
    let clientSecret = currentConfig.clientSecret;
    let redirectUri = currentConfig.redirectUri ?? DEFAULT_LOCAL_OAUTH_REDIRECT_URI;

    if (hasBundledOAuthApp) {
      console.log("Using bundled Bangumi developer application credentials from project config.");
      console.log(`Redirect URI: ${redirectUri}`);
    } else {
      clientId = await askRequired(rl, "Bangumi App ID", currentConfig.clientId);
      clientSecret = await askRequired(rl, "Bangumi App Secret", currentConfig.clientSecret);
      redirectUri = await askRequired(
        rl,
        "Bangumi Redirect URI",
        redirectUri,
      );
    }

    await setConfigValues({
      clientId,
      clientSecret,
      redirectUri,
      userAgent,
    });

    const oauth = new BangumiOAuthClient({
      ...currentConfig,
      clientId,
      clientSecret,
      redirectUri,
      userAgent,
    });

    const state = createState();
    const loginUrl = oauth.createAuthorizationUrl({
      clientId,
      redirectUri,
      state,
    });

    console.log("");
    const callbackMode = isLocalRedirectUri(redirectUri)
      ? await askChoice(
          rl,
          "OAuth callback handling",
          [
            {
              key: "1",
              label: "Receive callback parameters automatically (Recommended)",
              value: "auto",
            },
            {
              key: "2",
              label: "Paste callback URL / code manually",
              value: "manual",
            },
          ],
          "1",
        )
      : "manual";

    console.log("");
    console.log("Open this URL in your browser and complete authorization:");
    console.log(loginUrl);
    console.log("");
    console.log("The Bangumi account and password are entered on Bangumi's official site, not in this CLI.");
    console.log("");

    let code;

    if (callbackMode === "auto") {
      console.log("The CLI will listen on your local redirect URI and wait for Bangumi to redirect back.");
      console.log("If automatic callback does not work, stop and rerun `bgm --init`, then choose manual paste mode.");
      console.log("");

      code = await waitForAuthorizationCode({
        redirectUri,
        expectedState: state,
      });

      console.log("Authorization callback received.");
    } else {
      console.log("After authorization, Bangumi redirects to your callback URL with ?code=...");
      console.log("Paste the full callback URL or only the returned code below.");
      console.log("");

      const authInput = await askOptional(
        rl,
        "Paste callback URL / authorization code",
        "",
      );

      const resolved = extractAuthorizationInput(authInput);
      if (!resolved.value) {
        console.log("Initialization finished without token exchange. Stored app config only.");
        return;
      }
      code = resolved.value;
    }

    const token = await oauth.exchangeCode({
      code,
      clientId,
      clientSecret,
      redirectUri,
    });

    await setConfigValues({
      accessToken: token.access_token,
      refreshToken: token.refresh_token ?? null,
      tokenType: token.token_type ?? "Bearer",
      userAgent,
    });

    console.log("Authorization completed and tokens saved.");
    printResult(token, context);
  } finally {
    rl.close();
  }
}

async function runHostedOAuthInit(config, userAgent, context, rl) {
  console.log("The CLI will use the project's hosted OAuth relay.");
  console.log(`Hosted OAuth server: ${config.oauthServerBaseUrl}`);
  console.log("");
  console.log("This flow opens Bangumi's official authorization page in your browser.");
  console.log("After you approve access there, the hosted callback page will send the final token back to this CLI automatically.");
  console.log("");
  console.log("Before continuing:");
  console.log("1. Make sure the browser you will use is already signed in to https://bgm.tv");
  console.log("2. Keep this terminal open while the browser completes authorization");
  console.log("3. If the hosted callback cannot reach this terminal, rerun and use the ordinary local OAuth path instead");
  console.log("");

  const browserReady = await askChoice(
    rl,
    "Browser sign-in confirmation",
    [
      {
        key: "1",
        label: "I am already signed in to bgm.tv in this browser session",
        value: "ready",
      },
      {
        key: "2",
        label: "Stop here so I can sign in first and retry later",
        value: "stop",
      },
    ],
    "1",
  );

  if (browserReady !== "ready") {
    console.log("");
    console.log("Please sign in at https://bgm.tv first, then run `./bgm --init` again.");
    return;
  }

  console.log("");

  const backend = new OAuthBackendClient({
    ...config,
    userAgent,
  });

  const relay = await startHostedRelayReceiver({
    kind: "oauth",
  });

  const session = await backend.createSession({
    relayUrl: relay.callbackUrl,
  });

  console.log("Open the link below in your browser:");
  console.log(session.authorize_url);
  console.log("");
  console.log("Complete authorization on Bangumi's official page.");
  console.log("Your Bangumi account and password are entered only on Bangumi's official website, never in this CLI.");
  console.log("If everything goes well, the hosted callback page will send the token back to this terminal automatically.");
  console.log("");

  const token = await relay.completion;

  await setConfigValues({
    accessToken: token.access_token,
    refreshToken: token.refresh_token ?? null,
    tokenType: token.token_type ?? "Bearer",
    userAgent,
  });

  console.log("Authorization completed. Token saved.");
  printResult(token, context);
}

async function runConfigCommand(command, args, context) {
  switch (command) {
    case "show": {
      printResult(
        {
          configFile: getConfigFilePath(),
          configSourceFile: getConfigSourceFilePath(),
          config: getConfig(),
        },
        context,
      );
      return;
    }
    case "set": {
      const [key, value] = args;
      if (!key || value === undefined) {
        throw new CommandError("Usage: bgm config set <key> <value>");
      }

      const normalizedKey = normalizeConfigKey(key);
      const normalizedValue = normalizeConfigValue(normalizedKey, value);
      await setConfigValues({ [normalizedKey]: normalizedValue });
      printResult(
        {
          updated: normalizedKey,
          configFile: getConfigFilePath(),
          value: normalizedValue,
        },
        context,
      );
      return;
    }
    case "unset": {
      const [key] = args;
      if (!key) {
        throw new CommandError("Usage: bgm config unset <key>");
      }

      const normalizedKey = normalizeConfigKey(key);
      await clearConfigValue(normalizedKey);
      printResult(
        {
          removed: normalizedKey,
          configFile: getConfigFilePath(),
        },
        context,
      );
      return;
    }
    default:
      throw new CommandError("Usage: bgm config <show|set|unset> ...");
  }
}

async function runTui(context) {
  if (context.json) {
    throw new CommandError("bgm tui does not support --json because it requires interactive prompts.");
  }
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new CommandError("bgm tui requires an interactive TTY terminal.");
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    while (true) {
      const action = await askMenuChoice(
        "Choose an action",
        [
          { key: "1", label: "Subject: search subjects by keyword", value: "subject-search" },
          { key: "2", label: "Subject: fetch one subject by ID", value: "subject-get" },
          { key: "3", label: "Subject: browse subjects by type", value: "subject-list" },
          { key: "4", label: "Collection: list one user's collections", value: "collection-list" },
          { key: "5", label: "Collection: show one collection entry", value: "collection-get" },
          { key: "6", label: "Collection: create or update a collection", value: "collection-collect" },
          { key: "7", label: "Collection: update collection comment", value: "collection-comment" },
          { key: "8", label: "Collection: update collection rating", value: "collection-rate" },
          { key: "9", label: "Collection: update collection status", value: "collection-status" },
          { key: "10", label: "User: show current authenticated user", value: "user-me" },
          { key: "11", label: "User: fetch one public user profile", value: "user-get" },
          { key: "12", label: "Group: browse Bangumi groups", value: "group" },
          { key: "13", label: "System: setup and config", value: "system" },
          { key: "0", label: "Exit", value: "exit" },
        ],
        "subject-search",
        {
          quitValue: "exit",
          quitLabel: "exit",
        },
      );

      if (action === "exit") {
        clearScreen();
        console.log("");
        console.log("Bye.");
        return;
      }

      console.log("");
      const actionResult = await runTuiAction(rl, action, context);
      if (actionResult === "exit") {
        clearScreen();
        console.log("");
        console.log("Bye.");
        return;
      }
      if (actionResult === "menu") {
        continue;
      }

      await waitForTuiContinue();
    }
  } finally {
    rl.close();
  }
}

async function runTuiAction(rl, action, context) {
  switch (action) {
    case "system": {
      const systemAction = await askMenuChoice(
        "System",
        [
          { key: "1", label: "Setup: install bgm into PATH", value: "setup-install-path" },
          { key: "2", label: "Setup: update managed install", value: "setup-update" },
          { key: "3", label: "Config: show current config", value: "config-show" },
          { key: "4", label: "Config: set one config value", value: "config-set" },
          { key: "5", label: "Config: unset one config value", value: "config-unset" },
          { key: "0", label: "Back", value: "back" },
        ],
        "0",
      );
      if (isTuiBackAction(systemAction)) {
        return "menu";
      }
      return runTuiAction(rl, systemAction, context);
    }
    case "group": {
      const groupAction = await askMenuChoice(
        "Groups",
        [
          { key: "1", label: "Joined groups: quick topics", value: "group-joined-topics" },
          { key: "2", label: "List groups", value: "group-list" },
          { key: "3", label: "Open one group", value: "group-get" },
          { key: "4", label: "List one group's topics", value: "group-topics" },
          { key: "5", label: "Open one topic", value: "group-topic" },
          { key: "6", label: "List group members", value: "group-members" },
          { key: "7", label: "Recent group topics", value: "group-recent-topics" },
          { key: "8", label: "Latest replied topics", value: "group-latest-replies" },
          { key: "9", label: "Hot groups", value: "group-hot" },
          { key: "a", label: "Hot topics", value: "group-hot-topics" },
          { key: "0", label: "Back", value: "back" },
        ],
        "1",
      );
      if (isTuiBackAction(groupAction)) {
        return "menu";
      }
      return runTuiAction(rl, groupAction, context);
    }
    case "config-show":
      await runConfigCommand("show", [], context);
      return;
    case "config-set": {
      const key = await askMenuChoice(
        "Config key",
        [
          { key: "1", label: "accessToken", value: "accessToken" },
          { key: "2", label: "refreshToken", value: "refreshToken" },
          { key: "3", label: "clientId", value: "clientId" },
          { key: "4", label: "clientSecret", value: "clientSecret" },
          { key: "5", label: "redirectUri", value: "redirectUri" },
          { key: "6", label: "oauthServerBaseUrl", value: "oauthServerBaseUrl" },
          { key: "7", label: "userAgent", value: "userAgent" },
          { key: "8", label: "timezone", value: "timezone" },
        ],
        "accessToken",
      );
      if (isTuiBackAction(key)) {
        return "menu";
      }
      const value = await askTuiRequired(rl, `Value for ${key}`);
      await runConfigCommand("set", [key, value], context);
      return;
    }
    case "config-unset": {
      const key = await askMenuChoice(
        "Config key",
        [
          { key: "1", label: "accessToken", value: "accessToken" },
          { key: "2", label: "refreshToken", value: "refreshToken" },
          { key: "3", label: "clientId", value: "clientId" },
          { key: "4", label: "clientSecret", value: "clientSecret" },
          { key: "5", label: "redirectUri", value: "redirectUri" },
          { key: "6", label: "oauthServerBaseUrl", value: "oauthServerBaseUrl" },
          { key: "7", label: "userAgent", value: "userAgent" },
          { key: "8", label: "timezone", value: "timezone" },
        ],
        "accessToken",
      );
      if (isTuiBackAction(key)) {
        return "menu";
      }
      await runConfigCommand("unset", [key], context);
      return;
    }
    case "setup-install-path":
      await runSetupCommand("install-path", [], context);
      return;
    case "setup-update":
      await runSetupCommand("update", [], context);
      return;
    case "user-me":
      await runUserCommand("me", [], context);
      return;
    case "user-get": {
      const username = await askTuiRequired(rl, "Username or numeric user ID");
      await runUserCommand("get", [username], context);
      return;
    }
    case "group-list": {
      const mode = await askMenuChoice(
        "List mode",
        [
          { key: "1", label: "all", value: "all" },
          { key: "2", label: "joined", value: "joined" },
          { key: "3", label: "managed", value: "managed" },
        ],
        "all",
      );
      if (isTuiBackAction(mode)) {
        return "menu";
      }
      const sort = await askMenuChoice(
        "Sort",
        [
          { key: "1", label: "created", value: "created" },
          { key: "2", label: "updated", value: "updated" },
          { key: "3", label: "posts", value: "posts" },
          { key: "4", label: "topics", value: "topics" },
          { key: "5", label: "members", value: "members" },
        ],
        "created",
      );
      if (isTuiBackAction(sort)) {
        return "menu";
      }
      const limit = await askMenuChoice(
        "Limit",
        [
          { key: "1", label: "10", value: "10" },
          { key: "2", label: "20", value: "20" },
          { key: "3", label: "50", value: "50" },
          { key: "4", label: "100", value: "100" },
        ],
        "20",
      );
      if (isTuiBackAction(limit)) {
        return "menu";
      }
      const offset = await askTuiOptional(rl, "Offset", "0");
      const args = ["--mode", mode, "--sort", sort, "--limit", limit];
      if (offset) {
        args.push("--offset", offset);
      }
      const result = await executeGroupListCommand(args);
      await browseGroupResults(result, context, { mode, sort, limit, offset: offset || "0" });
      return "menu";
    }
    case "group-joined-topics": {
      const groupsResult = await executeGroupListCommand(["--mode", "joined", "--sort", "updated", "--limit", "100"]);
      const group = await pickGroupResult(groupsResult, {
        mode: "joined",
        sort: "updated",
        limit: "100",
      });
      if (!group?.name) {
        return "menu";
      }

      const topicsResult = await executeGroupTopicsCommand([String(group.name), "--limit", "20"]);
      await browseGroupTopicResults(topicsResult, context, {
        source: "joined groups",
        group: group.name,
        limit: "20",
      });
      return "menu";
    }
    case "group-get": {
      const groupName = await askTuiRequired(rl, "Group slug");
      const result = await executeGroupGetCommand([groupName]);
      renderTuiResultScreen("Group detail", formatDisplayResult(result, context));
      return;
    }
    case "group-topics": {
      const groupName = await askTuiRequired(rl, "Group slug");
      const limit = await askMenuChoice(
        "Limit",
        [
          { key: "1", label: "10", value: "10" },
          { key: "2", label: "20", value: "20" },
          { key: "3", label: "50", value: "50" },
          { key: "4", label: "100", value: "100" },
        ],
        "20",
      );
      if (isTuiBackAction(limit)) {
        return "menu";
      }
      const offset = await askTuiOptional(rl, "Offset", "0");
      const args = [groupName, "--limit", limit];
      if (offset) {
        args.push("--offset", offset);
      }
      const result = await executeGroupTopicsCommand(args);
      await browseGroupTopicResults(result, context, { group: groupName, limit, offset: offset || "0" });
      return "menu";
    }
    case "group-topic": {
      const topicId = await askTuiRequired(rl, "Topic ID");
      const replyLimit = await askMenuChoice(
        "Reply excerpts",
        [
          { key: "1", label: "10", value: "10" },
          { key: "2", label: "20", value: "20" },
          { key: "3", label: "50", value: "50" },
          { key: "4", label: "100", value: "100" },
        ],
        "20",
      );
      if (isTuiBackAction(replyLimit)) {
        return "menu";
      }
      const result = await executeGroupTopicCommand([topicId, "--reply-limit", replyLimit]);
      renderTuiResultScreen("Group topic", formatDisplayResult(result, context));
      return;
    }
    case "group-members": {
      const groupName = await askTuiRequired(rl, "Group slug");
      const role = await askMenuChoice(
        "Role filter",
        [
          { key: "1", label: "All roles", value: "" },
          { key: "2", label: "visitor", value: "visitor" },
          { key: "3", label: "guest", value: "guest" },
          { key: "4", label: "member", value: "member" },
          { key: "5", label: "creator", value: "creator" },
          { key: "6", label: "moderator", value: "moderator" },
          { key: "7", label: "blocked", value: "blocked" },
        ],
        "",
      );
      if (isTuiBackAction(role)) {
        return "menu";
      }
      const limit = await askMenuChoice(
        "Limit",
        [
          { key: "1", label: "10", value: "10" },
          { key: "2", label: "20", value: "20" },
          { key: "3", label: "50", value: "50" },
          { key: "4", label: "100", value: "100" },
        ],
        "20",
      );
      if (isTuiBackAction(limit)) {
        return "menu";
      }
      const offset = await askTuiOptional(rl, "Offset", "0");
      const args = [groupName, "--limit", limit];
      if (role) {
        args.push("--role", role);
      }
      if (offset) {
        args.push("--offset", offset);
      }
      const result = await executeGroupMembersCommand(args);
      renderTuiResultScreen(
        "Group members",
        formatDisplayResult(result, context),
        formatCriteriaSummary({ group: groupName, role: role || "all", limit, offset: offset || "0" }),
      );
      return;
    }
    case "group-recent-topics": {
      const mode = await askMenuChoice(
        "Topic mode",
        [
          { key: "1", label: "all", value: "all" },
          { key: "2", label: "joined", value: "joined" },
          { key: "3", label: "created", value: "created" },
          { key: "4", label: "replied", value: "replied" },
        ],
        "all",
      );
      if (isTuiBackAction(mode)) {
        return "menu";
      }
      const limit = await askMenuChoice(
        "Limit",
        [
          { key: "1", label: "10", value: "10" },
          { key: "2", label: "20", value: "20" },
          { key: "3", label: "50", value: "50" },
          { key: "4", label: "100", value: "100" },
        ],
        "20",
      );
      if (isTuiBackAction(limit)) {
        return "menu";
      }
      const offset = await askTuiOptional(rl, "Offset", "0");
      const args = ["--mode", mode, "--limit", limit];
      if (offset) {
        args.push("--offset", offset);
      }
      const result = await executeRecentGroupTopicsCommand(args);
      await browseGroupTopicResults(result, context, { mode, limit, offset: offset || "0" });
      return "menu";
    }
    case "group-latest-replies": {
      const mode = await askMenuChoice(
        "Topic mode",
        [
          { key: "1", label: "all", value: "all" },
          { key: "2", label: "joined", value: "joined" },
          { key: "3", label: "created", value: "created" },
          { key: "4", label: "replied", value: "replied" },
        ],
        "all",
      );
      if (isTuiBackAction(mode)) {
        return "menu";
      }
      const limit = await askMenuChoice(
        "Limit",
        [
          { key: "1", label: "10", value: "10" },
          { key: "2", label: "20", value: "20" },
          { key: "3", label: "50", value: "50" },
        ],
        "10",
      );
      if (isTuiBackAction(limit)) {
        return "menu";
      }
      const scan = await askMenuChoice(
        "Scan cap",
        [
          { key: "1", label: "50", value: "50" },
          { key: "2", label: "100", value: "100" },
          { key: "3", label: "200", value: "200" },
          { key: "4", label: "500", value: "500" },
        ],
        "100",
      );
      if (isTuiBackAction(scan)) {
        return "menu";
      }
      const result = await executeLatestRepliedGroupTopicsCommand(["--mode", mode, "--limit", limit, "--scan", scan]);
      await browseGroupTopicResults(result, context, { mode, limit, scan });
      return "menu";
    }
    case "group-hot": {
      const window = await askMenuChoice(
        "Window",
        [
          { key: "1", label: "day", value: "day" },
          { key: "2", label: "week", value: "week" },
          { key: "3", label: "month", value: "month" },
        ],
        "day",
      );
      if (isTuiBackAction(window)) {
        return "menu";
      }
      const mode = await askMenuChoice(
        "Topic mode",
        [
          { key: "1", label: "all", value: "all" },
          { key: "2", label: "joined", value: "joined" },
          { key: "3", label: "created", value: "created" },
          { key: "4", label: "replied", value: "replied" },
        ],
        "all",
      );
      if (isTuiBackAction(mode)) {
        return "menu";
      }
      const limit = await askMenuChoice(
        "Limit",
        [
          { key: "1", label: "10", value: "10" },
          { key: "2", label: "20", value: "20" },
          { key: "3", label: "50", value: "50" },
        ],
        "10",
      );
      if (isTuiBackAction(limit)) {
        return "menu";
      }
      const scan = await askMenuChoice(
        "Scan cap",
        [
          { key: "1", label: "100", value: "100" },
          { key: "2", label: "200", value: "200" },
          { key: "3", label: "500", value: "500" },
          { key: "4", label: "1000", value: "1000" },
        ],
        "200",
      );
      if (isTuiBackAction(scan)) {
        return "menu";
      }
      const result = await executeHotGroupsCommand(["--window", window, "--mode", mode, "--limit", limit, "--scan", scan]);
      await browseGroupResults(result, context, { window, mode, limit, scan });
      return "menu";
    }
    case "group-hot-topics": {
      const window = await askMenuChoice(
        "Window",
        [
          { key: "1", label: "day", value: "day" },
          { key: "2", label: "week", value: "week" },
          { key: "3", label: "month", value: "month" },
        ],
        "day",
      );
      if (isTuiBackAction(window)) {
        return "menu";
      }
      const mode = await askMenuChoice(
        "Topic mode",
        [
          { key: "1", label: "all", value: "all" },
          { key: "2", label: "joined", value: "joined" },
          { key: "3", label: "created", value: "created" },
          { key: "4", label: "replied", value: "replied" },
        ],
        "all",
      );
      if (isTuiBackAction(mode)) {
        return "menu";
      }
      const limit = await askMenuChoice(
        "Limit",
        [
          { key: "1", label: "10", value: "10" },
          { key: "2", label: "20", value: "20" },
          { key: "3", label: "50", value: "50" },
        ],
        "10",
      );
      if (isTuiBackAction(limit)) {
        return "menu";
      }
      const scan = await askMenuChoice(
        "Scan cap",
        [
          { key: "1", label: "100", value: "100" },
          { key: "2", label: "200", value: "200" },
          { key: "3", label: "500", value: "500" },
          { key: "4", label: "1000", value: "1000" },
        ],
        "200",
      );
      if (isTuiBackAction(scan)) {
        return "menu";
      }
      const result = await executeHotGroupTopicsCommand(["--window", window, "--mode", mode, "--limit", limit, "--scan", scan]);
      await browseGroupTopicResults(result, context, { window, mode, limit, scan });
      return "menu";
    }
    case "subject-get": {
      const subjectId = await askTuiRequired(rl, "Subject ID");
      const client = new BangumiClient(getConfig());
      const subject = await client.getSubject(subjectId);
      await browseSubjectDetailActions(client, subject, context);
      return "menu";
    }
    case "subject-list": {
      const type = await askMenuChoice(
        "Subject type",
        [
          { key: "1", label: "book", value: "book" },
          { key: "2", label: "anime", value: "anime" },
          { key: "3", label: "music", value: "music" },
          { key: "4", label: "game", value: "game" },
          { key: "5", label: "real", value: "real" },
        ],
        "anime",
      );
      if (isTuiBackAction(type)) {
        return "menu";
      }
      const sort = await askMenuChoice(
        "Sort",
        [
          { key: "1", label: "rank", value: "rank" },
          { key: "2", label: "date", value: "date" },
        ],
        "rank",
      );
      if (isTuiBackAction(sort)) {
        return "menu";
      }
      const year = await askTuiOptional(rl, "Year filter", "");
      const month = await askTuiOptional(rl, "Month filter", "");
      const limit = await askMenuChoice(
        "Limit",
        [
          { key: "1", label: "10", value: "10" },
          { key: "2", label: "20", value: "20" },
          { key: "3", label: "50", value: "50" },
          { key: "4", label: "100", value: "100" },
        ],
        "10",
      );
      if (isTuiBackAction(limit)) {
        return "menu";
      }
      const args = ["--type", type];
      if (sort) {
        args.push("--sort", sort);
      }
      if (year) {
        args.push("--year", year);
      }
      if (month) {
        args.push("--month", month);
      }
      if (limit) {
        args.push("--limit", limit);
      }
      const result = await executeSubjectListCommand(args);
      await browseSubjectResults(result, context, {
        mode: "list",
        type,
        sort,
        year: year || "any",
        month: month || "any",
        limit,
      });
      return "menu";
    }
    case "subject-search": {
      const keyword = await askTuiRequired(rl, "Keyword");
      const type = await askMenuChoice(
        "Type filter",
        [
          { key: "1", label: "All types", value: "" },
          { key: "2", label: "anime", value: "anime" },
          { key: "3", label: "book", value: "book" },
          { key: "4", label: "music", value: "music" },
          { key: "5", label: "game", value: "game" },
          { key: "6", label: "real", value: "real" },
        ],
        "",
      );
      if (isTuiBackAction(type)) {
        return "menu";
      }
      const sort = await askMenuChoice(
        "Sort",
        [
          { key: "1", label: "match", value: "match" },
          { key: "2", label: "heat", value: "heat" },
          { key: "3", label: "rank", value: "rank" },
          { key: "4", label: "score", value: "score" },
        ],
        "match",
      );
      if (isTuiBackAction(sort)) {
        return "menu";
      }
      const limit = await askMenuChoice(
        "Limit",
        [
          { key: "1", label: "10", value: "10" },
          { key: "2", label: "20", value: "20" },
          { key: "3", label: "50", value: "50" },
        ],
        "10",
      );
      if (isTuiBackAction(limit)) {
        return "menu";
      }
      const args = [keyword];
      if (type) {
        args.push("--type", type);
      }
      if (sort) {
        args.push("--sort", sort);
      }
      if (limit) {
        args.push("--limit", limit);
      }
      const result = await executeSubjectSearchCommand(args);
      await browseSubjectResults(result, context, {
        mode: "search",
        keyword,
        type: type || "all",
        sort,
        limit,
      });
      return "menu";
    }
    case "collection-list": {
      const targetMode = await askMenuChoice(
        "Collection target user",
        [
          { key: "1", label: "Current authenticated user", value: "me" },
          { key: "2", label: "Enter a username manually", value: "manual" },
        ],
        "me",
      );
      if (isTuiBackAction(targetMode)) {
        return "menu";
      }
      const username = targetMode === "manual" ? await askTuiRequired(rl, "Username") : "";
      const type = await askMenuChoice(
        "Type filter",
        [
          { key: "1", label: "All types", value: "" },
          { key: "2", label: "anime", value: "anime" },
          { key: "3", label: "book", value: "book" },
          { key: "4", label: "music", value: "music" },
          { key: "5", label: "game", value: "game" },
          { key: "6", label: "real", value: "real" },
        ],
        "",
      );
      if (isTuiBackAction(type)) {
        return "menu";
      }
      const status = await askMenuChoice(
        "Status filter",
        [
          { key: "1", label: "All statuses", value: "" },
          { key: "2", label: "wish", value: "wish" },
          { key: "3", label: "collect", value: "collect" },
          { key: "4", label: "doing", value: "doing" },
          { key: "5", label: "on_hold", value: "on_hold" },
          { key: "6", label: "dropped", value: "dropped" },
        ],
        "",
      );
      if (isTuiBackAction(status)) {
        return "menu";
      }
      const sort = await askMenuChoice(
        "Sort",
        [
          { key: "1", label: "updated", value: "updated" },
          { key: "2", label: "name", value: "name" },
          { key: "3", label: "rank", value: "rank" },
          { key: "4", label: "community_score", value: "community_score" },
          { key: "5", label: "user_score", value: "user_score" },
          { key: "6", label: "date", value: "date" },
        ],
        "updated",
      );
      if (isTuiBackAction(sort)) {
        return "menu";
      }
      const order = await askMenuChoice(
        "Order",
        [
          { key: "1", label: "desc", value: "desc" },
          { key: "2", label: "asc", value: "asc" },
        ],
        "desc",
      );
      if (isTuiBackAction(order)) {
        return "menu";
      }
      const limit = await askMenuChoice(
        "Limit",
        [
          { key: "1", label: "10", value: "10" },
          { key: "2", label: "20", value: "20" },
          { key: "3", label: "50", value: "50" },
          { key: "4", label: "100", value: "100" },
        ],
        "20",
      );
      if (isTuiBackAction(limit)) {
        return "menu";
      }
      const args = [];
      if (username) {
        args.push("--user", username);
      }
      if (status) {
        args.push("--status", status);
      }
      if (type) {
        args.push("--type", type);
      }
      if (sort) {
        args.push("--sort", sort);
      }
      if (order) {
        args.push("--order", order);
      }
      if (limit) {
        args.push("--limit", limit);
      }
      const result = await executeCollectionListCommand(args);
      await browseCollectionResults(result, context, {
        user: username || "(current user)",
        type: type || "all",
        status: status || "all",
        sort,
        order,
        limit,
      });
      return "menu";
    }
    case "collection-get": {
      const target = await askTuiCollectionTarget(rl);
      if (target === "menu") {
        return "menu";
      }
      const result = await executeCollectionGetCommand(buildCollectionTargetArgs(target));
      renderTuiResultScreen("Collection detail", formatDisplayResult(result, context));
      return;
    }
    case "collection-collect": {
      const target = await askTuiCollectionTarget(rl);
      if (target === "menu") {
        return "menu";
      }
      const snapshot = await fetchTuiCollectionSnapshot(target.subjectId);
      const status = await askMenuChoice(
        "Collection status",
        [
          { key: "1", label: "wish", value: "wish" },
          { key: "2", label: "collect", value: "collect" },
          { key: "3", label: "doing", value: "doing" },
          { key: "4", label: "on_hold", value: "on_hold" },
          { key: "5", label: "dropped", value: "dropped" },
        ],
        getCollectionStatusKey(snapshot?.type) ?? "wish",
        {
          summary: formatCollectionSnapshotSummary(snapshot),
        },
      );
      if (isTuiBackAction(status)) {
        return "menu";
      }
      const result = await executeCollectionCollectCommand([
        ...buildCollectionTargetArgs(target),
        status,
      ]);
      renderTuiResultScreen("Collection update", formatDisplayResult(result, context));
      return;
    }
    case "collection-comment": {
      const target = await askTuiCollectionTarget(rl);
      if (target === "menu") {
        return "menu";
      }
      const snapshot = await fetchTuiCollectionSnapshot(target.subjectId);
      const commentInput = await askTuiOptional(
        rl,
        "Comment",
        snapshot?.comment ?? "",
        `${formatCollectionSnapshotSummary(snapshot)}\nType a single dash (-) to clear the comment.`,
      );
      const comment = commentInput === "-" ? "" : commentInput;
      const result = await executeCollectionCommentCommand([
        ...buildCollectionTargetArgs(target),
        comment,
      ]);
      renderTuiResultScreen("Collection comment", formatDisplayResult(result, context));
      return;
    }
    case "collection-rate": {
      const target = await askTuiCollectionTarget(rl);
      if (target === "menu") {
        return "menu";
      }
      const snapshot = await fetchTuiCollectionSnapshot(target.subjectId);
      const rating = await askMenuChoice(
        "Rating",
        [
          { key: "0", label: "0", value: "0" },
          { key: "1", label: "1", value: "1" },
          { key: "2", label: "2", value: "2" },
          { key: "3", label: "3", value: "3" },
          { key: "4", label: "4", value: "4" },
          { key: "5", label: "5", value: "5" },
          { key: "6", label: "6", value: "6" },
          { key: "7", label: "7", value: "7" },
          { key: "8", label: "8", value: "8" },
          { key: "9", label: "9", value: "9" },
          { key: "10", label: "10", value: "10" },
        ],
        snapshot ? String(snapshot.rate ?? 0) : "7",
        {
          summary: formatCollectionSnapshotSummary(snapshot),
        },
      );
      if (isTuiBackAction(rating)) {
        return "menu";
      }
      const result = await executeCollectionRateCommand([
        ...buildCollectionTargetArgs(target),
        rating,
      ]);
      renderTuiResultScreen("Collection rating", formatDisplayResult(result, context));
      return;
    }
    case "collection-status": {
      const target = await askTuiCollectionTarget(rl);
      if (target === "menu") {
        return "menu";
      }
      const snapshot = await fetchTuiCollectionSnapshot(target.subjectId);
      const status = await askMenuChoice(
        "Collection status",
        [
          { key: "1", label: "wish", value: "wish" },
          { key: "2", label: "collect", value: "collect" },
          { key: "3", label: "doing", value: "doing" },
          { key: "4", label: "on_hold", value: "on_hold" },
          { key: "5", label: "dropped", value: "dropped" },
        ],
        getCollectionStatusKey(snapshot?.type) ?? "collect",
        {
          summary: formatCollectionSnapshotSummary(snapshot),
        },
      );
      if (isTuiBackAction(status)) {
        return "menu";
      }
      const result = await executeCollectionStatusCommand([
        ...buildCollectionTargetArgs(target),
        status,
      ]);
      renderTuiResultScreen("Collection status", formatDisplayResult(result, context));
      return;
    }
    default:
      throw new CommandError(`Unsupported TUI action: ${action}`);
  }
}

async function runSetupCommand(command, args, context) {
  switch (command) {
    case "install-path": {
      printResult(await runInstallPathSetup(), context);
      return;
    }
    case "update": {
      printResult(await runManagedInstallUpdate(), context);
      return;
    }
    default:
      throw new CommandError("Usage: bgm setup <install-path|update>");
  }
}

async function runAuthCommand(command, args, context) {
  const options = parseFlags(args);
  const config = getConfig();
  const oauth = new BangumiOAuthClient(config);

  switch (command) {
    case "login-url": {
      const loginUrl = oauth.createAuthorizationUrl({
        clientId: options.clientId ?? config.clientId,
        redirectUri: options.redirectUri ?? config.redirectUri,
        state: options.state,
      });
      printResult({ loginUrl }, context);
      return;
    }
    case "token": {
      const code = firstPositional(options);
      if (!code && !options.code) {
        throw new CommandError("Usage: bgm auth token --code <code> [--save]");
      }

      const token = await oauth.exchangeCode({
        code: options.code ?? code,
        clientId: options.clientId ?? config.clientId,
        clientSecret: options.clientSecret ?? config.clientSecret,
        redirectUri: options.redirectUri ?? config.redirectUri,
      });

      if (toBoolean(options.save, false)) {
        await setConfigValues({
          clientId: options.clientId ?? config.clientId,
          clientSecret: options.clientSecret ?? config.clientSecret,
          redirectUri: options.redirectUri ?? config.redirectUri,
          accessToken: token.access_token,
          refreshToken: token.refresh_token ?? null,
          tokenType: token.token_type ?? "Bearer",
        });
      }

      printResult(token, context);
      return;
    }
    case "refresh": {
      const token = await oauth.refreshToken({
        refreshToken: options.refreshToken ?? config.refreshToken,
        clientId: options.clientId ?? config.clientId,
        clientSecret: options.clientSecret ?? config.clientSecret,
        redirectUri: options.redirectUri ?? config.redirectUri,
      });

      if (toBoolean(options.save, false)) {
        await setConfigValues({
          clientId: options.clientId ?? config.clientId,
          clientSecret: options.clientSecret ?? config.clientSecret,
          redirectUri: options.redirectUri ?? config.redirectUri,
          accessToken: token.access_token,
          refreshToken: token.refresh_token ?? options.refreshToken ?? config.refreshToken,
          tokenType: token.token_type ?? "Bearer",
        });
      }

      printResult(token, context);
      return;
    }
    case "status": {
      const status = await oauth.getTokenStatus({
        accessToken: options.accessToken ?? config.accessToken,
      });
      printResult(status, context);
      return;
    }
    case "turnstile": {
      const result = await acquireTurnstileToken(options, context);
      printResult(
        {
          resource: "turnstile-token",
          token: result.token,
          tokenPreview: previewToken(result.token),
          verificationUrl: result.verificationUrl,
          authorizeUrl: result.authorizeUrl,
          redirectUri: result.redirectUri,
          backendBaseUrl: result.backendBaseUrl,
          sessionId: result.sessionId,
          listenHost: result.listenHost,
          port: result.port,
          openedBrowser: result.openedBrowser,
          timeoutSeconds: Math.floor(result.timeoutMs / 1000),
        },
        context,
      );
      return;
    }
    case "session-login": {
      const result = await runPrivateSessionLogin(options, context);
      printResult(result, context);
      return;
    }
    case "set-token": {
      const accessToken = options.accessToken ?? firstPositional(options);
      if (!accessToken) {
        throw new CommandError("Usage: bgm auth set-token <access_token>");
      }

      await setConfigValues({
        accessToken,
        tokenType: "Bearer",
      });

      printResult(
        {
          saved: true,
          configFile: getConfigFilePath(),
          accessTokenPreview: previewToken(accessToken),
        },
        context,
      );
      return;
    }
    case "set-session": {
      const rawSession = options.session ?? firstPositional(options);
      if (!rawSession) {
        throw new CommandError("Usage: bgm auth set-session <chiiNextSessionID|cookie_string>");
      }

      const sessionId = extractPrivateSessionId(rawSession);
      if (!sessionId) {
        throw new CommandError("Could not find chiiNextSessionID in the provided value.");
      }

      await setConfigValues({
        privateSessionId: sessionId,
        privateSessionUpdatedAt: new Date().toISOString(),
      });

      printResult(
        {
          resource: "private-session-mutation",
          saved: true,
          configFile: getConfigFilePath(),
          sessionPreview: previewToken(sessionId),
          loginUrl: getPrivateDemoLoginUrl(),
        },
        context,
      );
      return;
    }
    case "session-status": {
      const sessionId = typeof config.privateSessionId === "string" ? config.privateSessionId.trim() : "";
      printResult(
        {
          resource: "private-session-status",
          saved: Boolean(sessionId),
          sessionPreview: sessionId ? previewToken(sessionId) : null,
          updatedAt: config.privateSessionUpdatedAt ?? null,
          loginUrl: getPrivateDemoLoginUrl(),
        },
        context,
      );
      return;
    }
    case "clear": {
      await clearConfigValues(AUTH_CONFIG_KEYS);
      printResult(
        {
          resource: "auth-clear",
          cleared: AUTH_CONFIG_KEYS,
          configFile: getConfigFilePath(),
        },
        context,
      );
      return;
    }
    default:
      throw new CommandError("Usage: bgm auth <login-url|token|refresh|status|turnstile|session-login|set-token|set-session|session-status|clear> ...");
  }
}

async function runSubjectCommand(command, args, context) {
  switch (command) {
    case "get": {
      const options = parseFlags(args);
      const client = new BangumiClient(getConfig());
      const subjectId = firstPositional(options);
      if (!subjectId) {
        throw new CommandError("Usage: bgm subject get <subject_id> [--verbose]");
      }

      const subject = await client.getSubject(subjectId);
      context.verbose = Boolean(options.verbose);
      printResult(subject, context);
      return;
    }
    case "list": {
      const subjects = await executeSubjectListCommand(args);
      printResult(subjects, context);
      return;
    }
    case "search": {
      const result = await executeSubjectSearchCommand(args);
      printResult(result, context);
      return;
    }
    default:
      throw new CommandError("Usage: bgm subject <get|list|search> ...");
  }
}

async function runGroupCommand(command, args, context) {
  switch (command) {
    case "list": {
      const result = await executeGroupListCommand(args);
      printResult(result, context);
      return;
    }
    case "get": {
      const result = await executeGroupGetCommand(args);
      printResult(result, context);
      return;
    }
    case "topics": {
      const result = await executeGroupTopicsCommand(args);
      printResult(result, context);
      return;
    }
    case "topic": {
      const result = await executeGroupTopicCommand(args);
      printResult(result, context);
      return;
    }
    case "create-topic": {
      const result = await executeGroupCreateTopicCommand(args, context);
      printResult(result, context);
      return;
    }
    case "reply": {
      const result = await executeGroupReplyCommand(args, context);
      printResult(result, context);
      return;
    }
    case "members": {
      const result = await executeGroupMembersCommand(args);
      printResult(result, context);
      return;
    }
    case "recent-topics": {
      const result = await executeRecentGroupTopicsCommand(args);
      printResult(result, context);
      return;
    }
    case "latest-replies": {
      const result = await executeLatestRepliedGroupTopicsCommand(args);
      printResult(result, context);
      return;
    }
    case "hot": {
      const result = await executeHotGroupsCommand(args);
      printResult(result, context);
      return;
    }
    case "hot-topics": {
      const result = await executeHotGroupTopicsCommand(args);
      printResult(result, context);
      return;
    }
    default:
      throw new CommandError("Usage: bgm group <list|get|topics|topic|create-topic|reply|members|recent-topics|latest-replies|hot|hot-topics> ...");
  }
}

async function runBlogCommand(command, args, context) {
  switch (command) {
    case "list": {
      const result = await executeBlogListCommand(args);
      printResult(result, context);
      return;
    }
    case "get": {
      const result = await executeBlogGetCommand(args);
      printResult(result, context);
      return;
    }
    case "comments": {
      const result = await executeBlogCommentsCommand(args);
      printResult(result, context);
      return;
    }
    case "reply": {
      const result = await executeBlogReplyCommand(args, context);
      printResult(result, context);
      return;
    }
    case "edit-comment": {
      const result = await executeBlogEditCommentCommand(args);
      printResult(result, context);
      return;
    }
    case "delete-comment": {
      const result = await executeBlogDeleteCommentCommand(args);
      printResult(result, context);
      return;
    }
    case "photos": {
      const result = await executeBlogPhotosCommand(args);
      printResult(result, context);
      return;
    }
    case "subjects": {
      const result = await executeBlogSubjectsCommand(args);
      printResult(result, context);
      return;
    }
    default:
      throw new CommandError("Usage: bgm blog <list|get|comments|reply|edit-comment|delete-comment|photos|subjects> ...");
  }
}

async function runTimelineCommand(command, args, context) {
  switch (command) {
    case "list": {
      const result = await executeTimelineListCommand(args);
      printResult(result, context);
      return;
    }
    case "user": {
      const result = await executeTimelineUserCommand(args);
      printResult(result, context);
      return;
    }
    case "replies": {
      const result = await executeTimelineRepliesCommand(args);
      printResult(result, context);
      return;
    }
    case "say": {
      const result = await executeTimelineSayCommand(args, context);
      printResult(result, context);
      return;
    }
    case "reply": {
      const result = await executeTimelineReplyCommand(args, context);
      printResult(result, context);
      return;
    }
    case "delete": {
      const result = await executeTimelineDeleteCommand(args);
      printResult(result, context);
      return;
    }
    case "like": {
      const result = await executeTimelineLikeCommand(args);
      printResult(result, context);
      return;
    }
    case "unlike": {
      const result = await executeTimelineUnlikeCommand(args);
      printResult(result, context);
      return;
    }
    default:
      throw new CommandError("Usage: bgm timeline <list|user|replies|say|reply|delete|like|unlike> ...");
  }
}

async function runUserCommand(command, args, context) {
  const options = parseFlags(args);
  const client = new BangumiClient(getConfig());

  switch (command) {
    case "me": {
      const me = await client.getMe();
      printResult(me, context);
      return;
    }
    case "get": {
      const username = firstPositional(options);
      if (!username) {
        throw new CommandError("Usage: bgm user get <username_or_initial_uid>");
      }

      const user = await client.getUser(username);
      printResult(user, context);
      return;
    }
    default:
      throw new CommandError("Usage: bgm user <me|get> ...");
  }
}

async function runStatusCommand(command, args, context) {
  if (!command || String(command).startsWith("--")) {
    const result = await executeStatusCurrentCommand(command ? [command, ...args] : args);
    printResult(result, context);
    return;
  }

  switch (command) {
    case "current": {
      const result = await executeStatusCurrentCommand(args);
      printResult(result, context);
      return;
    }
    case "incidents": {
      const result = await executeStatusIncidentsCommand(args);
      printResult(result, context);
      return;
    }
    default:
      throw new CommandError("Usage: bgm status [current|incidents] ...");
  }
}

async function runCalendarCommand(command, args, context) {
  const client = new BangumiClient(getConfig());
  const data = await client.getCalendar();

  const subcommand = (command && !String(command).startsWith("--"))
    ? command
    : null;

  if (subcommand === "all") {
    printResult({ resource: "calendar", data }, context);
    return;
  }

  const weekdayId = subcommand
    ? resolveWeekdaySubcommand(subcommand)
    : null;

  if (weekdayId !== null) {
    const filtered = data.filter((d) => d.weekday.id === weekdayId);
    printResult({ resource: "calendar", data: filtered }, context);
    return;
  }

  // default: today
  const todayId = todayWeekdayId();
  const filtered = data.filter((d) => d.weekday.id === todayId);
  printResult({ resource: "calendar", data: filtered }, context);
}

async function runIndexCommand(command, args, context) {
  switch (command) {
    case "create": {
      const result = await executeIndexCreateCommand(args);
      printResult(result, context);
      return;
    }
    case "get": {
      const result = await executeIndexGetCommand(args);
      printResult(result, context);
      return;
    }
    case "update": {
      const result = await executeIndexUpdateCommand(args);
      printResult(result, context);
      return;
    }
    case "delete": {
      const result = await executeIndexDeleteCommand(args);
      printResult(result, context);
      return;
    }
    case "comments": {
      const result = await executeIndexCommentsCommand(args);
      printResult(result, context);
      return;
    }
    case "comment": {
      const result = await executeIndexCommentCommand(args, context);
      printResult(result, context);
      return;
    }
    case "edit-comment": {
      const result = await executeIndexEditCommentCommand(args);
      printResult(result, context);
      return;
    }
    case "delete-comment": {
      const result = await executeIndexDeleteCommentCommand(args);
      printResult(result, context);
      return;
    }
    case "related": {
      const result = await executeIndexRelatedCommand(args);
      printResult(result, context);
      return;
    }
    case "add-related": {
      const result = await executeIndexAddRelatedCommand(args);
      printResult(result, context);
      return;
    }
    case "update-related": {
      const result = await executeIndexUpdateRelatedCommand(args);
      printResult(result, context);
      return;
    }
    case "delete-related": {
      const result = await executeIndexDeleteRelatedCommand(args);
      printResult(result, context);
      return;
    }
    default:
      throw new CommandError(
        "Usage: bgm index <create|get|update|delete|comments|comment|edit-comment|delete-comment|related|add-related|update-related|delete-related> ...",
      );
  }
}

async function runCollectionCommand(command, args, context) {
  switch (command) {
    case "list": {
      const result = await executeCollectionListCommand(args);
      printResult(result, context);
      return;
    }
    case "get": {
      const result = await executeCollectionGetCommand(args);
      printResult(result, context);
      return;
    }
    case "collect": {
      const result = await executeCollectionCollectCommand(args);
      printResult(result, context);
      return;
    }
    case "comment": {
      const result = await executeCollectionCommentCommand(args);
      printResult(result, context);
      return;
    }
    case "rate": {
      const result = await executeCollectionRateCommand(args);
      printResult(result, context);
      return;
    }
    case "status": {
      const result = await executeCollectionStatusCommand(args);
      printResult(result, context);
      return;
    }
    default:
      throw new CommandError(
        "Usage: bgm collection <list|get|collect|comment|rate|status> ...",
      );
  }
}

async function runEpisodeCommand(command, args, context) {
  switch (command) {
    case "list": {
      const result = await executeEpisodeListCommand(args);
      printResult(result, context);
      return;
    }
    case "status": {
      const result = await executeEpisodeStatusCommand(args);
      printResult(result, context);
      return;
    }
    case "watch": {
      const result = await executeEpisodeWatchCommand(args);
      printResult(result, context);
      return;
    }
    default:
      throw new CommandError(
        "Usage: bgm episode <list|status|watch> ...",
      );
  }
}

async function executeEpisodeListCommand(args) {
  const options = parseFlags(args);
  const client = new BangumiClient(getConfig());
  const subjectId = firstPositional(options);
  if (!subjectId) {
    throw new CommandError(
      "Usage: bgm episode list <subject_id> [--type <main|sp|op|ed|op_ed|trailer|pv|mad|other>] [--limit n] [--offset n]",
    );
  }

  const typeFilter = normalizeEpisodeTypeFilter(options.type);
  const limit = normalizeEpisodePageSize(options.limit);
  const offset = normalizeNonNegativeInteger(options.offset, "offset");
  let result;
  let filtered;

  try {
    if (typeFilter.matchTypes) {
      const episodes = await fetchAllEpisodes(client, subjectId);
      const matched = episodes.filter((episode) => typeFilter.matchTypes.has(Number(episode?.type)));
      filtered = matched.slice(offset ?? 0, limit !== undefined ? (offset ?? 0) + limit : undefined);
      result = {
        data: filtered,
        total: matched.length,
        limit: limit ?? matched.length,
        offset: offset ?? 0,
      };
    } else {
      result = await client.listEpisodes({
        subject_id: subjectId,
        type: typeFilter.queryType,
        limit,
        offset,
      });
      const episodes = Array.isArray(result.data) ? result.data : [];
      filtered = episodes;
    }
  } catch (error) {
    handleEpisodeListError(error, subjectId);
  }

  return {
    ...result,
    resource: "episode-list",
    subjectId: Number(subjectId),
    data: filtered,
    total: result.total ?? filtered.length,
    filters: {
      type: typeFilter.label,
      limit,
      offset,
    },
  };
}

async function executeEpisodeStatusCommand(args) {
  const options = parseFlags(args);
  const client = new BangumiClient(getConfig());
  const episodeId = firstPositional(options);
  const rawStatus = options.status ?? getPositional(options, 1);
  if (!episodeId || !rawStatus) {
    throw new CommandError(
      "Usage: bgm episode status <episode_id> <queue|watched|drop|remove>",
    );
  }

  const episode = await client.getEpisode(episodeId);
  const requestedType = normalizeEpisodeCollectionStatusValue(rawStatus);
  try {
    await client.updateMyEpisodeCollection(episodeId, { type: requestedType });
  } catch (error) {
    throw mapEpisodeMutationError(error, {
      action: requestedType === 0 ? "clear episode progress" : `set episode status to ${formatEpisodeCollectionStatusForError(requestedType)}`,
      episodeId,
      subjectId: episode?.subject_id,
    });
  }
  const collection = await fetchMyEpisodeCollectionVerified(client, episodeId, {
    expected: { type: requestedType },
    actionLabel: "Episode status update",
    mismatchMessage: (latest) =>
      `Bangumi did not persist the requested episode status. Requested ${formatEpisodeCollectionStatusForError(requestedType)}, but read back ${formatEpisodeCollectionStatusForError(latest?.type)}.`,
  });

  return buildEpisodeActionResult({
    action: "status",
    actionLabel: requestedType === 0 ? "Episode status cleared" : "Episode status updated",
    episodeId,
    episode,
    collection,
    requestedType,
  });
}

async function executeEpisodeWatchCommand(args) {
  const options = parseFlags(args);
  const client = new BangumiClient(getConfig());
  const subjectId = firstPositional(options);
  const episodeNumber = normalizePositiveNumber(getPositional(options, 1) ?? options.number, "episode number");
  if (!subjectId || episodeNumber === undefined) {
    throw new CommandError("Usage: bgm episode watch <subject_id> <episode_number>");
  }

  const episodes = await fetchAllEpisodes(client, subjectId, { type: EPISODE_TYPE_MAP.main });
  const episode = episodes.find((item) => Number(item?.type) === EPISODE_TYPE_MAP.main && Number(item?.ep) === episodeNumber);
  if (!episode) {
    throw new CommandError(`Could not find main episode ${episodeNumber} under subject ${subjectId}.`);
  }

  try {
    await client.updateMyEpisodeCollection(episode.id, { type: EPISODE_COLLECTION_STATUS_MAP.watched });
  } catch (error) {
    throw mapEpisodeMutationError(error, {
      action: `mark episode ${episodeNumber} as watched`,
      episodeId: episode.id,
      subjectId,
    });
  }
  const collection = await fetchMyEpisodeCollectionVerified(client, episode.id, {
    expected: { type: EPISODE_COLLECTION_STATUS_MAP.watched },
    actionLabel: "Episode watch update",
    mismatchMessage: (latest) =>
      `Bangumi did not persist the requested episode status. Requested watched, but read back ${formatEpisodeCollectionStatusForError(latest?.type)}.`,
  });

  return buildEpisodeActionResult({
    action: "watch",
    actionLabel: "Episode marked watched",
    subjectId,
    episodeId: episode.id,
    episode,
    collection,
    requestedType: EPISODE_COLLECTION_STATUS_MAP.watched,
  });
}

async function executeSubjectListCommand(args) {
  const options = parseFlags(args);
  const client = new BangumiClient(getConfig());
  const type = normalizeSubjectType(options.type);
  if (!type) {
    throw new CommandError("Usage: bgm subject list --type <book|anime|music|game|real> [options]");
  }

  const limit = parseOptionalInteger(options.limit);
  const offset = parseOptionalInteger(options.offset);
  const query = {
    type,
    cat: options.cat,
    series: parseOptionalBoolean(options.series),
    platform: options.platform,
    sort: options.sort,
    year: parseOptionalInteger(options.year),
    month: parseOptionalInteger(options.month),
  };

  let result;
  if (limit !== undefined && limit > 100) {
    // The /v0/subjects API enforces limit <= 100. Paginate automatically.
    result = await fetchAllSubjects(client, { ...query, limit, offset });
  } else {
    result = await client.listSubjects({
      ...query,
      limit,
      offset,
    });
  }

  if (String(options.sort ?? "").toLowerCase() === "rank" && Array.isArray(result.data)) {
    result.data = sortSubjectsByRank(result.data);
  }
  return {
    ...result,
    filters: {
      mode: "list",
      type,
      sort: options.sort ?? "rank",
      year: parseOptionalInteger(options.year),
      month: parseOptionalInteger(options.month),
      cat: options.cat,
      series: parseOptionalBoolean(options.series),
      platform: options.platform,
    },
  };
}

async function executeStatusCurrentCommand(args) {
  const options = parseFlags(args);
  const client = new BangumiStatusClient(getConfig());
  const site = normalizeStatusSite(options.site);
  const audience = normalizeStatusAudience(options.audience);
  const current = await client.getCurrentStatus();

  return buildStatusCurrentPayload(current, { site, audience });
}

async function executeStatusIncidentsCommand(args) {
  const options = parseFlags(args);
  const client = new BangumiStatusClient(getConfig());
  const site = normalizeStatusSite(options.site);
  const audience = normalizeStatusAudience(options.audience);
  const limit = normalizePageSize(options.limit) ?? 10;
  const [current, feed] = await Promise.all([client.getCurrentStatus(), client.listIncidents()]);
  const filtered = feed.entries.filter((entry) => {
    if (site && entry.site !== site) {
      return false;
    }
    if (audience && normalizeStatusAudience(entry.audience) !== audience) {
      return false;
    }
    return true;
  });
  const currentPayload = buildStatusCurrentPayload(current, { site, audience });

  return {
    resource: "status-incidents",
    title: feed.title,
    source: feed.link,
    feedUrl: feed.feedUrl,
    feedUpdatedAt: feed.updatedAt,
    total: filtered.length,
    filters: {
      site,
      audience,
      limit,
    },
    data: filtered.slice(0, limit),
  };
}

async function executeIndexCreateCommand(args) {
  const options = parseFlags(args);
  const client = new BangumiClient(getConfig());
  const title = firstPositional(options) ?? options.title;
  const desc = getPositional(options, 1) ?? options.desc;
  if (!title || desc === undefined) {
    throw new CommandError("Usage: bgm index create <title> <desc> [--private <true|false>]");
  }

  const isPrivate = parseOptionalBoolean(options.private) ?? false;
  const result = await client.createIndex({
    title,
    desc,
    private: isPrivate,
  });

  return {
    resource: "index-mutation",
    action: "create",
    indexId: result.id,
    title: String(title),
    private: isPrivate,
  };
}

async function executeIndexGetCommand(args) {
  const options = parseFlags(args);
  const client = new BangumiClient(getConfig());
  const indexId = firstPositional(options);
  if (!indexId) {
    throw new CommandError("Usage: bgm index get <index_id>");
  }

  return client.getIndex(indexId);
}

async function executeIndexUpdateCommand(args) {
  const options = parseFlags(args);
  const client = new BangumiClient(getConfig());
  const indexId = firstPositional(options);
  if (!indexId) {
    throw new CommandError("Usage: bgm index update <index_id> [--title <title>] [--desc <desc>] [--private <true|false>]");
  }

  const payload = {};
  if (options.title !== undefined) {
    payload.title = options.title;
  }
  if (options.desc !== undefined) {
    payload.desc = options.desc;
  }
  if (options.private !== undefined) {
    payload.private = parseOptionalBoolean(options.private);
  }
  if (Object.keys(payload).length === 0) {
    throw new CommandError("At least one of --title, --desc, or --private is required.");
  }

  await client.updateIndex(indexId, payload);
  return {
    resource: "index-mutation",
    action: "update",
    indexId: Number(indexId),
    ...payload,
  };
}

async function executeIndexDeleteCommand(args) {
  const options = parseFlags(args);
  const client = new BangumiClient(getConfig());
  const indexId = firstPositional(options);
  if (!indexId) {
    throw new CommandError("Usage: bgm index delete <index_id>");
  }

  await client.deleteIndex(indexId);
  return {
    resource: "index-mutation",
    action: "delete",
    indexId: Number(indexId),
  };
}

async function executeIndexCommentsCommand(args) {
  const options = parseFlags(args);
  const client = new BangumiClient(getConfig());
  const indexId = firstPositional(options);
  if (!indexId) {
    throw new CommandError("Usage: bgm index comments <index_id>");
  }

  const data = await client.listIndexComments(indexId);
  return {
    resource: "index-comments",
    indexId: Number(indexId),
    data,
  };
}

async function executeIndexCommentCommand(args, context = {}) {
  const options = parseFlags(args);
  const client = new BangumiClient(getConfig());
  const indexId = firstPositional(options);
  const content = getPositional(options, 1) ?? options.content;
  const replyTo = normalizeNonNegativeInteger(options.replyTo, "reply-to") ?? 0;
  if (!indexId || !content) {
    throw new CommandError("Usage: bgm index comment <index_id> <content> [--reply-to <comment_id>] [--turnstile-token <token>] [--manual] [--listen-host <host>] [--port <n>] [--public-origin <url>] [--timeout-seconds <n>]");
  }

  const turnstileToken = await resolveTurnstileTokenForMutation(options, {
    actionLabel: "comment on an index",
    context,
  });

  const result = await client.createIndexComment(indexId, {
    content,
    replyTo,
    turnstileToken,
  });

  return {
    resource: "index-comment-mutation",
    action: "reply",
    indexId: Number(indexId),
    commentId: result.id,
    replyTo,
    url: `https://bgm.tv/index/${indexId}`,
  };
}

async function executeIndexEditCommentCommand(args) {
  const options = parseFlags(args);
  const client = new BangumiClient(getConfig());
  const commentId = firstPositional(options);
  const content = getPositional(options, 1) ?? options.content;
  if (!commentId || !content) {
    throw new CommandError("Usage: bgm index edit-comment <comment_id> <content>");
  }

  await client.updateIndexComment(commentId, { content });
  return {
    resource: "index-comment-mutation",
    action: "edit",
    commentId: Number(commentId),
  };
}

async function executeIndexDeleteCommentCommand(args) {
  const options = parseFlags(args);
  const client = new BangumiClient(getConfig());
  const commentId = firstPositional(options);
  if (!commentId) {
    throw new CommandError("Usage: bgm index delete-comment <comment_id>");
  }

  await client.deleteIndexComment(commentId);
  return {
    resource: "index-comment-mutation",
    action: "delete",
    commentId: Number(commentId),
  };
}

async function executeIndexRelatedCommand(args) {
  const options = parseFlags(args);
  const client = new BangumiClient(getConfig());
  const indexId = firstPositional(options);
  if (!indexId) {
    throw new CommandError("Usage: bgm index related <index_id> [--cat <subject|character|person|ep|blog|group_topic|subject_topic>] [--type <book|anime|music|game|real>] [--limit n] [--offset n]");
  }

  const cat = normalizeIndexRelatedCategory(options.cat);
  const type = normalizeSubjectType(options.type);
  const limit = normalizePageSize(options.limit);
  const offset = normalizeNonNegativeInteger(options.offset, "offset");
  const result = await client.listIndexRelated(indexId, { cat, type, limit, offset });
  return {
    ...result,
    resource: "index-related",
    indexId: Number(indexId),
    filters: { cat, type, limit, offset },
  };
}

async function executeIndexAddRelatedCommand(args) {
  const options = parseFlags(args);
  const client = new BangumiClient(getConfig());
  const indexId = firstPositional(options);
  const cat = normalizeIndexRelatedCategory(options.cat);
  const sid = normalizePositiveInteger(options.sid, "sid");
  if (!indexId || cat === undefined || sid === undefined) {
    throw new CommandError("Usage: bgm index add-related <index_id> --cat <subject|character|person|ep|blog|group_topic|subject_topic> --sid <sid> [--order <n>] [--comment <text>] [--award <text>]");
  }

  const order = normalizeNonNegativeInteger(options.order, "order");
  const result = await client.addIndexRelated(indexId, {
    cat,
    sid,
    order,
    comment: options.comment,
    award: options.award,
  });
  return {
    resource: "index-related-mutation",
    action: "add",
    indexId: Number(indexId),
    relatedId: result.id,
    cat,
    sid,
    order: order ?? 0,
  };
}

async function executeIndexUpdateRelatedCommand(args) {
  const options = parseFlags(args);
  const client = new BangumiClient(getConfig());
  const indexId = firstPositional(options);
  const relatedId = getPositional(options, 1);
  const order = normalizeNonNegativeInteger(options.order, "order");
  const comment = options.comment;
  if (!indexId || !relatedId || order === undefined || comment === undefined) {
    throw new CommandError("Usage: bgm index update-related <index_id> <related_id> --order <n> --comment <text>");
  }

  await client.updateIndexRelated(indexId, relatedId, {
    order,
    comment,
  });
  return {
    resource: "index-related-mutation",
    action: "update",
    indexId: Number(indexId),
    relatedId: Number(relatedId),
    order,
  };
}

async function executeIndexDeleteRelatedCommand(args) {
  const options = parseFlags(args);
  const client = new BangumiClient(getConfig());
  const indexId = firstPositional(options);
  const relatedId = getPositional(options, 1);
  if (!indexId || !relatedId) {
    throw new CommandError("Usage: bgm index delete-related <index_id> <related_id>");
  }

  await client.deleteIndexRelated(indexId, relatedId);
  return {
    resource: "index-related-mutation",
    action: "delete",
    indexId: Number(indexId),
    relatedId: Number(relatedId),
  };
}

async function executeGroupListCommand(args) {
  const options = parseFlags(args);
  const client = new BangumiClient(getConfig());
  const mode = normalizeGroupListMode(options.mode);
  const sort = normalizeGroupSort(options.sort);
  const limit = normalizePageSize(options.limit);
  const offset = normalizeNonNegativeInteger(options.offset, "offset");
  const result = await client.listGroups({
    mode,
    sort,
    limit,
    offset,
  });

  return {
    ...result,
    resource: "group-list",
    filters: { mode, sort, limit, offset },
  };
}

async function executeGroupGetCommand(args) {
  const options = parseFlags(args);
  const client = new BangumiClient(getConfig());
  const groupName = firstPositional(options);
  if (!groupName) {
    throw new CommandError("Usage: bgm group get <group_name>");
  }

  return client.getGroup(groupName);
}

async function executeGroupTopicsCommand(args) {
  const options = parseFlags(args);
  const client = new BangumiClient(getConfig());
  const groupName = firstPositional(options);
  if (!groupName) {
    throw new CommandError("Usage: bgm group topics <group_name> [--limit n] [--offset n]");
  }

  const limit = normalizePageSize(options.limit);
  const offset = normalizeNonNegativeInteger(options.offset, "offset");
  const result = await client.listGroupTopics(groupName, {
    limit,
    offset,
  });

  return {
    ...result,
    resource: "group-topics",
    groupName: String(groupName),
    filters: { limit, offset },
  };
}

async function executeGroupTopicCommand(args) {
  const options = parseFlags(args);
  const client = new BangumiClient(getConfig());
  const topicId = firstPositional(options);
  if (!topicId) {
    throw new CommandError("Usage: bgm group topic <topic_id> [--reply-limit n]");
  }

  const replyLimit = normalizeNonNegativeInteger(options.replyLimit, "reply-limit") ?? 20;
  const topic = await client.getGroupTopic(topicId);
  return {
    ...topic,
    resource: "group-topic-detail",
    filters: {
      replyLimit,
    },
  };
}

async function executeGroupCreateTopicCommand(args, context = {}) {
  const options = parseFlags(args);
  const client = new BangumiClient(getConfig());
  const groupName = firstPositional(options);
  const title = getPositional(options, 1) ?? options.title;
  const content = getPositional(options, 2) ?? options.content;

  if (!groupName || !title || !content) {
    throw new CommandError("Usage: bgm group create-topic <group_name> <title> <content> [--turnstile-token <token>] [--manual] [--listen-host <host>] [--port <n>] [--public-origin <url>] [--timeout-seconds <n>]");
  }

  const turnstileToken = await resolveTurnstileTokenForMutation(options, {
    actionLabel: "create a group topic",
    context,
  });

  const result = await client.createGroupTopic(groupName, {
    title,
    content,
    turnstileToken,
  });

  return {
    resource: "group-topic-mutation",
    action: "create-topic",
    groupName: String(groupName),
    title: String(title),
    topicId: result.id,
    url: result.id ? `https://bgm.tv/group/topic/${result.id}` : undefined,
  };
}

async function executeGroupReplyCommand(args, context = {}) {
  const options = parseFlags(args);
  const client = new BangumiClient(getConfig());
  const topicId = firstPositional(options);
  const content = getPositional(options, 1) ?? options.content;
  const replyTo = normalizeNonNegativeInteger(options.replyTo, "reply-to") ?? 0;

  if (!topicId || !content) {
    throw new CommandError("Usage: bgm group reply <topic_id> <content> [--reply-to <reply_id>] [--turnstile-token <token>] [--manual] [--listen-host <host>] [--port <n>] [--public-origin <url>] [--timeout-seconds <n>]");
  }

  const turnstileToken = await resolveTurnstileTokenForMutation(options, {
    actionLabel: "reply to a group topic",
    context,
  });

  const result = await client.createGroupReply(topicId, {
    content,
    replyTo,
    turnstileToken,
  });

  return {
    resource: "group-topic-mutation",
    action: "reply",
    topicId: Number(topicId),
    postId: result.id,
    replyTo,
    url: `https://bgm.tv/group/topic/${topicId}`,
  };
}

async function resolveTurnstileTokenForMutation(options, { actionLabel, context }) {
  const explicitToken = typeof options.turnstileToken === "string" ? options.turnstileToken.trim() : "";
  if (explicitToken) {
    return explicitToken;
  }

  if (!process.stdin.isTTY && !process.stdout.isTTY) {
    throw new CommandError(`Turnstile verification is required to ${actionLabel}. Run this command in a terminal so bgm-cli can open the official verification page or the local fallback helper, or pass --turnstile-token explicitly.`);
  }

  if (toBoolean(options.manual, false)) {
    writeProgress(context, `No --turnstile-token provided. Because you passed --manual, bgm-cli will skip the hosted official flow and use the local helper fallback to ${actionLabel}.`);
  } else if (!toBoolean(options.interactive, false)) {
    writeProgress(context, `No --turnstile-token provided. bgm-cli will first try Bangumi's official hosted Turnstile flow to ${actionLabel}.`);
  }

  const result = await acquireTurnstileToken(options, context, { actionLabel });
  return result.token;
}

async function acquireTurnstileToken(options, context = {}, meta = {}) {
  if (shouldUseHostedTurnstileBackend(options, getConfig())) {
    try {
      return await acquireHostedTurnstileToken(context, meta);
    } catch (error) {
      if (shouldFallbackFromHostedTurnstile(error)) {
        writeProgress(context, "The hosted official Turnstile flow is unavailable right now. bgm-cli will fall back to the local helper flow.");
      } else {
        throw error;
      }
    }
  }

  const timeoutMs = normalizeTurnstileTimeoutMs(options.timeoutSeconds);
  const flow = await startTurnstileFlow({
    listenHost: options.listenHost,
    port: options.port,
    publicOrigin: options.publicOrigin,
    timeoutMs,
    actionLabel: meta.actionLabel,
  });

  const manualOnly = toBoolean(options.manual, false);
  let openedBrowser = false;

  writeProgress(context, `${meta.actionLabel ? `Turnstile verification is required to ${meta.actionLabel}.` : "Turnstile verification is required."}`);
  writeProgress(context, "Mode: local fallback helper");
  writeProgress(context, `Helper page: ${flow.verificationUrl}`);
  writeProgress(context, `Listening on: ${flow.listenHost}:${flow.port}`);
  writeProgress(context, "The token is short-lived and is intended for the next write operation only.");
  writeProgress(context, "The helper page shows a copyable browser script, a next.bgm.tv shortcut, and a manual paste box.");
  writeProgress(context, "If the page does not open automatically, open the helper URL yourself in a browser.");
  writeProgress(context, "bgm-cli is now waiting for the helper page to send a token back.");
  writeProgress(context, "For remote or VPS usage, rerun with `--manual --port 8765` and open the helper page through an SSH tunnel, or provide `--public-origin`.");

  if (!manualOnly) {
    openedBrowser = tryOpenExternalUrl(flow.verificationUrl);
    writeProgress(context, openedBrowser ? "Browser opened." : "Automatic browser launch failed or is unavailable.");
  }

  const result = await flow.completion;
  writeProgress(context, "Turnstile verification completed.");

  return {
    ...result,
    openedBrowser,
    timeoutMs,
  };
}

async function acquireHostedTurnstileToken(context = {}, meta = {}) {
  const config = getConfig();
  const backend = new OAuthBackendClient(config);
  const relay = await startHostedRelayReceiver({
    kind: "turnstile",
    timeoutMs: DEFAULT_TURNSTILE_TIMEOUT_MS,
  });
  const session = await backend.createTurnstileSession({
    relayUrl: relay.callbackUrl,
  });
  const authorizeUrl = session.authorize_url;
  let openedBrowser = false;

  writeProgress(context, `${meta.actionLabel ? `Turnstile verification is required to ${meta.actionLabel}.` : "Turnstile verification is required."}`);
  writeProgress(context, "Mode: hosted official Bangumi Turnstile");
  writeProgress(context, `Turnstile backend: ${config.oauthServerBaseUrl}`);
  writeProgress(context, `Open this official URL in your browser: ${authorizeUrl}`);
  writeProgress(context, "Bangumi will show the official Turnstile verification page, then redirect back to the hosted callback.");
  writeProgress(context, "The token is short-lived and is intended for the next write operation only.");
  writeProgress(context, "After verification succeeds, the hosted callback page will try to send the token back to this terminal automatically.");

  openedBrowser = tryOpenExternalUrl(authorizeUrl);
  writeProgress(context, openedBrowser ? "Browser opened." : "Automatic browser launch failed or is unavailable.");

  const result = await relay.completion;
  writeProgress(context, "Turnstile verification completed.");

  return {
    token: result.turnstileToken,
    tokenPreview: previewToken(result.turnstileToken),
    authorizeUrl,
    redirectUri: session.redirect_uri,
    openedBrowser,
    timeoutMs: relay.timeoutMs,
    backendBaseUrl: config.oauthServerBaseUrl,
  };
}

function shouldUseHostedTurnstileBackend(options, config) {
  if (!config?.oauthServerBaseUrl) {
    return false;
  }

  if (toBoolean(options.manual, false)) {
    return false;
  }

  if (toBoolean(options.localHelper, false)) {
    return false;
  }

  if (options.listenHost !== undefined || options.port !== undefined || options.publicOrigin !== undefined) {
    return false;
  }

  return true;
}

function shouldFallbackFromHostedTurnstile(error) {
  if (!(error instanceof ApiError)) {
    return false;
  }

  return error.status === 404 || error.status === 405 || error.status === 501 || error.status >= 500;
}

async function runPrivateSessionLogin(options, context = {}) {
  if (context.json) {
    throw new CommandError("bgm auth session-login does not support --json because it requires interactive prompts.");
  }

  const loginUrl = getPrivateDemoLoginUrl();
  const manualOnly = toBoolean(options.manual, false);
  let openedBrowser = false;

  writeProgress(context, "Private API demo login can save an optional next.bgm.tv session for p1 requests.");
  writeProgress(context, "This does not replace the normal Access Token login path.");
  writeProgress(context, "This session helper also does not replace Turnstile verification for group write operations.");
  writeProgress(context, `Official login page: ${loginUrl}`);
  writeProgress(context, "After signing in successfully, copy the `chiiNextSessionID` cookie value from your browser and paste it here.");
  writeProgress(context, "You can paste either the raw session ID or a full cookie string that includes chiiNextSessionID=...");

  if (!manualOnly) {
    openedBrowser = tryOpenExternalUrl(loginUrl);
    writeProgress(context, openedBrowser ? "Browser opened." : "Automatic browser launch failed or is unavailable.");
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    const rawValue = await askRequired(rl, "Paste chiiNextSessionID or cookie string");
    const sessionId = extractPrivateSessionId(rawValue);
    if (!sessionId) {
      throw new CommandError("Could not find chiiNextSessionID in the pasted value.");
    }

    await setConfigValues({
      privateSessionId: sessionId,
      privateSessionUpdatedAt: new Date().toISOString(),
    });

    return {
      resource: "private-session-mutation",
      saved: true,
      configFile: getConfigFilePath(),
      sessionPreview: previewToken(sessionId),
      loginUrl,
      openedBrowser,
    };
  } finally {
    rl.close();
  }
}

async function executeGroupMembersCommand(args) {
  const options = parseFlags(args);
  const client = new BangumiClient(getConfig());
  const groupName = firstPositional(options);
  if (!groupName) {
    throw new CommandError("Usage: bgm group members <group_name> [--role member] [--limit n] [--offset n]");
  }

  const role = normalizeGroupMemberRole(options.role);
  const limit = normalizePageSize(options.limit);
  const offset = normalizeNonNegativeInteger(options.offset, "offset");
  const result = await client.listGroupMembers(groupName, {
    role,
    limit,
    offset,
  });

  return {
    ...result,
    resource: "group-members",
    groupName: String(groupName),
    filters: { role, limit, offset },
  };
}

async function executeRecentGroupTopicsCommand(args) {
  const options = parseFlags(args);
  const client = new BangumiClient(getConfig());
  const mode = normalizeGroupTopicMode(options.mode);
  const limit = normalizePageSize(options.limit);
  const offset = normalizeNonNegativeInteger(options.offset, "offset");
  const result = await client.listRecentGroupTopics({
    mode,
    limit,
    offset,
  });

  return {
    ...result,
    resource: "group-recent-topics",
    filters: { mode, limit, offset },
  };
}

async function executeLatestRepliedGroupTopicsCommand(args) {
  const options = parseFlags(args);
  const client = new BangumiClient(getConfig());
  const mode = normalizeGroupTopicMode(options.mode);
  const limit = normalizeHotResultLimit(options.limit);
  const scan = normalizeHotScanLimit(options.scan, "day");
  const topics = await fetchRecentRepliedTopics(client, {
    mode,
    limit,
    scan,
  });

  return {
    resource: "group-latest-replies",
    data: topics,
    total: topics.length,
    filters: {
      mode,
      limit,
      scan,
    },
  };
}

async function executeHotGroupsCommand(args) {
  const options = parseFlags(args);
  const client = new BangumiClient(getConfig());
  const window = normalizeGroupHotWindow(options.window);
  const mode = normalizeGroupTopicMode(options.mode);
  const limit = normalizeHotResultLimit(options.limit);
  const scan = normalizeHotScanLimit(options.scan, window);
  const topics = await fetchTopicsForHotWindow(client, { window, mode, scan });
  const rankedTopics = rankHotTopics(topics, window);
  const grouped = aggregateHotGroups(rankedTopics, window).slice(0, limit);

  return {
    resource: "group-hot",
    data: grouped,
    total: grouped.length,
    filters: {
      window,
      mode,
      limit,
      scan,
      sampledTopics: rankedTopics.length,
      cutoff: computeHotCutoffTimestamp(window),
    },
  };
}

async function executeHotGroupTopicsCommand(args) {
  const options = parseFlags(args);
  const client = new BangumiClient(getConfig());
  const window = normalizeGroupHotWindow(options.window);
  const mode = normalizeGroupTopicMode(options.mode);
  const limit = normalizeHotResultLimit(options.limit);
  const scan = normalizeHotScanLimit(options.scan, window);
  const topics = await fetchTopicsForHotWindow(client, { window, mode, scan });
  const ranked = rankHotTopics(topics, window).slice(0, limit);

  return {
    resource: "group-hot-topics",
    data: ranked,
    total: ranked.length,
    filters: {
      window,
      mode,
      limit,
      scan,
      sampledTopics: topics.length,
      cutoff: computeHotCutoffTimestamp(window),
    },
  };
}

async function executeBlogListCommand(args) {
  const options = parseFlags(args);
  const client = new BangumiClient(getConfig());
  const username = options.user ? String(options.user) : (await client.getMe()).username;
  const limit = normalizePageSize(options.limit);
  const offset = normalizeNonNegativeInteger(options.offset, "offset");
  const result = await client.listUserBlogs(username, {
    limit,
    offset,
  });

  return {
    ...result,
    resource: "blog-list",
    filters: {
      user: username,
      limit,
      offset,
    },
  };
}

async function executeBlogGetCommand(args) {
  const options = parseFlags(args);
  const client = new BangumiClient(getConfig());
  const entryId = firstPositional(options);
  if (!entryId) {
    throw new CommandError("Usage: bgm blog get <blog_id>");
  }

  return client.getBlogEntry(entryId);
}

async function executeBlogCommentsCommand(args) {
  const options = parseFlags(args);
  const client = new BangumiClient(getConfig());
  const entryId = firstPositional(options);
  if (!entryId) {
    throw new CommandError("Usage: bgm blog comments <blog_id>");
  }

  const data = await client.listBlogComments(entryId);
  return {
    resource: "blog-comments",
    entryId: Number(entryId),
    data,
  };
}

async function executeBlogReplyCommand(args, context = {}) {
  const options = parseFlags(args);
  const client = new BangumiClient(getConfig());
  const entryId = firstPositional(options);
  const content = getPositional(options, 1) ?? options.content;
  const replyTo = normalizeNonNegativeInteger(options.replyTo, "reply-to") ?? 0;

  if (!entryId || !content) {
    throw new CommandError("Usage: bgm blog reply <blog_id> <content> [--reply-to <comment_id>] [--turnstile-token <token>] [--manual] [--listen-host <host>] [--port <n>] [--public-origin <url>] [--timeout-seconds <n>]");
  }

  const turnstileToken = await resolveTurnstileTokenForMutation(options, {
    actionLabel: "reply to a blog",
    context,
  });

  const result = await client.createBlogComment(entryId, {
    content,
    replyTo,
    turnstileToken,
  });

  return {
    resource: "blog-comment-mutation",
    action: "reply",
    entryId: Number(entryId),
    commentId: result.id,
    replyTo,
    url: `https://bgm.tv/blog/${entryId}`,
  };
}

async function executeBlogEditCommentCommand(args) {
  const options = parseFlags(args);
  const client = new BangumiClient(getConfig());
  const commentId = firstPositional(options);
  const content = getPositional(options, 1) ?? options.content;
  if (!commentId || !content) {
    throw new CommandError("Usage: bgm blog edit-comment <comment_id> <content>");
  }

  await client.updateBlogComment(commentId, { content });
  return {
    resource: "blog-comment-mutation",
    action: "edit",
    commentId: Number(commentId),
  };
}

async function executeBlogDeleteCommentCommand(args) {
  const options = parseFlags(args);
  const client = new BangumiClient(getConfig());
  const commentId = firstPositional(options);
  if (!commentId) {
    throw new CommandError("Usage: bgm blog delete-comment <comment_id>");
  }

  await client.deleteBlogComment(commentId);
  return {
    resource: "blog-comment-mutation",
    action: "delete",
    commentId: Number(commentId),
  };
}

async function executeBlogPhotosCommand(args) {
  const options = parseFlags(args);
  const client = new BangumiClient(getConfig());
  const entryId = firstPositional(options);
  if (!entryId) {
    throw new CommandError("Usage: bgm blog photos <blog_id> [--limit n] [--offset n]");
  }

  const limit = normalizePageSize(options.limit);
  const offset = normalizeNonNegativeInteger(options.offset, "offset");
  const result = await client.listBlogPhotos(entryId, {
    limit,
    offset,
  });

  return {
    ...result,
    resource: "blog-photos",
    entryId: Number(entryId),
    filters: {
      limit,
      offset,
    },
  };
}

async function executeBlogSubjectsCommand(args) {
  const options = parseFlags(args);
  const client = new BangumiClient(getConfig());
  const entryId = firstPositional(options);
  if (!entryId) {
    throw new CommandError("Usage: bgm blog subjects <blog_id>");
  }

  const data = await client.listBlogSubjects(entryId);
  return {
    resource: "blog-subjects",
    entryId: Number(entryId),
    data,
  };
}

async function executeTimelineListCommand(args) {
  const options = parseFlags(args);
  const client = new BangumiClient(getConfig());
  const mode = normalizeTimelineMode(options.mode);
  const limit = normalizeTimelineLimit(options.limit);
  const until = normalizeNonNegativeInteger(options.until, "until");
  const data = await client.listTimeline({
    mode,
    limit,
    until,
  });

  return {
    resource: "timeline-list",
    filters: {
      mode,
      limit,
      until,
    },
    data,
  };
}

async function executeTimelineUserCommand(args) {
  const options = parseFlags(args);
  const client = new BangumiClient(getConfig());
  const username = firstPositional(options);
  if (!username) {
    throw new CommandError("Usage: bgm timeline user <username> [--limit n] [--until <timeline_id>]");
  }

  const limit = normalizeTimelineLimit(options.limit);
  const until = normalizeNonNegativeInteger(options.until, "until");
  const data = await client.listUserTimeline(username, {
    limit,
    until,
  });

  return {
    resource: "timeline-user-list",
    filters: {
      user: String(username),
      limit,
      until,
    },
    data,
  };
}

async function executeTimelineRepliesCommand(args) {
  const options = parseFlags(args);
  const client = new BangumiClient(getConfig());
  const timelineId = firstPositional(options);
  if (!timelineId) {
    throw new CommandError("Usage: bgm timeline replies <timeline_id>");
  }

  const data = await client.listTimelineReplies(timelineId);
  return {
    resource: "timeline-replies",
    timelineId: Number(timelineId),
    data,
  };
}

async function executeTimelineSayCommand(args, context = {}) {
  const options = parseFlags(args);
  const client = new BangumiClient(getConfig());
  const content = firstPositional(options) ?? options.content;
  if (!content) {
    throw new CommandError("Usage: bgm timeline say <content> [--turnstile-token <token>] [--manual] [--listen-host <host>] [--port <n>] [--public-origin <url>] [--timeout-seconds <n>]");
  }

  const turnstileToken = await resolveTurnstileTokenForMutation(options, {
    actionLabel: "post a timeline status",
    context,
  });

  const result = await client.createTimeline({
    content,
    turnstileToken,
  });

  return {
    resource: "timeline-mutation",
    action: "say",
    timelineId: result.id,
  };
}

async function executeTimelineReplyCommand(args, context = {}) {
  const options = parseFlags(args);
  const client = new BangumiClient(getConfig());
  const timelineId = firstPositional(options);
  const content = getPositional(options, 1) ?? options.content;
  const replyTo = normalizeNonNegativeInteger(options.replyTo, "reply-to") ?? 0;

  if (!timelineId || !content) {
    throw new CommandError("Usage: bgm timeline reply <timeline_id> <content> [--reply-to <comment_id>] [--turnstile-token <token>] [--manual] [--listen-host <host>] [--port <n>] [--public-origin <url>] [--timeout-seconds <n>]");
  }

  const turnstileToken = await resolveTurnstileTokenForMutation(options, {
    actionLabel: "reply to a timeline entry",
    context,
  });

  const result = await client.createTimelineReply(timelineId, {
    content,
    replyTo,
    turnstileToken,
  });

  return {
    resource: "timeline-mutation",
    action: "reply",
    timelineId: Number(timelineId),
    commentId: result.id,
    replyTo,
  };
}

async function executeTimelineDeleteCommand(args) {
  const options = parseFlags(args);
  const client = new BangumiClient(getConfig());
  const timelineId = firstPositional(options);
  if (!timelineId) {
    throw new CommandError("Usage: bgm timeline delete <timeline_id>");
  }

  await client.deleteTimeline(timelineId);
  return {
    resource: "timeline-mutation",
    action: "delete",
    timelineId: Number(timelineId),
  };
}

async function executeTimelineLikeCommand(args) {
  const options = parseFlags(args);
  const client = new BangumiClient(getConfig());
  const timelineId = firstPositional(options);
  const value = normalizePositiveInteger(getPositional(options, 1) ?? options.value, "value");
  if (!timelineId || value === undefined) {
    throw new CommandError("Usage: bgm timeline like <timeline_id> <value>");
  }

  await client.likeTimeline(timelineId, value);
  return {
    resource: "timeline-mutation",
    action: "like",
    timelineId: Number(timelineId),
    value,
  };
}

async function executeTimelineUnlikeCommand(args) {
  const options = parseFlags(args);
  const client = new BangumiClient(getConfig());
  const timelineId = firstPositional(options);
  if (!timelineId) {
    throw new CommandError("Usage: bgm timeline unlike <timeline_id>");
  }

  await client.unlikeTimeline(timelineId);
  return {
    resource: "timeline-mutation",
    action: "unlike",
    timelineId: Number(timelineId),
  };
}

async function executeSubjectSearchCommand(args) {
  const options = parseFlags(args);
  const client = new BangumiClient(getConfig());
  const keyword = firstPositional(options);
  if (!keyword) {
    throw new CommandError("Usage: bgm subject search <keyword> [options]");
  }

  const filter = {};
  const normalizedType = normalizeSubjectType(options.type);
  if (normalizedType) {
    filter.type = [normalizedType];
  }
  if (options.tag) {
    filter.tag = ensureArray(options.tag);
  }
  if (options.metaTag) {
    filter.meta_tags = ensureArray(options.metaTag);
  }
  if (options.airDate) {
    filter.air_date = ensureArray(options.airDate);
  }
  if (options.rating) {
    filter.rating = ensureArray(options.rating);
  }
  if (options.ratingCount) {
    filter.rating_count = ensureArray(options.ratingCount);
  }
  if (options.rank) {
    filter.rank = ensureArray(options.rank);
  }
  if (options.nsfw !== undefined) {
    filter.nsfw = parseOptionalBoolean(options.nsfw);
  }

  const result = await client.searchSubjects({
    limit: parseOptionalInteger(options.limit),
    offset: parseOptionalInteger(options.offset),
    keyword,
    sort: options.sort,
    filter,
  });
  if (String(options.sort ?? "").toLowerCase() === "rank" && Array.isArray(result.data)) {
    result.data = sortSubjectsByRank(result.data);
  }
  return {
    ...result,
    filters: {
      mode: "search",
      keyword,
      type: normalizedType,
      sort: options.sort ?? "match",
      tag: options.tag ? ensureArray(options.tag) : [],
      metaTags: options.metaTag ? ensureArray(options.metaTag) : [],
      airDate: options.airDate ? ensureArray(options.airDate) : [],
      rating: options.rating ? ensureArray(options.rating) : [],
      ratingCount: options.ratingCount ? ensureArray(options.ratingCount) : [],
      rank: options.rank ? ensureArray(options.rank) : [],
      nsfw: options.nsfw !== undefined ? parseOptionalBoolean(options.nsfw) : undefined,
    },
  };
}

async function executeCollectionListCommand(args) {
  const options = parseFlags(args);
  const client = new BangumiClient(getConfig());
  const username = options.user ? String(options.user) : (await client.getMe()).username;
  const subjectTypes = normalizeSubjectTypeFilter(options.type);
  const collectionTypes = normalizeCollectionStatusFilter(options.status);
  const sort = normalizeCollectionSort(options.sort);
  const order = normalizeSortOrder(options.order);
  const limit = parseOptionalInteger(options.limit);
  const offset = parseOptionalInteger(options.offset);

  // Pass single-value filters to the API to reduce payload size.
  // Bangumi v0 API supports subject_type and type as query params,
  // but only as single values (not arrays). Multi-value filters
  // fall back to client-side filtering after full fetch.
  const apiQuery = {};
  if (subjectTypes.length === 1) {
    apiQuery.subject_type = subjectTypes[0];
  }
  if (collectionTypes.length === 1) {
    apiQuery.type = collectionTypes[0];
  }

  let result = await fetchAllCollections(client, username, { query: apiQuery });
  let data = Array.isArray(result.data) ? result.data : [];

  if (subjectTypes.length > 1) {
    const allowed = new Set(subjectTypes);
    data = data.filter((item) => allowed.has(item.subject_type));
  }

  if (collectionTypes.length > 1) {
    const allowed = new Set(collectionTypes);
    data = data.filter((item) => allowed.has(item.type));
  }

  data = sortCollections(data, sort, order);

  const start = offset ?? 0;
  const end = limit !== undefined ? start + limit : undefined;
  if (start > 0 || end !== undefined) {
    data = data.slice(start, end);
  }

  return {
    ...result,
    data,
    total: data.length,
    filters: {
      user: username,
      status: collectionTypes,
      subjectType: subjectTypes,
      sort,
      order,
      offset: offset ?? 0,
      limit,
    },
  };
}

async function executeCollectionGetCommand(args) {
  const options = parseFlags(args);
  const client = new BangumiClient(getConfig());
  const { subjectId, subject } = await resolveCollectionTarget(options, {
    client,
    usage: "Usage: bgm collection get <subject_id> | bgm collection get --search <keyword> [--pick n] [--type anime] [--sort rank] [--limit n]",
  });
  const collection = await fetchMySubjectCollection(client, subjectId);
  return buildCollectionActionResult({
    action: "get",
    actionLabel: "Collection detail",
    subjectId,
    subject,
    collection,
  });
}

async function executeCollectionCollectCommand(args) {
  const options = parseFlags(args);
  const client = new BangumiClient(getConfig());
  const rawStatus = options.status ?? getPositional(options, options.search ? 0 : 1) ?? "wish";
  const { subjectId, subject } = await resolveCollectionTarget(options, {
    client,
    usage: "Usage: bgm collection collect <subject_id> [<wish|collect|doing|on_hold|dropped>] | bgm collection collect --search <keyword> [<wish|collect|doing|on_hold|dropped>] [--status ...] [--pick n]",
  });
  const requestedStatus = normalizeCollectionStatusValue(rawStatus);
  const payload = buildCollectionMutationPayload(options, {
    defaultStatus: requestedStatus,
  });

  await client.upsertMyCollection(subjectId, payload);
  const collection = await fetchMySubjectCollectionVerified(client, subjectId, {
    expected: { type: requestedStatus },
    actionLabel: "Collection status update",
    mismatchMessage: (latest) =>
      `Bangumi did not persist the requested collection status. Requested ${formatCollectionStatusForError(requestedStatus)}, but read back ${formatCollectionStatusForError(latest?.type)}.`,
  });
  return buildCollectionActionResult({
    action: "collect",
    actionLabel: "Collection updated",
    subjectId,
    subject,
    collection,
  });
}

async function executeCollectionCommentCommand(args) {
  const options = parseFlags(args);
  const client = new BangumiClient(getConfig());
  const comment = options.comment ?? getPositional(options, options.search ? 0 : 1);
  if (comment === undefined) {
    throw new CommandError(
      "Usage: bgm collection comment <subject_id> <comment> | bgm collection comment --search <keyword> <comment> [--pick n]",
    );
  }

  const { subjectId, subject } = await resolveCollectionTarget(options, {
    client,
    usage: "Usage: bgm collection comment <subject_id> <comment> | bgm collection comment --search <keyword> <comment> [--pick n]",
  });

  await client.patchMyCollection(subjectId, { comment: String(comment) });
  const collection = await fetchMySubjectCollection(client, subjectId);
  return buildCollectionActionResult({
    action: "comment",
    actionLabel: "Collection comment updated",
    subjectId,
    subject,
    collection,
  });
}

async function executeCollectionRateCommand(args) {
  const options = parseFlags(args);
  const client = new BangumiClient(getConfig());
  const rawRate = options.rate ?? options.value ?? getPositional(options, options.search ? 0 : 1);
  if (rawRate === undefined) {
    throw new CommandError(
      "Usage: bgm collection rate <subject_id> <0-10> | bgm collection rate --search <keyword> <0-10> [--pick n]",
    );
  }

  const { subjectId, subject } = await resolveCollectionTarget(options, {
    client,
    usage: "Usage: bgm collection rate <subject_id> <0-10> | bgm collection rate --search <keyword> <0-10> [--pick n]",
  });

  const requestedRate = normalizeRateValue(rawRate);
  const currentCollection = await fetchMySubjectCollection(client, subjectId);
  if (currentCollection?.type === COLLECTION_STATUS_MAP.wish && requestedRate > 0) {
    throw new CommandError(
      "Bangumi does not allow rating while the collection status is wish. Change it to collect/doing/on_hold/dropped first, or use rate 0.",
    );
  }

  await client.patchMyCollection(subjectId, { rate: requestedRate });
  const collection = await fetchMySubjectCollectionVerified(client, subjectId, {
    expected: { rate: requestedRate },
    actionLabel: "Rating update",
    mismatchMessage: (latest) =>
      `Bangumi did not persist the requested rating. Requested ${requestedRate}, but read back ${latest?.rate ?? "-"}. This can happen under some collection states such as wish.`,
  });
  return buildCollectionActionResult({
    action: "rate",
    actionLabel: "Collection rating updated",
    subjectId,
    subject,
    collection,
  });
}

async function executeCollectionStatusCommand(args) {
  const options = parseFlags(args);
  const client = new BangumiClient(getConfig());
  const rawStatus = options.status ?? getPositional(options, options.search ? 0 : 1);
  if (!rawStatus) {
    throw new CommandError(
      "Usage: bgm collection status <subject_id> <wish|collect|doing|on_hold|dropped> | bgm collection status --search <keyword> <wish|collect|doing|on_hold|dropped> [--pick n]",
    );
  }

  const { subjectId, subject } = await resolveCollectionTarget(options, {
    client,
    usage: "Usage: bgm collection status <subject_id> <wish|collect|doing|on_hold|dropped> | bgm collection status --search <keyword> <wish|collect|doing|on_hold|dropped> [--pick n]",
  });

  await client.patchMyCollection(subjectId, {
    type: normalizeCollectionStatusValue(rawStatus),
  });
  const collection = await fetchMySubjectCollection(client, subjectId);
  return buildCollectionActionResult({
    action: "status",
    actionLabel: "Collection status updated",
    subjectId,
    subject,
    collection,
  });
}

async function resolveCollectionTarget(options, { client, usage }) {
  const explicitSubjectId = options.subjectId ?? firstPositional(options);

  if (options.search) {
    return selectSubjectFromSearch(client, options.search, options);
  }

  if (!explicitSubjectId) {
    throw new CommandError(usage);
  }

  const subject = await client.getSubject(explicitSubjectId);
  return {
    subjectId: subject.id ?? Number(explicitSubjectId),
    subject,
  };
}

async function selectSubjectFromSearch(client, keyword, options) {
  const result = await executeSubjectSearchCommand(buildSubjectSearchArgs(keyword, options));
  const subjects = Array.isArray(result?.data) ? result.data : [];

  if (subjects.length === 0) {
    throw new CommandError(`No subject matched search keyword: ${keyword}`);
  }

  const pickedIndex = parseOptionalInteger(options.pick);
  if (pickedIndex !== undefined) {
    const subject = subjects[pickedIndex - 1];
    if (!subject) {
      throw new CommandError(`Search pick index out of range: ${pickedIndex}`);
    }
    return {
      subjectId: subject.id,
      subject,
    };
  }

  if (subjects.length === 1) {
    return {
      subjectId: subjects[0].id,
      subject: subjects[0],
    };
  }

  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new CommandError(
      "Search returned multiple subjects. Re-run with --pick <n> or pass a subject ID directly.",
    );
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    console.log("Search results");
    subjects.forEach((subject, index) => {
      console.log(`  ${index + 1}. ${formatSubjectMenuLabel(subject)}`);
    });
    const selected = await askRequired(rl, "Choose target subject number");
    const index = Number.parseInt(String(selected), 10);
    if (Number.isNaN(index) || index < 1 || index > subjects.length) {
      throw new CommandError(`Invalid number: ${selected}`);
    }
    return {
      subjectId: subjects[index - 1].id,
      subject: subjects[index - 1],
    };
  } finally {
    rl.close();
  }
}

async function askMenuChoice(label, choices, defaultValue, extras = {}) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    const fallbackChoice = choices.find(
      (choice) => choice.value === defaultValue || choice.key === defaultValue,
    ) ?? choices[0];
    return fallbackChoice?.value;
  }

  emitKeypressEvents(process.stdin);
  const options = choices.map((choice) => ({
    ...choice,
    selected: choice.value === defaultValue || choice.key === defaultValue,
  }));
  const directKeys = options
    .map((choice) => choice.key)
    .filter((choiceKey) => choiceKey !== undefined && choiceKey !== null && choiceKey !== "");
  let index = Math.max(0, options.findIndex((choice) => choice.selected));
  if (index === -1) {
    index = 0;
  }
  let keyBuffer = "";

  return new Promise((resolve, reject) => {
    const wasRaw = Boolean(process.stdin.isRaw);
    const quitValue = extras.quitValue ?? "back";
    const quitLabel = extras.quitLabel ?? (quitValue === "exit" ? "exit" : "back");

    const cleanup = () => {
      process.stdin.off("keypress", onKeypress);
      if (!wasRaw && process.stdin.isTTY) {
        process.stdin.setRawMode(false);
      }
    };

    const render = () => {
      renderTuiHeader();
      console.log(drawSectionTitle(label));
      console.log(drawDivider());
      if (extras.summary) {
        console.log(extras.summary);
        console.log(drawDivider());
      }
      for (let i = 0; i < options.length; i += 1) {
        const prefix = i === index ? "›" : " ";
        const line = `${prefix} ${options[i].label}`;
        console.log(i === index ? inverse(line) : line);
      }
      console.log("");
      console.log(drawDivider());
      const keyHint = keyBuffer ? `  typed: ${keyBuffer}` : "";
      console.log(`↑/↓ move  digits jump  Enter confirm  q ${quitLabel}${keyHint}`);
    };

    const onKeypress = (_str, key = {}) => {
      if (key.name === "up" || key.name === "k") {
        keyBuffer = "";
        index = index > 0 ? index - 1 : options.length - 1;
        render();
        return;
      }
      if (key.name === "down" || key.name === "j") {
        keyBuffer = "";
        index = index < options.length - 1 ? index + 1 : 0;
        render();
        return;
      }
      if (key.name === "return" || key.name === "enter") {
        cleanup();
        if (keyBuffer) {
          const exactMatch = options.find((choice) => choice.key === keyBuffer);
          if (exactMatch) {
            resolve(exactMatch.value);
            return;
          }
        }
        resolve(options[index].value);
        return;
      }
      if (key.name === "q" || key.name === "escape") {
        keyBuffer = "";
        cleanup();
        resolve(quitValue);
        return;
      }
      if (key.name === "backspace" || key.name === "delete") {
        keyBuffer = keyBuffer.slice(0, -1);
        render();
        return;
      }
      if (key.ctrl && key.name === "c") {
        cleanup();
        reject(new CommandError("TUI cancelled."));
        return;
      }

      const raw = typeof _str === "string" ? _str : "";
      if (/^[0-9]$/.test(raw)) {
        const nextBuffer = `${keyBuffer}${raw}`;
        const exactMatch = options.find((choice) => choice.key === nextBuffer);
        const prefixMatches = directKeys.filter((choiceKey) => String(choiceKey).startsWith(nextBuffer));

        if (prefixMatches.length > 0) {
          keyBuffer = nextBuffer;
          if (exactMatch) {
            index = options.findIndex((choice) => choice.key === nextBuffer);
            if (prefixMatches.length === 1) {
              cleanup();
              resolve(exactMatch.value);
              return;
            }
          }
          render();
          return;
        }

        const singleDigitMatch = options.find((choice) => choice.key === raw);
        if (singleDigitMatch) {
          keyBuffer = raw;
          index = options.findIndex((choice) => choice.key === raw);
          render();
        }
      }
    };

    if (!wasRaw && process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    process.stdin.on("keypress", onKeypress);
    render();
  });
}

async function waitForTuiContinue() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    return;
  }

  console.log("");
  console.log(drawDivider());
  console.log("Press Enter to continue.");

  emitKeypressEvents(process.stdin);

  await new Promise((resolve, reject) => {
    const wasRaw = Boolean(process.stdin.isRaw);

    const cleanup = () => {
      process.stdin.off("keypress", onKeypress);
      if (!wasRaw && process.stdin.isTTY) {
        process.stdin.setRawMode(false);
      }
    };

    const onKeypress = (_str, key = {}) => {
      if (key.name === "return" || key.name === "enter" || key.name === "space") {
        cleanup();
        resolve();
        return;
      }
      if (key.ctrl && key.name === "c") {
        cleanup();
        reject(new CommandError("TUI cancelled."));
      }
    };

    if (!wasRaw && process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    process.stdin.on("keypress", onKeypress);
  });
}

async function askTuiOptional(rl, label, defaultValue = "", description = "") {
  renderTuiInputScreen(label, defaultValue, description);
  return askOptional(rl, label, defaultValue);
}

async function askTuiRequired(rl, label, defaultValue = "", description = "") {
  renderTuiInputScreen(label, defaultValue, description);
  return askRequired(rl, label, defaultValue);
}

async function askTuiCollectionTarget(rl) {
  const targetMode = await askMenuChoice(
    "Collection target",
    [
      { key: "1", label: "Enter subject ID directly", value: "id" },
      { key: "2", label: "Search subjects and choose one", value: "search" },
    ],
    "id",
  );

  if (isTuiBackAction(targetMode)) {
    return "menu";
  }

  if (targetMode === "id") {
    const subjectId = await askTuiRequired(rl, "Subject ID");
    return { mode: "id", subjectId };
  }

  const keyword = await askTuiRequired(rl, "Keyword");
  const type = await askMenuChoice(
    "Type filter",
    [
      { key: "1", label: "All types", value: "" },
      { key: "2", label: "anime", value: "anime" },
      { key: "3", label: "book", value: "book" },
      { key: "4", label: "music", value: "music" },
      { key: "5", label: "game", value: "game" },
      { key: "6", label: "real", value: "real" },
    ],
    "",
  );
  if (isTuiBackAction(type)) {
    return "menu";
  }

  const sort = await askMenuChoice(
    "Sort",
    [
      { key: "1", label: "match", value: "match" },
      { key: "2", label: "heat", value: "heat" },
      { key: "3", label: "rank", value: "rank" },
      { key: "4", label: "score", value: "score" },
    ],
    "match",
  );
  if (isTuiBackAction(sort)) {
    return "menu";
  }

  const limit = await askMenuChoice(
    "Limit",
    [
      { key: "1", label: "10", value: "10" },
      { key: "2", label: "20", value: "20" },
      { key: "3", label: "50", value: "50" },
    ],
    "10",
  );
  if (isTuiBackAction(limit)) {
    return "menu";
  }

  const args = [keyword];
  if (type) {
    args.push("--type", type);
  }
  if (sort) {
    args.push("--sort", sort);
  }
  if (limit) {
    args.push("--limit", limit);
  }

  const result = await executeSubjectSearchCommand(args);
  const subjects = Array.isArray(result?.data) ? result.data : [];
  if (subjects.length === 0) {
    renderTuiResultScreen("Subject results", formatDisplayResult(result, {}), "No target found.");
    await waitForTuiContinue();
    return "menu";
  }

  const choice = await askMenuChoice(
    "Choose subject",
    [
      ...subjects.map((subject, index) => ({
        key: String(index + 1),
        label: formatSubjectMenuLabel(subject),
        value: String(index),
      })),
      { key: "0", label: "Back", value: "back" },
    ],
    "0",
    {
      summary: formatCriteriaSummary({
        keyword,
        type: type || "all",
        sort,
        limit,
      }),
    },
  );

  if (isTuiBackAction(choice)) {
    return "menu";
  }

  const subject = subjects[Number(choice)];
  if (!subject?.id) {
    return "menu";
  }

  return {
    mode: "id",
    subjectId: String(subject.id),
  };
}

async function browseSubjectResults(result, context, criteria = {}) {
  const client = new BangumiClient(getConfig());
  const subjects = Array.isArray(result?.data) ? result.data : [];
  const summary = formatCriteriaSummary(criteria);

  if (subjects.length === 0) {
    renderTuiResultScreen("Subject results", formatDisplayResult(result, context), summary);
    return;
  }

  let pageIndex = 0;
  while (true) {
    const page = buildPagedMenu(subjects, pageIndex, formatSubjectMenuLabel);
    const choice = await askMenuChoice(
      "Subject results",
      [
        ...page.items.map((subject, index) => ({
          key: String(index + 1),
          label: formatSubjectMenuLabel(subject),
          value: String(page.startIndex + index),
        })),
        ...(page.hasPrevious ? [{ key: "8", label: "Previous page", value: "page-prev" }] : []),
        ...(page.hasNext ? [{ key: "9", label: "Next page", value: "page-next" }] : []),
        { key: "0", label: "Back", value: "back" },
      ],
      "0",
      {
        summary: [summary, formatPageSummary(subjects.length, pageIndex, page.pageCount)]
          .filter(Boolean)
          .join("\n"),
      },
    );

    if (isTuiBackAction(choice)) {
      return;
    }
    if (choice === "page-prev") {
      pageIndex = Math.max(0, pageIndex - 1);
      continue;
    }
    if (choice === "page-next") {
      pageIndex = Math.min(page.pageCount - 1, pageIndex + 1);
      continue;
    }

    const subject = subjects[Number(choice)];
    if (!subject) {
      continue;
    }

    await browseSubjectDetailActions(client, subject, context);
  }
}

async function browseCollectionResults(result, context, criteria = {}) {
  const client = new BangumiClient(getConfig());
  const items = Array.isArray(result?.data) ? result.data : [];
  const summary = formatCriteriaSummary(criteria);

  if (items.length === 0) {
    renderTuiResultScreen("Collection results", formatDisplayResult(result, context), summary);
    return;
  }

  let pageIndex = 0;
  while (true) {
    const page = buildPagedMenu(items, pageIndex, formatCollectionMenuLabel);
    const choice = await askMenuChoice(
      "Collection results",
      [
        ...page.items.map((item, index) => ({
          key: String(index + 1),
          label: formatCollectionMenuLabel(item),
          value: String(page.startIndex + index),
        })),
        ...(page.hasPrevious ? [{ key: "8", label: "Previous page", value: "page-prev" }] : []),
        ...(page.hasNext ? [{ key: "9", label: "Next page", value: "page-next" }] : []),
        { key: "0", label: "Back", value: "back" },
      ],
      "0",
      {
        summary: [summary, formatPageSummary(items.length, pageIndex, page.pageCount)]
          .filter(Boolean)
          .join("\n"),
      },
    );

    if (isTuiBackAction(choice)) {
      return;
    }
    if (choice === "page-prev") {
      pageIndex = Math.max(0, pageIndex - 1);
      continue;
    }
    if (choice === "page-next") {
      pageIndex = Math.min(page.pageCount - 1, pageIndex + 1);
      continue;
    }

    const item = items[Number(choice)];
    if (!item?.subject_id) {
      continue;
    }

    await browseSubjectDetailActions(
      client,
      {
        id: item.subject_id,
        name_cn: item?.subject?.name_cn,
        name: item?.subject?.name,
      },
      context,
    );
  }
}

async function browseGroupResults(result, context, criteria = {}) {
  const items = Array.isArray(result?.data) ? result.data : [];
  const summary = formatCriteriaSummary(criteria);

  if (items.length === 0) {
    renderTuiResultScreen("Group results", formatDisplayResult(result, context), summary);
    return;
  }

  let pageIndex = 0;
  while (true) {
    const page = buildPagedMenu(items, pageIndex, formatGroupMenuLabel);
    const choice = await askMenuChoice(
      "Group results",
      [
        ...page.items.map((item, index) => ({
          key: String(index + 1),
          label: formatGroupMenuLabel(item),
          value: String(page.startIndex + index),
        })),
        ...(page.hasPrevious ? [{ key: "8", label: "Previous page", value: "page-prev" }] : []),
        ...(page.hasNext ? [{ key: "9", label: "Next page", value: "page-next" }] : []),
        { key: "0", label: "Back", value: "back" },
      ],
      "0",
      {
        summary: [summary, formatPageSummary(items.length, pageIndex, page.pageCount)]
          .filter(Boolean)
          .join("\n"),
      },
    );

    if (isTuiBackAction(choice)) {
      return;
    }
    if (choice === "page-prev") {
      pageIndex = Math.max(0, pageIndex - 1);
      continue;
    }
    if (choice === "page-next") {
      pageIndex = Math.min(page.pageCount - 1, pageIndex + 1);
      continue;
    }

    const group = items[Number(choice)];
    const groupName = group?.name;
    if (!groupName) {
      renderTuiResultScreen("Group result", formatDisplayResult(group, context));
      await waitForTuiContinue();
      continue;
    }

    const detail = await executeGroupGetCommand([String(groupName)]);
    renderTuiResultScreen("Group detail", formatDisplayResult(detail, context));
    await waitForTuiContinue();
  }
}

async function pickGroupResult(result, criteria = {}) {
  const items = Array.isArray(result?.data) ? result.data : [];
  const summary = formatCriteriaSummary(criteria);

  if (items.length === 0) {
    renderTuiResultScreen("Choose group", formatDisplayResult(result, {}), summary || "No groups found.");
    await waitForTuiContinue();
    return null;
  }

  let pageIndex = 0;
  while (true) {
    const page = buildPagedMenu(items, pageIndex, formatGroupMenuLabel);
    const choice = await askMenuChoice(
      "Choose group",
      [
        ...page.items.map((item, index) => ({
          key: String(index + 1),
          label: formatGroupMenuLabel(item),
          value: String(page.startIndex + index),
        })),
        ...(page.hasPrevious ? [{ key: "8", label: "Previous page", value: "page-prev" }] : []),
        ...(page.hasNext ? [{ key: "9", label: "Next page", value: "page-next" }] : []),
        { key: "0", label: "Back", value: "back" },
      ],
      "0",
      {
        summary: [summary, formatPageSummary(items.length, pageIndex, page.pageCount)]
          .filter(Boolean)
          .join("\n"),
      },
    );

    if (isTuiBackAction(choice)) {
      return null;
    }
    if (choice === "page-prev") {
      pageIndex = Math.max(0, pageIndex - 1);
      continue;
    }
    if (choice === "page-next") {
      pageIndex = Math.min(page.pageCount - 1, pageIndex + 1);
      continue;
    }

    const group = items[Number(choice)];
    if (group) {
      return group;
    }
  }
}

async function browseGroupTopicResults(result, context, criteria = {}) {
  const items = Array.isArray(result?.data) ? result.data : [];
  const summary = formatCriteriaSummary(criteria);

  if (items.length === 0) {
    renderTuiResultScreen("Group topics", formatDisplayResult(result, context), summary);
    return;
  }

  let pageIndex = 0;
  while (true) {
    const page = buildPagedMenu(items, pageIndex, formatGroupTopicMenuLabel);
    const choice = await askMenuChoice(
      "Group topics",
      [
        ...page.items.map((item, index) => ({
          key: String(index + 1),
          label: formatGroupTopicMenuLabel(item),
          value: String(page.startIndex + index),
        })),
        ...(page.hasPrevious ? [{ key: "8", label: "Previous page", value: "page-prev" }] : []),
        ...(page.hasNext ? [{ key: "9", label: "Next page", value: "page-next" }] : []),
        { key: "0", label: "Back", value: "back" },
      ],
      "0",
      {
        summary: [summary, formatPageSummary(items.length, pageIndex, page.pageCount)]
          .filter(Boolean)
          .join("\n"),
      },
    );

    if (isTuiBackAction(choice)) {
      return;
    }
    if (choice === "page-prev") {
      pageIndex = Math.max(0, pageIndex - 1);
      continue;
    }
    if (choice === "page-next") {
      pageIndex = Math.min(page.pageCount - 1, pageIndex + 1);
      continue;
    }

    const topic = items[Number(choice)];
    if (!topic?.id) {
      continue;
    }

    const detail = await executeGroupTopicCommand([String(topic.id), "--reply-limit", "20"]);
    renderTuiResultScreen("Group topic", formatDisplayResult(detail, context));
    await waitForTuiContinue();
  }
}

async function askSubjectDetailAction(detail, subject) {
  renderTuiHeader();
  console.log(drawSectionTitle("Subject detail"));
  console.log(drawDivider());
  console.log(formatDisplayResult(detail, {}));
  console.log("");
  console.log(drawDivider());
  console.log(`Selected subject: #${subject.id} ${subject.name_cn || subject.name || "-"}`);
  console.log("Actions");
  console.log("  [1/c] collect  [2/o] open collection  [3/m] comment");
  console.log("  [4/r] rate     [5/s] status           [0/b/q] back");

  emitKeypressEvents(process.stdin);

  return new Promise((resolve, reject) => {
    const wasRaw = Boolean(process.stdin.isRaw);

    const cleanup = () => {
      process.stdin.off("keypress", onKeypress);
      if (!wasRaw && process.stdin.isTTY) {
        process.stdin.setRawMode(false);
      }
    };

    const mapping = {
      "1": "collect",
      c: "collect",
      "2": "collection-get",
      o: "collection-get",
      "3": "comment",
      m: "comment",
      "4": "rate",
      r: "rate",
      "5": "status",
      s: "status",
      "0": "back",
      b: "back",
      q: "back",
      escape: "back",
      return: "collection-get",
      enter: "collection-get",
    };

    const onKeypress = (_str, key = {}) => {
      if (key.ctrl && key.name === "c") {
        cleanup();
        reject(new CommandError("TUI cancelled."));
        return;
      }

      const raw = typeof _str === "string" ? _str.toLowerCase() : "";
      const action = mapping[raw] ?? mapping[key.name];
      if (!action) {
        return;
      }

      cleanup();
      resolve(action);
    };

    if (!wasRaw && process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    process.stdin.on("keypress", onKeypress);
  });
}

async function browseSubjectDetailActions(client, subject, context) {
  while (true) {
    const detail = await client.getSubject(subject.id);
    const action = await askSubjectDetailAction(detail, subject);

    if (isTuiBackAction(action)) {
      return;
    }

    const result = await runTuiSubjectCollectionAction(subject.id, action);
    renderTuiResultScreen("Collection result", formatDisplayResult(result, context));
    await waitForTuiContinue();
  }
}

async function runTuiSubjectCollectionAction(subjectId, action) {
  switch (action) {
    case "collection-get":
      return executeCollectionGetCommand([String(subjectId)]);
    case "collect": {
      const snapshot = await fetchTuiCollectionSnapshot(subjectId);
      const status = await askMenuChoice(
        "Collection status",
        [
          { key: "1", label: "wish", value: "wish" },
          { key: "2", label: "collect", value: "collect" },
          { key: "3", label: "doing", value: "doing" },
          { key: "4", label: "on_hold", value: "on_hold" },
          { key: "5", label: "dropped", value: "dropped" },
        ],
        getCollectionStatusKey(snapshot?.type) ?? "wish",
        {
          summary: formatCollectionSnapshotSummary(snapshot),
        },
      );
      if (isTuiBackAction(status)) {
        throw new CommandError("TUI cancelled.");
      }
      return executeCollectionCollectCommand([String(subjectId), status]);
    }
    case "comment": {
      const snapshot = await fetchTuiCollectionSnapshot(subjectId);
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      try {
        const commentInput = await askTuiOptional(
          rl,
          "Comment",
          snapshot?.comment ?? "",
          `${formatCollectionSnapshotSummary(snapshot)}\nType a single dash (-) to clear the comment.`,
        );
        const comment = commentInput === "-" ? "" : commentInput;
        return executeCollectionCommentCommand([String(subjectId), comment]);
      } finally {
        rl.close();
      }
    }
    case "rate": {
      const snapshot = await fetchTuiCollectionSnapshot(subjectId);
      const rating = await askMenuChoice(
        "Rating",
        [
          { key: "0", label: "0", value: "0" },
          { key: "1", label: "1", value: "1" },
          { key: "2", label: "2", value: "2" },
          { key: "3", label: "3", value: "3" },
          { key: "4", label: "4", value: "4" },
          { key: "5", label: "5", value: "5" },
          { key: "6", label: "6", value: "6" },
          { key: "7", label: "7", value: "7" },
          { key: "8", label: "8", value: "8" },
          { key: "9", label: "9", value: "9" },
          { key: "10", label: "10", value: "10" },
        ],
        snapshot ? String(snapshot.rate ?? 0) : "7",
        {
          summary: formatCollectionSnapshotSummary(snapshot),
        },
      );
      if (isTuiBackAction(rating)) {
        throw new CommandError("TUI cancelled.");
      }
      return executeCollectionRateCommand([String(subjectId), rating]);
    }
    case "status": {
      const snapshot = await fetchTuiCollectionSnapshot(subjectId);
      const status = await askMenuChoice(
        "Collection status",
        [
          { key: "1", label: "wish", value: "wish" },
          { key: "2", label: "collect", value: "collect" },
          { key: "3", label: "doing", value: "doing" },
          { key: "4", label: "on_hold", value: "on_hold" },
          { key: "5", label: "dropped", value: "dropped" },
        ],
        getCollectionStatusKey(snapshot?.type) ?? "collect",
        {
          summary: formatCollectionSnapshotSummary(snapshot),
        },
      );
      if (isTuiBackAction(status)) {
        throw new CommandError("TUI cancelled.");
      }
      return executeCollectionStatusCommand([String(subjectId), status]);
    }
    default:
      throw new CommandError(`Unsupported subject collection action: ${action}`);
  }
}

async function fetchTuiCollectionSnapshot(subjectId) {
  const client = new BangumiClient(getConfig());
  try {
    return await fetchMySubjectCollection(client, subjectId);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

async function runInstallPathSetup() {
  const repoDir = REPO_ROOT;
  const isWindows = process.platform === "win32";
  const scriptPath = isWindows
    ? path.join(repoDir, "scripts", "install-global-bgm.ps1")
    : path.join(repoDir, "scripts", "install-global-bgm.sh");

  if (!isWindows) {
    ensureExecutable(path.join(repoDir, "bgm"));
    ensureExecutable(scriptPath);
  }

  const command = isWindows
    ? "powershell"
    : "sh";
  const commandArgs = isWindows
    ? ["-ExecutionPolicy", "Bypass", "-File", scriptPath]
    : [scriptPath];

  const result = spawnSync(command, commandArgs, {
    cwd: repoDir,
    encoding: "utf8",
  });

  if (result.error) {
    throw new CommandError(`Failed to run global command setup: ${result.error.message}`);
  }

  const stdout = String(result.stdout ?? "").trim();
  const stderr = String(result.stderr ?? "").trim();

  if (result.status !== 0) {
    throw new CommandError(
      [
        "Global command setup failed.",
        stdout,
        stderr,
      ].filter(Boolean).join("\n"),
    );
  }

  const setupResult = await enableGlobalConfigMode();

  return {
    action: "install-path",
    platform: formatPlatformName(process.platform),
    repoDir,
    shellHint: getShellReloadHint(),
    output: stdout || "Installer script completed.",
    configFile: setupResult.configFile,
    migratedConfig: setupResult.migrated,
  };
}

async function runManagedInstallUpdate() {
  const repoDir = REPO_ROOT;
  const installDir = getManagedInstallDir();

  if (!pathsEqual(repoDir, installDir)) {
    throw new CommandError(
      [
        "`bgm setup update` only supports the one-click managed install.",
        `Current repository: ${repoDir}`,
        `Managed install path: ${installDir}`,
        "If you are using a git checkout, update it with your normal git workflow instead.",
      ].join("\n"),
    );
  }

  const isWindows = process.platform === "win32";
  const scriptName = isWindows ? "install-remote.ps1" : "install-remote.sh";
  const scriptUrl = `${REMOTE_INSTALL_SCRIPT_BASE_URL}/${scriptName}`;
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "bgm-cli-update-"));
  const scriptPath = path.join(tempDir, scriptName);

  try {
    const response = await fetch(scriptUrl, {
      headers: {
        Accept: "text/plain",
      },
    });

    if (!response.ok) {
      throw new CommandError(`Failed to download update script from ${scriptUrl}: HTTP ${response.status}`);
    }

    await writeFile(scriptPath, await response.text(), "utf8");

    if (!isWindows) {
      ensureExecutable(scriptPath);
    }

    const command = isWindows ? "powershell" : "sh";
    const commandArgs = isWindows
      ? ["-ExecutionPolicy", "Bypass", "-File", scriptPath]
      : [scriptPath];

    const result = spawnSync(command, commandArgs, {
      cwd: repoDir,
      encoding: "utf8",
    });

    if (result.error) {
      throw new CommandError(`Failed to run self-update: ${result.error.message}`);
    }

    const stdout = String(result.stdout ?? "").trim();
    const stderr = String(result.stderr ?? "").trim();

    if (result.status !== 0) {
      throw new CommandError(
        [
          "bgm-cli update failed.",
          stdout,
          stderr,
        ].filter(Boolean).join("\n"),
      );
    }

    return {
      action: "update",
      platform: formatPlatformName(process.platform),
      repoDir,
      installDir,
      output: stdout || "Update script completed.",
      configFile: getConfigFilePath(),
      shellHint: getUpdateShellHint(),
    };
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function waitForAuthorizationCode({ redirectUri, expectedState, timeoutMs = 300000 }) {
  const callbackUrl = new URL(redirectUri);
  const hostname = callbackUrl.hostname;
  const port = Number(callbackUrl.port || (callbackUrl.protocol === "https:" ? 443 : 80));
  const pathName = callbackUrl.pathname || "/";

  console.log(`Waiting for callback on ${hostname}:${port}${pathName}`);

  const result = await new Promise((resolve, reject) => {
    let settled = false;
    const server = http.createServer((req, res) => {
      try {
        const requestUrl = new URL(req.url ?? "/", redirectUri);
        if (requestUrl.pathname !== pathName) {
          respondHtml(res, 404, "Not Found", "<h1>Not Found</h1>");
          return;
        }

        const error = requestUrl.searchParams.get("error");
        const code = requestUrl.searchParams.get("code");
        const state = requestUrl.searchParams.get("state");

        if (error) {
          respondHtml(
            res,
            400,
            "Authorization failed",
            `<h1>Authorization failed</h1><p>${escapeHtml(error)}</p>`,
          );
          finishReject(new CommandError(`Bangumi authorization failed: ${error}`));
          return;
        }

        if (!code) {
          respondHtml(
            res,
            400,
            "Missing code",
            "<h1>Missing code</h1><p>No authorization code was returned.</p>",
          );
          finishReject(new CommandError("Authorization callback did not contain code."));
          return;
        }

        if (expectedState && state !== expectedState) {
          respondHtml(
            res,
            400,
            "Invalid state",
            "<h1>Invalid state</h1><p>State verification failed.</p>",
          );
          finishReject(new CommandError("Authorization callback state mismatch."));
          return;
        }

        respondHtml(
          res,
          200,
          "Authorization completed",
          "<h1>Authorization completed</h1><p>You can now return to the terminal.</p>",
        );
        finishResolve(code);
      } catch (error) {
        finishReject(error);
      }
    });

    server.once("error", (error) => {
      finishReject(
        new CommandError(
          `Failed to listen on redirect URI ${redirectUri}: ${error.message}. Use manual callback mode instead.`,
        ),
      );
    });

    const timeout = setTimeout(() => {
      finishReject(new CommandError("Timed out waiting for OAuth callback. Rerun `bgm --init` and choose manual callback mode if needed."));
    }, timeoutMs);

    function cleanup() {
      clearTimeout(timeout);
      server.close();
    }

    function finishResolve(value) {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      resolve(value);
    }

    function finishReject(error) {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      reject(error);
    }

    server.listen(port, hostname);
  });

  return result;
}

async function waitForHostedOAuthAuthorization(backend, session) {
  const startedAt = Date.now();
  const pollIntervalMs = session.poll_interval_ms ?? 2000;
  const expiresAt = session.expires_at ? new Date(session.expires_at).getTime() : Date.now() + 300000;

  while (Date.now() <= expiresAt) {
    let status;
    try {
      status = await backend.getSession(session.session_id);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404 && error.details?.status === "expired") {
        throw new CommandError("OAuth session expired before authorization completed.");
      }
      throw error;
    }

    if (status.status === "authorized") {
      return backend.claimSession(session.session_id);
    }

    if (status.status === "failed") {
      throw new CommandError(`OAuth authorization failed: ${status.error ?? "unknown_error"}`);
    }

    if (status.status === "expired") {
      throw new CommandError("OAuth session expired before authorization completed.");
    }

    if (Date.now() - startedAt < 1000 || (Date.now() - startedAt) % 10000 < pollIntervalMs) {
      console.log(`Waiting for authorization... session ${session.session_id}`);
    }

    await sleep(pollIntervalMs);
  }

  throw new CommandError("Timed out waiting for the hosted OAuth backend to finish authorization.");
}

async function waitForHostedTurnstileAuthorization(backend, session, context = {}) {
  const startedAt = Date.now();
  const pollIntervalMs = session.poll_interval_ms ?? 2000;
  const expiresAt = session.expires_at ? new Date(session.expires_at).getTime() : Date.now() + 300000;

  while (Date.now() <= expiresAt) {
    let status;
    try {
      status = await backend.getTurnstileSession(session.session_id, session.session_secret);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404 && error.details?.status === "expired") {
        throw new CommandError("Turnstile session expired before verification completed.");
      }
      throw error;
    }

    if (status.status === "completed") {
      return backend.claimTurnstileSession(session.session_id, session.session_secret);
    }

    if (status.status === "failed") {
      throw new CommandError(`Turnstile verification failed: ${status.error ?? "unknown_error"}`);
    }

    if (status.status === "expired") {
      throw new CommandError("Turnstile session expired before verification completed.");
    }

    if (Date.now() - startedAt < 1000 || (Date.now() - startedAt) % 10000 < pollIntervalMs) {
      writeProgress(context, `Waiting for Turnstile verification... session ${session.session_id}`);
    }

    await sleep(pollIntervalMs);
  }

  throw new CommandError("Timed out waiting for the hosted Turnstile backend to finish verification.");
}

async function startHostedRelayReceiver({ kind, timeoutMs = 300000 }) {
  const hostname = "0.0.0.0";
  const server = http.createServer();
  let settled = false;
  let timeout = null;
  let resolveCompletion;
  let rejectCompletion;

  const completion = new Promise((resolve, reject) => {
    resolveCompletion = resolve;
    rejectCompletion = reject;
  });

  server.on("request", async (req, res) => {
    try {
      const origin = callbackUrl ? new URL(callbackUrl).origin : `http://${hostname}`;
      const requestUrl = new URL(req.url ?? "/", origin);

      if (req.method === "OPTIONS" && requestUrl.pathname === "/callback") {
        respondHostedRelayPreflight(req, res);
        return;
      }

      if (req.method === "POST" && requestUrl.pathname === "/callback") {
        const payload = await readHostedRelayJsonBody(req);

        if (kind === "oauth") {
          if (!payload || typeof payload.access_token !== "string") {
            respondHostedRelayJson(req, res, 400, { error: "missing_access_token" });
            return;
          }
        }

        if (kind === "turnstile") {
          if (!payload || typeof payload.turnstileToken !== "string") {
            respondHostedRelayJson(req, res, 400, { error: "missing_turnstile_token" });
            return;
          }
        }

        respondHostedRelayJson(req, res, 200, {
          ok: true,
          message: "Payload received. You can return to the terminal.",
        });
        finishResolve(payload);
        return;
      }

      if (req.method === "GET" && requestUrl.pathname === "/health") {
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ ok: true, kind }));
        return;
      }

      respondHtml(res, 404, "Not Found", "<h1>Not Found</h1>");
    } catch (error) {
      finishReject(error);
      respondHostedRelayJson(req, res, 500, { error: "internal_error" });
    }
  });

  await new Promise((resolve, reject) => {
    const onError = (error) => reject(new CommandError(`Failed to start local relay receiver: ${error.message}`));
    server.once("error", onError);
    server.listen(0, hostname, () => resolve());
    server.once("listening", () => {
      server.off("error", onError);
    });
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new CommandError("Failed to determine local relay receiver address.");
  }

  const callbackUrl = `http://${hostname}:${address.port}/callback`;
  timeout = setTimeout(() => {
    finishReject(new CommandError(`Timed out waiting for the hosted ${kind} callback relay.`));
  }, timeoutMs);

  return {
    callbackUrl,
    completion,
    timeoutMs,
    close: cleanup,
  };

  function cleanup() {
    if (timeout) {
      clearTimeout(timeout);
    }
    server.close();
  }

  function finishResolve(value) {
    if (settled) {
      return;
    }
    settled = true;
    cleanup();
    resolveCompletion(value);
  }

  function finishReject(error) {
    if (settled) {
      return;
    }
    settled = true;
    cleanup();
    rejectCompletion(error);
  }
}

main(process.argv.slice(2)).catch((error) => {
  if (error instanceof CommandError) {
    console.error(`Error: ${error.message}`);
    process.exitCode = 1;
    return;
  }

  if (error instanceof ConfigError) {
    console.error(`Error: ${error.message}`);
    process.exitCode = 1;
    return;
  }

  if (error?.name === "BangumiApiError") {
    console.error(`Bangumi API error (${error.status}): ${error.message}`);
    if (error.details !== undefined) {
      console.error(JSON.stringify(error.details, null, 2));
    }
    if (error.status === 401) {
      console.error("");
      console.error("Tip: Your access token may have expired. Try refreshing it with:");
      console.error("  bgm auth refresh --save");
      console.error("Or set a new token with:");
      console.error("  bgm auth set-token <access_token>");
    }
    process.exitCode = 1;
    return;
  }

  console.error(error);
  process.exitCode = 1;
});
