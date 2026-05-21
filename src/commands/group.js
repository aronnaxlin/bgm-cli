import { BangumiClient } from "../core/client.js";
import { getConfig } from "../core/config.js";
import { CommandError, printResult } from "../core/output.js";
import { firstPositional, getPositional, parseFlags } from "../utils/args.js";
import {
  normalizeNonNegativeInteger,
  normalizePageSize,
} from "../utils/helpers.js";
import {
  normalizeGroupHotWindow,
  normalizeGroupListMode,
  normalizeGroupMemberRole,
  normalizeGroupSort,
  normalizeGroupTopicMode,
  normalizeHotResultLimit,
  normalizeHotScanLimit,
} from "../utils/validators.js";
import {
  aggregateHotGroups,
  computeHotCutoffTimestamp,
  fetchRecentRepliedTopics,
  fetchTopicsForHotWindow,
  rankHotTopics,
} from "../utils/hot.js";
import { resolveTurnstileTokenForMutation } from "../utils/turnstile-flow.js";

export async function runGroupCommand(command, args, context) {
  switch (command) {
    case "list": {
      const result = await executeGroupListCommand(args);
      printResult(result, context);
      return;
    }
    case "get": {
      const result = await executeGroupGetCommand(args);
      printResult(result, context);
      return;
    }
    case "topics": {
      const result = await executeGroupTopicsCommand(args);
      printResult(result, context);
      return;
    }
    case "topic": {
      const result = await executeGroupTopicCommand(args);
      printResult(result, context);
      return;
    }
    case "create-topic": {
      const result = await executeGroupCreateTopicCommand(args, context);
      printResult(result, context);
      return;
    }
    case "reply": {
      const result = await executeGroupReplyCommand(args, context);
      printResult(result, context);
      return;
    }
    case "members": {
      const result = await executeGroupMembersCommand(args);
      printResult(result, context);
      return;
    }
    case "user": {
      const result = await executeUserGroupsCommand(args);
      printResult(result, context);
      return;
    }
    case "recent-topics": {
      const result = await executeRecentGroupTopicsCommand(args);
      printResult(result, context);
      return;
    }
    case "latest-replies": {
      const result = await executeLatestRepliedGroupTopicsCommand(args);
      printResult(result, context);
      return;
    }
    case "hot": {
      const result = await executeHotGroupsCommand(args);
      printResult(result, context);
      return;
    }
    case "hot-topics": {
      const result = await executeHotGroupTopicsCommand(args);
      printResult(result, context);
      return;
    }
    default:
      throw new CommandError("Usage: bgm group <list|get|topics|topic|create-topic|reply|members|user|recent-topics|latest-replies|hot|hot-topics> ...");
  }
}

export async function executeGroupListCommand(args) {
  const options = parseFlags(args);
  const client = new BangumiClient(getConfig());
  const mode = normalizeGroupListMode(options.mode);
  const sort = normalizeGroupSort(options.sort);
  const limit = normalizePageSize(options.limit);
  const offset = normalizeNonNegativeInteger(options.offset, "offset");
  const result = await client.listGroups({
    mode,
    sort,
    limit,
    offset,
  });

  return {
    ...result,
    resource: "group-list",
    filters: { mode, sort, limit, offset },
  };
}

export async function executeGroupGetCommand(args) {
  const options = parseFlags(args);
  const client = new BangumiClient(getConfig());
  const groupName = firstPositional(options);
  if (!groupName) {
    throw new CommandError("Usage: bgm group get <group_name>");
  }

  return client.getGroup(groupName);
}

export async function executeGroupTopicsCommand(args) {
  const options = parseFlags(args);
  const client = new BangumiClient(getConfig());
  const groupName = firstPositional(options);
  if (!groupName) {
    throw new CommandError("Usage: bgm group topics <group_name> [--limit n] [--offset n]");
  }

  const limit = normalizePageSize(options.limit);
  const offset = normalizeNonNegativeInteger(options.offset, "offset");
  const result = await client.listGroupTopics(groupName, {
    limit,
    offset,
  });

  return {
    ...result,
    resource: "group-topics",
    groupName: String(groupName),
    filters: { limit, offset },
  };
}

export async function executeGroupTopicCommand(args) {
  const options = parseFlags(args);
  const client = new BangumiClient(getConfig());
  const topicId = firstPositional(options);
  if (!topicId) {
    throw new CommandError("Usage: bgm group topic <topic_id> [--reply-limit n]");
  }

  const replyLimit = normalizeNonNegativeInteger(options.replyLimit, "reply-limit") ?? 20;
  const topic = await client.getGroupTopic(topicId);
  return {
    ...topic,
    resource: "group-topic-detail",
    filters: {
      replyLimit,
    },
  };
}

export async function executeGroupCreateTopicCommand(args, context = {}) {
  const options = parseFlags(args);
  const client = new BangumiClient(getConfig());
  const groupName = firstPositional(options);
  const title = getPositional(options, 1) ?? options.title;
  const content = getPositional(options, 2) ?? options.content;

  if (!groupName || !title || !content) {
    throw new CommandError("Usage: bgm group create-topic <group_name> <title> <content> [--turnstile-token <token>] [--manual] [--listen-host <host>] [--port <n>] [--public-origin <url>] [--timeout-seconds <n>]");
  }

  const turnstileToken = await resolveTurnstileTokenForMutation(options, {
    actionLabel: "create a group topic",
    context,
  });

  const result = await client.createGroupTopic(groupName, {
    title,
    content,
    turnstileToken,
  });

  return {
    resource: "group-topic-mutation",
    action: "create-topic",
    groupName: String(groupName),
    title: String(title),
    topicId: result.id,
    url: result.id ? `https://bgm.tv/group/topic/${result.id}` : undefined,
  };
}

export async function executeGroupReplyCommand(args, context = {}) {
  const options = parseFlags(args);
  const client = new BangumiClient(getConfig());
  const topicId = firstPositional(options);
  const content = getPositional(options, 1) ?? options.content;
  const replyTo = normalizeNonNegativeInteger(options.replyTo, "reply-to") ?? 0;

  if (!topicId || !content) {
    throw new CommandError("Usage: bgm group reply <topic_id> <content> [--reply-to <reply_id>] [--turnstile-token <token>] [--manual] [--listen-host <host>] [--port <n>] [--public-origin <url>] [--timeout-seconds <n>]");
  }

  const turnstileToken = await resolveTurnstileTokenForMutation(options, {
    actionLabel: "reply to a group topic",
    context,
  });

  const result = await client.createGroupReply(topicId, {
    content,
    replyTo,
    turnstileToken,
  });

  return {
    resource: "group-topic-mutation",
    action: "reply",
    topicId: Number(topicId),
    postId: result.id,
    replyTo,
    url: `https://bgm.tv/group/topic/${topicId}`,
  };
}

export async function executeGroupMembersCommand(args) {
  const options = parseFlags(args);
  const client = new BangumiClient(getConfig());
  const groupName = firstPositional(options);
  if (!groupName) {
    throw new CommandError("Usage: bgm group members <group_name> [--role member] [--limit n] [--offset n]");
  }

  const role = normalizeGroupMemberRole(options.role);
  const limit = normalizePageSize(options.limit);
  const offset = normalizeNonNegativeInteger(options.offset, "offset");
  const result = await client.listGroupMembers(groupName, {
    role,
    limit,
    offset,
  });

  return {
    ...result,
    resource: "group-members",
    groupName: String(groupName),
    filters: { role, limit, offset },
  };
}

export async function executeUserGroupsCommand(args) {
  const options = parseFlags(args);
  const client = new BangumiClient(getConfig());
  const username = firstPositional(options);
  if (!username) {
    throw new CommandError("Usage: bgm group user <username> [--limit n] [--offset n]");
  }

  const limit = normalizePageSize(options.limit);
  const offset = normalizeNonNegativeInteger(options.offset, "offset");
  const result = await client.listUserGroups(username, { limit, offset });
  return {
    ...result,
    resource: "group-list",
    title: "User groups",
    username: String(username),
    filters: { mode: `user:${username}`, limit, offset },
  };
}

export async function executeRecentGroupTopicsCommand(args) {
  const options = parseFlags(args);
  const client = new BangumiClient(getConfig());
  const mode = normalizeGroupTopicMode(options.mode);
  const limit = normalizePageSize(options.limit);
  const offset = normalizeNonNegativeInteger(options.offset, "offset");
  const result = await client.listRecentGroupTopics({
    mode,
    limit,
    offset,
  });

  return {
    ...result,
    resource: "group-recent-topics",
    filters: { mode, limit, offset },
  };
}

export async function executeLatestRepliedGroupTopicsCommand(args) {
  const options = parseFlags(args);
  const client = new BangumiClient(getConfig());
  const mode = normalizeGroupTopicMode(options.mode);
  const limit = normalizeHotResultLimit(options.limit);
  const scan = normalizeHotScanLimit(options.scan, "day");
  const topics = await fetchRecentRepliedTopics(client, {
    mode,
    limit,
    scan,
  });

  return {
    resource: "group-latest-replies",
    data: topics,
    total: topics.length,
    filters: {
      mode,
      limit,
      scan,
    },
  };
}

export async function executeHotGroupsCommand(args) {
  const options = parseFlags(args);
  const client = new BangumiClient(getConfig());
  const window = normalizeGroupHotWindow(options.window);
  const mode = normalizeGroupTopicMode(options.mode);
  const limit = normalizeHotResultLimit(options.limit);
  const scan = normalizeHotScanLimit(options.scan, window);
  const topics = await fetchTopicsForHotWindow(client, { window, mode, scan });
  const rankedTopics = rankHotTopics(topics, window);
  const grouped = aggregateHotGroups(rankedTopics, window).slice(0, limit);

  return {
    resource: "group-hot",
    data: grouped,
    total: grouped.length,
    filters: {
      window,
      mode,
      limit,
      scan,
      sampledTopics: rankedTopics.length,
      cutoff: computeHotCutoffTimestamp(window),
    },
  };
}

export async function executeHotGroupTopicsCommand(args) {
  const options = parseFlags(args);
  const client = new BangumiClient(getConfig());
  const window = normalizeGroupHotWindow(options.window);
  const mode = normalizeGroupTopicMode(options.mode);
  const limit = normalizeHotResultLimit(options.limit);
  const scan = normalizeHotScanLimit(options.scan, window);
  const topics = await fetchTopicsForHotWindow(client, { window, mode, scan });
  const ranked = rankHotTopics(topics, window).slice(0, limit);

  return {
    resource: "group-hot-topics",
    data: ranked,
    total: ranked.length,
    filters: {
      window,
      mode,
      limit,
      scan,
      sampledTopics: topics.length,
      cutoff: computeHotCutoffTimestamp(window),
    },
  };
}
