import { BangumiClient } from "../core/client.js";
import { getConfig } from "../core/config.js";
import { CommandError, printResult } from "../core/output.js";
import { firstPositional, getPositional, parseFlags } from "../utils/args.js";
import {
  normalizeEpisodePageSize,
  normalizeNonNegativeInteger,
  normalizePositiveNumber,
} from "../utils/helpers.js";
import {
  EPISODE_COLLECTION_STATUS_MAP,
  EPISODE_TYPE_MAP,
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
    default:
      throw new CommandError(
        "Usage: bgm episode <list|status|watch> ...",
      );
  }
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
