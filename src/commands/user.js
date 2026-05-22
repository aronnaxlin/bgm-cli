import { BangumiClient } from "../core/client.js";
import { getConfig } from "../core/config.js";
import { CommandError, printResult } from "../core/output.js";
import { firstPositional, parseFlags } from "../utils/args.js";
import {
  normalizeNonNegativeInteger,
  normalizePageSize,
  resolveUsernameOrMe,
} from "../utils/helpers.js";

export async function runUserCommand(command, args, context) {
  switch (command) {
    case "me": {
      const client = new BangumiClient(getConfig());
      const me = await client.getMe();
      printResult(me, context);
      return;
    }
    case "get": {
      const options = parseFlags(args);
      const client = new BangumiClient(getConfig());
      const username = firstPositional(options);
      if (!username) {
        throw new CommandError("Usage: bgm user get <username_or_initial_uid>");
      }

      const user = await client.getUser(username);
      printResult(user, context);
      return;
    }
    case "friends": {
      const result = await executeUserFriendsCommand(args);
      printResult(result, context);
      return;
    }
    case "followers": {
      const result = await executeUserFollowersCommand(args);
      printResult(result, context);
      return;
    }
    default:
      throw new CommandError("Usage: bgm user <me|get|friends|followers> ...");
  }
}

async function executeUserFriendsCommand(args) {
  const { client, username, query } = await parseUserListArgs(args);
  const result = await client.listUserFriends(username, query);
  return {
    ...result,
    resource: "user-friends",
    title: "User friends",
    username,
    filters: query,
  };
}

async function executeUserFollowersCommand(args) {
  const { client, username, query } = await parseUserListArgs(args);
  const result = await client.listUserFollowers(username, query);
  return {
    ...result,
    resource: "user-followers",
    title: "User followers",
    username,
    filters: query,
  };
}

async function parseUserListArgs(args) {
  const options = parseFlags(args);
  const client = new BangumiClient(getConfig());
  const username = await resolveUsernameOrMe(client, firstPositional(options));

  return {
    client,
    username,
    query: {
      limit: normalizePageSize(options.limit),
      offset: normalizeNonNegativeInteger(options.offset, "offset"),
    },
  };
}
