#!/usr/bin/env node

import http from "node:http";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { chmodSync } from "node:fs";
import readline from "node:readline/promises";
import { emitKeypressEvents } from "node:readline";
import { fileURLToPath } from "node:url";
import { BangumiClient, BangumiOAuthClient, OAuthBackendClient } from "./core/client.js";
import {
  ConfigError,
  clearConfigValue,
  enableGlobalConfigMode,
  getConfig,
  getConfigFilePath,
  getConfigSourceFilePath,
  setConfigValues,
} from "./core/config.js";
import { CommandError, formatDisplayResult, printResult, printUsage } from "./core/output.js";

const SUBJECT_TYPE_MAP = {
  book: 1,
  anime: 2,
  music: 3,
  game: 4,
  real: 6,
};

const CLI_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(CLI_DIR, "..");

const COLLECTION_STATUS_MAP = {
  wish: 1,
  collect: 2,
  done: 2,
  doing: 3,
  do: 3,
  on_hold: 4,
  onhold: 4,
  hold: 4,
  dropped: 5,
  drop: 5,
};

async function main(argv) {
  const parsed = parseGlobalArgs(argv);
  const context = {
    json: parsed.json,
    rawArgs: parsed.args,
  };

  if (parsed.init) {
    await runInitWizard(context);
    return;
  }

  if (parsed.args.length === 0 || hasHelpFlag(parsed.args)) {
    printUsage();
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
    case "collection":
      await runCollectionCommand(command, rest, context);
      return;
    case "user":
      await runUserCommand(command, rest, context);
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
    let redirectUri = currentConfig.redirectUri ?? "http://localhost/callback";

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
      if (resolved.kind === "token") {
        throw new CommandError("Manual callback mode expects callback URL or authorization code, not access token.");
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
  console.log("The CLI will use the project's hosted OAuth backend.");
  console.log(`OAuth server: ${config.oauthServerBaseUrl}`);
  console.log("");
  console.log("Warning: Bangumi hosted OAuth is still experimental and unstable.");
  console.log("Do not use it unless you are explicitly testing this flow.");
  console.log("");
  console.log("If you still want to test it, make sure your browser is already signed in to Bangumi.");
  console.log("Before continuing:");
  console.log("1. Open https://bangumi.tv in your browser");
  console.log("2. Sign in first");
  console.log("3. Open the authorization link later in the same browser session");
  console.log("");

  const browserReady = await askChoice(
    rl,
    "Browser sign-in confirmation",
    [
      {
        key: "1",
        label: "I am already signed in to bangumi.tv in this browser session",
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
    console.log("Please sign in at https://bangumi.tv first, then run `./bgm --init` again.");
    return;
  }

  console.log("");

  const backend = new OAuthBackendClient({
    ...config,
    userAgent,
  });

  const session = await backend.createSession();

  console.log("Open the link below in your browser and complete authorization:");
  console.log(session.authorize_url);
  console.log("");
  console.log("Your Bangumi account and password are entered only on Bangumi's official website, never in this CLI.");
  console.log("Use the same browser session that is already signed in to https://bangumi.tv.");
  console.log("The CLI will keep polling the OAuth backend until authorization completes.");
  console.log("");

  const token = await waitForHostedOAuthAuthorization(backend, session);

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
      await setConfigValues({ [normalizedKey]: value });
      printResult(
        {
          updated: normalizedKey,
          configFile: getConfigFilePath(),
          value,
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
          { key: "5", label: "User: show current authenticated user", value: "user-me" },
          { key: "6", label: "User: fetch one public user profile", value: "user-get" },
          { key: "7", label: "Setup: install bgm into PATH", value: "setup-install-path" },
          { key: "8", label: "Config: show current config", value: "config-show" },
          { key: "9", label: "Config: set one config value", value: "config-set" },
          { key: "10", label: "Config: unset one config value", value: "config-unset" },
          { key: "0", label: "Exit", value: "exit" },
        ],
        "subject-search",
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

      const nextStep = await askMenuChoice(
        "Next step",
        [
          { key: "1", label: "Back to main menu", value: "menu" },
          { key: "0", label: "Exit", value: "exit" },
        ],
        "menu",
      );

      if (nextStep === "exit") {
        clearScreen();
        console.log("");
        console.log("Bye.");
        return;
      }
    }
  } finally {
    rl.close();
  }
}

async function runTuiAction(rl, action, context) {
  switch (action) {
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
        ],
        "accessToken",
      );
      if (key === "exit") {
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
        ],
        "accessToken",
      );
      if (key === "exit") {
        return "menu";
      }
      await runConfigCommand("unset", [key], context);
      return;
    }
    case "setup-install-path":
      await runSetupCommand("install-path", [], context);
      return;
    case "user-me":
      await runUserCommand("me", [], context);
      return;
    case "user-get": {
      const username = await askTuiRequired(rl, "Username or numeric user ID");
      await runUserCommand("get", [username], context);
      return;
    }
    case "subject-get": {
      const subjectId = await askTuiRequired(rl, "Subject ID");
      await runSubjectCommand("get", [subjectId], context);
      return;
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
      if (type === "exit") {
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
      if (sort === "exit") {
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
      if (limit === "exit") {
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
      return;
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
      if (type === "exit") {
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
      if (sort === "exit") {
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
      if (limit === "exit") {
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
      return;
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
      if (targetMode === "exit") {
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
      if (type === "exit") {
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
      if (status === "exit") {
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
      if (sort === "exit") {
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
      if (order === "exit") {
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
      if (limit === "exit") {
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
    default:
      throw new CommandError("Usage: bgm setup install-path");
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

      if (toBoolean(options.save, true)) {
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

      if (toBoolean(options.save, true)) {
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
    default:
      throw new CommandError("Usage: bgm auth <login-url|token|refresh|status|set-token> ...");
  }
}

async function runSubjectCommand(command, args, context) {
  switch (command) {
    case "get": {
      const options = parseFlags(args);
      const client = new BangumiClient(getConfig());
      const subjectId = firstPositional(options);
      if (!subjectId) {
        throw new CommandError("Usage: bgm subject get <subject_id>");
      }

      const subject = await client.getSubject(subjectId);
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

async function executeSubjectListCommand(args) {
  const options = parseFlags(args);
  const client = new BangumiClient(getConfig());
  const type = normalizeSubjectType(options.type);
  if (!type) {
    throw new CommandError("Usage: bgm subject list --type <book|anime|music|game|real> [options]");
  }

  const result = await client.listSubjects({
    type,
    cat: options.cat,
    series: parseOptionalBoolean(options.series),
    platform: options.platform,
    sort: options.sort,
    year: parseOptionalInteger(options.year),
    month: parseOptionalInteger(options.month),
    limit: parseOptionalInteger(options.limit),
    offset: parseOptionalInteger(options.offset),
  });
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

  let result = await fetchAllCollections(client, username);
  let data = Array.isArray(result.data) ? result.data : [];

  if (subjectTypes.length > 0) {
    const allowed = new Set(subjectTypes);
    data = data.filter((item) => allowed.has(item.subject_type));
  }

  if (collectionTypes.length > 0) {
    const allowed = new Set(collectionTypes);
    data = data.filter((item) => allowed.has(item.type));
  }

  data = sortCollections(data, sort, order);

  if (limit !== undefined) {
    data = data.slice(0, limit);
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

function buildCollectionActionResult({ action, actionLabel, subjectId, subject, collection }) {
  return {
    action,
    actionLabel,
    subjectId: Number(subjectId),
    subjectName: subject?.name_cn || subject?.name,
    subject,
    collection,
  };
}

async function fetchMySubjectCollection(client, subjectId) {
  const me = await client.getMe();
  return client.getUserCollection(me.username, subjectId);
}

async function fetchMySubjectCollectionVerified(client, subjectId, { expected, actionLabel, mismatchMessage }) {
  let latest = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    latest = await fetchMySubjectCollection(client, subjectId);
    if (collectionMatchesExpected(latest, expected)) {
      return latest;
    }
    if (attempt < 2) {
      await delayMs(350);
    }
  }

  throw new CommandError(
    typeof mismatchMessage === "function"
      ? mismatchMessage(latest)
      : `${actionLabel} did not persist on Bangumi.`,
  );
}

function collectionMatchesExpected(collection, expected = {}) {
  return Object.entries(expected).every(([key, value]) => collection?.[key] === value);
}

function formatCollectionStatusForError(type) {
  const labels = {
    1: "wish",
    2: "collect",
    3: "doing",
    4: "on_hold",
    5: "dropped",
  };
  return labels[type] ?? String(type ?? "-");
}

function delayMs(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
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

function buildSubjectSearchArgs(keyword, options) {
  const args = [String(keyword)];

  if (options.type) {
    args.push("--type", String(options.type));
  }
  if (options.sort) {
    args.push("--sort", String(options.sort));
  }
  if (options.limit) {
    args.push("--limit", String(options.limit));
  } else {
    args.push("--limit", "10");
  }

  return args;
}

function buildCollectionMutationPayload(options, { defaultStatus } = {}) {
  const payload = {};

  if (defaultStatus !== undefined) {
    payload.type = defaultStatus;
  } else if (options.status !== undefined) {
    payload.type = normalizeCollectionStatusValue(options.status);
  }
  if (options.rate !== undefined) {
    payload.rate = normalizeRateValue(options.rate);
  }
  if (options.comment !== undefined) {
    payload.comment = String(options.comment);
  }
  if (options.private !== undefined) {
    payload.private = parseOptionalBoolean(options.private);
  }
  if (options.epStatus !== undefined) {
    payload.ep_status = normalizeNonNegativeInteger(options.epStatus, "ep-status");
  }
  if (options.volStatus !== undefined) {
    payload.vol_status = normalizeNonNegativeInteger(options.volStatus, "vol-status");
  }
  if (options.tags !== undefined) {
    payload.tags = splitFilterValues(options.tags);
  }

  return payload;
}

function parseGlobalArgs(argv) {
  const args = [];
  let json = false;
  let init = false;

  for (const arg of argv) {
    if (arg === "--json") {
      json = true;
      continue;
    }
    if (arg === "--init") {
      init = true;
      continue;
    }
    args.push(arg);
  }

  return { args, json, init };
}

function parseFlags(args) {
  const options = { _: [] };

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (!token.startsWith("--")) {
      options._.push(token);
      continue;
    }

    const stripped = token.slice(2);
    if (stripped.length === 0) {
      continue;
    }

    const [rawKey, inlineValue] = stripped.split("=", 2);
    const key = toCamelCase(rawKey);

    if (inlineValue !== undefined) {
      storeFlagValue(options, key, inlineValue);
      continue;
    }

    const next = args[index + 1];
    if (next && !next.startsWith("--")) {
      storeFlagValue(options, key, next);
      index += 1;
      continue;
    }

    storeFlagValue(options, key, true);
  }

  return options;
}

function storeFlagValue(target, key, value) {
  if (target[key] === undefined) {
    target[key] = value;
    return;
  }

  if (Array.isArray(target[key])) {
    target[key].push(value);
    return;
  }

  target[key] = [target[key], value];
}

function firstPositional(options) {
  return options._[0];
}

function getPositional(options, index) {
  return options._[index];
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [value];
}

function splitFilterValues(value) {
  return ensureArray(value)
    .flatMap((entry) => String(entry).split(","))
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function normalizeSubjectType(value) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (/^\d+$/.test(String(value))) {
    return Number(value);
  }

  const normalized = SUBJECT_TYPE_MAP[String(value).toLowerCase()];
  if (!normalized) {
    throw new CommandError(`Unsupported subject type: ${value}`);
  }

  return normalized;
}

function normalizeSubjectTypeFilter(value) {
  if (value === undefined || value === null || value === "") {
    return [];
  }

  return splitFilterValues(value).map((entry) => normalizeSubjectType(entry));
}

function normalizeCollectionStatusFilter(value) {
  if (value === undefined || value === null || value === "") {
    return [];
  }

  return splitFilterValues(value).map((entry) => {
    const numeric = /^\d+$/.test(entry) ? Number(entry) : undefined;
    if (numeric) {
      return numeric;
    }

    const normalized = COLLECTION_STATUS_MAP[entry.toLowerCase()];
    if (!normalized) {
      throw new CommandError(`Unsupported collection status: ${entry}`);
    }
    return normalized;
  });
}

function normalizeCollectionStatusValue(value) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const normalized = normalizeCollectionStatusFilter(value);
  if (normalized.length !== 1) {
    throw new CommandError(`Expected exactly one collection status, received: ${value}`);
  }
  return normalized[0];
}

function normalizeCollectionSort(value) {
  if (value === undefined || value === null || value === "") {
    return "updated";
  }

  const normalized = String(value).toLowerCase();
  const aliases = {
    score: "community_score",
    community: "community_score",
    rating: "community_score",
    my_score: "user_score",
    user: "user_score",
  };
  const resolved = aliases[normalized] ?? normalized;

  if (!["updated", "name", "rank", "community_score", "user_score", "date"].includes(resolved)) {
    throw new CommandError(`Unsupported sort field: ${value}`);
  }
  return resolved;
}

function normalizeSortOrder(value) {
  if (value === undefined || value === null || value === "") {
    return "desc";
  }

  const normalized = String(value).toLowerCase();
  if (!["asc", "desc"].includes(normalized)) {
    throw new CommandError(`Unsupported sort order: ${value}`);
  }
  return normalized;
}

async function fetchAllCollections(client, username) {
  const pageSize = 100;
  let offset = 0;
  let total = 0;
  const all = [];

  while (true) {
    const page = await client.listCollections(username, {
      limit: pageSize,
      offset,
    });

    const data = Array.isArray(page.data) ? page.data : [];
    total = page.total ?? total;
    all.push(...data);

    if (data.length === 0 || data.length < pageSize) {
      break;
    }

    offset += data.length;

    if (total && all.length >= total) {
      break;
    }
  }

  return {
    data: all,
    total: total || all.length,
    limit: pageSize,
    offset: 0,
  };
}

function sortCollections(items, sort, order) {
  const factor = order === "asc" ? 1 : -1;
  const list = [...items];

  list.sort((left, right) => {
    const leftValue = getCollectionSortValue(left, sort);
    const rightValue = getCollectionSortValue(right, sort);

    if (leftValue < rightValue) {
      return -1 * factor;
    }
    if (leftValue > rightValue) {
      return 1 * factor;
    }

    return compareStrings(
      left?.subject?.name_cn || left?.subject?.name || "",
      right?.subject?.name_cn || right?.subject?.name || "",
    ) * factor;
  });

  return list;
}

function sortSubjectsByRank(subjects) {
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

function getCollectionSortValue(item, sort) {
  switch (sort) {
    case "name":
      return String(item?.subject?.name_cn || item?.subject?.name || "").toLowerCase();
    case "rank":
      return Number(item?.subject?.rank || Number.MAX_SAFE_INTEGER);
    case "community_score":
      return Number(item?.subject?.score || -1);
    case "user_score":
      return Number(item?.rate || -1);
    case "date":
      return String(item?.subject?.date || "");
    case "updated":
    default:
      return String(item?.updated_at || "");
  }
}

function compareStrings(left, right) {
  return String(left).localeCompare(String(right), "zh-Hans-CN");
}

function parseOptionalInteger(value) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const parsed = Number.parseInt(String(value), 10);
  if (Number.isNaN(parsed)) {
    throw new CommandError(`Expected integer, received: ${value}`);
  }
  return parsed;
}

function normalizeNonNegativeInteger(value, label) {
  const parsed = parseOptionalInteger(value);
  if (parsed === undefined) {
    return undefined;
  }
  if (parsed < 0) {
    throw new CommandError(`Expected ${label} to be >= 0, received: ${value}`);
  }
  return parsed;
}

function normalizeRateValue(value) {
  const parsed = parseOptionalInteger(value);
  if (parsed === undefined || parsed < 0 || parsed > 10) {
    throw new CommandError(`Expected rate to be between 0 and 10, received: ${value}`);
  }
  return parsed;
}

function parseOptionalBoolean(value) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (typeof value === "boolean") {
    return value;
  }

  const normalized = String(value).toLowerCase();
  if (["true", "1", "yes", "y"].includes(normalized)) {
    return true;
  }
  if (["false", "0", "no", "n"].includes(normalized)) {
    return false;
  }

  throw new CommandError(`Expected boolean, received: ${value}`);
}

function toBoolean(value, fallback) {
  if (value === undefined) {
    return fallback;
  }
  return parseOptionalBoolean(value);
}

function hasHelpFlag(args) {
  return args.includes("--help") || args.includes("-h") || args[0] === "help";
}

function renderTuiHeader() {
  clearScreen();
  const width = 72;
  console.log(drawBoxLine("top", width));
  console.log(drawBoxText("bgm-cli TUI", width));
  console.log(drawBoxLine("mid", width));
  const infoLines = [
    `Config: ${getConfigFilePath()}`,
    "Keys: Up/Down move | Enter confirm | q quit",
  ];
  for (const line of drawBoxColumns(infoLines, BANGUMI_TV_ASCII, width)) {
    console.log(line);
  }
  console.log(drawBoxLine("bottom", width));
  console.log("");
}

function renderTuiInputScreen(label, defaultValue, description) {
  renderTuiHeader();
  console.log(drawSectionTitle(label));
  console.log(drawDivider());
  if (description) {
    console.log(description);
    console.log("");
  }
  if (defaultValue !== undefined && defaultValue !== null && defaultValue !== "") {
    console.log(`Press Enter to use the default value: ${defaultValue}`);
  } else {
    console.log("Type a value and press Enter.");
  }
  console.log("");
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
  let index = Math.max(0, options.findIndex((choice) => choice.selected));
  if (index === -1) {
    index = 0;
  }

  return new Promise((resolve, reject) => {
    const wasRaw = Boolean(process.stdin.isRaw);

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
      console.log("↑/↓ move  Enter confirm  q quit");
    };

    const onKeypress = (_str, key = {}) => {
      if (key.name === "up" || key.name === "k") {
        index = index > 0 ? index - 1 : options.length - 1;
        render();
        return;
      }
      if (key.name === "down" || key.name === "j") {
        index = index < options.length - 1 ? index + 1 : 0;
        render();
        return;
      }
      if (key.name === "return" || key.name === "enter") {
        cleanup();
        resolve(options[index].value);
        return;
      }
      if (key.name === "q" || key.name === "escape") {
        cleanup();
        resolve("exit");
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
    render();
  });
}

function clearScreen() {
  process.stdout.write("\x1Bc");
}

function inverse(value) {
  return `\x1b[7m${value}\x1b[0m`;
}

function drawDivider(width = 72) {
  return "─".repeat(width);
}

function drawSectionTitle(title) {
  return `[ ${title} ]`;
}

function drawBoxLine(position, width) {
  const inner = "─".repeat(Math.max(0, width - 2));
  switch (position) {
    case "top":
      return `┌${inner}┐`;
    case "mid":
      return `├${inner}┤`;
    case "bottom":
      return `└${inner}┘`;
    default:
      return `│${inner}│`;
  }
}

function drawBoxText(text, width) {
  const innerWidth = Math.max(0, width - 2);
  const value = String(text);
  const clipped = value.length > innerWidth ? `${value.slice(0, innerWidth - 3)}...` : value;
  return `│${clipped.padEnd(innerWidth, " ")}│`;
}

// Banner provided by user, adapted from Bangumi 2025 console output.
const BANGUMI_TV_ASCII = [
  " ____    _    _   _  ____ _   _ __  __ ___ ",
  "| __ )  / \\  | \\ | |/ ___| | | |  \\/  |_ _|",
  "|  _ \\/ _ \\ |  \\| | |  _| | | | |\\/| || | ",
  "| |_) / ___ \\| |\\  | |_| | |_| | |  | || | ",
  "|____/_/   \\_\\_| \\_|\\____|\\___/|_|  |_|___|",
];

function drawBoxColumns(leftLines, rightLines, width, gap = 2) {
  const innerWidth = Math.max(0, width - 2);
  const left = Array.isArray(leftLines) ? leftLines : [];
  const right = Array.isArray(rightLines) ? rightLines : [];
  const totalRows = Math.max(left.length, right.length, 1);
  const rightWidth = right.reduce((max, line) => Math.max(max, getVisibleWidth(line)), 0);
  const leftWidth = Math.max(0, innerWidth - rightWidth - gap);
  const leftOffset = Math.max(0, Math.floor((totalRows - left.length) / 2));
  const rightOffset = Math.max(0, Math.floor((totalRows - right.length) / 2));
  const rows = [];

  for (let index = 0; index < totalRows; index += 1) {
    const leftIndex = index - leftOffset;
    const rightIndex = index - rightOffset;
    const leftText = leftIndex >= 0 && leftIndex < left.length ? left[leftIndex] : "";
    const rightText = rightIndex >= 0 && rightIndex < right.length ? right[rightIndex] : "";
    const clippedLeft = clipBoxSegment(leftText, leftWidth);
    rows.push(`│${padVisibleEnd(clippedLeft, leftWidth)}${" ".repeat(gap)}${padVisibleEnd(rightText, rightWidth)}│`);
  }

  return rows;
}

function clipBoxSegment(text, width) {
  const value = String(text ?? "");
  if (value.length <= width) {
    return value;
  }
  if (width <= 3) {
    return ".".repeat(width);
  }
  return `${value.slice(0, width - 3)}...`;
}

function getVisibleWidth(text) {
  return String(text ?? "").length;
}

function padVisibleEnd(text, width) {
  const value = String(text ?? "");
  const padding = Math.max(0, width - getVisibleWidth(value));
  return `${value}${" ".repeat(padding)}`;
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

async function browseSubjectResults(result, context, criteria = {}) {
  const client = new BangumiClient(getConfig());
  const subjects = Array.isArray(result?.data) ? result.data : [];
  const summary = formatCriteriaSummary(criteria);

  if (subjects.length === 0) {
    renderTuiResultScreen("Subject results", formatDisplayResult(result, context), summary);
    return;
  }

  while (true) {
    const choice = await askMenuChoice(
      "Subject results",
      [
        ...subjects.map((subject, index) => ({
          key: String(index + 1),
          label: formatSubjectMenuLabel(subject),
          value: String(index),
        })),
        { key: "0", label: "Back", value: "back" },
      ],
      "0",
      { summary },
    );

    if (choice === "exit" || choice === "back") {
      return;
    }

    const subject = subjects[Number(choice)];
    if (!subject) {
      continue;
    }

    const detail = await client.getSubject(subject.id);
    renderTuiResultScreen("Subject detail", formatDisplayResult(detail, context));
    await waitForTuiContinue();
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

  while (true) {
    const choice = await askMenuChoice(
      "Collection results",
      [
        ...items.map((item, index) => ({
          key: String(index + 1),
          label: formatCollectionMenuLabel(item),
          value: String(index),
        })),
        { key: "0", label: "Back", value: "back" },
      ],
      "0",
      { summary },
    );

    if (choice === "exit" || choice === "back") {
      return;
    }

    const item = items[Number(choice)];
    if (!item?.subject_id) {
      continue;
    }

    const detail = await client.getSubject(item.subject_id);
    renderTuiResultScreen("Subject detail", formatDisplayResult(detail, context));
    await waitForTuiContinue();
  }
}

function renderTuiResultScreen(title, content, summary = "") {
  renderTuiHeader();
  console.log(drawSectionTitle(title));
  console.log(drawDivider());
  if (summary) {
    console.log(summary);
    console.log(drawDivider());
  }
  console.log(content);
}

function formatCriteriaSummary(criteria) {
  const entries = Object.entries(criteria).filter(([, value]) => value !== undefined && value !== "");
  if (entries.length === 0) {
    return "";
  }

  const lines = ["Criteria"];
  for (const [key, value] of entries) {
    lines.push(`  ${key}: ${value}`);
  }
  return lines.join("\n");
}

function formatSubjectMenuLabel(subject) {
  const parts = [
    `[${formatSubjectTypeLabel(subject?.type)}]`,
    subject?.name_cn || subject?.name || "-",
  ];

  if (subject?.rating?.rank) {
    parts.push(`#${subject.rating.rank}`);
  } else {
    parts.push("unranked");
  }

  if (subject?.rating?.score !== undefined) {
    parts.push(`score ${subject.rating.score}`);
  }

  return parts.join("  ");
}

function formatCollectionMenuLabel(item) {
  const subject = item?.subject ?? {};
  const parts = [
    `[${formatCollectionStatusLabel(item?.type)}]`,
    `[${formatSubjectTypeLabel(item?.subject_type ?? subject?.type)}]`,
    subject?.name_cn || subject?.name || "-",
  ];

  if (subject?.rank) {
    parts.push(`#${subject.rank}`);
  } else {
    parts.push("unranked");
  }

  if (item?.rate) {
    parts.push(`my ${item.rate}`);
  }

  return parts.join("  ");
}

function formatSubjectTypeLabel(type) {
  const map = {
    1: "书籍",
    2: "动画",
    3: "音乐",
    4: "游戏",
    6: "三次元",
  };
  return map[type] ?? String(type ?? "-");
}

function formatCollectionStatusLabel(type) {
  const map = {
    1: "想看",
    2: "看过",
    3: "在看",
    4: "搁置",
    5: "抛弃",
  };
  return map[type] ?? String(type ?? "-");
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

function ensureExecutable(filePath) {
  try {
    chmodSync(filePath, 0o755);
  } catch {
    // Best effort only. If chmod fails, the installer may still succeed on systems
    // where executable bits are already correct.
  }
}

function formatPlatformName(platform) {
  switch (platform) {
    case "darwin":
      return "macOS";
    case "win32":
      return "Windows";
    default:
      return "Linux";
  }
}

function getShellReloadHint() {
  if (process.platform === "win32") {
    return "Restart PowerShell or CMD, then run `bgm --help`.";
  }

  const shell = process.env.SHELL ?? "";
  if (shell.includes("zsh")) {
    return "Run `source ~/.zshrc`, then run `bgm --help`.";
  }
  if (shell.includes("bash")) {
    return "Run `source ~/.bashrc`, then run `bgm --help`.";
  }
  return "Reload your shell configuration, then run `bgm --help`.";
}

async function askRequired(rl, label, defaultValue) {
  const value = await askOptional(rl, label, defaultValue);
  if (!value) {
    throw new CommandError(`Missing required value: ${label}`);
  }
  return value;
}

async function askOptional(rl, label, defaultValue) {
  const suffix = defaultValue ? ` [${defaultValue}]` : "";
  const answer = await rl.question(`${label}${suffix}: `);
  const value = answer.trim();
  if (value) {
    return value;
  }
  return defaultValue ?? "";
}

async function askChoice(rl, label, choices, defaultKey) {
  console.log(`${label}:`);
  for (const choice of choices) {
    console.log(`  ${choice.key}. ${choice.label}`);
  }

  const answer = await askOptional(rl, "Choose", defaultKey);
  const normalized = String(answer).trim() || defaultKey;
  const matched = choices.find(
    (choice) =>
      choice.key === normalized || choice.value === normalized.toLowerCase(),
  );

  if (!matched) {
    throw new CommandError(`Invalid option: ${answer}`);
  }

  return matched.value;
}

function extractAuthorizationInput(rawValue) {
  const value = String(rawValue ?? "").trim();
  if (!value) {
    return { kind: "none", value: "" };
  }

  if (value.startsWith("http://") || value.startsWith("https://")) {
    const url = new URL(value);
    const code = url.searchParams.get("code");
    if (!code) {
      throw new CommandError("Callback URL does not contain a code query parameter.");
    }
    return { kind: "code", value: code };
  }

  if (looksLikeToken(value)) {
    return { kind: "token", value };
  }

  return { kind: "code", value };
}

function looksLikeToken(value) {
  return value.length > 32 && !/[/?=&]/.test(value);
}

function createState() {
  return `bgm-cli-${Date.now().toString(36)}`;
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

function isLocalRedirectUri(redirectUri) {
  try {
    const url = new URL(redirectUri);
    return ["127.0.0.1", "localhost"].includes(url.hostname);
  } catch {
    return false;
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
    const status = await backend.getSession(session.session_id);

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

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function respondHtml(res, statusCode, statusMessage, body) {
  res.writeHead(statusCode, statusMessage, {
    "Content-Type": "text/html; charset=utf-8",
  });
  res.end(`<!doctype html><html><body>${body}</body></html>`);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeConfigKey(key) {
  const aliasMap = {
    clientid: "clientId",
    clientsecret: "clientSecret",
    redirecturi: "redirectUri",
    oauthserverbaseurl: "oauthServerBaseUrl",
    accesstoken: "accessToken",
    refreshtoken: "refreshToken",
    tokentype: "tokenType",
    useragent: "userAgent",
  };

  const condensed = String(key).replace(/[-_]/g, "").toLowerCase();
  const normalized = aliasMap[condensed];
  if (!normalized) {
    throw new CommandError(`Unsupported config key: ${key}`);
  }
  return normalized;
}

function previewToken(token) {
  const value = String(token);
  if (value.length <= 10) {
    return value;
  }
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function toCamelCase(value) {
  return String(value).replace(/-([a-z])/g, (_, char) => char.toUpperCase());
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
    process.exitCode = 1;
    return;
  }

  console.error(error);
  process.exitCode = 1;
});
