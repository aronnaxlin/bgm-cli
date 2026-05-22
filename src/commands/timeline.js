import { BangumiClient } from "../core/client.js";
import { getConfig } from "../core/config.js";
import { CommandError, printResult } from "../core/output.js";
import { firstPositional, getPositional, parseFlags } from "../utils/args.js";
import {
  normalizeNonNegativeInteger,
  normalizePositiveInteger,
  resolveUsernameOrMe,
} from "../utils/helpers.js";
import {
  normalizeTimelineLimit,
  normalizeTimelineMode,
} from "../utils/validators.js";
import { resolveTurnstileTokenForMutation } from "../utils/turnstile-flow.js";

export async function runTimelineCommand(command, args, context) {
  switch (command) {
    case "list": {
      const result = await executeTimelineListCommand(args);
      printResult(result, context);
      return;
    }
    case "user": {
      const result = await executeTimelineUserCommand(args);
      printResult(result, context);
      return;
    }
    case "replies": {
      const result = await executeTimelineRepliesCommand(args);
      printResult(result, context);
      return;
    }
    case "say": {
      const result = await executeTimelineSayCommand(args, context);
      printResult(result, context);
      return;
    }
    case "reply": {
      const result = await executeTimelineReplyCommand(args, context);
      printResult(result, context);
      return;
    }
    case "delete": {
      const result = await executeTimelineDeleteCommand(args);
      printResult(result, context);
      return;
    }
    case "like": {
      const result = await executeTimelineLikeCommand(args);
      printResult(result, context);
      return;
    }
    case "unlike": {
      const result = await executeTimelineUnlikeCommand(args);
      printResult(result, context);
      return;
    }
    default:
      throw new CommandError("Usage: bgm timeline <list|user|replies|say|reply|delete|like|unlike> ...");
  }
}

export async function executeTimelineListCommand(args) {
  const options = parseFlags(args);
  const client = new BangumiClient(getConfig());
  const mode = normalizeTimelineMode(options.mode);
  const limit = normalizeTimelineLimit(options.limit);
  const until = normalizeNonNegativeInteger(options.until, "until");
  const data = await client.listTimeline({
    mode,
    limit,
    until,
  });

  return {
    resource: "timeline-list",
    filters: {
      mode,
      limit,
      until,
    },
    data,
  };
}

export async function executeTimelineUserCommand(args) {
  const options = parseFlags(args);
  const client = new BangumiClient(getConfig());
  const username = await resolveUsernameOrMe(client, firstPositional(options));

  const limit = normalizeTimelineLimit(options.limit);
  const until = normalizeNonNegativeInteger(options.until, "until");
  const data = await client.listUserTimeline(username, {
    limit,
    until,
  });

  return {
    resource: "timeline-user-list",
    filters: {
      user: String(username),
      limit,
      until,
    },
    data,
  };
}

export async function executeTimelineRepliesCommand(args) {
  const options = parseFlags(args);
  const client = new BangumiClient(getConfig());
  const timelineId = firstPositional(options);
  if (!timelineId) {
    throw new CommandError("Usage: bgm timeline replies <timeline_id>");
  }

  const data = await client.listTimelineReplies(timelineId);
  return {
    resource: "timeline-replies",
    timelineId: Number(timelineId),
    data,
  };
}

export async function executeTimelineSayCommand(args, context = {}) {
  const options = parseFlags(args);
  const client = new BangumiClient(getConfig());
  const content = firstPositional(options) ?? options.content;
  if (!content) {
    throw new CommandError("Usage: bgm timeline say <content> [--turnstile-token <token>] [--manual] [--listen-host <host>] [--port <n>] [--public-origin <url>] [--timeout-seconds <n>]");
  }

  const turnstileToken = await resolveTurnstileTokenForMutation(options, {
    actionLabel: "post a timeline status",
    context,
  });

  const result = await client.createTimeline({
    content,
    turnstileToken,
  });

  return {
    resource: "timeline-mutation",
    action: "say",
    timelineId: result.id,
  };
}

export async function executeTimelineReplyCommand(args, context = {}) {
  const options = parseFlags(args);
  const client = new BangumiClient(getConfig());
  const timelineId = firstPositional(options);
  const content = getPositional(options, 1) ?? options.content;
  const replyTo = normalizeNonNegativeInteger(options.replyTo, "reply-to") ?? 0;

  if (!timelineId || !content) {
    throw new CommandError("Usage: bgm timeline reply <timeline_id> <content> [--reply-to <comment_id>] [--turnstile-token <token>] [--manual] [--listen-host <host>] [--port <n>] [--public-origin <url>] [--timeout-seconds <n>]");
  }

  const turnstileToken = await resolveTurnstileTokenForMutation(options, {
    actionLabel: "reply to a timeline entry",
    context,
  });

  const result = await client.createTimelineReply(timelineId, {
    content,
    replyTo,
    turnstileToken,
  });

  return {
    resource: "timeline-mutation",
    action: "reply",
    timelineId: Number(timelineId),
    commentId: result.id,
    replyTo,
  };
}

export async function executeTimelineDeleteCommand(args) {
  const options = parseFlags(args);
  const client = new BangumiClient(getConfig());
  const timelineId = firstPositional(options);
  if (!timelineId) {
    throw new CommandError("Usage: bgm timeline delete <timeline_id>");
  }

  await client.deleteTimeline(timelineId);
  return {
    resource: "timeline-mutation",
    action: "delete",
    timelineId: Number(timelineId),
  };
}

export async function executeTimelineLikeCommand(args) {
  const options = parseFlags(args);
  const client = new BangumiClient(getConfig());
  const timelineId = firstPositional(options);
  const value = normalizePositiveInteger(getPositional(options, 1) ?? options.value, "value");
  if (!timelineId || value === undefined) {
    throw new CommandError("Usage: bgm timeline like <timeline_id> <value>");
  }

  await client.likeTimeline(timelineId, value);
  return {
    resource: "timeline-mutation",
    action: "like",
    timelineId: Number(timelineId),
    value,
  };
}

export async function executeTimelineUnlikeCommand(args) {
  const options = parseFlags(args);
  const client = new BangumiClient(getConfig());
  const timelineId = firstPositional(options);
  if (!timelineId) {
    throw new CommandError("Usage: bgm timeline unlike <timeline_id>");
  }

  await client.unlikeTimeline(timelineId);
  return {
    resource: "timeline-mutation",
    action: "unlike",
    timelineId: Number(timelineId),
  };
}
