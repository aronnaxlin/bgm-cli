import { BangumiClient } from "../core/client.js";
import { getConfig } from "../core/config.js";
import { CommandError, printResult } from "../core/output.js";
import { firstPositional, parseFlags } from "../utils/args.js";
import {
  normalizeNonNegativeInteger,
  normalizePageSize,
  parseOptionalBoolean,
  parseOptionalInteger,
} from "../utils/helpers.js";
import { normalizeSubjectType } from "../utils/validators.js";

export async function runCharacterCommand(command, args, context) {
  const executor = {
    get: executeCharacterGetCommand,
    search: executeCharacterSearchCommand,
    casts: executeCharacterCastsCommand,
    collects: executeCharacterCollectsCommand,
    comments: executeCharacterCommentsCommand,
    indexes: executeCharacterIndexesCommand,
    photos: executeCharacterPhotosCommand,
    relations: executeCharacterRelationsCommand,
  }[command];

  if (!executor) {
    throw new CommandError("Usage: bgm character <get|search|casts|collects|comments|indexes|photos|relations> ...");
  }

  const result = await executor(args);
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

async function executeCharacterRelationsCommand(args) {
  const { client, id, query } = parseCharacterListArgs(args, "relations");
  const result = await client.listCharacterRelations(id, query);
  return wrapList(result, "character-relations", "Character relations", { characterId: Number(id), ...query });
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

function wrapList(result, resource, title, filters) {
  return {
    ...result,
    resource,
    title,
    filters,
  };
}
