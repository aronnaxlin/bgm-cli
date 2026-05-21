import { BangumiClient } from "../core/client.js";
import { getConfig } from "../core/config.js";
import { CommandError, printResult } from "../core/output.js";
import { ensureArray, firstPositional, parseFlags } from "../utils/args.js";
import { parseOptionalBoolean, parseOptionalInteger } from "../utils/helpers.js";
import { normalizeSubjectType } from "../utils/validators.js";
import { fetchAllSubjects, sortSubjectsByRank } from "../utils/collection.js";

export async function runSubjectCommand(command, args, context) {
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

export async function executeSubjectListCommand(args) {
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

export async function executeSubjectSearchCommand(args) {
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
