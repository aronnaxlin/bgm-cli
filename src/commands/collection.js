import { BangumiClient } from "../core/client.js";
import { getConfig } from "../core/config.js";
import { CommandError, printResult } from "../core/output.js";
import { getPositional, parseFlags } from "../utils/args.js";
import {
  normalizeNonNegativeInteger,
  normalizePageSize,
  normalizeRateValue,
  parseOptionalInteger,
} from "../utils/helpers.js";
import {
  COLLECTION_STATUS_MAP,
  normalizeCollectionSort,
  normalizeCollectionStatusFilter,
  normalizeCollectionStatusValue,
  normalizeSortOrder,
  normalizeSubjectTypeFilter,
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
    default:
      throw new CommandError(
        "Usage: bgm collection <list|get|collect|comment|rate|status|characters|persons|indexes> ...",
      );
  }
}

export async function executeCollectionListCommand(args) {
  const options = parseFlags(args);
  const client = new BangumiClient(getConfig());
  const username = options.user ? String(options.user) : (await client.getMe()).username;
  const subjectTypes = normalizeSubjectTypeFilter(options.type);
  const collectionTypes = normalizeCollectionStatusFilter(options.status);
  const sort = normalizeCollectionSort(options.sort);
  const order = normalizeSortOrder(options.order);
  const limit = parseOptionalInteger(options.limit);
  const offset = parseOptionalInteger(options.offset);

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
  const username = options.user ? String(options.user) : (await client.getMe()).username;
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

  await client.upsertMyCollection(subjectId, payload);
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

  await client.patchMyCollection(subjectId, { comment: String(comment) });
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

  await client.patchMyCollection(subjectId, { rate: requestedRate });
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

  await client.patchMyCollection(subjectId, {
    type: normalizeCollectionStatusValue(rawStatus),
  });
  const collection = await fetchMySubjectCollection(client, subjectId);
  return buildCollectionActionResult({
    action: "status",
    actionLabel: "Collection status updated",
    subjectId,
    subject,
    collection,
  });
}
