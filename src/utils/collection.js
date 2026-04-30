/**
 * Collection/subject/episode fetching and sorting utilities.
 */

import { compareStrings } from "./helpers.js";

export async function fetchAllCollections(client, username, { query = {} } = {}) {
  const pageSize = 100;

  const first = await client.listCollections(username, {
    limit: pageSize,
    offset: 0,
    ...query,
  });

  const firstData = Array.isArray(first.data) ? first.data : [];

  // Only trust API total when it is a finite positive number.
  // Fallback to sequential pagination otherwise to avoid truncating results.
  const hasReliableTotal = Number.isFinite(first.total) && first.total > 0;
  const total = hasReliableTotal ? first.total : firstData.length;

  if (firstData.length === 0 || (hasReliableTotal && firstData.length >= total)) {
    return {
      data: firstData,
      total,
      limit: pageSize,
      offset: 0,
    };
  }

  if (!hasReliableTotal) {
    // Sequential fallback: paginate until an empty or partial page signals the end.
    const all = [...firstData];
    let currentOffset = firstData.length;
    while (true) {
      const page = await client.listCollections(username, {
        limit: pageSize,
        offset: currentOffset,
        ...query,
      });
      const pageData = Array.isArray(page.data) ? page.data : [];
      if (pageData.length === 0) break;
      all.push(...pageData);
      currentOffset += pageData.length;
      if (pageData.length < pageSize) break;
    }
    return {
      data: all,
      total: all.length,
      limit: pageSize,
      offset: 0,
    };
  }

  // Parallel path with bounded concurrency to avoid rate limiting.
  const CONCURRENCY = 8;
  const offsets = [];
  for (let off = firstData.length; off < total; off += pageSize) {
    offsets.push(off);
  }

  const all = [...firstData];
  for (let i = 0; i < offsets.length; i += CONCURRENCY) {
    const batch = offsets.slice(i, i + CONCURRENCY);
    const pages = await Promise.all(
      batch.map((off) =>
        client.listCollections(username, { limit: pageSize, offset: off, ...query })
      )
    );
    for (const page of pages) {
      const data = Array.isArray(page.data) ? page.data : [];
      all.push(...data);
    }
  }

  return {
    data: all,
    total: total || all.length,
    limit: pageSize,
    offset: 0,
  };
}

export async function fetchAllSubjects(client, query) {
  const pageSize = 100;
  const requestedLimit = query.limit ?? pageSize;
  const startOffset = query.offset ?? 0;

  const first = await client.listSubjects({
    ...query,
    limit: pageSize,
    offset: startOffset,
  });

  const firstData = Array.isArray(first.data) ? first.data : [];
  const total = first.total ?? firstData.length;

  const needed = Math.min(requestedLimit, total - startOffset);
  if (firstData.length === 0 || firstData.length >= needed) {
    return {
      data: firstData.slice(0, needed),
      total,
      limit: requestedLimit,
      offset: startOffset,
    };
  }

  // Parallel path with bounded concurrency to avoid rate limiting.
  const CONCURRENCY = 8;
  const offsets = [];
  for (let off = startOffset + firstData.length; off < startOffset + needed; off += pageSize) {
    offsets.push(off);
  }

  const all = [...firstData];
  for (let i = 0; i < offsets.length; i += CONCURRENCY) {
    const batch = offsets.slice(i, i + CONCURRENCY);
    const pages = await Promise.all(
      batch.map((off) =>
        client.listSubjects({
          ...query,
          limit: pageSize,
          offset: off,
        })
      )
    );
    for (const page of pages) {
      const data = Array.isArray(page.data) ? page.data : [];
      all.push(...data);
      if (all.length >= needed) break;
    }
    if (all.length >= needed) break;
  }

  return {
    data: all.slice(0, needed),
    total,
    limit: requestedLimit,
    offset: startOffset,
  };
}

export function sortCollections(items, sort, order) {
  const factor = order === "asc" ? 1 : -1;
  const list = [...items];

  list.sort((left, right) => {
    const leftValue = getCollectionSortValue(left, sort);
    const rightValue = getCollectionSortValue(right, sort);

    if (leftValue < rightValue) {
      return -1 * factor;
    }
    if (leftValue > rightValue) {
      return 1 * factor;
    }

    return compareStrings(
      left?.subject?.name_cn || left?.subject?.name || "",
      right?.subject?.name_cn || right?.subject?.name || "",
    ) * factor;
  });

  return list;
}

export function sortSubjectsByRank(subjects) {
  return [...subjects].sort((left, right) => {
    const leftRank = Number(left?.rating?.rank ?? left?.rank ?? Number.MAX_SAFE_INTEGER);
    const rightRank = Number(right?.rating?.rank ?? right?.rank ?? Number.MAX_SAFE_INTEGER);

    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }

    const leftScore = Number(left?.rating?.score ?? -1);
    const rightScore = Number(right?.rating?.score ?? -1);
    if (leftScore !== rightScore) {
      return rightScore - leftScore;
    }

    const leftName = String(left?.name_cn || left?.name || "");
    const rightName = String(right?.name_cn || right?.name || "");
    return leftName.localeCompare(rightName, "zh-Hans-CN");
  });
}

export function getCollectionSortValue(item, sort) {
  switch (sort) {
    case "name":
      return String(item?.subject?.name_cn || item?.subject?.name || "").toLowerCase();
    case "rank":
      return Number(item?.subject?.rank || Number.MAX_SAFE_INTEGER);
    case "community_score":
      return Number(item?.subject?.score || -1);
    case "user_score":
      return Number(item?.rate || -1);
    case "date":
      return String(item?.subject?.date || "");
    case "updated":
    default:
      return String(item?.updated_at || "");
  }
}

export async function fetchAllEpisodes(client, subjectId, query = {}) {
  const pageSize = 200;
  const first = await client.listEpisodes({
    ...query,
    subject_id: subjectId,
    limit: pageSize,
    offset: 0,
  });

  const firstData = Array.isArray(first.data) ? first.data : [];
  const total = first.total ?? firstData.length;
  if (firstData.length === 0 || firstData.length >= total) {
    return firstData;
  }

  const remaining = [];
  for (let offset = firstData.length; offset < total; offset += pageSize) {
    remaining.push(
      client.listEpisodes({
        ...query,
        subject_id: subjectId,
        limit: pageSize,
        offset,
      })
    );
  }

  const pages = await Promise.all(remaining);
  const all = [...firstData];
  for (const page of pages) {
    all.push(...(Array.isArray(page.data) ? page.data : []));
  }
  return all;
}
