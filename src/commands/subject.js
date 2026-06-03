import { BangumiClient } from "../core/client.js";
import { getConfig } from "../core/config.js";
import { CommandError, printResult } from "../core/output.js";
import { normalizeBangumiReactionValue } from "../core/reactions.js";
import { ensureArray, firstPositional, getPositional, parseFlags } from "../utils/args.js";
import {
  normalizeNonNegativeInteger,
  normalizePageSize,
  parseOptionalBoolean,
  parseOptionalInteger,
} from "../utils/helpers.js";
import {
  normalizeCollectionStatusValue,
  normalizeSubjectType,
} from "../utils/validators.js";
import { fetchAllSubjects, sortSubjectsByRank } from "../utils/collection.js";
import { resolveTurnstileTokenForMutation } from "../utils/turnstile-flow.js";

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
    case "characters":
    case "collects":
    case "comments":
    case "indexes":
    case "recs":
    case "relations":
    case "reviews":
    case "staff":
    case "staff-positions":
    case "topics": {
      const result = await executeSubjectP1ListCommand(command, args);
      printResult(result, context);
      return;
    }
    case "recent-topics":
    case "latest-topics": {
      const result = await executeRecentSubjectTopicsCommand(args);
      printResult(result, context);
      return;
    }
    case "topic": {
      const result = await executeSubjectTopicCommand(args);
      printResult(result, context);
      return;
    }
    case "create-topic": {
      const result = await executeSubjectCreateTopicCommand(args, context);
      printResult(result, context);
      return;
    }
    case "edit-topic": {
      const result = await executeSubjectEditTopicCommand(args);
      printResult(result, context);
      return;
    }
    case "reply": {
      const result = await executeSubjectReplyCommand(args, context);
      printResult(result, context);
      return;
    }
    case "post": {
      const result = await executeSubjectPostCommand(args);
      printResult(result, context);
      return;
    }
    case "edit-post": {
      const result = await executeSubjectEditPostCommand(args);
      printResult(result, context);
      return;
    }
    case "delete-post": {
      const result = await executeSubjectDeletePostCommand(args);
      printResult(result, context);
      return;
    }
    case "like-post": {
      const result = await executeSubjectLikePostCommand(args);
      printResult(result, context);
      return;
    }
    case "unlike-post": {
      const result = await executeSubjectUnlikePostCommand(args);
      printResult(result, context);
      return;
    }
    case "like-collect": {
      const result = await executeSubjectLikeCollectCommand(args);
      printResult(result, context);
      return;
    }
    case "unlike-collect": {
      const result = await executeSubjectUnlikeCollectCommand(args);
      printResult(result, context);
      return;
    }
    default:
      throw new CommandError("Usage: bgm subject <get|list|search|characters|collects|comments|indexes|recs|relations|reviews|staff|staff-positions|topics|recent-topics|topic|create-topic|edit-topic|reply|post|edit-post|delete-post|like-post|unlike-post|like-collect|unlike-collect> ...");
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

export async function executeSubjectP1ListCommand(command, args) {
  const options = parseFlags(args);
  const client = new BangumiClient(getConfig());
  const subjectId = firstPositional(options);
  if (!subjectId) {
    throw new CommandError(`Usage: bgm subject ${command} <subject_id> [--limit n] [--offset n]`);
  }

  const limit = normalizePageSize(options.limit);
  const offset = normalizeNonNegativeInteger(options.offset, "offset");
  const method = {
    characters: "listSubjectCharacters",
    collects: "listSubjectCollects",
    comments: "listSubjectComments",
    indexes: "listSubjectIndexes",
    recs: "listSubjectRecommendations",
    relations: "listSubjectRelations",
    reviews: "listSubjectReviews",
    staff: "listSubjectStaffPersons",
    "staff-positions": "listSubjectStaffPositions",
    topics: "listSubjectTopics",
  }[command];
  const query = {
    limit,
    offset,
    type: normalizeSubjectP1Type(command, options.type),
    mode: options.mode,
    offprint: parseOptionalBoolean(options.offprint),
    position: parseOptionalInteger(options.position),
  };
  const result = normalizeListResult(await client[method](subjectId, query));
  return {
    ...result,
    resource: `subject-${command}`,
    title: `Subject ${command}`,
    subjectId: Number(subjectId),
    filters: {
      subjectId: Number(subjectId),
      limit,
      offset,
      type: query.type,
      mode: query.mode,
      offprint: query.offprint,
      position: query.position,
    },
  };
}

export async function executeRecentSubjectTopicsCommand(args) {
  const options = parseFlags(args);
  const limit = normalizePageSize(options.limit);
  const offset = normalizeNonNegativeInteger(options.offset, "offset");
  const result = await new BangumiClient(getConfig()).listRecentSubjectTopics({
    limit,
    offset,
  });

  return {
    ...result,
    resource: "subject-recent-topics",
    title: "Recent subject topics",
    filters: {
      limit,
      offset,
    },
  };
}

function normalizeListResult(result) {
  if (Array.isArray(result)) {
    return {
      data: result,
      total: result.length,
    };
  }

  return {
    ...result,
    data: Array.isArray(result?.data) ? result.data : [],
    total: result?.total ?? (Array.isArray(result?.data) ? result.data.length : 0),
  };
}

export async function executeSubjectTopicCommand(args) {
  const options = parseFlags(args);
  const topicId = firstPositional(options);
  if (!topicId) {
    throw new CommandError("Usage: bgm subject topic <topic_id>");
  }

  return new BangumiClient(getConfig()).getSubjectTopic(topicId);
}

export async function executeSubjectCreateTopicCommand(args, context = {}) {
  const options = parseFlags(args);
  const client = new BangumiClient(getConfig());
  const subjectId = firstPositional(options);
  const title = getPositional(options, 1) ?? options.title;
  const content = getPositional(options, 2) ?? options.content;

  if (!subjectId || !title || !content) {
    throw new CommandError("Usage: bgm subject create-topic <subject_id> <title> <content> [--turnstile-token <token>] [--manual]");
  }

  const turnstileToken = await resolveTurnstileTokenForMutation(options, {
    actionLabel: "create a subject topic",
    context,
  });
  const result = await client.createSubjectTopic(subjectId, {
    title,
    content,
    turnstileToken,
  });

  return buildTopicMutationResult("subject", "create-topic", {
    subjectId,
    topicId: result.id,
    title,
    url: result.id ? `https://bgm.tv/subject/topic/${result.id}` : undefined,
  });
}

export async function executeSubjectEditTopicCommand(args) {
  const options = parseFlags(args);
  const topicId = firstPositional(options);
  const title = getPositional(options, 1) ?? options.title;
  const content = getPositional(options, 2) ?? options.content;
  if (!topicId || !title || !content) {
    throw new CommandError("Usage: bgm subject edit-topic <topic_id> <title> <content>");
  }

  await new BangumiClient(getConfig()).updateSubjectTopic(topicId, { title, content });
  return buildTopicMutationResult("subject", "edit-topic", {
    topicId,
    title,
    url: `https://bgm.tv/subject/topic/${topicId}`,
  });
}

export async function executeSubjectReplyCommand(args, context = {}) {
  const options = parseFlags(args);
  const client = new BangumiClient(getConfig());
  const topicId = firstPositional(options);
  const content = getPositional(options, 1) ?? options.content;
  const replyTo = normalizeNonNegativeInteger(options.replyTo, "reply-to") ?? 0;
  if (!topicId || !content) {
    throw new CommandError("Usage: bgm subject reply <topic_id> <content> [--reply-to <post_id>] [--turnstile-token <token>] [--manual]");
  }

  const turnstileToken = await resolveTurnstileTokenForMutation(options, {
    actionLabel: "reply to a subject topic",
    context,
  });
  const result = await client.createSubjectReply(topicId, {
    content,
    replyTo,
    turnstileToken,
  });

  return buildTopicMutationResult("subject", "reply", {
    topicId,
    postId: result.id,
    replyTo,
    url: `https://bgm.tv/subject/topic/${topicId}`,
  });
}

export async function executeSubjectPostCommand(args) {
  const options = parseFlags(args);
  const postId = firstPositional(options);
  if (!postId) {
    throw new CommandError("Usage: bgm subject post <post_id>");
  }

  return {
    resource: "topic-post",
    scope: "subject",
    postId: Number(postId),
    data: await new BangumiClient(getConfig()).getSubjectPost(postId),
  };
}

export async function executeSubjectEditPostCommand(args) {
  const options = parseFlags(args);
  const postId = firstPositional(options);
  const content = getPositional(options, 1) ?? options.content;
  if (!postId || !content) {
    throw new CommandError("Usage: bgm subject edit-post <post_id> <content>");
  }

  await new BangumiClient(getConfig()).updateSubjectPost(postId, { content });
  return buildPostMutationResult("subject", "edit-post", { postId });
}

export async function executeSubjectDeletePostCommand(args) {
  const options = parseFlags(args);
  const postId = firstPositional(options);
  if (!postId) {
    throw new CommandError("Usage: bgm subject delete-post <post_id>");
  }

  await new BangumiClient(getConfig()).deleteSubjectPost(postId);
  return buildPostMutationResult("subject", "delete-post", { postId });
}

export async function executeSubjectLikePostCommand(args) {
  const options = parseFlags(args);
  const postId = firstPositional(options);
  const value = normalizeBangumiReactionValue(options.value ?? getPositional(options, 1), "subjectPost");
  if (!postId || value === undefined) {
    throw new CommandError("Usage: bgm subject like-post <post_id> <value>");
  }

  await new BangumiClient(getConfig()).likeSubjectPost(postId, value);
  return buildPostMutationResult("subject", "like-post", { postId, value });
}

export async function executeSubjectUnlikePostCommand(args) {
  const options = parseFlags(args);
  const postId = firstPositional(options);
  if (!postId) {
    throw new CommandError("Usage: bgm subject unlike-post <post_id>");
  }

  await new BangumiClient(getConfig()).unlikeSubjectPost(postId);
  return buildPostMutationResult("subject", "unlike-post", { postId });
}

export async function executeSubjectLikeCollectCommand(args) {
  const options = parseFlags(args);
  const collectId = firstPositional(options);
  const value = normalizeBangumiReactionValue(options.value ?? getPositional(options, 1), "subjectCollect");
  if (!collectId || value === undefined) {
    throw new CommandError("Usage: bgm subject like-collect <collect_id> <value>");
  }

  await new BangumiClient(getConfig()).likeSubjectCollect(collectId, value);
  return {
    resource: "subject-collect-mutation",
    action: "like-collect",
    collectId: Number(collectId),
    value,
  };
}

export async function executeSubjectUnlikeCollectCommand(args) {
  const options = parseFlags(args);
  const collectId = firstPositional(options);
  if (!collectId) {
    throw new CommandError("Usage: bgm subject unlike-collect <collect_id>");
  }

  await new BangumiClient(getConfig()).unlikeSubjectCollect(collectId);
  return {
    resource: "subject-collect-mutation",
    action: "unlike-collect",
    collectId: Number(collectId),
  };
}

function buildTopicMutationResult(scope, action, details) {
  return {
    resource: "topic-mutation",
    scope,
    action,
    ...normalizeNumericIds(details),
  };
}

function buildPostMutationResult(scope, action, details) {
  return {
    resource: "post-mutation",
    scope,
    action,
    ...normalizeNumericIds(details),
  };
}

function normalizeNumericIds(details) {
  const normalized = { ...details };
  for (const key of ["subjectId", "topicId", "postId", "replyTo"]) {
    if (normalized[key] !== undefined) {
      normalized[key] = Number(normalized[key]);
    }
  }
  return normalized;
}

function normalizeSubjectP1Type(command, value) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (command === "relations") {
    return normalizeSubjectType(value);
  }
  if (command === "collects" || command === "comments") {
    return normalizeCollectionStatusValue(value);
  }

  return parseOptionalInteger(value);
}
