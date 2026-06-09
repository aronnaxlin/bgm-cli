import { BangumiClient } from "../core/client.js";
import { getConfig } from "../core/config.js";
import { CommandError, printResult } from "../core/output.js";
import { normalizeBangumiReactionValue } from "../core/reactions.js";
import { firstPositional, getPositional, parseFlags } from "../utils/args.js";
import {
  normalizeEpisodePageSize,
  normalizeNonNegativeInteger,
  normalizePositiveInteger,
  normalizePositiveNumber,
} from "../utils/helpers.js";
import {
  EPISODE_COLLECTION_STATUS_MAP,
  EPISODE_TYPE_MAP,
  SUBJECT_TYPE_MAP,
  normalizeEpisodeCollectionStatusValue,
  normalizeEpisodeTypeFilter,
} from "../utils/validators.js";
import { fetchAllEpisodes } from "../utils/collection.js";
import {
  buildEpisodeActionResult,
  fetchMyEpisodeCollectionVerified,
  formatEpisodeCollectionStatusForError,
  handleEpisodeListError,
  mapEpisodeMutationError,
} from "../utils/collection-ops.js";
import { resolveTurnstileTokenForMutation } from "../utils/turnstile-flow.js";

export async function runEpisodeCommand(command, args, context) {
  switch (command) {
    case "list": {
      const result = await executeEpisodeListCommand(args);
      printResult(result, context);
      return;
    }
    case "status": {
      const result = await executeEpisodeStatusCommand(args);
      printResult(result, context);
      return;
    }
    case "watch": {
      const result = await executeEpisodeWatchCommand(args);
      printResult(result, context);
      return;
    }
    case "get": {
      const result = await executeEpisodeGetCommand(args);
      printResult(result, context);
      return;
    }
    case "comments": {
      const result = await executeEpisodeCommentsCommand(args);
      printResult(result, context);
      return;
    }
    case "comment": {
      const result = await executeEpisodeCommentCommand(args, context);
      printResult(result, context);
      return;
    }
    case "edit-comment": {
      const result = await executeEpisodeEditCommentCommand(args);
      printResult(result, context);
      return;
    }
    case "delete-comment": {
      const result = await executeEpisodeDeleteCommentCommand(args);
      printResult(result, context);
      return;
    }
    case "like-comment": {
      const result = await executeEpisodeLikeCommentCommand(args);
      printResult(result, context);
      return;
    }
    case "unlike-comment": {
      const result = await executeEpisodeUnlikeCommentCommand(args);
      printResult(result, context);
      return;
    }
    default:
      throw new CommandError(
        "Usage: bgm episode <list|status|watch|get|comments|comment|edit-comment|delete-comment|like-comment|unlike-comment> ...",
      );
  }
}

export async function executeEpisodeGetCommand(args) {
  const options = parseFlags(args);
  const episodeId = firstPositional(options);
  if (!episodeId) {
    throw new CommandError("Usage: bgm episode get <episode_id>");
  }

  return new BangumiClient(getConfig()).getEpisode(episodeId);
}

export async function executeEpisodeListCommand(args) {
  const options = parseFlags(args);
  const client = new BangumiClient(getConfig());
  const subjectId = firstPositional(options);
  if (!subjectId) {
    throw new CommandError(
      "Usage: bgm episode list <subject_id> [--type <main|sp|op|ed|op_ed|trailer|pv|mad|other>] [--limit n] [--offset n]",
    );
  }

  const typeFilter = normalizeEpisodeTypeFilter(options.type);
  const limit = normalizeEpisodePageSize(options.limit);
  const offset = normalizeNonNegativeInteger(options.offset, "offset");
  let result;
  let filtered;

  try {
    if (typeFilter.matchTypes) {
      const episodes = await fetchAllEpisodes(client, subjectId);
      const matched = episodes.filter((episode) => typeFilter.matchTypes.has(Number(episode?.type)));
      filtered = matched.slice(offset ?? 0, limit !== undefined ? (offset ?? 0) + limit : undefined);
      result = {
        data: filtered,
        total: matched.length,
        limit: limit ?? matched.length,
        offset: offset ?? 0,
      };
    } else {
      result = await client.listEpisodes({
        subject_id: subjectId,
        type: typeFilter.queryType,
        limit,
        offset,
      });
      const episodes = Array.isArray(result.data) ? result.data : [];
      filtered = episodes;
    }
  } catch (error) {
    handleEpisodeListError(error, subjectId);
  }

  if (filtered.length === 0) {
    const subject = await client.getSubject(subjectId);
    if (Number(subject?.type) === SUBJECT_TYPE_MAP.book) {
      throw new CommandError(
        `Subject ${subjectId} is a book-type entry. Bangumi does not provide episode lists for books. Use \`bgm book ep ${subjectId} <chapter_number>\` to track reading progress.`,
      );
    }
  }

  return {
    ...result,
    resource: "episode-list",
    subjectId: Number(subjectId),
    data: filtered,
    total: result.total ?? filtered.length,
    filters: {
      type: typeFilter.label,
      limit,
      offset,
    },
  };
}

export async function executeEpisodeStatusCommand(args) {
  const options = parseFlags(args);
  const client = new BangumiClient(getConfig());
  const episodeId = firstPositional(options);
  const rawStatus = options.status ?? getPositional(options, 1);
  if (!episodeId || !rawStatus) {
    throw new CommandError(
      "Usage: bgm episode status <episode_id> <queue|watched|drop|remove>",
    );
  }

  const episode = await client.getEpisode(episodeId);
  const requestedType = normalizeEpisodeCollectionStatusValue(rawStatus);
  try {
    await client.updateMyEpisodeCollection(episodeId, { type: requestedType });
  } catch (error) {
    throw mapEpisodeMutationError(error, {
      action: requestedType === 0 ? "clear episode progress" : `set episode status to ${formatEpisodeCollectionStatusForError(requestedType)}`,
      episodeId,
      subjectId: episode?.subject_id,
    });
  }
  const collection = await fetchMyEpisodeCollectionVerified(client, episodeId, {
    expected: { type: requestedType },
    actionLabel: "Episode status update",
    mismatchMessage: (latest) =>
      `Bangumi did not persist the requested episode status. Requested ${formatEpisodeCollectionStatusForError(requestedType)}, but read back ${formatEpisodeCollectionStatusForError(latest?.type)}.`,
  });

  return buildEpisodeActionResult({
    action: "status",
    actionLabel: requestedType === 0 ? "Episode status cleared" : "Episode status updated",
    episodeId,
    episode,
    collection,
    requestedType,
  });
}

export async function executeEpisodeWatchCommand(args) {
  const options = parseFlags(args);
  const client = new BangumiClient(getConfig());
  const subjectId = firstPositional(options);
  const episodeNumber = normalizePositiveNumber(getPositional(options, 1) ?? options.number, "episode number");
  if (!subjectId || episodeNumber === undefined) {
    throw new CommandError("Usage: bgm episode watch <subject_id> <episode_number>");
  }

  const episodes = await fetchAllEpisodes(client, subjectId, { type: EPISODE_TYPE_MAP.main });
  const episode = episodes.find((item) => Number(item?.type) === EPISODE_TYPE_MAP.main && Number(item?.ep) === episodeNumber);
  if (!episode) {
    const subject = await client.getSubject(subjectId);
    if (Number(subject?.type) === SUBJECT_TYPE_MAP.book) {
      throw new CommandError(
        `Subject ${subjectId} is a book-type entry. Bangumi does not support episode-level tracking for books. Use \`bgm book ep ${subjectId} ${episodeNumber}\` to update reading progress.`,
      );
    }
    throw new CommandError(`Could not find main episode ${episodeNumber} under subject ${subjectId}.`);
  }

  try {
    await client.updateMyEpisodeCollection(episode.id, { type: EPISODE_COLLECTION_STATUS_MAP.watched });
  } catch (error) {
    throw mapEpisodeMutationError(error, {
      action: `mark episode ${episodeNumber} as watched`,
      episodeId: episode.id,
      subjectId,
    });
  }
  const collection = await fetchMyEpisodeCollectionVerified(client, episode.id, {
    expected: { type: EPISODE_COLLECTION_STATUS_MAP.watched },
    actionLabel: "Episode watch update",
    mismatchMessage: (latest) =>
      `Bangumi did not persist the requested episode status. Requested watched, but read back ${formatEpisodeCollectionStatusForError(latest?.type)}.`,
  });

  return buildEpisodeActionResult({
    action: "watch",
    actionLabel: "Episode marked watched",
    subjectId,
    episodeId: episode.id,
    episode,
    collection,
    requestedType: EPISODE_COLLECTION_STATUS_MAP.watched,
  });
}

export async function executeEpisodeCommentsCommand(args) {
  const options = parseFlags(args);
  const client = new BangumiClient(getConfig());
  const first = firstPositional(options);
  const second = getPositional(options, 1);
  let episodeId = first;
  let episode;
  let subjectId;
  let episodeNumber;
  let typeFilter;

  if (options.subject || options.subjectId || second !== undefined || options.number !== undefined || options.ep !== undefined) {
    subjectId = options.subject ?? options.subjectId ?? first;
    episodeNumber = normalizePositiveNumber(options.number ?? options.ep ?? second, "episode number");
    if (!subjectId || episodeNumber === undefined) {
      throw new CommandError(
        "Usage: bgm episode comments <episode_id> OR bgm episode comments <subject_id> <episode_number> [--type <main|sp|op|ed|op_ed|trailer|pv|mad|other>]",
      );
    }

    typeFilter = normalizeEpisodeTypeFilter(options.type ?? "main");
    episode = await resolveEpisodeByNumber(client, subjectId, episodeNumber, typeFilter);
    episodeId = episode.id;
  }

  if (!episodeId) {
    throw new CommandError(
      "Usage: bgm episode comments <episode_id> OR bgm episode comments <subject_id> <episode_number> [--type <main|sp|op|ed|op_ed|trailer|pv|mad|other>]",
    );
  }

  const data = await client.listEpisodeComments(episodeId);
  return {
    resource: "episode-comments",
    episodeId: Number(episodeId),
    subjectId: subjectId !== undefined ? Number(subjectId) : undefined,
    episodeNumber,
    episode,
    filters: typeFilter ? { type: typeFilter.label ?? "main" } : undefined,
    data,
  };
}

export async function executeEpisodeCommentCommand(args, context = {}) {
  const options = parseFlags(args);
  const episodeId = firstPositional(options);
  const content = getPositional(options, 1) ?? options.content;
  const replyTo = normalizeNonNegativeInteger(options.replyTo, "reply-to") ?? 0;

  if (!episodeId || !content) {
    throw new CommandError("Usage: bgm episode comment <episode_id> <content> [--reply-to <comment_id>] [--turnstile-token <token>] [--manual]");
  }

  const turnstileToken = await resolveTurnstileTokenForMutation(options, {
    actionLabel: "create an episode comment",
    context,
  });
  const result = await new BangumiClient(getConfig()).createEpisodeComment(episodeId, {
    content,
    replyTo,
    turnstileToken,
  });

  return buildEpisodeCommentMutationResult("create", {
    episodeId,
    commentId: result.id,
    replyTo,
  });
}

export async function executeEpisodeEditCommentCommand(args) {
  const options = parseFlags(args);
  const commentId = firstPositional(options);
  const content = getPositional(options, 1) ?? options.content;
  if (!commentId || !content) {
    throw new CommandError("Usage: bgm episode edit-comment <comment_id> <content>");
  }

  await new BangumiClient(getConfig()).updateEpisodeComment(commentId, { content });
  return buildEpisodeCommentMutationResult("edit", { commentId });
}

export async function executeEpisodeDeleteCommentCommand(args) {
  const options = parseFlags(args);
  const commentId = firstPositional(options);
  if (!commentId) {
    throw new CommandError("Usage: bgm episode delete-comment <comment_id>");
  }

  await new BangumiClient(getConfig()).deleteEpisodeComment(commentId);
  return buildEpisodeCommentMutationResult("delete", { commentId });
}

export async function executeEpisodeLikeCommentCommand(args) {
  const options = parseFlags(args);
  const commentId = firstPositional(options);
  const value = normalizeBangumiReactionValue(getPositional(options, 1) ?? options.value, "episodeComment");
  if (!commentId || value === undefined) {
    throw new CommandError("Usage: bgm episode like-comment <comment_id> <value>");
  }

  await new BangumiClient(getConfig()).likeEpisodeComment(commentId, value);
  return buildEpisodeCommentMutationResult("like", { commentId, value });
}

export async function executeEpisodeUnlikeCommentCommand(args) {
  const options = parseFlags(args);
  const commentId = firstPositional(options);
  if (!commentId) {
    throw new CommandError("Usage: bgm episode unlike-comment <comment_id>");
  }

  await new BangumiClient(getConfig()).unlikeEpisodeComment(commentId);
  return buildEpisodeCommentMutationResult("unlike", { commentId });
}

function buildEpisodeCommentMutationResult(action, details) {
  const normalized = { ...details };
  for (const key of ["episodeId", "commentId", "replyTo"]) {
    if (normalized[key] !== undefined) {
      normalized[key] = Number(normalized[key]);
    }
  }

  return {
    resource: "episode-comment-mutation",
    action,
    ...normalized,
  };
}

async function resolveEpisodeByNumber(client, subjectId, episodeNumber, typeFilter) {
  const episodes = await fetchAllEpisodes(client, subjectId, {
    type: typeFilter.matchTypes ? undefined : typeFilter.queryType,
  });
  const candidates = typeFilter.matchTypes
    ? episodes.filter((item) => typeFilter.matchTypes.has(Number(item?.type)))
    : episodes;
  const episode = candidates.find((item) => Number(item?.ep) === episodeNumber);

  if (!episode) {
    const typeLabel = typeFilter.label ?? "main";
    const subject = await client.getSubject(subjectId);
    if (Number(subject?.type) === SUBJECT_TYPE_MAP.book) {
      throw new CommandError(
        `Subject ${subjectId} is a book-type entry. Bangumi does not support episode-level tracking for books. Use \`bgm book ep ${subjectId} ${episodeNumber}\` to update reading progress.`,
      );
    }
    throw new CommandError(`Could not find ${typeLabel} episode ${episodeNumber} under subject ${subjectId}.`);
  }

  return episode;
}
