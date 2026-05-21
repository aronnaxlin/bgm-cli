import { BangumiClient } from "../core/client.js";
import { getConfig } from "../core/config.js";
import { CommandError, printResult } from "../core/output.js";
import { firstPositional, getPositional, parseFlags } from "../utils/args.js";
import { normalizeNonNegativeInteger, normalizePageSize } from "../utils/helpers.js";
import { resolveTurnstileTokenForMutation } from "../utils/turnstile-flow.js";

export async function runBlogCommand(command, args, context) {
  switch (command) {
    case "list": {
      const result = await executeBlogListCommand(args);
      printResult(result, context);
      return;
    }
    case "get": {
      const result = await executeBlogGetCommand(args);
      printResult(result, context);
      return;
    }
    case "comments": {
      const result = await executeBlogCommentsCommand(args);
      printResult(result, context);
      return;
    }
    case "reply": {
      const result = await executeBlogReplyCommand(args, context);
      printResult(result, context);
      return;
    }
    case "edit-comment": {
      const result = await executeBlogEditCommentCommand(args);
      printResult(result, context);
      return;
    }
    case "delete-comment": {
      const result = await executeBlogDeleteCommentCommand(args);
      printResult(result, context);
      return;
    }
    case "photos": {
      const result = await executeBlogPhotosCommand(args);
      printResult(result, context);
      return;
    }
    case "subjects": {
      const result = await executeBlogSubjectsCommand(args);
      printResult(result, context);
      return;
    }
    default:
      throw new CommandError("Usage: bgm blog <list|get|comments|reply|edit-comment|delete-comment|photos|subjects> ...");
  }
}

export async function executeBlogListCommand(args) {
  const options = parseFlags(args);
  const client = new BangumiClient(getConfig());
  const username = options.user ? String(options.user) : (await client.getMe()).username;
  const limit = normalizePageSize(options.limit);
  const offset = normalizeNonNegativeInteger(options.offset, "offset");
  const result = await client.listUserBlogs(username, {
    limit,
    offset,
  });

  return {
    ...result,
    resource: "blog-list",
    filters: {
      user: username,
      limit,
      offset,
    },
  };
}

export async function executeBlogGetCommand(args) {
  const options = parseFlags(args);
  const client = new BangumiClient(getConfig());
  const entryId = firstPositional(options);
  if (!entryId) {
    throw new CommandError("Usage: bgm blog get <blog_id>");
  }

  return client.getBlogEntry(entryId);
}

export async function executeBlogCommentsCommand(args) {
  const options = parseFlags(args);
  const client = new BangumiClient(getConfig());
  const entryId = firstPositional(options);
  if (!entryId) {
    throw new CommandError("Usage: bgm blog comments <blog_id>");
  }

  const data = await client.listBlogComments(entryId);
  return {
    resource: "blog-comments",
    entryId: Number(entryId),
    data,
  };
}

export async function executeBlogReplyCommand(args, context = {}) {
  const options = parseFlags(args);
  const client = new BangumiClient(getConfig());
  const entryId = firstPositional(options);
  const content = getPositional(options, 1) ?? options.content;
  const replyTo = normalizeNonNegativeInteger(options.replyTo, "reply-to") ?? 0;

  if (!entryId || !content) {
    throw new CommandError("Usage: bgm blog reply <blog_id> <content> [--reply-to <comment_id>] [--turnstile-token <token>] [--manual] [--listen-host <host>] [--port <n>] [--public-origin <url>] [--timeout-seconds <n>]");
  }

  const turnstileToken = await resolveTurnstileTokenForMutation(options, {
    actionLabel: "reply to a blog",
    context,
  });

  const result = await client.createBlogComment(entryId, {
    content,
    replyTo,
    turnstileToken,
  });

  return {
    resource: "blog-comment-mutation",
    action: "reply",
    entryId: Number(entryId),
    commentId: result.id,
    replyTo,
    url: `https://bgm.tv/blog/${entryId}`,
  };
}

export async function executeBlogEditCommentCommand(args) {
  const options = parseFlags(args);
  const client = new BangumiClient(getConfig());
  const commentId = firstPositional(options);
  const content = getPositional(options, 1) ?? options.content;
  if (!commentId || !content) {
    throw new CommandError("Usage: bgm blog edit-comment <comment_id> <content>");
  }

  await client.updateBlogComment(commentId, { content });
  return {
    resource: "blog-comment-mutation",
    action: "edit",
    commentId: Number(commentId),
  };
}

export async function executeBlogDeleteCommentCommand(args) {
  const options = parseFlags(args);
  const client = new BangumiClient(getConfig());
  const commentId = firstPositional(options);
  if (!commentId) {
    throw new CommandError("Usage: bgm blog delete-comment <comment_id>");
  }

  await client.deleteBlogComment(commentId);
  return {
    resource: "blog-comment-mutation",
    action: "delete",
    commentId: Number(commentId),
  };
}

export async function executeBlogPhotosCommand(args) {
  const options = parseFlags(args);
  const client = new BangumiClient(getConfig());
  const entryId = firstPositional(options);
  if (!entryId) {
    throw new CommandError("Usage: bgm blog photos <blog_id> [--limit n] [--offset n]");
  }

  const limit = normalizePageSize(options.limit);
  const offset = normalizeNonNegativeInteger(options.offset, "offset");
  const result = await client.listBlogPhotos(entryId, {
    limit,
    offset,
  });

  return {
    ...result,
    resource: "blog-photos",
    entryId: Number(entryId),
    filters: {
      limit,
      offset,
    },
  };
}

export async function executeBlogSubjectsCommand(args) {
  const options = parseFlags(args);
  const client = new BangumiClient(getConfig());
  const entryId = firstPositional(options);
  if (!entryId) {
    throw new CommandError("Usage: bgm blog subjects <blog_id>");
  }

  const data = await client.listBlogSubjects(entryId);
  return {
    resource: "blog-subjects",
    entryId: Number(entryId),
    data,
  };
}
