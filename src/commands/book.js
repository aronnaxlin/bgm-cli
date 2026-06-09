import { BangumiClient } from "../core/client.js";
import { getConfig } from "../core/config.js";
import { BangumiApiError } from "../core/http.js";
import { CommandError, printResult } from "../core/output.js";
import { firstPositional, getPositional, parseFlags } from "../utils/args.js";
import { normalizeNonNegativeInteger, normalizePositiveNumber } from "../utils/helpers.js";
import { SUBJECT_TYPE_MAP } from "../utils/validators.js";
import {
  buildCollectionActionResult,
  fetchMySubjectCollection,
  fetchMySubjectCollectionVerified,
} from "../utils/collection-ops.js";

export async function runBookCommand(command, args, context) {
  switch (command) {
    case "get": {
      const result = await executeBookGetCommand(args);
      printResult(result, context);
      return;
    }
    case "ep": {
      const result = await executeBookEpCommand(args);
      printResult(result, context);
      return;
    }
    case "vol": {
      const result = await executeBookVolCommand(args);
      printResult(result, context);
      return;
    }
    default:
      throw new CommandError(
        "Usage: bgm book <get|ep|vol> ...",
      );
  }
}

export async function executeBookGetCommand(args) {
  const options = parseFlags(args);
  const client = new BangumiClient(getConfig());
  const subjectId = firstPositional(options);
  if (!subjectId) {
    throw new CommandError("Usage: bgm book get <subject_id>");
  }

  const subject = await client.getSubject(subjectId);
  if (Number(subject?.type) !== SUBJECT_TYPE_MAP.book) {
    throw new CommandError(
      `Subject ${subjectId} is not a book-type entry (${subject?.name || "unknown"}). Use \`bgm episode list\` or \`bgm episode watch\` for anime/game/real entries.`,
    );
  }

  let collection;
  try {
    collection = await fetchMySubjectCollection(client, subjectId);
  } catch (error) {
    if (error instanceof BangumiApiError && error.status === 404) {
      throw new CommandError(
        `Subject ${subjectId} (${subject?.name || "unknown"}) is not in your collection. Add it first with \`bgm collection collect ${subjectId} doing\`.`,
      );
    }
    throw error;
  }

  return {
    resource: "book-progress",
    action: "get",
    actionLabel: "Book reading progress",
    subjectId: Number(subjectId),
    subject,
    collection,
  };
}

export async function executeBookEpCommand(args) {
  const options = parseFlags(args);
  const client = new BangumiClient(getConfig());
  const subjectId = firstPositional(options);
  const chapterNumber = normalizePositiveNumber(getPositional(options, 1), "chapter number");
  if (!subjectId || chapterNumber === undefined) {
    throw new CommandError("Usage: bgm book ep <subject_id> <chapter_number>");
  }

  const subject = await client.getSubject(subjectId);
  if (Number(subject?.type) !== SUBJECT_TYPE_MAP.book) {
    throw new CommandError(
      `Subject ${subjectId} is not a book-type entry (${subject?.name || "unknown"}). Use \`bgm episode watch\` for anime/game/real entries.`,
    );
  }

  const collection = await ensureBookCollection(client, subjectId, subject);
  await client.patchMyCollection(subjectId, { epStatus: chapterNumber });

  const updatedCollection = await fetchMySubjectCollectionVerified(client, subjectId, {
    expected: { ep_status: chapterNumber },
    actionLabel: "Book chapter progress update",
    mismatchMessage: (latest) =>
      `Bangumi did not persist the requested chapter progress. Requested ep_status ${chapterNumber}, but read back ${latest?.ep_status ?? "-"}.`,
  });

  return buildCollectionActionResult({
    action: "ep",
    actionLabel: "Chapter progress updated",
    subjectId,
    subject,
    collection: updatedCollection,
  });
}

export async function executeBookVolCommand(args) {
  const options = parseFlags(args);
  const client = new BangumiClient(getConfig());
  const subjectId = firstPositional(options);
  const volumeNumber = normalizePositiveNumber(getPositional(options, 1), "volume number");
  if (!subjectId || volumeNumber === undefined) {
    throw new CommandError("Usage: bgm book vol <subject_id> <volume_number>");
  }

  const subject = await client.getSubject(subjectId);
  if (Number(subject?.type) !== SUBJECT_TYPE_MAP.book) {
    throw new CommandError(
      `Subject ${subjectId} is not a book-type entry (${subject?.name || "unknown"}). Use \`bgm episode watch\` for anime/game/real entries.`,
    );
  }

  const collection = await ensureBookCollection(client, subjectId, subject);
  await client.patchMyCollection(subjectId, { volStatus: volumeNumber });

  const updatedCollection = await fetchMySubjectCollectionVerified(client, subjectId, {
    expected: { vol_status: volumeNumber },
    actionLabel: "Book volume progress update",
    mismatchMessage: (latest) =>
      `Bangumi did not persist the requested volume progress. Requested vol_status ${volumeNumber}, but read back ${latest?.vol_status ?? "-"}.`,
  });

  return buildCollectionActionResult({
    action: "vol",
    actionLabel: "Volume progress updated",
    subjectId,
    subject,
    collection: updatedCollection,
  });
}

async function ensureBookCollection(client, subjectId, subject) {
  try {
    return await fetchMySubjectCollection(client, subjectId);
  } catch (error) {
    if (error instanceof BangumiApiError && error.status === 404) {
      throw new CommandError(
        `Subject ${subjectId} (${subject?.name || "unknown"}) is not in your collection. Add it first with \`bgm collection collect ${subjectId} doing\`, then retry.`,
      );
    }
    throw error;
  }
}
