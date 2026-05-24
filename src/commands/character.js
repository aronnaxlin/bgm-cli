import { BangumiClient } from "../core/client.js";
import { getConfig } from "../core/config.js";
import { CommandError, printResult } from "../core/output.js";
import { firstPositional, getPositional, parseFlags } from "../utils/args.js";
import {
  normalizeNonNegativeInteger,
  normalizePageSize,
  parseOptionalBoolean,
  parseOptionalInteger,
} from "../utils/helpers.js";
import { normalizeSubjectType } from "../utils/validators.js";
import { resolveTurnstileTokenForMutation } from "../utils/turnstile-flow.js";

export async function runCharacterCommand(command, args, context) {
  const executor = {
    get: executeCharacterGetCommand,
    search: executeCharacterSearchCommand,
    casts: executeCharacterCastsCommand,
    collects: executeCharacterCollectsCommand,
    comments: executeCharacterCommentsCommand,
    indexes: executeCharacterIndexesCommand,
    photos: executeCharacterPhotosCommand,
    "photos-preview": executeCharacterPhotoPreviewCommand,
    photo: executeCharacterPhotoCommand,
    "photo-comments": executeCharacterPhotoCommentsCommand,
    relations: executeCharacterRelationsCommand,
    comment: executeCharacterCommentCommand,
    "edit-comment": executeCharacterEditCommentCommand,
    "delete-comment": executeCharacterDeleteCommentCommand,
  }[command];

  if (!executor) {
    throw new CommandError("Usage: bgm character <get|search|casts|collects|comments|indexes|photos|photos-preview|photo|photo-comments|relations|comment|edit-comment|delete-comment> ...");
  }

  const result = await executor(args, context);
  printResult(result, context);
}

async function executeCharacterGetCommand(args) {
  const options = parseFlags(args);
  const characterId = firstPositional(options);
  if (!characterId) {
    throw new CommandError("Usage: bgm character get <character_id>");
  }

  return {
    resource: "character",
    data: await new BangumiClient(getConfig()).getCharacter(characterId),
  };
}

async function executeCharacterSearchCommand(args) {
  const options = parseFlags(args);
  const keyword = firstPositional(options);
  if (!keyword) {
    throw new CommandError("Usage: bgm character search <keyword> [--nsfw <true|false>] [--limit n] [--offset n]");
  }

  const limit = normalizePageSize(options.limit);
  const offset = normalizeNonNegativeInteger(options.offset, "offset");
  const filter = {};
  if (options.nsfw !== undefined) {
    filter.nsfw = parseOptionalBoolean(options.nsfw);
  }

  const result = await new BangumiClient(getConfig()).searchCharacters({
    keyword,
    limit,
    offset,
    filter,
  });
  return wrapList(result, "character-search", "Characters", { keyword, limit, offset, nsfw: filter.nsfw });
}

async function executeCharacterCastsCommand(args) {
  const { client, id, query } = parseCharacterListArgs(args, "casts", "[--type <main|support|guest|n>] [--subject-type <book|anime|music|game|real>]");
  const result = await client.listCharacterCasts(id, {
    ...query,
    type: normalizeCastType(query.type),
    subjectType: normalizeSubjectType(query.subjectType),
  });
  return wrapList(result, "character-casts", "Character casts", { characterId: Number(id), ...query });
}

async function executeCharacterCollectsCommand(args) {
  const { client, id, query } = parseCharacterListArgs(args, "collects");
  const result = await client.listCharacterCollects(id, query);
  return wrapList(result, "character-collects", "Character collectors", { characterId: Number(id), ...query });
}

async function executeCharacterCommentsCommand(args) {
  const { client, id, query } = parseCharacterListArgs(args, "comments");
  const result = await client.listCharacterComments(id, query);
  return wrapList(result, "character-comments", "Character comments", { characterId: Number(id), ...query });
}

async function executeCharacterIndexesCommand(args) {
  const { client, id, query } = parseCharacterListArgs(args, "indexes");
  const result = await client.listCharacterIndexes(id, query);
  return wrapList(result, "character-indexes", "Character indexes", { characterId: Number(id), ...query });
}

async function executeCharacterPhotosCommand(args) {
  const { client, id, query } = parseCharacterListArgs(args, "photos");
  const result = await client.listCharacterPhotos(id, query);
  return wrapList(result, "character-photos", "Character photos", { characterId: Number(id), ...query });
}

async function executeCharacterPhotoPreviewCommand(args) {
  const options = parseFlags(args);
  const characterId = firstPositional(options);
  if (!characterId) {
    throw new CommandError("Usage: bgm character photos-preview <character_id> [--limit n]");
  }

  const limit = normalizePhotoPreviewLimit(options.limit);
  const result = await new BangumiClient(getConfig()).listCharacterPhotoPreview(characterId, { limit });
  return wrapList(result, "character-photos-preview", "Character photo preview", { characterId: Number(characterId), limit });
}

async function executeCharacterPhotoCommand(args) {
  const options = parseFlags(args);
  const characterId = firstPositional(options);
  const photoId = getPositional(options, 1);
  if (!characterId || !photoId) {
    throw new CommandError("Usage: bgm character photo <character_id> <photo_id>");
  }

  return {
    resource: "mono-photo",
    scope: "character",
    targetId: Number(characterId),
    photoId: Number(photoId),
    data: await new BangumiClient(getConfig()).getCharacterPhoto(characterId, photoId),
  };
}

async function executeCharacterPhotoCommentsCommand(args) {
  const options = parseFlags(args);
  const characterId = firstPositional(options);
  const photoId = getPositional(options, 1);
  if (!characterId || !photoId) {
    throw new CommandError("Usage: bgm character photo-comments <character_id> <photo_id>");
  }

  const data = await new BangumiClient(getConfig()).listCharacterPhotoComments(characterId, photoId);
  return {
    resource: "mono-photo-comments",
    scope: "character",
    targetId: Number(characterId),
    photoId: Number(photoId),
    data,
  };
}

async function executeCharacterRelationsCommand(args) {
  const { client, id, query } = parseCharacterListArgs(args, "relations");
  const result = await client.listCharacterRelations(id, query);
  return wrapList(result, "character-relations", "Character relations", { characterId: Number(id), ...query });
}

async function executeCharacterCommentCommand(args, context = {}) {
  const options = parseFlags(args);
  const characterId = firstPositional(options);
  const content = getPositional(options, 1) ?? options.content;
  const replyTo = normalizeNonNegativeInteger(options.replyTo, "reply-to") ?? 0;
  if (!characterId || !content) {
    throw new CommandError("Usage: bgm character comment <character_id> <content> [--reply-to <comment_id>] [--turnstile-token <token>] [--manual]");
  }

  const turnstileToken = await resolveTurnstileTokenForMutation(options, {
    actionLabel: "create a character comment",
    context,
  });
  const result = await new BangumiClient(getConfig()).createCharacterComment(characterId, {
    content,
    replyTo,
    turnstileToken,
  });

  return buildCommentMutationResult("character", "create", {
    targetId: characterId,
    commentId: result.id,
    replyTo,
  });
}

async function executeCharacterEditCommentCommand(args) {
  const options = parseFlags(args);
  const commentId = firstPositional(options);
  const content = getPositional(options, 1) ?? options.content;
  if (!commentId || !content) {
    throw new CommandError("Usage: bgm character edit-comment <comment_id> <content>");
  }

  await new BangumiClient(getConfig()).updateCharacterComment(commentId, { content });
  return buildCommentMutationResult("character", "edit", { commentId });
}

async function executeCharacterDeleteCommentCommand(args) {
  const options = parseFlags(args);
  const commentId = firstPositional(options);
  if (!commentId) {
    throw new CommandError("Usage: bgm character delete-comment <comment_id>");
  }

  await new BangumiClient(getConfig()).deleteCharacterComment(commentId);
  return buildCommentMutationResult("character", "delete", { commentId });
}

function parseCharacterListArgs(args, subcommand, suffix = "") {
  const options = parseFlags(args);
  const id = firstPositional(options);
  if (!id) {
    throw new CommandError(`Usage: bgm character ${subcommand} <character_id> ${suffix} [--limit n] [--offset n]`.trim());
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
