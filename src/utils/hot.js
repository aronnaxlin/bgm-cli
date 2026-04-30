/**
 * Hot topic/group ranking utilities.
 */

import { GROUP_HOT_WINDOWS } from "./validators.js";

export async function fetchTopicsForHotWindow(client, { window, mode, scan }) {
  const cutoff = computeHotCutoffTimestamp(window);
  const pageSize = 100;
  const collected = [];

  for (let offset = 0; offset < scan; offset += pageSize) {
    const page = await client.listRecentGroupTopics({
      mode,
      limit: Math.min(pageSize, scan - offset),
      offset,
    });
    const topics = Array.isArray(page?.data) ? page.data : [];
    if (topics.length === 0) {
      break;
    }

    let seenOlderTopic = false;
    for (const topic of topics) {
      const activityTimestamp = getTopicActivityTimestamp(topic);
      if (activityTimestamp >= cutoff) {
        collected.push(topic);
      } else {
        seenOlderTopic = true;
      }
    }

    if (seenOlderTopic || topics.length < pageSize) {
      break;
    }
  }

  return collected;
}

export async function fetchRecentRepliedTopics(client, { mode, limit, scan }) {
  const pageSize = 100;
  const collected = [];

  for (let offset = 0; offset < scan && collected.length < limit; offset += pageSize) {
    const page = await client.listRecentGroupTopics({
      mode,
      limit: Math.min(pageSize, scan - offset),
      offset,
    });
    const topics = Array.isArray(page?.data) ? page.data : [];
    if (topics.length === 0) {
      break;
    }

    for (const topic of topics) {
      if (isRepliedTopic(topic)) {
        collected.push(topic);
        if (collected.length >= limit) {
          break;
        }
      }
    }

    if (topics.length < pageSize) {
      break;
    }
  }

  return collected;
}

export function rankHotTopics(topics, window) {
  return [...topics]
    .map((topic) => buildHotTopicEntry(topic, window))
    .sort((left, right) => {
      if (right.hotScore !== left.hotScore) {
        return right.hotScore - left.hotScore;
      }
      return getTopicActivityTimestamp(right) - getTopicActivityTimestamp(left);
    });
}

export function buildHotTopicEntry(topic, window) {
  const hotScore = computeTopicHotScore(topic, window);
  return {
    ...topic,
    hotScore,
    ageHours: computeAgeHours(getTopicActivityTimestamp(topic)),
    window,
  };
}

export function aggregateHotGroups(topics, window) {
  const grouped = new Map();

  for (const topic of topics) {
    const groupKey = String(topic?.group?.name ?? topic?.group?.id ?? topic?.parentID ?? "");
    if (!groupKey) {
      continue;
    }

    if (!grouped.has(groupKey)) {
      grouped.set(groupKey, {
        id: topic?.group?.id,
        name: topic?.group?.name,
        title: topic?.group?.title,
        members: topic?.group?.members ?? 0,
        accessible: topic?.group?.accessible,
        createdAt: topic?.group?.createdAt,
        hotScore: 0,
        topicCount: 0,
        replyCount: 0,
        latestActivityAt: 0,
        topTopics: [],
      });
    }

    const entry = grouped.get(groupKey);
    entry.hotScore += Number(topic.hotScore ?? 0);
    entry.topicCount += 1;
    entry.replyCount += Number(topic.replyCount ?? 0);
    entry.latestActivityAt = Math.max(entry.latestActivityAt, getTopicActivityTimestamp(topic));
    entry.topTopics.push({
      id: topic.id,
      title: topic.title,
      replyCount: topic.replyCount ?? 0,
      hotScore: topic.hotScore,
    });
  }

  return [...grouped.values()]
    .map((entry) => ({
      ...entry,
      hotScore: applyGroupRecencyBonus(entry.hotScore, entry.latestActivityAt, window),
      topTopics: entry.topTopics
        .sort((left, right) => right.hotScore - left.hotScore)
        .slice(0, 3),
      ageHours: computeAgeHours(entry.latestActivityAt),
    }))
    .sort((left, right) => {
      if (right.hotScore !== left.hotScore) {
        return right.hotScore - left.hotScore;
      }
      if (right.topicCount !== left.topicCount) {
        return right.topicCount - left.topicCount;
      }
      return right.replyCount - left.replyCount;
    });
}

export function computeTopicHotScore(topic, window) {
  const config = GROUP_HOT_WINDOWS[window];
  const ageHours = computeAgeHours(getTopicActivityTimestamp(topic));
  const replyCount = Number(topic?.replyCount ?? 0);
  return Math.log1p(replyCount + 1) / ((ageHours + 2) ** config.gravity);
}

export function applyGroupRecencyBonus(score, latestActivityAt, window) {
  const config = GROUP_HOT_WINDOWS[window];
  const ageHours = computeAgeHours(latestActivityAt);
  const recencyBonus = Math.exp(-ageHours / config.groupDecayHours);
  return score + recencyBonus;
}

export function computeAgeHours(timestampSeconds) {
  const seconds = Math.max(0, Math.floor(Date.now() / 1000) - Number(timestampSeconds ?? 0));
  return seconds / 3600;
}

export function getTopicActivityTimestamp(topic) {
  return Number(topic?.updatedAt ?? topic?.createdAt ?? 0);
}

export function isRepliedTopic(topic) {
  return Number(topic?.replyCount ?? 0) > 0 && Number(topic?.updatedAt ?? 0) > Number(topic?.createdAt ?? 0);
}

export function computeHotCutoffTimestamp(window) {
  const config = GROUP_HOT_WINDOWS[window];
  return Math.floor(Date.now() / 1000) - config.hours * 3600;
}
