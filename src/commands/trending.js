import { BangumiClient } from "../core/client.js";
import { getConfig } from "../core/config.js";
import { CommandError, printResult } from "../core/output.js";
import { parseFlags } from "../utils/args.js";
import {
  normalizeNonNegativeInteger,
  normalizePageSize,
} from "../utils/helpers.js";
import { normalizeSubjectType } from "../utils/validators.js";

export async function runTrendingCommand(command, args, context) {
  switch (command) {
    case "subjects": {
      const result = await executeTrendingSubjectsCommand(args);
      printResult(result, context);
      return;
    }
    case "subject-topics":
    case "topics": {
      const result = await executeTrendingSubjectTopicsCommand(args);
      printResult(result, context);
      return;
    }
    default:
      throw new CommandError("Usage: bgm trending <subjects|subject-topics> ...");
  }
}

async function executeTrendingSubjectsCommand(args) {
  const options = parseFlags(args);
  const type = normalizeSubjectType(options.type);
  if (!type) {
    throw new CommandError("Usage: bgm trending subjects --type <book|anime|music|game|real> [--limit n] [--offset n]");
  }

  const limit = normalizePageSize(options.limit);
  const offset = normalizeNonNegativeInteger(options.offset, "offset");
  const result = await new BangumiClient(getConfig()).listTrendingSubjects({ type, limit, offset });
  return {
    ...result,
    resource: "trending-subjects",
    title: "Trending subjects",
    filters: { type, limit, offset },
  };
}

async function executeTrendingSubjectTopicsCommand(args) {
  const options = parseFlags(args);
  const limit = normalizePageSize(options.limit);
  const offset = normalizeNonNegativeInteger(options.offset, "offset");
  const result = await new BangumiClient(getConfig()).listTrendingSubjectTopics({ limit, offset });
  return {
    ...result,
    resource: "trending-subject-topics",
    title: "Trending subject topics",
    filters: { limit, offset },
  };
}
