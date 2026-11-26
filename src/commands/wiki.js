import { BangumiClient } from "../core/client.js";
import { getConfig } from "../core/config.js";
import { CommandError, printResult } from "../core/output.js";
import { loadBatch } from "../wiki/input.js";
import { executeWikiBatch } from "../wiki/batch.js";

const USAGE = "Usage: bgm [--json] wiki create --file <batch.json|-> [--dry-run | --report <results.jsonl> [--resume]]";

export function parseWikiArgs(args) {
  const result = { dryRun: false, resume: false };
  const seen = new Set();
  for (let i = 0; i < args.length; i++) {
    const token = args[i];
    const equal = token.indexOf("=");
    const key = equal < 0 ? token : token.slice(0, equal);
    if (seen.has(key)) throw new CommandError(`Repeated option: ${key}`);
    seen.add(key);
    if (key === "--dry-run" || key === "--resume") {
      if (equal >= 0) throw new CommandError(`${key} does not take a value.`);
      result[key === "--dry-run" ? "dryRun" : "resume"] = true;
    } else if (key === "--file" || key === "--report") {
      const value = equal < 0 ? args[++i] : token.slice(equal + 1);
      if (!value || value.startsWith("--")) throw new CommandError(`Missing value for ${key}. ${USAGE}`);
      if (key === "--report" && value === "-") throw new CommandError("--report must be a local file, not stdout.");
      result[key === "--file" ? "file" : "reportFile"] = value;
    } else {
      throw new CommandError(`Unexpected argument: ${token}. ${USAGE}`);
    }
  }
  if (!result.file || (!result.dryRun && !result.reportFile)) throw new CommandError(USAGE);
  if (result.dryRun && result.resume) throw new CommandError("--resume cannot be combined with --dry-run.");
  return result;
}

export async function runWikiCommand(command, args, context) {
  if (command !== "create") throw new CommandError(USAGE);
  const options = parseWikiArgs(args);
  const { batch, baseDir } = await loadBatch(options.file);
  const result = await executeWikiBatch({
    ...options, batch, baseDir,
    client: new BangumiClient(getConfig()),
    onProgress: (message) => process.stderr.write(`${message}\n`),
  });
  printResult(result, context);
  if (!result.ok) process.exitCode = 1;
}
