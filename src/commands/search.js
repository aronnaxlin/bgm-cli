/**
 * Search command group — powered by the SearchEncore API.
 *
 * ⚠️  All commands in this group use the SearchEncore service at bgmdb.ry.mk.
 * Results are crawled/aggregated data, NOT from bangumi.tv official sources.
 * Every response carries _meta.isSearchEncore = true.
 *
 * This module is intentionally isolated from official API command groups
 * (subject, user, group, etc.) to avoid path collisions.
 */

import {
  searchSubjects,
  searchUsers,
  searchGroups,
  searchReplies,
  searchGroupTopics,
  searchSubjectTopics,
  searchIndexes,
  searchBlogs,
} from "../core/community-api.js";
import { CommandError, printResult } from "../core/output.js";
import { firstPositional, parseFlags, splitFilterValues } from "../utils/args.js";
import {
  normalizeNonNegativeInteger,
  normalizePageSize,
  parseOptionalBoolean,
} from "../utils/helpers.js";
import { normalizeSubjectTypeName } from "../utils/validators.js";

export async function runSearchCommand(command, args, context) {
  switch (command) {
    case "subject":
    case "subjects": {
      const result = await executeEntitySearch("subjects", args, searchSubjects, { allowSubjectType: true });
      printResult(result, context);
      return;
    }
    case "user":
    case "users": {
      const result = await executeEntitySearch("users", args, searchUsers);
      printResult(result, context);
      return;
    }
    case "group":
    case "groups": {
      const result = await executeEntitySearch("groups", args, searchGroups);
      printResult(result, context);
      return;
    }
    case "topic":
    case "topics":
    case "group-topic":
    case "group-topics": {
      const result = await executeEntitySearch("group-topics", args, searchGroupTopics);
      printResult(result, context);
      return;
    }
    case "subject-topic":
    case "subject-topics": {
      const result = await executeEntitySearch("subject-topics", args, searchSubjectTopics);
      printResult(result, context);
      return;
    }
    case "reply":
    case "replies": {
      const result = await executeEntitySearch("replies", args, searchReplies, { allowSource: true });
      printResult(result, context);
      return;
    }
    case "index":
    case "indexes": {
      const result = await executeEntitySearch("indexes", args, searchIndexes);
      printResult(result, context);
      return;
    }
    case "blog":
    case "blogs": {
      const result = await executeEntitySearch("blogs", args, searchBlogs);
      printResult(result, context);
      return;
    }
    default:
      throw new CommandError(
        "Usage: bgm search <subject|user|group|topic|subject-topic|reply|index|blog> <keyword> [--limit n] [--offset n] [--sort <sort>] [--user <name>] [--group <slug>] [--exact] [--include <nsfw|blocked>] [--exclude nsfw] [--type <type>] [--source <source>]",
      );
  }
}

const REPLY_SOURCES = new Set([
  "all", "group", "subject", "episode", "ep", "character", "crt", "person", "prsn", "blog",
]);

// SearchEncore 内联指令的合法取值（写入 q，而非独立 query 参数）。
const DIRECTIVE_INCLUDE_VALUES = new Set(["nsfw", "blocked"]);
const DIRECTIVE_EXCLUDE_VALUES = new Set(["nsfw"]);

function directiveValues(flag, flagName, { allowed, lowercase = true } = {}) {
  if (flag === undefined) {
    return [];
  }
  if (flag === true) {
    throw new CommandError(`--${flagName} requires a value.`);
  }

  return splitFilterValues(flag).map((entry) => {
    const raw = String(entry);
    const value = lowercase ? raw.toLowerCase() : raw;
    if (allowed && !allowed.has(value)) {
      throw new CommandError(
        `Invalid --${flagName}: ${entry}. Use one of: ${[...allowed].join(", ")}.`,
      );
    }
    return value;
  });
}

async function executeEntitySearch(resource, args, searchFn, { allowSource = false, allowSubjectType = false } = {}) {
  const options = parseFlags(args);
  const rawKeyword = firstPositional(options);
  if (!rawKeyword) {
    throw new CommandError(
      `Usage: bgm search ${resource} <keyword> [--limit n] [--offset n] [--sort <sort>] [--user <name>] [--group <slug>] [--exact] [--include <nsfw|blocked>] [--exclude nsfw]${allowSubjectType ? " [--type <book|anime|music|game|real>]" : ""}${allowSource ? " [--source <source>]" : ""}`,
    );
  }

  // 通用指令：用户名/组 slug 保留原始大小写，不做小写归一化。
  const users = directiveValues(options.user, "user", { lowercase: false });
  const groups = directiveValues(options.group, "group", { lowercase: false });
  const includes = directiveValues(options.include, "include", { allowed: DIRECTIVE_INCLUDE_VALUES });
  const excludes = directiveValues(options.exclude, "exclude", { allowed: DIRECTIVE_EXCLUDE_VALUES });
  const exact = parseOptionalBoolean(options.exact);

  // --type 只对 subject 资源生效；其他资源传了会被忽略（与服务端忽略不适用指令的语义一致）。
  const subjectTypes = allowSubjectType
    ? directiveValues(options.type, "type").map((entry) => normalizeSubjectTypeName(entry))
    : [];

  const directives = [
    ...users.map((name) => `user:${name}`),
    ...groups.map((slug) => `group:${slug}`),
    ...subjectTypes.map((name) => `type:${name}`),
    ...includes.map((value) => `include:${value}`),
    ...excludes.map((value) => `exclude:${value}`),
    ...(exact === true ? ["exact:true"] : []),
  ];
  const keyword = directives.length > 0 ? `${rawKeyword} ${directives.join(" ")}` : rawKeyword;

  const query = {
    q: keyword,
    limit: normalizePageSize(options.limit),
    offset: normalizeNonNegativeInteger(options.offset, "offset"),
  };
  if (options.sort) {
    query.sort = options.sort;
  }

  if (allowSource && options.source) {
    const source = String(options.source).toLowerCase();
    if (!REPLY_SOURCES.has(source)) {
      throw new CommandError(
        "Invalid --source. Use one of: all, group, subject, episode (ep), character (crt), person (prsn), blog.",
      );
    }
    query.source = source;
  }

  const result = await searchFn(query);

  return {
    ...result,
    resource: `community-${resource}`,
    title: `SearchEncore: ${resource}`,
    filters: {
      keyword: rawKeyword,
      limit: query.limit,
      offset: query.offset,
      sort: query.sort,
      ...(users.length > 0 ? { user: users } : {}),
      ...(groups.length > 0 ? { group: groups } : {}),
      ...(subjectTypes.length > 0 ? { type: subjectTypes } : {}),
      ...(includes.length > 0 ? { include: includes } : {}),
      ...(excludes.length > 0 ? { exclude: excludes } : {}),
      ...(exact === true ? { exact: true } : {}),
      ...(query.source ? { source: query.source } : {}),
    },
  };
}
