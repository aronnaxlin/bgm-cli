import { BangumiClient } from "../core/client.js";
import { getConfig } from "../core/config.js";
import { BangumiApiError } from "../core/http.js";
import { CommandError, printResult } from "../core/output.js";
import { firstPositional, getPositional, parseFlags } from "../utils/args.js";
import {
  normalizeNonNegativeInteger,
  normalizePageSize,
  normalizeRateValue,
  parseOptionalInteger,
  resolveUsernameOrMe,
} from "../utils/helpers.js";
import {
  COLLECTION_STATUS_MAP,
  normalizeCollectionSort,
  normalizeCollectionStatusFilter,
  normalizeCollectionStatusValue,
  normalizeSortOrder,
  normalizeSubjectTypeFilter,
  normalizeTagFilter,
} from "../utils/validators.js";
import { fetchAllCollections, sortCollections } from "../utils/collection.js";
import {
  buildCollectionActionResult,
  buildCollectionMutationPayload,
  fetchMySubjectCollection,
  fetchMySubjectCollectionVerified,
  formatCollectionStatusForError,
  resolveCollectionTarget,
} from "../utils/collection-ops.js";
import { executeSubjectSearchCommand } from "./subject.js";

export async function runCollectionCommand(command, args, context) {
  switch (command) {
    case "list": {
      const result = await executeCollectionListCommand(args);
      printResult(result, context);
      return;
    }
    case "get": {
      const result = await executeCollectionGetCommand(args);
      printResult(result, context);
      return;
    }
    case "collect": {
      const result = await executeCollectionCollectCommand(args);
      printResult(result, context);
      return;
    }
    case "comment": {
      const result = await executeCollectionCommentCommand(args);
      printResult(result, context);
      return;
    }
    case "rate": {
      const result = await executeCollectionRateCommand(args);
      printResult(result, context);
      return;
    }
    case "status": {
      const result = await executeCollectionStatusCommand(args);
      printResult(result, context);
      return;
    }
    case "characters": {
      const result = await executeP1CollectionListCommand(args, "characters");
      printResult(result, context);
      return;
    }
    case "persons": {
      const result = await executeP1CollectionListCommand(args, "persons");
      printResult(result, context);
      return;
    }
    case "indexes": {
      const result = await executeP1CollectionListCommand(args, "indexes");
      printResult(result, context);
      return;
    }
    case "collect-character":
    case "uncollect-character":
    case "collect-person":
    case "uncollect-person":
    case "collect-index":
    case "uncollect-index": {
      const result = await executeSimpleCollectionMutationCommand(command, args);
      printResult(result, context);
      return;
    }
    default:
      throw new CommandError(
        "Usage: bgm collection <list|get|collect|comment|rate|status|characters|persons|indexes|collect-character|uncollect-character|collect-person|uncollect-person|collect-index|uncollect-index> ...",
      );
  }
}

export async function executeCollectionListCommand(args) {
  const options = parseFlags(args);
  const client = new BangumiClient(getConfig());
  const username = await resolveUsernameOrMe(client, options.user);
  const subjectTypes = normalizeSubjectTypeFilter(options.type);
  const collectionTypes = normalizeCollectionStatusFilter(options.status);
  const sort = normalizeCollectionSort(options.sort);
  const order = normalizeSortOrder(options.order);
  const limit = parseOptionalInteger(options.limit);
  const offset = parseOptionalInteger(options.offset);
  const tagFilter = normalizeTagFilter(options.tag);

  const apiQuery = {};
  if (subjectTypes.length === 1) {
    apiQuery.subject_type = subjectTypes[0];
  }
  if (collectionTypes.length === 1) {
    apiQuery.type = collectionTypes[0];
  }

  let result = await fetchAllCollections(client, username, { query: apiQuery });
  let data = Array.isArray(result.data) ? result.data : [];

  if (subjectTypes.length > 1) {
    const allowed = new Set(subjectTypes);
    data = data.filter((item) => allowed.has(item.subject_type));
  }

  if (collectionTypes.length > 1) {
    const allowed = new Set(collectionTypes);
    data = data.filter((item) => allowed.has(item.type));
  }

  if (tagFilter.length > 0) {
    data = data.filter((item) => {
      const itemTags = item.interest?.tags ?? item.tags ?? [];
      return tagFilter.every((tag) => itemTags.some((t) => String(t).toLowerCase() === tag.toLowerCase()));
    });
  }

  data = sortCollections(data, sort, order);

  const start = offset ?? 0;
  const end = limit !== undefined ? start + limit : undefined;
  if (start > 0 || end !== undefined) {
    data = data.slice(start, end);
  }

  return {
    ...result,
    data,
    total: result.total ?? data.length,
    filters: {
      user: username,
      status: collectionTypes,
      subjectType: subjectTypes,
      tag: tagFilter,
      sort,
      order,
      offset: offset ?? 0,
      limit,
    },
  };
}

export async function executeP1CollectionListCommand(args, kind) {
  const options = parseFlags(args);
  const client = new BangumiClient(getConfig());
  const username = await resolveUsernameOrMe(client, options.user);
  const limit = normalizePageSize(options.limit);
  const offset = normalizeNonNegativeInteger(options.offset, "offset");
  const query = { limit, offset };

  const method = {
    characters: "listUserCharacterCollections",
    persons: "listUserPersonCollections",
    indexes: "listUserIndexCollections",
  }[kind];
  if (!method) {
    throw new CommandError(`Unsupported collection kind: ${kind}`);
  }

  const result = await client[method](username, query);
  return {
    ...result,
    resource: `collection-${kind}`,
    title: formatP1CollectionTitle(kind),
    filters: { user: username, limit, offset },
  };
}

function formatP1CollectionTitle(kind) {
  return {
    characters: "Character collections",
    persons: "Person collections",
    indexes: "Index collections",
  }[kind] ?? `${kind} collections`;
}

export async function executeSimpleCollectionMutationCommand(command, args) {
  const options = parseFlags(args);
  const id = firstCollectionMutationId(options);
  if (!id) {
    throw new CommandError(`Usage: bgm collection ${command} <id>`);
  }

  const method = {
    "collect-character": "addCharacterCollection",
    "uncollect-character": "deleteCharacterCollection",
    "collect-person": "addPersonCollection",
    "uncollect-person": "deletePersonCollection",
    "collect-index": "addIndexCollection",
    "uncollect-index": "deleteIndexCollection",
  }[command];
  const kind = command.endsWith("character") ? "character" : command.endsWith("person") ? "person" : "index";
  const action = command.startsWith("uncollect") ? "delete" : "add";

  await new BangumiClient(getConfig())[method](id);
  return {
    resource: "simple-collection-mutation",
    action,
    kind,
    id: Number(id),
  };
}

function firstCollectionMutationId(options) {
  return firstPositional(options) ?? options.id ?? options.characterId ?? options.personId ?? options.indexId;
}

export async function executeCollectionGetCommand(args) {
  const options = parseFlags(args);
  const client = new BangumiClient(getConfig());
  const { subjectId, subject } = await resolveCollectionTarget(options, {
    client,
    searchSubjects: executeSubjectSearchCommand,
    usage: "Usage: bgm collection get <subject_id> | bgm collection get --search <keyword> [--pick n] [--type anime] [--sort rank] [--limit n]",
  });
  const collection = await fetchMySubjectCollection(client, subjectId);
  return buildCollectionActionResult({
    action: "get",
    actionLabel: "Collection detail",
    subjectId,
    subject,
    collection,
  });
}

export async function executeCollectionCollectCommand(args) {
  const options = parseFlags(args);
  const client = new BangumiClient(getConfig());
  const rawStatus = options.status ?? getPositional(options, options.search ? 0 : 1) ?? "wish";
  const { subjectId, subject } = await resolveCollectionTarget(options, {
    client,
    searchSubjects: executeSubjectSearchCommand,
    usage: "Usage: bgm collection collect <subject_id> [<wish|collect|doing|on_hold|dropped>] | bgm collection collect --search <keyword> [<wish|collect|doing|on_hold|dropped>] [--status ...] [--pick n]",
  });
  const requestedStatus = normalizeCollectionStatusValue(rawStatus);
  const payload = buildCollectionMutationPayload(options, {
    defaultStatus: requestedStatus,
  });
  const currentCollection = await fetchMySubjectCollectionIfExists(client, subjectId);
  const mutationPayload = currentCollection
    ? buildPreservedCollectionMutationPayload(currentCollection, payload)
    : payload;

  await client.upsertMyCollection(subjectId, mutationPayload);
  const collection = await fetchMySubjectCollectionVerified(client, subjectId, {
    expected: { type: requestedStatus },
    actionLabel: "Collection status update",
    mismatchMessage: (latest) =>
      `Bangumi did not persist the requested collection status. Requested ${formatCollectionStatusForError(requestedStatus)}, but read back ${formatCollectionStatusForError(latest?.type)}.`,
  });
  return buildCollectionActionResult({
    action: "collect",
    actionLabel: "Collection updated",
    subjectId,
    subject,
    collection,
  });
}

export async function executeCollectionCommentCommand(args) {
  const options = parseFlags(args);
  const client = new BangumiClient(getConfig());
  const comment = options.comment ?? getPositional(options, options.search ? 0 : 1);
  if (comment === undefined) {
    throw new CommandError(
      "Usage: bgm collection comment <subject_id> <comment> | bgm collection comment --search <keyword> <comment> [--pick n]",
    );
  }

  const { subjectId, subject } = await resolveCollectionTarget(options, {
    client,
    searchSubjects: executeSubjectSearchCommand,
    usage: "Usage: bgm collection comment <subject_id> <comment> | bgm collection comment --search <keyword> <comment> [--pick n]",
  });

  const currentCollection = await fetchMySubjectCollection(client, subjectId);
  await client.patchMyCollection(subjectId, buildPreservedCollectionMutationPayload(currentCollection, {
    comment: String(comment),
  }));
  const collection = await fetchMySubjectCollection(client, subjectId);
  return buildCollectionActionResult({
    action: "comment",
    actionLabel: "Collection comment updated",
    subjectId,
    subject,
    collection,
  });
}

export async function executeCollectionRateCommand(args) {
  const options = parseFlags(args);
  const client = new BangumiClient(getConfig());
  const rawRate = options.rate ?? options.value ?? getPositional(options, options.search ? 0 : 1);
  if (rawRate === undefined) {
    throw new CommandError(
      "Usage: bgm collection rate <subject_id> <0-10> | bgm collection rate --search <keyword> <0-10> [--pick n]",
    );
  }

  const { subjectId, subject } = await resolveCollectionTarget(options, {
    client,
    searchSubjects: executeSubjectSearchCommand,
    usage: "Usage: bgm collection rate <subject_id> <0-10> | bgm collection rate --search <keyword> <0-10> [--pick n]",
  });

  const requestedRate = normalizeRateValue(rawRate);
  const currentCollection = await fetchMySubjectCollection(client, subjectId);
  if (currentCollection?.type === COLLECTION_STATUS_MAP.wish && requestedRate > 0) {
    throw new CommandError(
      "Bangumi does not allow rating while the collection status is wish. Change it to collect/doing/on_hold/dropped first, or use rate 0.",
    );
  }

  await client.patchMyCollection(subjectId, buildPreservedCollectionMutationPayload(currentCollection, {
    rate: requestedRate,
  }));
  const collection = await fetchMySubjectCollectionVerified(client, subjectId, {
    expected: { rate: requestedRate },
    actionLabel: "Rating update",
    mismatchMessage: (latest) =>
      `Bangumi did not persist the requested rating. Requested ${requestedRate}, but read back ${latest?.rate ?? "-"}. This can happen under some collection states such as wish.`,
  });
  return buildCollectionActionResult({
    action: "rate",
    actionLabel: "Collection rating updated",
    subjectId,
    subject,
    collection,
  });
}

export async function executeCollectionStatusCommand(args) {
  const options = parseFlags(args);
  const client = new BangumiClient(getConfig());
  const rawStatus = options.status ?? getPositional(options, options.search ? 0 : 1);
  if (!rawStatus) {
    throw new CommandError(
      "Usage: bgm collection status <subject_id> <wish|collect|doing|on_hold|dropped> | bgm collection status --search <keyword> <wish|collect|doing|on_hold|dropped> [--pick n]",
    );
  }

  const { subjectId, subject } = await resolveCollectionTarget(options, {
    client,
    searchSubjects: executeSubjectSearchCommand,
    usage: "Usage: bgm collection status <subject_id> <wish|collect|doing|on_hold|dropped> | bgm collection status --search <keyword> <wish|collect|doing|on_hold|dropped> [--pick n]",
  });

  const requestedStatus = normalizeCollectionStatusValue(rawStatus);
  const currentCollection = await fetchMySubjectCollection(client, subjectId);
  await client.patchMyCollection(subjectId, buildPreservedCollectionMutationPayload(currentCollection, {
    type: requestedStatus,
  }));
  const collection = await fetchMySubjectCollection(client, subjectId);
  return buildCollectionActionResult({
    action: "status",
    actionLabel: "Collection status updated",
    subjectId,
    subject,
    collection,
  });
}

async function fetchMySubjectCollectionIfExists(client, subjectId) {
  try {
    return await fetchMySubjectCollection(client, subjectId);
  } catch (error) {
    if (error instanceof BangumiApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

export function buildPreservedCollectionMutationPayload(currentCollection, changes = {}) {
  const nextType = changes.type ?? currentCollection?.type;
  const payload = {};

  if (nextType !== undefined) {
    payload.type = nextType;
  }

  const nextRate = changes.rate ?? currentCollection?.rate;
  if (nextRate !== undefined) {
    payload.rate = Number(nextType) === COLLECTION_STATUS_MAP.wish ? 0 : nextRate;
  }

  const nextComment = changes.comment ?? currentCollection?.comment;
  if (nextComment !== undefined) {
    payload.comment = String(nextComment);
  }

  if (changes.private !== undefined) {
    payload.private = changes.private;
  } else if (currentCollection?.private !== undefined) {
    payload.private = currentCollection.private;
  }

  if (changes.tags !== undefined) {
    payload.tags = changes.tags;
  } else if (Array.isArray(currentCollection?.tags)) {
    payload.tags = currentCollection.tags;
  }

  if (changes.progress !== undefined) {
    payload.progress = changes.progress;
  }

  return payload;
}
