import { BangumiClient } from "../core/client.js";
import { getConfig } from "../core/config.js";
import { CommandError, printResult } from "../core/output.js";
import { firstPositional, getPositional, parseFlags } from "../utils/args.js";
import {
  normalizeNonNegativeInteger,
  normalizePageSize,
  normalizePositiveInteger,
  parseOptionalBoolean,
} from "../utils/helpers.js";
import {
  normalizeIndexRelatedCategory,
  normalizeSubjectType,
} from "../utils/validators.js";
import { resolveTurnstileTokenForMutation } from "../utils/turnstile-flow.js";

export async function runIndexCommand(command, args, context) {
  switch (command) {
    case "create": {
      const result = await executeIndexCreateCommand(args);
      printResult(result, context);
      return;
    }
    case "get": {
      const result = await executeIndexGetCommand(args);
      printResult(result, context);
      return;
    }
    case "update": {
      const result = await executeIndexUpdateCommand(args);
      printResult(result, context);
      return;
    }
    case "delete": {
      const result = await executeIndexDeleteCommand(args);
      printResult(result, context);
      return;
    }
    case "comments": {
      const result = await executeIndexCommentsCommand(args);
      printResult(result, context);
      return;
    }
    case "comment": {
      const result = await executeIndexCommentCommand(args, context);
      printResult(result, context);
      return;
    }
    case "edit-comment": {
      const result = await executeIndexEditCommentCommand(args);
      printResult(result, context);
      return;
    }
    case "delete-comment": {
      const result = await executeIndexDeleteCommentCommand(args);
      printResult(result, context);
      return;
    }
    case "related": {
      const result = await executeIndexRelatedCommand(args);
      printResult(result, context);
      return;
    }
    case "user": {
      const result = await executeUserIndexesCommand(args);
      printResult(result, context);
      return;
    }
    case "add-related": {
      const result = await executeIndexAddRelatedCommand(args);
      printResult(result, context);
      return;
    }
    case "update-related": {
      const result = await executeIndexUpdateRelatedCommand(args);
      printResult(result, context);
      return;
    }
    case "delete-related": {
      const result = await executeIndexDeleteRelatedCommand(args);
      printResult(result, context);
      return;
    }
    default:
      throw new CommandError(
        "Usage: bgm index <create|get|update|delete|comments|comment|edit-comment|delete-comment|related|user|add-related|update-related|delete-related> ...",
      );
  }
}

export async function executeIndexCreateCommand(args) {
  const options = parseFlags(args);
  const client = new BangumiClient(getConfig());
  const title = firstPositional(options) ?? options.title;
  const desc = getPositional(options, 1) ?? options.desc;
  if (!title || desc === undefined) {
    throw new CommandError("Usage: bgm index create <title> <desc> [--private <true|false>]");
  }

  const isPrivate = parseOptionalBoolean(options.private) ?? false;
  const result = await client.createIndex({
    title,
    desc,
    private: isPrivate,
  });

  return {
    resource: "index-mutation",
    action: "create",
    indexId: result.id,
    title: String(title),
    private: isPrivate,
  };
}

export async function executeIndexGetCommand(args) {
  const options = parseFlags(args);
  const client = new BangumiClient(getConfig());
  const indexId = firstPositional(options);
  if (!indexId) {
    throw new CommandError("Usage: bgm index get <index_id>");
  }

  return client.getIndex(indexId);
}

export async function executeIndexUpdateCommand(args) {
  const options = parseFlags(args);
  const client = new BangumiClient(getConfig());
  const indexId = firstPositional(options);
  if (!indexId) {
    throw new CommandError("Usage: bgm index update <index_id> [--title <title>] [--desc <desc>] [--private <true|false>]");
  }

  const payload = {};
  if (options.title !== undefined) {
    payload.title = options.title;
  }
  if (options.desc !== undefined) {
    payload.desc = options.desc;
  }
  if (options.private !== undefined) {
    payload.private = parseOptionalBoolean(options.private);
  }
  if (Object.keys(payload).length === 0) {
    throw new CommandError("At least one of --title, --desc, or --private is required.");
  }

  await client.updateIndex(indexId, payload);
  return {
    resource: "index-mutation",
    action: "update",
    indexId: Number(indexId),
    ...payload,
  };
}

export async function executeIndexDeleteCommand(args) {
  const options = parseFlags(args);
  const client = new BangumiClient(getConfig());
  const indexId = firstPositional(options);
  if (!indexId) {
    throw new CommandError("Usage: bgm index delete <index_id>");
  }

  await client.deleteIndex(indexId);
  return {
    resource: "index-mutation",
    action: "delete",
    indexId: Number(indexId),
  };
}

export async function executeIndexCommentsCommand(args) {
  const options = parseFlags(args);
  const client = new BangumiClient(getConfig());
  const indexId = firstPositional(options);
  if (!indexId) {
    throw new CommandError("Usage: bgm index comments <index_id>");
  }

  const data = await client.listIndexComments(indexId);
  return {
    resource: "index-comments",
    indexId: Number(indexId),
    data,
  };
}

export async function executeIndexCommentCommand(args, context = {}) {
  const options = parseFlags(args);
  const client = new BangumiClient(getConfig());
  const indexId = firstPositional(options);
  const content = getPositional(options, 1) ?? options.content;
  const replyTo = normalizeNonNegativeInteger(options.replyTo, "reply-to") ?? 0;
  if (!indexId || !content) {
    throw new CommandError("Usage: bgm index comment <index_id> <content> [--reply-to <comment_id>] [--turnstile-token <token>] [--manual] [--listen-host <host>] [--port <n>] [--public-origin <url>] [--timeout-seconds <n>]");
  }

  const turnstileToken = await resolveTurnstileTokenForMutation(options, {
    actionLabel: "comment on an index",
    context,
  });

  const result = await client.createIndexComment(indexId, {
    content,
    replyTo,
    turnstileToken,
  });

  return {
    resource: "index-comment-mutation",
    action: "reply",
    indexId: Number(indexId),
    commentId: result.id,
    replyTo,
    url: `https://bgm.tv/index/${indexId}`,
  };
}

export async function executeIndexEditCommentCommand(args) {
  const options = parseFlags(args);
  const client = new BangumiClient(getConfig());
  const commentId = firstPositional(options);
  const content = getPositional(options, 1) ?? options.content;
  if (!commentId || !content) {
    throw new CommandError("Usage: bgm index edit-comment <comment_id> <content>");
  }

  await client.updateIndexComment(commentId, { content });
  return {
    resource: "index-comment-mutation",
    action: "edit",
    commentId: Number(commentId),
  };
}

export async function executeIndexDeleteCommentCommand(args) {
  const options = parseFlags(args);
  const client = new BangumiClient(getConfig());
  const commentId = firstPositional(options);
  if (!commentId) {
    throw new CommandError("Usage: bgm index delete-comment <comment_id>");
  }

  await client.deleteIndexComment(commentId);
  return {
    resource: "index-comment-mutation",
    action: "delete",
    commentId: Number(commentId),
  };
}

export async function executeIndexRelatedCommand(args) {
  const options = parseFlags(args);
  const client = new BangumiClient(getConfig());
  const indexId = firstPositional(options);
  if (!indexId) {
    throw new CommandError("Usage: bgm index related <index_id> [--cat <subject|character|person|ep|blog|group_topic|subject_topic>] [--type <book|anime|music|game|real>] [--limit n] [--offset n]");
  }

  const cat = normalizeIndexRelatedCategory(options.cat);
  const type = normalizeSubjectType(options.type);
  const limit = normalizePageSize(options.limit);
  const offset = normalizeNonNegativeInteger(options.offset, "offset");
  const result = await client.listIndexRelated(indexId, { cat, type, limit, offset });
  return {
    ...result,
    resource: "index-related",
    indexId: Number(indexId),
    filters: { cat, type, limit, offset },
  };
}

export async function executeUserIndexesCommand(args) {
  const options = parseFlags(args);
  const client = new BangumiClient(getConfig());
  const username = firstPositional(options);
  if (!username) {
    throw new CommandError("Usage: bgm index user <username> [--limit n] [--offset n]");
  }

  const limit = normalizePageSize(options.limit);
  const offset = normalizeNonNegativeInteger(options.offset, "offset");
  const result = await client.listUserIndexes(username, { limit, offset });
  return {
    ...result,
    resource: "index-list",
    title: "User indexes",
    username: String(username),
    filters: { limit, offset },
  };
}

export async function executeIndexAddRelatedCommand(args) {
  const options = parseFlags(args);
  const client = new BangumiClient(getConfig());
  const indexId = firstPositional(options);
  const cat = normalizeIndexRelatedCategory(options.cat);
  const sid = normalizePositiveInteger(options.sid, "sid");
  if (!indexId || cat === undefined || sid === undefined) {
    throw new CommandError("Usage: bgm index add-related <index_id> --cat <subject|character|person|ep|blog|group_topic|subject_topic> --sid <sid> [--order <n>] [--comment <text>] [--award <text>]");
  }

  const order = normalizeNonNegativeInteger(options.order, "order");
  const result = await client.addIndexRelated(indexId, {
    cat,
    sid,
    order,
    comment: options.comment,
    award: options.award,
  });
  return {
    resource: "index-related-mutation",
    action: "add",
    indexId: Number(indexId),
    relatedId: result.id,
    cat,
    sid,
    order: order ?? 0,
  };
}

export async function executeIndexUpdateRelatedCommand(args) {
  const options = parseFlags(args);
  const client = new BangumiClient(getConfig());
  const indexId = firstPositional(options);
  const relatedId = getPositional(options, 1);
  const order = normalizeNonNegativeInteger(options.order, "order");
  const comment = options.comment;
  if (!indexId || !relatedId || order === undefined || comment === undefined) {
    throw new CommandError("Usage: bgm index update-related <index_id> <related_id> --order <n> --comment <text>");
  }

  await client.updateIndexRelated(indexId, relatedId, {
    order,
    comment,
  });
  return {
    resource: "index-related-mutation",
    action: "update",
    indexId: Number(indexId),
    relatedId: Number(relatedId),
    order,
  };
}

export async function executeIndexDeleteRelatedCommand(args) {
  const options = parseFlags(args);
  const client = new BangumiClient(getConfig());
  const indexId = firstPositional(options);
  const relatedId = getPositional(options, 1);
  if (!indexId || !relatedId) {
    throw new CommandError("Usage: bgm index delete-related <index_id> <related_id>");
  }

  await client.deleteIndexRelated(indexId, relatedId);
  return {
    resource: "index-related-mutation",
    action: "delete",
    indexId: Number(indexId),
    relatedId: Number(relatedId),
  };
}
