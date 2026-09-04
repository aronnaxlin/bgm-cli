/**
 * Bangumi URL parsing and command resolution.
 *
 * Turns a pasted bgm.tv / bangumi.tv / chii.in / next.bgm.tv / api.bgm.tv link
 * into the bgm CLI command that shows the same resource. Resolution is pure and
 * offline: no request is made while parsing.
 */

import { CommandError } from "../core/output.js";

export const WEB_HOSTS = new Set(["bgm.tv", "bangumi.tv", "chii.in", "next.bgm.tv"]);
export const API_HOSTS = new Set(["api.bgm.tv"]);

/** Page size assumed when a URL carries ?page=n and no explicit limit. */
export const URL_PAGE_SIZE = 20;

const SUBJECT_TYPE_SLUGS = new Set(["book", "anime", "music", "game", "real"]);

const SUBJECT_SEARCH_CATEGORIES = {
  1: "book",
  2: "anime",
  3: "music",
  4: "game",
  6: "real",
};

/** Old-site collection status path segments -> CLI --status values. */
const COLLECTION_STATUS_SLUGS = {
  wish: "wish",
  collect: "collect",
  do: "doing",
  on_hold: "on_hold",
  dropped: "dropped",
};

const SUBJECT_SUBPAGES = {
  comments: ["subject", "comments"],
  reviews: ["subject", "reviews"],
  board: ["subject", "topics"],
  characters: ["subject", "characters"],
  persons: ["subject", "staff"],
  collections: ["subject", "collects"],
  index: ["subject", "indexes"],
  ep: ["episode", "list"],
};

const CHARACTER_SUBPAGES = {
  collections: "collects",
  indices: "indexes",
  album: "photos",
};

const PERSON_SUBPAGES = {
  collections: "collects",
  indices: "indexes",
  album: "photos",
  works: "works",
  collabs: "relations",
};

const SUBJECT_LIST_SORTS = new Set(["date", "rank"]);
const SUBJECT_SEARCH_SORTS = new Set(["match", "heat", "rank", "score"]);
const COLLECTION_SORTS = new Set(["updated", "name", "rank", "community_score", "user_score", "date"]);

/**
 * Parse a possible Bangumi URL. Returns null when the value is not a URL on a
 * supported host, so callers can fall back to normal command parsing.
 */
export function parseBangumiUrl(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (trimmed === "" || /\s/.test(trimmed)) {
    return null;
  }

  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let parsed;
  try {
    parsed = new URL(withScheme);
  } catch {
    return null;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return null;
  }

  const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
  if (!WEB_HOSTS.has(host) && !API_HOSTS.has(host)) {
    return null;
  }

  const segments = parsed.pathname
    .split("/")
    .filter(Boolean)
    .map(decodeSegment);

  const query = {};
  for (const [key, entry] of parsed.searchParams.entries()) {
    if (query[key] === undefined) {
      query[key] = entry;
    }
  }

  return {
    url: trimmed,
    host,
    kind: API_HOSTS.has(host) ? "api" : "web",
    path: `/${segments.join("/")}`,
    segments,
    query,
    hash: parsed.hash.replace(/^#/, ""),
  };
}

export function looksLikeBangumiUrl(value) {
  return parseBangumiUrl(value) !== null;
}

/**
 * Resolve a Bangumi URL into { group, command, args }.
 * Throws a CommandError (with a `bgm ...` suggestion when one can be derived)
 * for supported hosts whose path has no CLI equivalent.
 */
export function resolveBangumiUrl(value) {
  const parsed = parseBangumiUrl(value);
  if (!parsed) {
    throw new CommandError(
      `Not a supported Bangumi URL: ${value}\nSupported hosts: ${[...WEB_HOSTS, ...API_HOSTS].join(", ")}`,
    );
  }

  const resolved = parsed.kind === "api" ? resolveApiPath(parsed) : resolveWebPath(parsed);
  return {
    ...resolved,
    url: parsed.url,
    site: parsed.host,
  };
}

export function formatResolvedCommand(resolved) {
  return ["bgm", resolved.group, resolved.command, ...resolved.args]
    .filter((entry) => entry !== undefined && entry !== "")
    .map(quoteArg)
    .join(" ");
}

function resolveWebPath(parsed) {
  const { segments } = parsed;
  if (segments.length === 0) {
    throw unsupported(parsed, "The site homepage has no single CLI equivalent.");
  }

  switch (segments[0]) {
    case "subject":
      return resolveSubject(parsed);
    case "group":
      return resolveGroup(parsed);
    case "ep":
      return command("episode", "get", [requireId(segments[1], "episode id", parsed)], parsed);
    case "character":
      return resolveMono(parsed, "character", CHARACTER_SUBPAGES);
    case "person":
      return resolveMono(parsed, "person", PERSON_SUBPAGES);
    case "user":
      return resolveUser(parsed);
    case "blog":
      return resolveBlog(parsed);
    case "index":
      return resolveIndex(parsed);
    case "subject_search":
      return resolveSubjectSearch(parsed);
    case "mono_search":
      return resolveMonoSearch(parsed);
    case "calendar":
      return command("calendar", "all", [], parsed);
    case "timeline":
      return command("timeline", "list", pagingArgs(parsed, { untilKey: "until" }), parsed);
    case "notify":
      return command("notify", "list", pagingArgs(parsed, { limitOnly: true }), parsed);
    case "rakuen":
      return resolveRakuen(parsed);
    default:
      if (SUBJECT_TYPE_SLUGS.has(segments[0])) {
        return resolveTypeSection(parsed);
      }
      throw unsupported(parsed);
  }
}

function resolveSubject(parsed) {
  const { segments } = parsed;

  if (segments[1] === "topic") {
    const topicId = requireId(segments[2], "topic id", parsed);
    const postId = postIdFromHash(parsed.hash);
    if (postId) {
      return command("subject", "post", [postId], parsed);
    }
    return command("subject", "topic", [topicId], parsed);
  }

  const subjectId = requireId(segments[1], "subject id", parsed);
  const sub = segments[2];

  if (sub === undefined) {
    return command("subject", "get", [subjectId], parsed);
  }

  const mapped = SUBJECT_SUBPAGES[sub];
  if (!mapped || segments.length > 3) {
    throw unsupported(parsed, undefined, `bgm subject get ${subjectId}`);
  }

  const [group, name] = mapped;
  const args = [subjectId, ...pagingArgs(parsed)];
  if (group === "subject" && name === "comments") {
    const type = collectionStatusFromQuery(parsed.query.type ?? parsed.query.filter);
    if (type) {
      args.push("--type", type);
    }
  }
  return command(group, name, args, parsed);
}

function resolveGroup(parsed) {
  const { segments } = parsed;

  if (segments[1] === "topic") {
    const topicId = requireId(segments[2], "topic id", parsed);
    const postId = postIdFromHash(parsed.hash);
    if (postId) {
      return command("group", "post", [postId], parsed);
    }
    return command("group", "topic", [topicId], parsed);
  }

  if (segments[1] === "category") {
    const args = pagingArgs(parsed);
    if (segments[2] === "all" || segments[2] === undefined) {
      args.unshift("--mode", "all");
    }
    return command("group", "list", args, parsed);
  }

  const name = requireSlug(segments[1], "group name", parsed);
  const sub = segments[2];

  if (sub === undefined) {
    return command("group", "get", [name], parsed);
  }
  if (sub === "forum" && segments.length === 3) {
    return command("group", "topics", [name, ...pagingArgs(parsed)], parsed);
  }
  if (sub === "members" && segments.length === 3) {
    const args = [name, ...pagingArgs(parsed)];
    if (typeof parsed.query.role === "string" && parsed.query.role !== "") {
      args.push("--role", parsed.query.role);
    }
    return command("group", "members", args, parsed);
  }

  throw unsupported(parsed, undefined, `bgm group get ${name}`);
}

function resolveMono(parsed, kind, subpages) {
  const { segments } = parsed;
  const id = requireId(segments[1], `${kind} id`, parsed);
  const sub = segments[2];

  if (sub === undefined) {
    return command(kind, "get", [id], parsed);
  }

  const mapped = subpages[sub];
  if (!mapped || (segments.length > 3 && sub !== "works")) {
    throw unsupported(parsed, undefined, `bgm ${kind} get ${id}`);
  }

  return command(kind, mapped, [id, ...pagingArgs(parsed)], parsed);
}

function resolveUser(parsed) {
  const { segments } = parsed;
  const username = requireSlug(segments[1], "username", parsed);
  const sub = segments[2];

  if (sub === undefined) {
    return command("user", "get", [username], parsed);
  }

  if (segments.length === 3) {
    switch (sub) {
      case "timeline":
        return command("timeline", "user", [username, ...pagingArgs(parsed, { untilKey: "until" })], parsed);
      case "blog":
        return command("blog", "list", ["--user", username, ...pagingArgs(parsed)], parsed);
      case "index":
        return command("index", "user", [username, ...pagingArgs(parsed)], parsed);
      case "friends":
        return command("user", "friends", [username, ...pagingArgs(parsed)], parsed);
      case "followers":
        return command("user", "followers", [username, ...pagingArgs(parsed)], parsed);
      case "groups":
        return command("group", "user", [username, ...pagingArgs(parsed)], parsed);
      case "mono":
        throw unsupported(
          parsed,
          "This page mixes character and person collections.",
          `bgm collection characters --user ${username}\n              bgm collection persons --user ${username}`,
        );
      default:
        break;
    }
  }

  if (sub === "mono" && segments.length === 4) {
    if (segments[3] === "character") {
      return command("collection", "characters", ["--user", username, ...pagingArgs(parsed)], parsed);
    }
    if (segments[3] === "person") {
      return command("collection", "persons", ["--user", username, ...pagingArgs(parsed)], parsed);
    }
  }

  throw unsupported(parsed, undefined, `bgm user get ${username}`);
}

function resolveBlog(parsed) {
  const { segments } = parsed;
  const blogId = requireId(segments[1], "blog id", parsed);

  if (segments.length === 2) {
    return command("blog", "get", [blogId], parsed);
  }
  if (segments[2] === "photos" && segments.length === 3) {
    return command("blog", "photos", [blogId, ...pagingArgs(parsed)], parsed);
  }

  throw unsupported(parsed, undefined, `bgm blog get ${blogId}`);
}

function resolveIndex(parsed) {
  const { segments } = parsed;
  const indexId = requireId(segments[1], "index id", parsed);

  if (segments.length === 2) {
    return command("index", "get", [indexId], parsed);
  }
  if (segments[2] === "comments" && segments.length === 3) {
    return command("index", "comments", [indexId], parsed);
  }

  throw unsupported(parsed, undefined, `bgm index get ${indexId}`);
}

function resolveSubjectSearch(parsed) {
  const keyword = requireKeyword(parsed.segments[1], parsed);
  const args = [keyword];

  const type = SUBJECT_SEARCH_CATEGORIES[Number(parsed.query.cat)];
  if (type) {
    args.push("--type", type);
  }
  if (SUBJECT_SEARCH_SORTS.has(parsed.query.sort)) {
    args.push("--sort", parsed.query.sort);
  }

  return command("subject", "search", args, parsed);
}

function resolveMonoSearch(parsed) {
  const keyword = requireKeyword(parsed.segments[1], parsed);
  const cat = Number(parsed.query.cat);
  const group = cat === 2 ? "person" : "character";
  return command(group, "search", [keyword, ...pagingArgs(parsed)], parsed);
}

function resolveTypeSection(parsed) {
  const { segments } = parsed;
  const type = segments[0];
  const section = segments[1];

  if (section === "list") {
    const username = requireSlug(segments[2], "username", parsed);
    const args = ["--user", username, "--type", type];
    const status = COLLECTION_STATUS_SLUGS[segments[3] ?? ""];
    if (segments[3] !== undefined && !status) {
      throw unsupported(parsed, undefined, `bgm collection list --user ${username} --type ${type}`);
    }
    if (status) {
      args.push("--status", status);
    }
    if (typeof parsed.query.tag === "string" && parsed.query.tag !== "") {
      args.push("--tag", parsed.query.tag);
    }
    if (COLLECTION_SORTS.has(parsed.query.orderby)) {
      args.push("--sort", parsed.query.orderby);
    }
    args.push(...pagingArgs(parsed));
    return command("collection", "list", args, parsed);
  }

  if (section === "browser" && segments.length === 2) {
    const args = ["--type", type];
    if (SUBJECT_LIST_SORTS.has(parsed.query.sort)) {
      args.push("--sort", parsed.query.sort);
    }
    args.push(...pagingArgs(parsed, { limitOnly: true }));
    return command("subject", "list", args, parsed);
  }

  if (section === "tag" && segments.length === 3) {
    const args = ["--type", type, "--tag", segments[2]];
    if (SUBJECT_LIST_SORTS.has(parsed.query.sort)) {
      args.push("--sort", parsed.query.sort);
    }
    args.push(...pagingArgs(parsed, { limitOnly: true }));
    return command("subject", "list", args, parsed);
  }

  throw unsupported(parsed, undefined, `bgm subject list --type ${type}`);
}

function resolveRakuen(parsed) {
  const { segments } = parsed;
  if (segments[1] === "topic" && segments[3] !== undefined) {
    const id = String(segments[3]);
    if (/^\d+$/.test(id) && (segments[2] === "group" || segments[2] === "subject")) {
      throw unsupported(parsed, undefined, `bgm ${segments[2]} topic ${id}`);
    }
  }
  throw unsupported(parsed);
}

function resolveApiPath(parsed) {
  const { segments } = parsed;

  if (segments[0] === "calendar") {
    return command("calendar", "all", [], parsed);
  }
  if (segments[0] !== "v0") {
    throw unsupported(parsed);
  }

  const resource = segments[1];
  const id = segments[2];
  const sub = segments[3];

  switch (resource) {
    case "me":
      return command("user", "me", [], parsed);
    case "subjects": {
      const subjectId = requireId(id, "subject id", parsed);
      if (sub === undefined) {
        return command("subject", "get", [subjectId], parsed);
      }
      if (sub === "persons") {
        return command("subject", "staff", [subjectId, ...pagingArgs(parsed)], parsed);
      }
      if (sub === "characters") {
        return command("subject", "characters", [subjectId, ...pagingArgs(parsed)], parsed);
      }
      if (sub === "subjects") {
        return command("subject", "relations", [subjectId, ...pagingArgs(parsed)], parsed);
      }
      throw unsupported(parsed, undefined, `bgm subject get ${subjectId}`);
    }
    case "episodes": {
      if (id === undefined) {
        const subjectId = requireId(parsed.query.subject_id, "subject id", parsed);
        const args = [subjectId, ...pagingArgs(parsed)];
        return command("episode", "list", args, parsed);
      }
      return command("episode", "get", [requireId(id, "episode id", parsed)], parsed);
    }
    case "characters": {
      const characterId = requireId(id, "character id", parsed);
      if (sub === undefined) {
        return command("character", "get", [characterId], parsed);
      }
      if (sub === "subjects" || sub === "persons") {
        return command("character", "casts", [characterId, ...pagingArgs(parsed)], parsed);
      }
      throw unsupported(parsed, undefined, `bgm character get ${characterId}`);
    }
    case "persons": {
      const personId = requireId(id, "person id", parsed);
      if (sub === undefined) {
        return command("person", "get", [personId], parsed);
      }
      if (sub === "subjects") {
        return command("person", "works", [personId, ...pagingArgs(parsed)], parsed);
      }
      if (sub === "characters") {
        return command("person", "casts", [personId, ...pagingArgs(parsed)], parsed);
      }
      throw unsupported(parsed, undefined, `bgm person get ${personId}`);
    }
    case "users": {
      const username = requireSlug(id, "username", parsed);
      if (sub === undefined) {
        return command("user", "get", [username], parsed);
      }
      if (sub === "collections") {
        const args = ["--user", username];
        const type = SUBJECT_TYPE_SLUGS.has(parsed.query.subject_type)
          ? parsed.query.subject_type
          : SUBJECT_SEARCH_CATEGORIES[Number(parsed.query.subject_type)];
        if (type) {
          args.push("--type", type);
        }
        args.push(...pagingArgs(parsed));
        return command("collection", "list", args, parsed);
      }
      throw unsupported(parsed, undefined, `bgm user get ${username}`);
    }
    case "indices": {
      const indexId = requireId(id, "index id", parsed);
      if (sub === undefined) {
        return command("index", "get", [indexId], parsed);
      }
      if (sub === "subjects") {
        return command("index", "related", [indexId, "--cat", "subject", ...pagingArgs(parsed)], parsed);
      }
      throw unsupported(parsed, undefined, `bgm index get ${indexId}`);
    }
    default:
      throw unsupported(parsed);
  }
}

function command(group, name, args, parsed) {
  return {
    group,
    command: name,
    args: args.map(String),
    path: parsed.path,
  };
}

/**
 * Translate ?page= / ?limit= / ?offset= into CLI paging flags.
 * A page beyond the first also pins --limit so the offset stays meaningful.
 */
function pagingArgs(parsed, { limitOnly = false, untilKey } = {}) {
  const args = [];
  const explicitLimit = positiveIntOrNull(parsed.query.limit);
  const page = positiveIntOrNull(parsed.query.page);
  const offset = nonNegativeIntOrNull(parsed.query.offset);
  const limit = explicitLimit ?? (page !== null && page > 1 ? URL_PAGE_SIZE : null);

  if (limit !== null) {
    args.push("--limit", String(limit));
  }

  if (untilKey && typeof parsed.query[untilKey] === "string" && /^\d+$/.test(parsed.query[untilKey])) {
    args.push("--until", parsed.query[untilKey]);
    return args;
  }

  if (limitOnly) {
    return args;
  }

  if (offset !== null) {
    args.push("--offset", String(offset));
  } else if (page !== null && page > 1) {
    args.push("--offset", String((page - 1) * (limit ?? URL_PAGE_SIZE)));
  }

  return args;
}

function collectionStatusFromQuery(value) {
  if (typeof value !== "string" || value === "") {
    return undefined;
  }
  return COLLECTION_STATUS_SLUGS[value.toLowerCase()];
}

function postIdFromHash(hash) {
  const match = /^post_(\d+)$/.exec(String(hash ?? ""));
  return match ? match[1] : undefined;
}

function decodeSegment(segment) {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function positiveIntOrNull(value) {
  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    return null;
  }
  const parsed = Number(value);
  return parsed > 0 ? parsed : null;
}

function nonNegativeIntOrNull(value) {
  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    return null;
  }
  return Number(value);
}

function requireId(value, label, parsed) {
  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    throw unsupported(parsed, `Expected a numeric ${label}.`);
  }
  return value;
}

function requireSlug(value, label, parsed) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]+$/.test(value)) {
    throw unsupported(parsed, `Expected a valid ${label}.`);
  }
  return value;
}

function requireKeyword(value, parsed) {
  if (typeof value !== "string" || value === "") {
    throw unsupported(parsed, "Expected a search keyword in the URL path.");
  }
  return value;
}

function unsupported(parsed, reason, suggestion) {
  const lines = [`Unsupported Bangumi URL path: ${parsed.path || "/"}`];
  if (reason) {
    lines.push(reason);
  }
  if (suggestion) {
    lines.push(`Did you mean: ${suggestion}`);
  } else {
    lines.push("Run `bgm url --help` to see the supported link shapes.");
  }
  return new CommandError(lines.join("\n"));
}

function quoteArg(value) {
  const text = String(value);
  return /[\s"'#]/.test(text) ? JSON.stringify(text) : text;
}
