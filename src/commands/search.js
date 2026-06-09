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
import { firstPositional, parseFlags } from "../utils/args.js";
import { normalizeNonNegativeInteger, normalizePageSize } from "../utils/helpers.js";

export async function runSearchCommand(command, args, context) {
  switch (command) {
    case "subject":
    case "subjects": {
      const result = await executeEntitySearch("subjects", args, searchSubjects);
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
      const result = await executeEntitySearch("replies", args, searchReplies);
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
        "Usage: bgm search <subject|user|group|topic|subject-topic|reply|index|blog> <keyword> [--limit n] [--offset n] [--sort <sort>]",
      );
  }
}

async function executeEntitySearch(resource, args, searchFn) {
  const options = parseFlags(args);
  const keyword = firstPositional(options);
  if (!keyword) {
    throw new CommandError(`Usage: bgm search ${resource} <keyword> [--limit n] [--offset n] [--sort <sort>]`);
  }

  const query = {
    q: keyword,
    limit: normalizePageSize(options.limit),
    offset: normalizeNonNegativeInteger(options.offset, "offset"),
  };
  if (options.sort) {
    query.sort = options.sort;
  }

  const result = await searchFn(query);

  return {
    ...result,
    resource: `community-${resource}`,
    title: `SearchEncore: ${resource}`,
    filters: {
      keyword,
      limit: query.limit,
      offset: query.offset,
      sort: query.sort,
    },
  };
}
