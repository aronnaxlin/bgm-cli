import { BangumiClient } from "../core/client.js";
import { getConfig } from "../core/config.js";
import { CommandError, printResult } from "../core/output.js";
import { normalizeBangumiReactionValue } from "../core/reactions.js";
import { firstPositional, getPositional, parseFlags } from "../utils/args.js";
import {
  normalizeNonNegativeInteger,
  normalizePageSize,
  resolveUsernameOrMe,
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
    case "edit-topic": {
      const result = await executeGroupEditTopicCommand(args);
      printResult(result, context);
      return;
    }
    case "post": {
      const result = await executeGroupPostCommand(args);
      printResult(result, context);
      return;
    }
    case "edit-post": {
      const result = await executeGroupEditPostCommand(args);
      printResult(result, context);
      return;
    }
    case "delete-post": {
      const result = await executeGroupDeletePostCommand(args);
      printResult(result, context);
      return;
    }
    case "like-post": {
      const result = await executeGroupLikePostCommand(args);
      printResult(result, context);
      return;
    }
    case "unlike-post": {
      const result = await executeGroupUnlikePostCommand(args);
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
      throw new CommandError("Usage: bgm group <list|get|topics|topic|create-topic|reply|edit-topic|post|edit-post|delete-post|like-post|unlike-post|members|user|recent-topics|latest-replies|hot|hot-topics> ...");
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

export async function executeGroupEditTopicCommand(args) {
  const options = parseFlags(args);
  const topicId = firstPositional(options);
  const title = getPositional(options, 1) ?? options.title;
  const content = getPositional(options, 2) ?? options.content;
  if (!topicId || !title || !content) {
    throw new CommandError("Usage: bgm group edit-topic <topic_id> <title> <content>");
  }

  await new BangumiClient(getConfig()).updateGroupTopic(topicId, { title, content });
  return {
    resource: "group-topic-mutation",
    action: "edit-topic",
    topicId: Number(topicId),
    title: String(title),
    url: `https://bgm.tv/group/topic/${topicId}`,
  };
}

export async function executeGroupPostCommand(args) {
  const options = parseFlags(args);
  const postId = firstPositional(options);
  if (!postId) {
    throw new CommandError("Usage: bgm group post <post_id>");
  }

  return {
    resource: "topic-post",
    scope: "group",
    postId: Number(postId),
    data: await new BangumiClient(getConfig()).getGroupPost(postId),
  };
}

export async function executeGroupEditPostCommand(args) {
  const options = parseFlags(args);
  const postId = firstPositional(options);
  const content = getPositional(options, 1) ?? options.content;
  if (!postId || !content) {
    throw new CommandError("Usage: bgm group edit-post <post_id> <content>");
  }

  await new BangumiClient(getConfig()).updateGroupPost(postId, { content });
  return buildGroupPostMutationResult("edit-post", { postId });
}

export async function executeGroupDeletePostCommand(args) {
  const options = parseFlags(args);
  const postId = firstPositional(options);
  if (!postId) {
    throw new CommandError("Usage: bgm group delete-post <post_id>");
  }

  await new BangumiClient(getConfig()).deleteGroupPost(postId);
  return buildGroupPostMutationResult("delete-post", { postId });
}

export async function executeGroupLikePostCommand(args) {
  const options = parseFlags(args);
  const postId = firstPositional(options);
  const value = normalizeBangumiReactionValue(options.value ?? getPositional(options, 1), "groupPost");
  if (!postId || value === undefined) {
    throw new CommandError("Usage: bgm group like-post <post_id> <value>");
  }

  await new BangumiClient(getConfig()).likeGroupPost(postId, value);
  return buildGroupPostMutationResult("like-post", { postId, value });
}

export async function executeGroupUnlikePostCommand(args) {
  const options = parseFlags(args);
  const postId = firstPositional(options);
  if (!postId) {
    throw new CommandError("Usage: bgm group unlike-post <post_id>");
  }

  await new BangumiClient(getConfig()).unlikeGroupPost(postId);
  return buildGroupPostMutationResult("unlike-post", { postId });
}

function buildGroupPostMutationResult(action, details) {
  return {
    resource: "post-mutation",
    scope: "group",
    action,
    postId: Number(details.postId),
    value: details.value,
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
  const username = await resolveUsernameOrMe(client, firstPositional(options));

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
