#!/usr/bin/env node

import http from "node:http";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { chmodSync } from "node:fs";
import readline from "node:readline/promises";
import { fileURLToPath } from "node:url";
import { BangumiClient, BangumiOAuthClient, OAuthBackendClient } from "./core/client.js";
import {
  clearConfigValue,
  getConfig,
  getConfigFilePath,
  setConfigValues,
} from "./core/config.js";
import { CommandError, printResult, printUsage } from "./core/output.js";

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
      "请选择登录方式",
      [
        {
          key: "1",
          label: "填写用户自己的 access token (Recommended)",
          value: "token",
        },
        {
          key: "2",
          label: hasHostedOAuthBackend
            ? "使用项目 OAuth 服务网页授权 (Experimental, Not Recommended)"
            : hasBundledOAuthApp
              ? "使用项目内置开发者应用网页授权 (Experimental, Not Recommended)"
              : "网页登录授权 (Experimental, Not Recommended)",
          value: "web",
        },
      ],
      "1",
    );

    const userAgent = currentConfig.userAgent ?? fallbackUserAgent(currentConfig);

    if (authMode === "token") {
      const confirmedUserAgent = userAgent;
      console.log("将使用以下 User-Agent：");
      console.log(confirmedUserAgent);
      console.log("");
      console.log("获取 Access Token 的推荐步骤：");
      console.log("1. 在浏览器中登录 Bangumi");
      console.log("2. 打开 Access Token 获取页面");
      console.log("3. 复制你的 token，回到这里粘贴");
      console.log("");
      console.log("Access Token 页面：");
      console.log("https://next.bgm.tv/demo/access-token");
      console.log("");
      console.log("如果你暂时不想继续，可以直接按 Ctrl+C 退出。");
      console.log("");

      await setConfigValues({
        userAgent: confirmedUserAgent,
      });

      if (currentConfig.accessToken) {
        console.log("检测到本地已经保存过 Access Token。");
        console.log("如果你要替换它，请直接输入新的 token。");
        console.log("如果你不想修改，按 Ctrl+C 退出即可。");
        console.log("");
      }

      const manualToken = await askRequired(rl, "请输入 Access Token");
      await setConfigValues({
        accessToken: manualToken,
        tokenType: "Bearer",
        userAgent: confirmedUserAgent,
      });
      console.log("Access Token 已保存。");

      const installPathChoice = await askChoice(
        rl,
        "可选：建议把当前仓库加入 PATH，之后你就可以在任意目录直接运行 bgm",
        [
          {
            key: "1",
            label: "现在执行全局命令安装 (Recommended)",
            value: "install",
          },
          {
            key: "2",
            label: "暂时跳过",
            value: "skip",
          },
        ],
        "1",
      );

      if (installPathChoice === "install") {
        console.log("");
        printResult(runInstallPathSetup(), context);
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
              label: "自动接收回调参数 (Recommended)",
              value: "auto",
            },
            {
              key: "2",
              label: "手动粘贴回调 URL / code",
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
  console.log("将使用项目内置的托管 OAuth 后端。");
  console.log(`OAuth 服务地址：${config.oauthServerBaseUrl}`);
  console.log("");
  console.log("警告：Bangumi 托管 OAuth 当前属于实验性功能，而且并不稳定。");
  console.log("除非你明确是在测试这条链路，否则不要使用它。");
  console.log("");
  console.log("如果你仍然要测试它，请先确保浏览器已经登录 Bangumi。");
  console.log("继续前请先完成：");
  console.log("1. 在浏览器打开 https://bangumi.tv");
  console.log("2. 先完成登录");
  console.log("3. 后面必须在同一个浏览器会话里打开授权链接");
  console.log("");

  const browserReady = await askChoice(
    rl,
    "浏览器登录确认",
    [
      {
        key: "1",
        label: "我已经在当前浏览器会话里登录了 bangumi.tv",
        value: "ready",
      },
      {
        key: "2",
        label: "先停在这里，我去浏览器登录后再重试",
        value: "stop",
      },
    ],
    "1",
  );

  if (browserReady !== "ready") {
    console.log("");
    console.log("请先在 https://bangumi.tv 完成登录，然后重新运行 `./bgm --init`。");
    return;
  }

  console.log("");

  const backend = new OAuthBackendClient({
    ...config,
    userAgent,
  });

  const session = await backend.createSession();

  console.log("请在浏览器中打开下面的链接并完成授权：");
  console.log(session.authorize_url);
  console.log("");
  console.log("Bangumi 账号和密码只会输入在 Bangumi 官方网站，不会输入在这个 CLI 中。");
  console.log("请务必使用刚才已经登录了 https://bangumi.tv 的同一个浏览器会话。");
  console.log("CLI 会持续轮询 OAuth 后端，直到授权完成。");
  console.log("");

  const token = await waitForHostedOAuthAuthorization(backend, session);

  await setConfigValues({
    accessToken: token.access_token,
    refreshToken: token.refresh_token ?? null,
    tokenType: token.token_type ?? "Bearer",
    userAgent,
  });

  console.log("授权完成，Token 已保存。");
  printResult(token, context);
}

async function runConfigCommand(command, args, context) {
  switch (command) {
    case "show": {
      printResult(
        {
          configFile: getConfigFilePath(),
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

async function runSetupCommand(command, args, context) {
  switch (command) {
    case "install-path": {
      printResult(runInstallPathSetup(), context);
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
  const options = parseFlags(args);
  const client = new BangumiClient(getConfig());

  switch (command) {
    case "get": {
      const subjectId = firstPositional(options);
      if (!subjectId) {
        throw new CommandError("Usage: bgm subject get <subject_id>");
      }

      const subject = await client.getSubject(subjectId);
      printResult(subject, context);
      return;
    }
    case "list": {
      const type = normalizeSubjectType(options.type);
      if (!type) {
        throw new CommandError("Usage: bgm subject list --type <book|anime|music|game|real> [options]");
      }

      const subjects = await client.listSubjects({
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
      printResult(subjects, context);
      return;
    }
    case "search": {
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
  const options = parseFlags(args);
  const client = new BangumiClient(getConfig());

  switch (command) {
    case "list": {
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

      result = {
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

      printResult(result, context);
      return;
    }
    default:
      throw new CommandError(
        "Usage: bgm collection list [--user <username>] [--status <wish|collect|doing|on_hold|dropped>] [--type <book|anime|music|game|real>] [--sort <updated|name|rank|community_score|user_score|date>] [--order <asc|desc>] [--limit n]",
      );
  }
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

function runInstallPathSetup() {
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
    throw new CommandError(`执行全局命令安装失败：${result.error.message}`);
  }

  const stdout = String(result.stdout ?? "").trim();
  const stderr = String(result.stderr ?? "").trim();

  if (result.status !== 0) {
    throw new CommandError(
      [
        "执行全局命令安装失败。",
        stdout,
        stderr,
      ].filter(Boolean).join("\n"),
    );
  }

  return {
    action: "install-path",
    platform: formatPlatformName(process.platform),
    repoDir,
    shellHint: getShellReloadHint(),
    output: stdout || "安装脚本已执行完成。",
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
    return "请重启 PowerShell 或 CMD，然后执行 `bgm --help`。";
  }

  const shell = process.env.SHELL ?? "";
  if (shell.includes("zsh")) {
    return "请执行 `source ~/.zshrc`，然后运行 `bgm --help`。";
  }
  if (shell.includes("bash")) {
    return "请执行 `source ~/.bashrc`，然后运行 `bgm --help`。";
  }
  return `请重新加载你的 shell 配置文件，然后运行 \`bgm --help\`。`;
}

async function askRequired(rl, label, defaultValue) {
  const value = await askOptional(rl, label, defaultValue);
  if (!value) {
    throw new CommandError(`缺少必填项：${label}`);
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

  const answer = await askOptional(rl, "请选择", defaultKey);
  const normalized = String(answer).trim() || defaultKey;
  const matched = choices.find(
    (choice) =>
      choice.key === normalized || choice.value === normalized.toLowerCase(),
  );

  if (!matched) {
    throw new CommandError(`无效选项：${answer}`);
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
