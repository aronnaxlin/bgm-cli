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
import { BangumiClient, BangumiOAuthClient } from "./core/client.js";
import { getInstalledProxy, installProxyFromConfig, resolveProxyUrl } from "./core/proxy.js";
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
  extractPrivateSessionId,
  fallbackUserAgent,
  getPrivateLoginUrl,
} from "./utils/auth.js";
import {
  getManagedInstallDir,
  getShellReloadHint,
  getUpdateShellHint,
} from "./utils/install.js";
import {
  askChoice,
  askHiddenRequired,
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
import { runCharacterCommand } from "./commands/character.js";
import { runPersonCommand } from "./commands/person.js";
import { runTrendingCommand } from "./commands/trending.js";
import { runNotifyCommand } from "./commands/notify.js";

const CLI_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(CLI_DIR, "..");

const REMOTE_INSTALL_SCRIPT_BASE_URL = "https://raw.githubusercontent.com/aronnaxlin/bgm-cli/main/scripts";
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

  try {
    installProxyFromConfig(getConfig());
  } catch (error) {
    process.stderr.write(`Warning: ${error?.message ?? error}\n`);
  }

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
    case "proxy":
      await runProxyCommand(command, rest, context);
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
    case "character":
      await runCharacterCommand(command, rest, context);
      return;
    case "person":
      await runPersonCommand(command, rest, context);
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
    case "trending":
      await runTrendingCommand(command, rest, context);
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
    case "notify":
      await runNotifyCommand(command, rest, context);
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
  let rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    console.log("Bangumi CLI initialization");
    console.log(`Config file: ${getConfigFilePath()}`);
    console.log("");

    const authMode = await askChoice(
      rl,
      "Choose a login method",
      [
        {
          key: "1",
          label: "Official Bangumi login (Recommended)",
          value: "login",
        },
        {
          key: "2",
          label: "Paste your own Access Token",
          value: "token",
        },
      ],
      "1",
    );

    const userAgent = currentConfig.userAgent ?? fallbackUserAgent(currentConfig);

    await setConfigValues({
      userAgent,
    });

    if (authMode === "login") {
      const loginArgs = [];
      if (getSavedPrivateSessionId(currentConfig)) {
        const replaceChoice = await askChoice(
          rl,
          "A private session is already saved",
          [
            {
              key: "1",
              label: "Keep the current session (Recommended)",
              value: "keep",
            },
            {
              key: "2",
              label: "Replace it with a new official login",
              value: "replace",
            },
          ],
          "1",
        );

        if (replaceChoice === "keep") {
          console.log("Keeping the current private session.");
          await promptInstallPathSetup(context, rl);
          return;
        }

        loginArgs.push("--force");
      }

      console.log("");
      console.log("Starting official Bangumi login.");
      console.log("This is the same flow as `bgm auth login`: email, hidden password prompt, and official Turnstile verification.");
      console.log("");
      rl.close();
      rl = null;
      await runAuthCommand("login", loginArgs, context);
      await promptInstallPathSetup(context);
      return;
    }

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

      await promptInstallPathSetup(context, rl);
      return;
    }
  } finally {
    if (rl) {
      rl.close();
    }
  }
}

async function promptInstallPathSetup(context, existingReadline) {
  const rl = existingReadline ?? readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
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
  } finally {
    if (!existingReadline) {
      rl.close();
    }
  }
}

async function runConfigCommand(command, args, context) {
  switch (command) {
    case "show": {
      const config = getConfig();
      const proxy = resolveProxyUrl(config);
      printResult(
        {
          configFile: getConfigFilePath(),
          configSourceFile: getConfigSourceFilePath(),
          config,
          effectiveProxy: {
            url: proxy.url || null,
            source: proxy.source,
            active: Boolean(getInstalledProxy()),
          },
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

async function runProxyCommand(command, args, context) {
  switch (command) {
    case undefined:
    case "show": {
      const proxy = resolveProxyUrl(getConfig());
      printResult(
        {
          proxy: {
            url: proxy.url || null,
            source: proxy.source,
            active: Boolean(getInstalledProxy()),
          },
        },
        context,
      );
      return;
    }
    case "set": {
      const [url] = args;
      if (!url) {
        throw new CommandError("Usage: bgm proxy set <url>");
      }

      const normalizedValue = normalizeConfigValue("proxy", url);
      await setConfigValues({ proxy: normalizedValue });
      printResult(
        {
          updated: "proxy",
          configFile: getConfigFilePath(),
          value: normalizedValue,
        },
        context,
      );
      return;
    }
    case "unset": {
      await clearConfigValue("proxy");
      printResult(
        {
          removed: "proxy",
          configFile: getConfigFilePath(),
        },
        context,
      );
      return;
    }
    default:
      throw new CommandError("Usage: bgm proxy <show|set|unset> ...");
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
    case "login": {
      const savedSessionId = getSavedPrivateSessionId(config);
      if (savedSessionId && !toBoolean(options.force, false)) {
        throw new CommandError("Private session is already saved. Run `bgm auth status` to inspect it, `bgm auth logout` to end it, or `bgm auth login --force` to replace it.");
      }

      const { email, password } = await resolveOfficialLoginCredentials(options, context);
      let turnstileToken = typeof options.turnstileToken === "string" ? options.turnstileToken.trim() : "";
      if (!turnstileToken) {
        const result = await acquireTurnstileToken(options, context, {
          actionLabel: "log in to Bangumi private API",
        });
        turnstileToken = result.token;
      }

      const login = await new BangumiClient(config).login({
        email,
        password,
        turnstileToken,
      });
      if (!login.privateSessionId) {
        throw new CommandError("Bangumi login succeeded, but the response did not include chiiNextSessionID.");
      }

      await setConfigValues({
        privateSessionId: login.privateSessionId,
        privateSessionUpdatedAt: new Date().toISOString(),
      });

      printResult(
        {
          resource: "auth-login",
          saved: true,
          configFile: getConfigFilePath(),
          sessionPreview: previewToken(login.privateSessionId),
          user: login.user,
        },
        context,
      );
      return;
    }
    case "logout": {
      const sessionId = typeof config.privateSessionId === "string" ? config.privateSessionId.trim() : "";
      if (!sessionId) {
        throw new CommandError("No saved private API session. Run `bgm auth login` first, or use `bgm auth clear` to clear local auth state.");
      }

      await new BangumiClient(config).logout();
      await clearConfigValues(["privateSessionId", "privateSessionUpdatedAt"]);
      printResult(
        {
          resource: "auth-logout",
          clearedSession: true,
          configFile: getConfigFilePath(),
        },
        context,
      );
      return;
    }
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
      printResult(buildAuthStatusPayload(config), context);
      return;
    }
    case "token-status": {
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
          loginUrl: getPrivateLoginUrl(),
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
          loginUrl: getPrivateLoginUrl(),
        },
        context,
      );
      return;
    }
    case "clear": {
      const clearKeys = resolveAuthClearKeys(options);
      await clearConfigValues(clearKeys);
      printResult(
        {
          resource: "auth-clear",
          cleared: clearKeys,
          configFile: getConfigFilePath(),
        },
        context,
      );
      return;
    }
    default:
      throw new CommandError("Usage: bgm auth <login|logout|status|token-status|login-url|token|refresh|turnstile|session-login|set-token|set-session|session-status|clear> ...");
  }
}

async function resolveOfficialLoginCredentials(options, context) {
  let email = options.email ?? process.env.BGM_LOGIN_EMAIL;
  let password = options.password ?? process.env.BGM_LOGIN_PASSWORD;

  if ((!email || !password) && !context.json && process.stdin.isTTY && process.stdout.isTTY) {
    if (!email) {
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      try {
        email = email || await askRequired(rl, "Bangumi email");
      } finally {
        rl.close();
      }
    }
    if (!password) {
      password = await askHiddenRequired("Bangumi password");
    }
  }

  if (!email || !password) {
    throw new CommandError("Usage: bgm auth login [--email <email>] [--password <password>] [--turnstile-token <token>] [--manual]");
  }

  return {
    email,
    password,
  };
}

function buildAuthStatusPayload(config) {
  const accessToken = typeof config.accessToken === "string" ? config.accessToken.trim() : "";
  const refreshToken = typeof config.refreshToken === "string" ? config.refreshToken.trim() : "";
  const privateSession = getSavedPrivateSessionId(config);

  return {
    resource: "auth-status",
    configFile: getConfigFilePath(),
    policy: "p1 requests use the private session cookie when saved; Access Token is not sent together with it.",
    channels: {
      accessToken: {
        saved: Boolean(accessToken),
        tokenPreview: accessToken ? previewToken(accessToken) : null,
        refreshTokenSaved: Boolean(refreshToken),
        statusCommand: "bgm auth token-status",
        setCommand: "bgm auth set-token <access_token>",
      },
      privateSession: {
        saved: Boolean(privateSession),
        sessionPreview: privateSession ? previewToken(privateSession) : null,
        updatedAt: config.privateSessionUpdatedAt ?? null,
        loginCommand: "bgm auth login",
        logoutCommand: "bgm auth logout",
      },
    },
  };
}

function getSavedPrivateSessionId(config) {
  return typeof config.privateSessionId === "string" ? config.privateSessionId.trim() : "";
}

function resolveAuthClearKeys(options) {
  const clearToken = toBoolean(options.token, false) || options.channel === "token";
  const clearSession = toBoolean(options.session, false) || options.channel === "session";

  if (clearToken && clearSession) {
    return AUTH_CONFIG_KEYS;
  }

  if (clearToken) {
    return ["accessToken", "refreshToken", "tokenType", "clientId", "clientSecret", "redirectUri"];
  }

  if (clearSession) {
    return ["privateSessionId", "privateSessionUpdatedAt"];
  }

  return AUTH_CONFIG_KEYS;
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
    if (error.status === 401 && error.details?.code !== "CAPTCHA_ERROR") {
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
