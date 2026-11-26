import { constants } from "node:fs";
import { open, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { CommandError } from "../core/output.js";

const invalid = (message) => { throw new CommandError(`Invalid Wiki report: ${message}`); };
const positiveId = (value) => Number.isSafeInteger(value) && value > 0;

function applyEvent(state, row) {
  if (!row || typeof row !== "object" || !Number.isFinite(Date.parse(row.at))) invalid("invalid event or timestamp.");
  if (row.event === "validation-failed") return;
  if (!["started", "succeeded", "failed", "unknown"].includes(row.event)) invalid("unknown event type.");
  if (typeof row.key !== "string" || !row.key || !["subject", "person", "character"].includes(row.kind)) invalid("missing key or kind.");
  if (!/^(create|cover|episodes:\d+)$/.test(row.step) || !/^[a-f\d]{64}$/.test(row.hash)) invalid("invalid step or request digest.");
  let item = state.items.get(row.key);
  if (!item) {
    item = { kind: row.kind, steps: new Map() };
    state.items.set(row.key, item);
  }
  if (item.kind !== row.kind) invalid(`kind changed for ${row.key}.`);
  if (row.step !== "create" && (row.kind !== "subject" || item.steps.get("create")?.event !== "succeeded")) invalid("attachment without a created subject.");
  const previous = item.steps.get(row.step);
  const requestId = `${row.key}\n${row.step}`;
  if (row.event === "started") {
    if (previous && previous.event !== "failed") invalid(`cannot resend ${row.key}/${row.step}.`);
    state.unansweredRequests.set(requestId, state.requestTimes.push(Date.parse(row.at)) - 1);
  } else {
    if (previous?.event !== "started" || previous.hash !== row.hash) invalid("result without matching start.");
    state.requestTimes[state.unansweredRequests.get(requestId)] = Date.parse(row.at);
    state.unansweredRequests.delete(requestId);
    if (row.event === "succeeded") {
      if (row.step === "create" && !positiveId(row.id)) invalid("missing created ID.");
      if (row.step.startsWith("episodes:") && (!Array.isArray(row.episodeIDs) || !row.episodeIDs.length || !row.episodeIDs.every(positiveId))) invalid("invalid episode IDs.");
    }
  }
  item.steps.set(row.step, row);
}

async function acquireLock(file) {
  const lockPath = `${file}.lock`;
  let handle;
  try {
    handle = await open(lockPath, "wx", 0o600);
  } catch (error) {
    if (error.code === "ENOENT") throw new CommandError(`Cannot create a report in a directory that is missing: ${path.dirname(file)}`);
    if (error.code !== "EEXIST") throw error;
    let owner;
    try { owner = JSON.parse(await readFile(lockPath, "utf8")); } catch {}
    throw new CommandError(`Report is locked${owner?.pid ? ` by process ${owner.pid}` : ""}: ${lockPath}. After an interrupted process, inspect the report and remove only this lock once its owner has exited.`);
  }
  try {
    await handle.writeFile(JSON.stringify({ pid: process.pid }));
    await handle.sync();
  } catch (error) {
    await handle.close();
    await unlink(lockPath);
    throw error;
  }
  await handle.close();
  return async () => { await unlink(lockPath); };
}

export async function openReport(filename, { resume = false, now = Date.now } = {}) {
  const file = path.resolve(filename);
  const unlock = await acquireLock(file);
  let handle;
  const state = { items: new Map(), requestTimes: [], unansweredRequests: new Map() };
  try {
    handle = await open(file, constants.O_APPEND | constants.O_RDWR | (resume ? 0 : constants.O_CREAT | constants.O_EXCL), 0o600);
    if (resume) {
      const raw = await handle.readFile("utf8");
      if (!raw.endsWith("\n")) invalid("truncated final record; inspect it before continuing.");
      let rows;
      try { rows = raw.trimEnd().split("\n").map((line) => JSON.parse(line)); }
      catch { invalid("malformed JSONL; no requests were sent."); }
      if (rows[0]?.event !== "batch" || rows[0]?.version !== 1) invalid("unsupported header.");
      for (const row of rows.slice(1)) applyEvent(state, row);
    } else {
      await handle.writeFile(`${JSON.stringify({ event: "batch", version: 1, at: new Date(now()).toISOString() })}\n`);
      await handle.sync();
    }
    return {
      file, state,
      async record(event) {
        const row = { ...event, at: new Date(now()).toISOString() };
        await handle.writeFile(`${JSON.stringify(row)}\n`);
        await handle.sync();
        applyEvent(state, row);
        return row;
      },
      async close() {
        try { await handle.close(); } finally { await unlock(); }
      },
    };
  } catch (error) {
    try { await handle?.close(); } finally { await unlock(); }
    if (error.code === "EEXIST") throw new CommandError("Report already exists. Use --resume, or choose a new report for a new batch.");
    if (error.code === "ENOENT") throw new CommandError(`Report does not exist: ${file}. Run without --resume to start a new batch.`);
    throw error;
  }
}
