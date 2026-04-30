/**
 * Collection and episode mutation helpers.
 */

import { getConfig } from "../core/config.js";
import { BangumiApiError as ApiError } from "../core/http.js";
import { CommandError } from "../core/output.js";
import { delayMs, normalizeNonNegativeInteger, normalizeRateValue, parseOptionalBoolean } from "./helpers.js";
import { splitFilterValues } from "./args.js";
import { COLLECTION_STATUS_MAP, normalizeCollectionStatusValue } from "./validators.js";

export function buildCollectionActionResult({ action, actionLabel, subjectId, subject, collection }) {
  return {
    action,
    actionLabel,
    subjectId: Number(subjectId),
    subjectName: subject?.name_cn || subject?.name,
    subject,
    collection,
  };
}

export function buildEpisodeActionResult({ action, actionLabel, subjectId, episodeId, episode, collection, requestedType }) {
  const resolvedEpisode = collection?.episode ?? episode ?? null;
  return {
    resource: "episode-mutation",
    action,
    actionLabel,
    subjectId: subjectId !== undefined ? Number(subjectId) : (resolvedEpisode?.subject_id ?? null),
    episodeId: Number(episodeId ?? resolvedEpisode?.id),
    episode: resolvedEpisode,
    collection,
    status: requestedType,
  };
}

export async function fetchMySubjectCollection(client, subjectId) {
  const me = await client.getMe();
  return client.getUserCollection(me.username, subjectId);
}

export async function fetchMyEpisodeCollection(client, episodeId) {
  return client.getMyEpisodeCollection(episodeId);
}

export async function fetchMySubjectCollectionVerified(client, subjectId, { expected, actionLabel, mismatchMessage }) {
  let latest = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    latest = await fetchMySubjectCollection(client, subjectId);
    if (collectionMatchesExpected(latest, expected)) {
      return latest;
    }
    if (attempt < 2) {
      await delayMs(350);
    }
  }

  throw new CommandError(
    typeof mismatchMessage === "function"
      ? mismatchMessage(latest)
      : `${actionLabel} did not persist on Bangumi.`,
  );
}

export function collectionMatchesExpected(collection, expected = {}) {
  return Object.entries(expected).every(([key, value]) => collection?.[key] === value);
}

export async function fetchMyEpisodeCollectionVerified(client, episodeId, { expected, actionLabel, mismatchMessage }) {
  let latest = null;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      latest = await fetchMyEpisodeCollection(client, episodeId);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404 && expected?.type === 0) {
        return null;
      }
      throw error;
    }

    if (episodeCollectionMatchesExpected(latest, expected)) {
      return latest;
    }
    if (attempt < 4) {
      await delayMs(400 + attempt * 350);
    }
  }

  throw new CommandError(
    typeof mismatchMessage === "function"
      ? mismatchMessage(latest)
      : `${actionLabel} did not persist on Bangumi.`,
  );
}

export function episodeCollectionMatchesExpected(collection, expected = {}) {
  return Object.entries(expected).every(([key, value]) => {
    if (key === "type" && value === 0) {
      return collection === null || collection?.type === 0;
    }
    return collection?.[key] === value;
  });
}

export function formatCollectionStatusForError(type) {
  const labels = {
    1: "wish",
    2: "collect",
    3: "doing",
    4: "on_hold",
    5: "dropped",
  };
  return labels[type] ?? String(type ?? "-");
}

export function formatEpisodeCollectionStatusForError(type) {
  const labels = {
    0: "remove",
    1: "queue",
    2: "watched",
    3: "drop",
  };
  return labels[type] ?? String(type ?? "-");
}

export function mapEpisodeMutationError(error, { action, episodeId, subjectId }) {
  if (!(error instanceof ApiError)) {
    return error;
  }

  const description = String(error.message ?? "").toLowerCase();

  if (error.status === 400 && description.includes("need to add subject to your collection first")) {
    return new CommandError(
      `Failed to ${action}. Bangumi requires the parent subject to be in your collection before episode progress can be changed. Add subject #${subjectId ?? "-"} to your collection first, then retry.`,
    );
  }

  if (error.status === 400 && description.includes("episode id not valid")) {
    return new CommandError(`Failed to ${action}. Episode #${episodeId} is invalid or does not belong to a writable collected subject.`);
  }

  if (error.status === 401) {
    return new CommandError(`Failed to ${action}. Save a valid Bangumi access token first with \`bgm auth set-token\`.`);
  }

  if (error.status === 403) {
    return new CommandError(
      `Failed to ${action}. Your Bangumi account is authenticated but does not currently have permission for this episode or subject. This can happen with NSFW/R18 content or account-level access restrictions.`,
    );
  }

  if (error.status === 404) {
    return new CommandError(
      `Failed to ${action}. Episode #${episodeId} or its parent subject was not found, or Bangumi denied access to the subject. For NSFW/R18 content, make sure you are authenticated and your account is eligible to view it.`,
    );
  }

  return error;
}

export function buildSubjectSearchArgs(keyword, options) {
  const args = [String(keyword)];

  if (options.type) {
    args.push("--type", String(options.type));
  }
  if (options.sort) {
    args.push("--sort", String(options.sort));
  }
  if (options.limit) {
    args.push("--limit", String(options.limit));
  } else {
    args.push("--limit", "10");
  }

  return args;
}

export function buildCollectionMutationPayload(options, { defaultStatus } = {}) {
  const payload = {};

  if (defaultStatus !== undefined) {
    payload.type = defaultStatus;
  } else if (options.status !== undefined) {
    payload.type = normalizeCollectionStatusValue(options.status);
  }
  if (options.rate !== undefined) {
    payload.rate = normalizeRateValue(options.rate);
  }
  if (options.comment !== undefined) {
    payload.comment = String(options.comment);
  }
  if (options.private !== undefined) {
    payload.private = parseOptionalBoolean(options.private);
  }
  if (options.epStatus !== undefined) {
    payload.ep_status = normalizeNonNegativeInteger(options.epStatus, "ep-status");
  }
  if (options.volStatus !== undefined) {
    payload.vol_status = normalizeNonNegativeInteger(options.volStatus, "vol-status");
  }
  if (options.tags !== undefined) {
    payload.tags = splitFilterValues(options.tags);
  }

  return payload;
}

export function buildCollectionTargetArgs(target) {
  if (target?.mode === "id" && target.subjectId) {
    return [String(target.subjectId)];
  }
  return [];
}

export function getCollectionStatusKey(type) {
  const map = {
    [COLLECTION_STATUS_MAP.wish]: "wish",
    [COLLECTION_STATUS_MAP.collect]: "collect",
    [COLLECTION_STATUS_MAP.doing]: "doing",
    [COLLECTION_STATUS_MAP.on_hold]: "on_hold",
    [COLLECTION_STATUS_MAP.dropped]: "dropped",
  };
  return map[type];
}

export function handleEpisodeListError(error, subjectId) {
  if (error instanceof ApiError && [401, 403, 404].includes(error.status)) {
    const hasToken = Boolean(getConfig().accessToken);
    const suggestion = hasToken
      ? "If this subject is NSFW/R18, your Bangumi account may still lack permission to view it, for example because the account is too new or not eligible yet."
      : "If this subject is NSFW/R18, save an access token first. Bangumi may return a misleading 404 when the request is unauthenticated.";
    throw new CommandError(
      `Failed to list episodes for subject ${subjectId}. ${suggestion} Original API response: ${error.message}`,
    );
  }

  throw error;
}
