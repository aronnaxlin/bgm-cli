import { BangumiStatusClient } from "../core/client.js";
import { getConfig } from "../core/config.js";
import { CommandError, printResult } from "../core/output.js";
import { parseFlags } from "../utils/args.js";
import { normalizePageSize } from "../utils/helpers.js";
import { normalizeStatusAudience, normalizeStatusSite } from "../utils/validators.js";
import { buildStatusCurrentPayload } from "../utils/status.js";

export async function runStatusCommand(command, args, context) {
  if (!command || String(command).startsWith("--")) {
    const result = await executeStatusCurrentCommand(command ? [command, ...args] : args);
    printResult(result, context);
    return;
  }

  switch (command) {
    case "current": {
      const result = await executeStatusCurrentCommand(args);
      printResult(result, context);
      return;
    }
    case "incidents": {
      const result = await executeStatusIncidentsCommand(args);
      printResult(result, context);
      return;
    }
    default:
      throw new CommandError("Usage: bgm status [current|incidents] ...");
  }
}

export async function executeStatusCurrentCommand(args) {
  const options = parseFlags(args);
  const client = new BangumiStatusClient(getConfig());
  const site = normalizeStatusSite(options.site);
  const audience = normalizeStatusAudience(options.audience);
  const current = await client.getCurrentStatus();

  return buildStatusCurrentPayload(current, { site, audience });
}

export async function executeStatusIncidentsCommand(args) {
  const options = parseFlags(args);
  const client = new BangumiStatusClient(getConfig());
  const site = normalizeStatusSite(options.site);
  const audience = normalizeStatusAudience(options.audience);
  const limit = normalizePageSize(options.limit) ?? 10;
  const [current, feed] = await Promise.all([client.getCurrentStatus(), client.listIncidents()]);
  const filtered = feed.entries.filter((entry) => {
    if (site && entry.site !== site) {
      return false;
    }
    if (audience && normalizeStatusAudience(entry.audience) !== audience) {
      return false;
    }
    return true;
  });
  buildStatusCurrentPayload(current, { site, audience });

  return {
    resource: "status-incidents",
    title: feed.title,
    source: feed.link,
    feedUrl: feed.feedUrl,
    feedUpdatedAt: feed.updatedAt,
    total: filtered.length,
    filters: {
      site,
      audience,
      limit,
    },
    data: filtered.slice(0, limit),
  };
}
