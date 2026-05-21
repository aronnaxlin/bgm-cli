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
import { BangumiClient, BangumiOAuthClient, OAuthBackendClient } from "./core/client.js";
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
  normalizeNonNegativeInteger,
  normalizePageSize,
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
  SUBJECT_TYPE_MAP,
  TIMELINE_MODE_VALUES,
  normalizeSortOrder,
} from "./utils/validators.js";
import {
  createState,
  extractAuthorizationInput,
  extractPrivateSessionId,
  fallbackUserAgent,
  getPrivateDemoLoginUrl,
  isLocalRedirectUri,
} from "./utils/auth.js";
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
  askMenuChoice,
  askTuiOptional,
  askTuiRequired,
  waitForTuiContinue,
} from "./utils/tui-interactive.js";
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
  runPrivateSessionLogin,
  startHostedRelayReceiver,
  waitForAuthorizationCode,
  waitForHostedOAuthAuthorization,
  waitForHostedTurnstileAuthorization,
} from "./utils/auth-flow.js";
import {
  acquireTurnstileToken,
} from "./utils/turnstile-flow.js";
import {
  fetchTuiCollectionSnapshot,
} from "./utils/collection-ops.js";
import { summarizeCurrentStatus } from "./utils/status.js";
import { runCalendarCommand } from "./commands/calendar.js";
import { runStatusCommand } from "./commands/status.js";
import { runUserCommand } from "./commands/user.js";
import {
  executeSubjectListCommand,
  executeSubjectSearchCommand,
  runSubjectCommand,
} from "./commands/subject.js";
import {
  executeCollectionCollectCommand,
  executeCollectionCommentCommand,
  executeCollectionGetCommand,
  executeCollectionListCommand,
  executeCollectionRateCommand,
  executeCollectionStatusCommand,
  runCollectionCommand,
} from "./commands/collection.js";
import { runEpisodeCommand } from "./commands/episode.js";
import { runIndexCommand } from "./commands/index.js";
import { runBlogCommand } from "./commands/blog.js";
import { runTimelineCommand } from "./commands/timeline.js";
import {
  executeGroupGetCommand,
  executeGroupListCommand,
  executeGroupMembersCommand,
  executeGroupTopicCommand,
  executeGroupTopicsCommand,
  runGroupCommand,
} from "./commands/group.js";

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
