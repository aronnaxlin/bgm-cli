#!/usr/bin/env node

import http from "node:http";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { chmodSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import readline from "node:readline/promises";
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
import { summarizeCurrentStatus } from "./utils/status.js";
import { runTui } from "./commands/tui.js";
import { runCalendarCommand } from "./commands/calendar.js";
import { runStatusCommand } from "./commands/status.js";
import { runUserCommand } from "./commands/user.js";
import { runSubjectCommand } from "./commands/subject.js";
import { runCollectionCommand } from "./commands/collection.js";
import { runEpisodeCommand } from "./commands/episode.js";
import { runIndexCommand } from "./commands/index.js";
import { runBlogCommand } from "./commands/blog.js";
import { runTimelineCommand } from "./commands/timeline.js";
import { runGroupCommand } from "./commands/group.js";

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
      await runTui(context, { runConfigCommand, runSetupCommand });
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
