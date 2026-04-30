/**
 * TUI and display formatting utilities.
 */

const TUI_PAGE_SIZE = 7;

export function formatCollectionSnapshotSummary(snapshot) {
  if (!snapshot) {
    return "Current collection: none";
  }

  return [
    "Current collection",
    `  Status: ${formatCollectionStatusLabel(snapshot.type)}`,
    `  Rating: ${snapshot.rate ?? 0}`,
    `  Comment: ${snapshot.comment || "-"}`,
  ].join("\n");
}

export function formatCriteriaSummary(criteria) {
  const entries = Object.entries(criteria).filter(([, value]) => value !== undefined && value !== "");
  if (entries.length === 0) {
    return "";
  }

  const lines = ["Criteria"];
  for (const [key, value] of entries) {
    lines.push(`  ${key}: ${value}`);
  }
  return lines.join("\n");
}

export function formatPageSummary(total, pageIndex, pageCount) {
  return `Results: ${total} total  Page: ${pageIndex + 1}/${pageCount}`;
}

export function buildPagedMenu(items, pageIndex, formatter) {
  const pageCount = Math.max(1, Math.ceil(items.length / TUI_PAGE_SIZE));
  const normalizedPageIndex = Math.min(Math.max(0, pageIndex), pageCount - 1);
  const startIndex = normalizedPageIndex * TUI_PAGE_SIZE;
  const pageItems = items.slice(startIndex, startIndex + TUI_PAGE_SIZE);

  return {
    items: pageItems.map((item) => ({ ...item, __label: formatter(item) })),
    startIndex,
    pageCount,
    hasPrevious: normalizedPageIndex > 0,
    hasNext: normalizedPageIndex < pageCount - 1,
  };
}

export function formatSubjectMenuLabel(subject) {
  const parts = [
    `#${subject?.id ?? "-"}`,
    `[${formatSubjectTypeLabel(subject?.type)}]`,
    subject?.name_cn || subject?.name || "-",
  ];

  if (subject?.rating?.rank) {
    parts.push(`#${subject.rating.rank}`);
  } else {
    parts.push("unranked");
  }

  if (subject?.rating?.score !== undefined) {
    parts.push(`score ${subject.rating.score}`);
  }

  return parts.join("  ");
}

export function formatCollectionMenuLabel(item) {
  const subject = item?.subject ?? {};
  const parts = [
    `#${item?.subject_id ?? subject?.id ?? "-"}`,
    `[${formatCollectionStatusLabel(item?.type)}]`,
    `[${formatSubjectTypeLabel(item?.subject_type ?? subject?.type)}]`,
    subject?.name_cn || subject?.name || "-",
  ];

  if (subject?.rank) {
    parts.push(`#${subject.rank}`);
  } else {
    parts.push("unranked");
  }

  if (item?.rate) {
    parts.push(`my ${item.rate}`);
  }

  return parts.join("  ");
}

export function formatGroupMenuLabel(group) {
  const parts = [
    `#${group?.id ?? "-"}`,
    group?.title || "-",
  ];

  if (group?.name) {
    parts.push(`(${group.name})`);
  }
  if (group?.members !== undefined) {
    parts.push(`${group.members} members`);
  }
  if (group?.topics !== undefined) {
    parts.push(`${group.topics} topics`);
  } else if (group?.topicCount !== undefined) {
    parts.push(`${group.topicCount} active`);
  }
  if (group?.hotScore !== undefined) {
    parts.push(`hot ${Number(group.hotScore).toFixed(4)}`);
  }

  return parts.join("  ");
}

export function formatGroupTopicMenuLabel(topic) {
  const parts = [
    `#${topic?.id ?? "-"}`,
    topic?.title || "-",
  ];

  if (topic?.group?.title) {
    parts.push(`[${topic.group.title}]`);
  }
  if (topic?.replyCount !== undefined) {
    parts.push(`${topic.replyCount} replies`);
  }
  if (topic?.hotScore !== undefined) {
    parts.push(`hot ${Number(topic.hotScore).toFixed(4)}`);
  }

  return parts.join("  ");
}

export function formatSubjectTypeLabel(type) {
  const map = {
    1: "Book",
    2: "Anime",
    3: "Music",
    4: "Game",
    6: "Real",
  };
  return map[type] ?? String(type ?? "-");
}

export function formatCollectionStatusLabel(type) {
  const map = {
    1: "Wish",
    2: "Collect",
    3: "Doing",
    4: "On hold",
    5: "Dropped",
  };
  return map[type] ?? String(type ?? "-");
}
