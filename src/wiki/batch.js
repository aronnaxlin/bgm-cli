import { setTimeout as sleepMs } from "node:timers/promises";
import { CommandError } from "../core/output.js";
import { itemSteps, prepareItem, validateBatch } from "./input.js";
import { openReport } from "./report.js";

const idFields = { subject: "subjectID", person: "personID", character: "characterID" };
const methods = { subject: "createWikiSubject", person: "createWikiPerson", character: "createWikiCharacter" };
const positiveId = (v) => Number.isSafeInteger(v) && v > 0;
const RATE_LIMIT_REQUESTS = 30;
const RATE_LIMIT_WINDOW_WITH_MARGIN_MS = 301_000;
const NEVER_SENT_ERROR_CODES = new Set(["ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN", "UND_ERR_CONNECT_TIMEOUT"]);
const BATCH_STOPPING_STATUSES = { 401: "authentication", 403: "permission", 429: "rate-limit" };

async function waitForRateLimitSlot(responseTimes, { now, sleep, onProgress }) {
  while (true) {
    const recent = responseTimes.filter((t) => t > now() - RATE_LIMIT_WINDOW_WITH_MARGIN_MS).sort((a, b) => a - b);
    if (recent.length < RATE_LIMIT_REQUESTS) return;
    const wait = Math.max(1, recent[recent.length - RATE_LIMIT_REQUESTS] + RATE_LIMIT_WINDOW_WITH_MARGIN_MS - now());
    onProgress(`Waiting ${Math.ceil(wait / 1000)}s for the Wiki rate limit.`);
    await sleep(wait);
  }
}

function describeErrorWithoutSecrets(error, client, item) {
  let message = String(error?.details?.message ?? error?.message ?? "Request failed");
  const secrets = [
    client?.config?.accessToken, client?.config?.refreshToken, client?.config?.privateSessionId,
    client?.config?.clientSecret, item?.imageContent, item?.body?.[item?.kind]?.img,
  ];
  for (const secret of secrets) if (typeof secret === "string" && secret) message = message.split(secret).join("[redacted]");
  message = message.replace(/[A-Za-z0-9+/]{80,}={0,2}/g, "[redacted]").slice(0, 1000);
  const code = /^[A-Z\d_]{1,80}$/.test(error?.details?.code ?? "") ? error.details.code : undefined;
  return { message, ...(Number.isInteger(error?.status) ? { status: error.status } : {}), ...(code ? { code } : {}) };
}

export function checkResume(prepared, state) {
  const byKey = new Map(prepared.filter((p) => p.item).map((p) => [p.item.key, p.item]));
  for (const [key, previous] of state.items) {
    const successful = [...previous.steps.values()].filter((s) => s.event === "succeeded");
    const item = byKey.get(key);
    if (!item) {
      if (successful.length) throw new CommandError(`Cannot remove or invalidate previously successful item ${key}.`);
      continue;
    }
    if (item.kind !== previous.kind) throw new CommandError(`Cannot change the kind of previously submitted item ${key}.`);
    const steps = new Map(itemSteps(item, previous.steps.get("create")?.id).map((s) => [s.step, s]));
    for (const old of successful) {
      if (steps.get(old.step)?.hash !== old.hash) throw new CommandError(`Successful request changed: ${key}/${old.step}.`);
    }
  }
}

function summaryResult(results, dryRun, stopped, reportFile) {
  const summary = { total: results.length, ready: 0, succeeded: 0, failed: 0, partial: 0, unknown: 0, pending: 0 };
  for (const result of results) {
    if (!result.error) {
      const statuses = result.steps.map((s) => s.status);
      if (statuses.includes("unknown")) result.status = "unknown";
      else if (statuses.every((s) => s === "succeeded")) result.status = "succeeded";
      else if (statuses.includes("succeeded")) result.status = "partial";
      else if (statuses.includes("failed")) result.status = "failed";
      else result.status = dryRun ? "ready" : "pending";
    }
    result.unfinishedSteps = result.steps.filter((s) => s.status !== "succeeded").map((s) => s.step);
    summary[result.status]++;
  }
  return {
    resource: "wiki-create", dryRun, ok: !stopped && (dryRun ? summary.ready : summary.succeeded) === summary.total,
    ...(reportFile ? { report: reportFile } : {}), ...(stopped ? { stopped } : {}), summary, items: results,
  };
}

export async function executeWikiBatch({
  batch, baseDir = process.cwd(), client, dryRun = false, reportFile, resume = false,
  now = Date.now, sleep = sleepMs, timeoutMs = 60_000, onProgress = () => {},
}) {
  validateBatch(batch);
  if (resume && dryRun) throw new CommandError("--resume cannot be combined with --dry-run.");
  if (!dryRun && !reportFile) throw new CommandError("--report is required for Wiki writes.");
  const prepared = [];
  for (const [index, input] of batch.items.entries()) {
    try { prepared.push({ index, item: await prepareItem(input, baseDir) }); }
    catch (error) { prepared.push({ index, key: typeof input?.key === "string" ? input.key : null, error: describeErrorWithoutSecrets(error, client) }); }
  }
  const results = prepared.map((entry) => entry.error
    ? { index: entry.index, key: entry.key, status: "failed", error: entry.error, steps: [] }
    : { index: entry.index, key: entry.item.key, kind: entry.item.kind, status: "pending", steps: itemSteps(entry.item).map(({ step }) => ({ step, status: "pending" })) });
  if (dryRun) return summaryResult(results, true);

  const report = await openReport(reportFile, { resume, now });
  let stopped;
  try {
    checkResume(prepared, report.state);
    for (const [index, entry] of prepared.entries()) {
      if (!entry.item) continue;
      const previous = report.state.items.get(entry.item.key);
      const result = results[index];
      if (previous?.steps.get("create")?.event === "succeeded") result.id = previous.steps.get("create").id;
      for (const step of result.steps) {
        const old = previous?.steps.get(step.step);
        if (old?.event === "succeeded") Object.assign(step, { status: "succeeded", resumed: true, ...(old.episodeIDs ? { episodeIDs: old.episodeIDs } : {}) });
        if (old?.event === "started" || old?.event === "unknown") Object.assign(step, { status: "unknown", error: old.error ?? { message: "Previous request has no confirmed result." } });
      }
    }
    const uncertain = [...report.state.items.entries()].flatMap(([key, item]) =>
      [...item.steps.values()].filter((s) => s.event === "started" || s.event === "unknown").map((s) => ({ key, step: s.step })));
    if (uncertain.length) {
      stopped = { reason: "unknown", message: "Inspect uncertain requests before continuing. They will not be resent.", requests: uncertain };
      return summaryResult(results, false, stopped, report.file);
    }

    for (const [index, entry] of prepared.entries()) {
      const result = results[index];
      if (entry.error) {
        await report.record({ event: "validation-failed", index, key: entry.key, error: entry.error });
        continue;
      }
      const { item } = entry;
      let requests = itemSteps(item, result.id);
      for (let stepIndex = 0; stepIndex < result.steps.length; stepIndex++) {
        const display = result.steps[stepIndex];
        if (display.status === "succeeded") continue;
        if (stepIndex > 0 && !result.id) break;
        const step = requests[stepIndex];
        await waitForRateLimitSlot(report.state.requestTimes, { now, sleep, onProgress });
        const common = { key: item.key, kind: item.kind, step: step.step, hash: step.hash };
        onProgress(`${item.key}: ${step.step}`);
        await report.record({ ...common, event: "started" });
        let outcome;
        try {
          const options = { signal: AbortSignal.timeout(timeoutMs) };
          let payload;
          if (step.step === "create") payload = await client[methods[item.kind]](step.body, options);
          else if (step.step === "cover") payload = await client.uploadWikiSubjectCover(result.id, step.body, options);
          else payload = await client.createWikiEpisodes(result.id, step.body, options);
          if (step.step === "create") {
            const id = payload?.[idFields[item.kind]];
            if (!positiveId(id)) throw new Error("Create response did not contain a valid ID; the object may already exist.");
            outcome = { event: "succeeded", id };
          } else if (step.step.startsWith("episodes:")) {
            const ids = payload?.episodeIDs;
            if (!Array.isArray(ids) || ids.length !== step.body.episodes.length || !ids.every(positiveId) || new Set(ids).size !== ids.length) {
              throw new Error("Episode response did not contain all expected IDs; episodes may already exist.");
            }
            outcome = { event: "succeeded", episodeIDs: ids };
          } else {
            if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("Unexpected cover response; upload result is uncertain.");
            outcome = { event: "succeeded" };
          }
        } catch (error) {
          const neverSent = NEVER_SENT_ERROR_CODES.has(error?.details?.code);
          const rejected = error?.status >= 400 && error.status < 500 && error.status !== 408;
          outcome = { event: neverSent || rejected ? "failed" : "unknown", error: describeErrorWithoutSecrets(error, client, item) };
          const reason = neverSent ? "network" : rejected ? BATCH_STOPPING_STATUSES[error.status] : "unknown";
          if (reason) stopped = { reason, key: item.key, step: step.step };
        }
        if (outcome.id) onProgress(`${item.key}: created ${item.kind} ID ${outcome.id}`);
        await report.record({ ...common, ...outcome });
        Object.assign(display, { status: outcome.event, ...(outcome.error ? { error: outcome.error } : {}), ...(outcome.episodeIDs ? { episodeIDs: outcome.episodeIDs } : {}) });
        if (outcome.id) {
          result.id = outcome.id;
          requests = itemSteps(item, result.id);
        }
        if (stopped) break;
      }
      if (stopped) break;
    }
    return summaryResult(results, false, stopped, report.file);
  } finally {
    await report.close();
  }
}
