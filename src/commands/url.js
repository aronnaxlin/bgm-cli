/**
 * URL command: turn a pasted Bangumi link into the equivalent bgm CLI command.
 *
 * Resolution is read-only. A link never triggers a write operation.
 */

import { CommandError, printResult } from "../core/output.js";
import {
  formatResolvedCommand,
  looksLikeBangumiUrl,
  resolveBangumiUrl,
} from "../utils/bangumi-url.js";
import { runBlogCommand } from "./blog.js";
import { runCalendarCommand } from "./calendar.js";
import { runCharacterCommand } from "./character.js";
import { runCollectionCommand } from "./collection.js";
import { runEpisodeCommand } from "./episode.js";
import { runGroupCommand } from "./group.js";
import { runIndexCommand } from "./index.js";
import { runNotifyCommand } from "./notify.js";
import { runPersonCommand } from "./person.js";
import { runSubjectCommand } from "./subject.js";
import { runTimelineCommand } from "./timeline.js";
import { runUserCommand } from "./user.js";

const COMMAND_RUNNERS = {
  blog: runBlogCommand,
  calendar: runCalendarCommand,
  character: runCharacterCommand,
  collection: runCollectionCommand,
  episode: runEpisodeCommand,
  group: runGroupCommand,
  index: runIndexCommand,
  notify: runNotifyCommand,
  person: runPersonCommand,
  subject: runSubjectCommand,
  timeline: runTimelineCommand,
  user: runUserCommand,
};

const USAGE = "Usage: bgm [--json] url <bangumi_url> [--dry-run] [extra flags passed to the resolved command]";

export async function runUrlCommand(args, context = {}) {
  const { url, dryRun, passthrough } = splitUrlArgs(args);
  if (!url) {
    throw new CommandError(USAGE);
  }

  const resolved = resolveBangumiUrl(url);
  const commandArgs = [...resolved.args, ...passthrough];

  if (dryRun) {
    printResult(buildDryRunPayload(resolved, commandArgs), context);
    return;
  }

  const runner = COMMAND_RUNNERS[resolved.group];
  if (!runner) {
    throw new CommandError(`No CLI runner for command group: ${resolved.group}`);
  }

  await runner(resolved.command, commandArgs, {
    ...context,
    resolvedFrom: {
      url: resolved.url,
      site: resolved.site,
      command: `${resolved.group} ${resolved.command}`,
      args: commandArgs,
    },
  });
}

export function buildDryRunPayload(resolved, commandArgs = resolved.args) {
  return {
    resource: "url-resolve",
    url: resolved.url,
    site: resolved.site,
    path: resolved.path,
    command: `${resolved.group} ${resolved.command}`,
    args: commandArgs,
    commandLine: formatResolvedCommand({ ...resolved, args: commandArgs }),
  };
}

/**
 * Split raw args into the URL, the --dry-run switch, and flags forwarded to the
 * resolved command. Done by hand so `--dry-run <url>` cannot swallow the URL.
 */
export function splitUrlArgs(args) {
  const tokens = args.filter((token) => token !== undefined && token !== null).map(String);
  const rest = tokens.filter((token) => token !== "--dry-run");
  const dryRun = tokens.length !== rest.length;

  let urlIndex = rest.findIndex((token) => looksLikeBangumiUrl(token));
  if (urlIndex === -1) {
    urlIndex = rest.findIndex((token) => !token.startsWith("-"));
  }

  if (urlIndex === -1) {
    return { url: undefined, dryRun, passthrough: rest };
  }

  return {
    url: rest[urlIndex],
    dryRun,
    passthrough: [...rest.slice(0, urlIndex), ...rest.slice(urlIndex + 1)],
  };
}
