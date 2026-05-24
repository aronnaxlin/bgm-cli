import { BangumiClient } from "../core/client.js";
import { getConfig } from "../core/config.js";
import { CommandError, printResult } from "../core/output.js";
import { firstPositional, getPositional, parseFlags, splitFilterValues } from "../utils/args.js";
import {
  normalizeNonNegativeInteger,
  normalizePageSize,
  parseOptionalInteger,
} from "../utils/helpers.js";
import { normalizeSubjectType } from "../utils/validators.js";
import { resolveTurnstileTokenForMutation } from "../utils/turnstile-flow.js";

export async function runPersonCommand(command, args, context) {
  const executor = {
    get: executePersonGetCommand,
    search: executePersonSearchCommand,
    casts: executePersonCastsCommand,
    collects: executePersonCollectsCommand,
    comments: executePersonCommentsCommand,
    indexes: executePersonIndexesCommand,
    photos: executePersonPhotosCommand,
    "photos-preview": executePersonPhotoPreviewCommand,
    photo: executePersonPhotoCommand,
    "photo-comments": executePersonPhotoCommentsCommand,
    relations: executePersonRelationsCommand,
    works: executePersonWorksCommand,
    comment: executePersonCommentCommand,
    "edit-comment": executePersonEditCommentCommand,
    "delete-comment": executePersonDeleteCommentCommand,
  }[command];

  if (!executor) {
    throw new CommandError("Usage: bgm person <get|search|casts|collects|comments|indexes|photos|photos-preview|photo|photo-comments|relations|works|comment|edit-comment|delete-comment> ...");
  }

  const result = await executor(args, context);
  printResult(result, context);
}

async function executePersonGetCommand(args) {
  const options = parseFlags(args);
  const personId = firstPositional(options);
  if (!personId) {
    throw new CommandError("Usage: bgm person get <person_id>");
  }

  return {
    resource: "person",
    data: await new BangumiClient(getConfig()).getPerson(personId),
  };
}

async function executePersonSearchCommand(args) {
  const options = parseFlags(args);
  const keyword = firstPositional(options);
  if (!keyword) {
    throw new CommandError("Usage: bgm person search <keyword> [--career <seiyu,writer,...>] [--limit n] [--offset n]");
  }

  const limit = normalizePageSize(options.limit);
  const offset = normalizeNonNegativeInteger(options.offset, "offset");
  const career = normalizeCareerFilter(options.career);
  const result = await new BangumiClient(getConfig()).searchPersons({
    keyword,
    limit,
    offset,
    filter: career ? { career } : {},
  });
  return wrapList(result, "person-search", "Persons", { keyword, limit, offset, career: career ?? [] });
}

async function executePersonCastsCommand(args) {
  const { client, id, query } = parsePersonListArgs(args, "casts", "[--type <main|support|guest|n>] [--subject-type <book|anime|music|game|real>]");
  const result = await client.listPersonCasts(id, {
    ...query,
    type: normalizeCastType(query.type),
    subjectType: normalizeSubjectType(query.subjectType),
  });
  return wrapList(result, "person-casts", "Person casts", { personId: Number(id), ...query });
}

async function executePersonCollectsCommand(args) {
  const { client, id, query } = parsePersonListArgs(args, "collects");
  const result = await client.listPersonCollects(id, query);
  return wrapList(result, "person-collects", "Person collectors", { personId: Number(id), ...query });
}

async function executePersonCommentsCommand(args) {
  const { client, id, query } = parsePersonListArgs(args, "comments");
  const result = await client.listPersonComments(id, query);
  return wrapList(result, "person-comments", "Person comments", { personId: Number(id), ...query });
}

async function executePersonIndexesCommand(args) {
  const { client, id, query } = parsePersonListArgs(args, "indexes");
  const result = await client.listPersonIndexes(id, query);
  return wrapList(result, "person-indexes", "Person indexes", { personId: Number(id), ...query });
}

async function executePersonPhotosCommand(args) {
  const { client, id, query } = parsePersonListArgs(args, "photos");
  const result = await client.listPersonPhotos(id, query);
  return wrapList(result, "person-photos", "Person photos", { personId: Number(id), ...query });
}

async function executePersonPhotoPreviewCommand(args) {
  const options = parseFlags(args);
  const personId = firstPositional(options);
  if (!personId) {
    throw new CommandError("Usage: bgm person photos-preview <person_id> [--limit n]");
  }

  const limit = normalizePhotoPreviewLimit(options.limit);
  const result = await new BangumiClient(getConfig()).listPersonPhotoPreview(personId, { limit });
  return wrapList(result, "person-photos-preview", "Person photo preview", { personId: Number(personId), limit });
}

async function executePersonPhotoCommand(args) {
  const options = parseFlags(args);
  const personId = firstPositional(options);
  const photoId = getPositional(options, 1);
  if (!personId || !photoId) {
    throw new CommandError("Usage: bgm person photo <person_id> <photo_id>");
  }

  return {
    resource: "mono-photo",
    scope: "person",
    targetId: Number(personId),
    photoId: Number(photoId),
    data: await new BangumiClient(getConfig()).getPersonPhoto(personId, photoId),
  };
}

async function executePersonPhotoCommentsCommand(args) {
  const options = parseFlags(args);
  const personId = firstPositional(options);
  const photoId = getPositional(options, 1);
  if (!personId || !photoId) {
    throw new CommandError("Usage: bgm person photo-comments <person_id> <photo_id>");
  }

  const data = await new BangumiClient(getConfig()).listPersonPhotoComments(personId, photoId);
  return {
    resource: "mono-photo-comments",
    scope: "person",
    targetId: Number(personId),
    photoId: Number(photoId),
    data,
  };
}

async function executePersonRelationsCommand(args) {
  const { client, id, query } = parsePersonListArgs(args, "relations");
  const result = await client.listPersonRelations(id, query);
  return wrapList(result, "person-relations", "Person relations", { personId: Number(id), ...query });
}

async function executePersonWorksCommand(args) {
  const { client, id, query } = parsePersonListArgs(args, "works");
  const result = await client.listPersonWorks(id, query);
  return wrapList(result, "person-works", "Person works", { personId: Number(id), ...query });
}

async function executePersonCommentCommand(args, context = {}) {
  const options = parseFlags(args);
  const personId = firstPositional(options);
  const content = getPositional(options, 1) ?? options.content;
  const replyTo = normalizeNonNegativeInteger(options.replyTo, "reply-to") ?? 0;
  if (!personId || !content) {
    throw new CommandError("Usage: bgm person comment <person_id> <content> [--reply-to <comment_id>] [--turnstile-token <token>] [--manual]");
  }

  const turnstileToken = await resolveTurnstileTokenForMutation(options, {
    actionLabel: "create a person comment",
    context,
  });
  const result = await new BangumiClient(getConfig()).createPersonComment(personId, {
    content,
    replyTo,
    turnstileToken,
  });

  return buildCommentMutationResult("person", "create", {
    targetId: personId,
    commentId: result.id,
    replyTo,
  });
}

async function executePersonEditCommentCommand(args) {
  const options = parseFlags(args);
  const commentId = firstPositional(options);
  const content = getPositional(options, 1) ?? options.content;
  if (!commentId || !content) {
    throw new CommandError("Usage: bgm person edit-comment <comment_id> <content>");
  }

  await new BangumiClient(getConfig()).updatePersonComment(commentId, { content });
  return buildCommentMutationResult("person", "edit", { commentId });
}

async function executePersonDeleteCommentCommand(args) {
  const options = parseFlags(args);
  const commentId = firstPositional(options);
  if (!commentId) {
    throw new CommandError("Usage: bgm person delete-comment <comment_id>");
  }

  await new BangumiClient(getConfig()).deletePersonComment(commentId);
  return buildCommentMutationResult("person", "delete", { commentId });
}

function parsePersonListArgs(args, subcommand, suffix = "") {
  const options = parseFlags(args);
  const id = firstPositional(options);
  if (!id) {
    throw new CommandError(`Usage: bgm person ${subcommand} <person_id> ${suffix} [--limit n] [--offset n]`.trim());
  }

  return {
    client: new BangumiClient(getConfig()),
    id,
    query: {
      limit: normalizePageSize(options.limit),
      offset: normalizeNonNegativeInteger(options.offset, "offset"),
      type: options.type,
      subjectType: options.subjectType,
    },
  };
}

function normalizeCastType(value) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const mapped = {
    main: 1,
    major: 1,
    support: 2,
    supporting: 2,
    guest: 3,
  }[String(value).toLowerCase()];
  return mapped ?? parseOptionalInteger(value);
}

function normalizePhotoPreviewLimit(value) {
  const parsed = parseOptionalInteger(value);
  if (parsed === undefined) {
    return undefined;
  }
  if (parsed < 1 || parsed > 20) {
    throw new CommandError(`Expected limit to be between 1 and 20, received: ${value}`);
  }
  return parsed;
}

function wrapList(result, resource, title, filters) {
  const normalized = normalizeListResult(result);
  return {
    ...normalized,
    resource,
    title,
    filters,
  };
}

function normalizeCareerFilter(value) {
  return value === undefined ? undefined : splitFilterValues(value);
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

function buildCommentMutationResult(scope, action, details) {
  return {
    resource: "mono-comment-mutation",
    scope,
    action,
    targetId: details.targetId !== undefined ? Number(details.targetId) : undefined,
    commentId: details.commentId !== undefined ? Number(details.commentId) : undefined,
    replyTo: details.replyTo !== undefined ? Number(details.replyTo) : undefined,
  };
}
