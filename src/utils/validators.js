/**
 * Input validation and normalization utilities.
 */

import { splitFilterValues } from "./args.js";
import {
  normalizeNonNegativeInteger,
  normalizePositiveInteger,
  parseOptionalInteger,
} from "./helpers.js";
import { CommandError } from "../core/output.js";

export const SUBJECT_TYPE_MAP = {
  book: 1,
  anime: 2,
  music: 3,
  game: 4,
  real: 6,
};

export const COLLECTION_STATUS_MAP = {
  wish: 1,
  collect: 2,
  done: 2,
  doing: 3,
  do: 3,
  on_hold: 4,
  onhold: 4,
  hold: 4,
  dropped: 5,
  drop: 5,
};

export const EPISODE_COLLECTION_STATUS_MAP = {
  queue: 1,
  wish: 1,
  watched: 2,
  watch: 2,
  done: 2,
  collect: 2,
  drop: 3,
  dropped: 3,
  remove: 0,
  clear: 0,
};

export const EPISODE_TYPE_MAP = {
  main: 0,
  sp: 1,
  op: 2,
  ed: 3,
  trailer: 4,
  pv: 4,
  mad: 5,
  other: 6,
};

export const GROUP_SORT_VALUES = new Set(["posts", "topics", "members", "created", "updated"]);
export const GROUP_LIST_MODE_VALUES = new Set(["all", "joined", "managed"]);
export const GROUP_TOPIC_MODE_VALUES = new Set(["all", "joined", "created", "replied"]);
export const TIMELINE_MODE_VALUES = new Set(["all", "friends"]);

export const GROUP_HOT_WINDOWS = {
  day: {
    hours: 24,
    gravity: 1.8,
    groupDecayHours: 6,
  },
  week: {
    hours: 24 * 7,
    gravity: 1.4,
    groupDecayHours: 24,
  },
  month: {
    hours: 24 * 30,
    gravity: 1.1,
    groupDecayHours: 72,
  },
};

export const GROUP_MEMBER_ROLE_MAP = {
  visitor: -2,
  guest: -1,
  member: 0,
  creator: 1,
  owner: 1,
  moderator: 2,
  admin: 2,
  blocked: 3,
  ban: 3,
};

export const INDEX_RELATED_CATEGORY_MAP = {
  subject: 0,
  character: 1,
  person: 2,
  ep: 3,
  episode: 3,
  blog: 4,
  group_topic: 5,
  grouptopic: 5,
  subject_topic: 6,
  subjecttopic: 6,
};

export function normalizeSubjectType(value) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (/^\d+$/.test(String(value))) {
    return Number(value);
  }

  const normalized = SUBJECT_TYPE_MAP[String(value).toLowerCase()];
  if (!normalized) {
    throw new CommandError(`Unsupported subject type: ${value}`);
  }

  return normalized;
}

export function normalizeSubjectTypeFilter(value) {
  if (value === undefined || value === null || value === "") {
    return [];
  }

  return splitFilterValues(value).map((entry) => normalizeSubjectType(entry));
}

export function normalizeCollectionStatusFilter(value) {
  if (value === undefined || value === null || value === "") {
    return [];
  }

  return splitFilterValues(value).map((entry) => {
    const numeric = /^\d+$/.test(entry) ? Number(entry) : undefined;
    if (numeric) {
      return numeric;
    }

    const normalized = COLLECTION_STATUS_MAP[entry.toLowerCase()];
    if (!normalized) {
      throw new CommandError(`Unsupported collection status: ${entry}`);
    }
    return normalized;
  });
}

export function normalizeCollectionStatusValue(value) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const normalized = normalizeCollectionStatusFilter(value);
  if (normalized.length !== 1) {
    throw new CommandError(`Expected exactly one collection status, received: ${value}`);
  }
  return normalized[0];
}

export function normalizeEpisodeCollectionStatusValue(value) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const normalized = String(value).toLowerCase();
  if (/^\d+$/.test(normalized)) {
    const numeric = Number(normalized);
    if ([0, 1, 2, 3].includes(numeric)) {
      return numeric;
    }
  }

  const resolved = EPISODE_COLLECTION_STATUS_MAP[normalized];
  if (resolved === undefined) {
    throw new CommandError(`Unsupported episode status: ${value}`);
  }
  return resolved;
}

export function normalizeEpisodeTypeFilter(value) {
  if (value === undefined || value === null || value === "") {
    return {
      label: undefined,
      queryType: undefined,
      matchTypes: null,
    };
  }

  const normalized = String(value).toLowerCase();
  if (normalized === "op_ed") {
    return {
      label: "op_ed",
      queryType: undefined,
      matchTypes: new Set([EPISODE_TYPE_MAP.op, EPISODE_TYPE_MAP.ed]),
    };
  }

  if (/^\d+$/.test(normalized)) {
    const numeric = Number(normalized);
    if (numeric < 0 || numeric > 6) {
      throw new CommandError(`Unsupported episode type: ${value}`);
    }
    return {
      label: numeric,
      queryType: numeric,
      matchTypes: null,
    };
  }

  const resolved = EPISODE_TYPE_MAP[normalized];
  if (resolved === undefined) {
    throw new CommandError(`Unsupported episode type: ${value}`);
  }

  return {
    label: normalized,
    queryType: resolved,
    matchTypes: null,
  };
}

export function normalizeCollectionSort(value) {
  if (value === undefined || value === null || value === "") {
    return "updated";
  }

  const normalized = String(value).toLowerCase();
  const aliases = {
    score: "community_score",
    community: "community_score",
    rating: "community_score",
    my_score: "user_score",
    user: "user_score",
  };
  const resolved = aliases[normalized] ?? normalized;

  if (!["updated", "name", "rank", "community_score", "user_score", "date"].includes(resolved)) {
    throw new CommandError(`Unsupported sort field: ${value}`);
  }
  return resolved;
}

export function normalizeGroupSort(value) {
  if (value === undefined || value === null || value === "") {
    return "created";
  }

  const normalized = String(value).toLowerCase();
  if (!GROUP_SORT_VALUES.has(normalized)) {
    throw new CommandError(`Unsupported group sort: ${value}`);
  }
  return normalized;
}

export function normalizeGroupListMode(value) {
  if (value === undefined || value === null || value === "") {
    return "all";
  }

  const normalized = String(value).toLowerCase();
  if (!GROUP_LIST_MODE_VALUES.has(normalized)) {
    throw new CommandError(`Unsupported group list mode: ${value}`);
  }
  return normalized;
}

export function normalizeGroupTopicMode(value) {
  if (value === undefined || value === null || value === "") {
    return "all";
  }

  const normalized = String(value).toLowerCase();
  if (!GROUP_TOPIC_MODE_VALUES.has(normalized)) {
    throw new CommandError(`Unsupported group topic mode: ${value}`);
  }
  return normalized;
}

export function normalizeStatusSite(value) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const normalized = String(value).toLowerCase();
  if (!["bgm.tv", "bangumi.tv", "chii.in"].includes(normalized)) {
    throw new CommandError(`Unsupported status site: ${value}`);
  }
  return normalized;
}

export function normalizeStatusAudience(value) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const normalized = String(value).toLowerCase();
  if (["auth", "authenticated"].includes(normalized)) {
    return "Authenticated";
  }
  if (normalized === "guest") {
    return "Guest";
  }
  throw new CommandError(`Unsupported status audience: ${value}`);
}

export function normalizeIndexRelatedCategory(value) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (/^\d+$/.test(String(value))) {
    return Number(value);
  }

  const normalized = INDEX_RELATED_CATEGORY_MAP[String(value).toLowerCase()];
  if (normalized === undefined) {
    throw new CommandError(`Unsupported index related category: ${value}`);
  }
  return normalized;
}

export function normalizeTimelineMode(value) {
  if (value === undefined || value === null || value === "") {
    return "all";
  }

  const normalized = String(value).toLowerCase();
  if (!TIMELINE_MODE_VALUES.has(normalized)) {
    throw new CommandError(`Unsupported timeline mode: ${value}`);
  }
  return normalized;
}

export function normalizeTimelineLimit(value) {
  const parsed = normalizePositiveInteger(value, "limit");
  if (parsed === undefined) {
    return undefined;
  }
  if (parsed > 20) {
    throw new CommandError(`Expected limit to be <= 20, received: ${value}`);
  }
  return parsed;
}

export function normalizeGroupHotWindow(value) {
  if (value === undefined || value === null || value === "") {
    return "day";
  }

  const normalized = String(value).toLowerCase();
  if (!Object.hasOwn(GROUP_HOT_WINDOWS, normalized)) {
    throw new CommandError(`Unsupported hot window: ${value}`);
  }
  return normalized;
}

export function normalizeGroupMemberRole(value) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (/^-?\d+$/.test(String(value))) {
    return Number(value);
  }

  const normalized = GROUP_MEMBER_ROLE_MAP[String(value).toLowerCase()];
  if (normalized === undefined) {
    throw new CommandError(`Unsupported group member role: ${value}`);
  }
  return normalized;
}

export function normalizeHotResultLimit(value) {
  const parsed = normalizeNonNegativeInteger(value, "limit");
  if (parsed === undefined) {
    return 20;
  }
  if (parsed === 0 || parsed > 100) {
    throw new CommandError(`Expected limit to be between 1 and 100, received: ${value}`);
  }
  return parsed;
}

export function normalizeHotScanLimit(value, window) {
  const defaults = {
    day: 300,
    week: 1000,
    month: 3000,
  };
  const parsed = normalizeNonNegativeInteger(value, "scan");
  if (parsed === undefined) {
    return defaults[window];
  }
  if (parsed === 0 || parsed > 5000) {
    throw new CommandError(`Expected scan to be between 1 and 5000, received: ${value}`);
  }
  return parsed;
}

export function normalizeSortOrder(value) {
  if (value === undefined || value === null || value === "") {
    return "desc";
  }

  const normalized = String(value).toLowerCase();
  if (!["asc", "desc"].includes(normalized)) {
    throw new CommandError(`Unsupported sort order: ${value}`);
  }
  return normalized;
}
