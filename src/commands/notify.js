import { BangumiClient } from "../core/client.js";
import { getConfig } from "../core/config.js";
import { CommandError, printResult } from "../core/output.js";
import { parseFlags } from "../utils/args.js";
import {
  normalizeNonNegativeInteger,
  normalizePositiveInteger,
  parseOptionalBoolean,
} from "../utils/helpers.js";

export async function runNotifyCommand(command, args, context) {
  if (!command || String(command).startsWith("--")) {
    const result = await executeNotifyListCommand(command ? [command, ...args] : args);
    printResult(result, context);
    return;
  }

  switch (command) {
    case "list": {
      const result = await executeNotifyListCommand(args);
      printResult(result, context);
      return;
    }
    case "clear": {
      const result = await executeNotifyClearCommand(args);
      printResult(result, context);
      return;
    }
    default:
      throw new CommandError("Usage: bgm notify [list|clear] ...");
  }
}

export async function executeNotifyListCommand(args) {
  const options = parseFlags(args);
  const limit = normalizeNotifyLimit(options.limit);
  const unread = parseOptionalBoolean(options.unread);
  const result = await new BangumiClient(getConfig()).listNotifications({
    limit,
    unread,
  });

  return {
    ...result,
    resource: "notifications",
    filters: {
      limit,
      unread,
    },
  };
}

export async function executeNotifyClearCommand(args) {
  const options = parseFlags(args);
  const ids = options._.map((id) => normalizePositiveInteger(id, "notification id"));

  await new BangumiClient(getConfig()).clearNotifications(ids);
  return {
    resource: "notification-clear",
    cleared: ids.length > 0 ? "selected" : "all",
    ids,
  };
}

function normalizeNotifyLimit(value) {
  const limit = normalizeNonNegativeInteger(value, "limit");
  if (limit === undefined) {
    return undefined;
  }
  if (limit > 40) {
    throw new CommandError(`Expected limit to be <= 40, received: ${value}`);
  }
  return limit;
}
