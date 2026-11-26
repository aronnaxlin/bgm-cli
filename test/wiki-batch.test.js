import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { BangumiClient } from "../src/core/client.js";
import { BangumiApiError } from "../src/core/http.js";
import { loadBatch, prepareItem, validateBatch, IMAGE_SIZE_LIMIT, digest, itemSteps } from "../src/wiki/input.js";
import { executeWikiBatch } from "../src/wiki/batch.js";
import { openReport } from "../src/wiki/report.js";
import { CommandError, formatDisplayResult } from "../src/core/output.js";

const subject = (key = "album") => ({ key, kind: "subject", body: {
  name: "  Original title  ", type: 3, platform: 0, infobox: "{{Infobox Album\n|Artist= A\n}}\n",
  nsfw: false, metaTags: [], summary: " Original summary\nhttps://example.invalid/do-not-fetch\n",
} });
const mono = (kind, key = kind) => ({ key, kind, body: { [kind]: {
  name: "Example", infobox: "{{Infobox Crt}}", summary: "", type: 1,
  ...(kind === "person" ? { profession: { artist: true } } : {}),
} } });
const episode = (n) => ({ ep: n + 1, disc: n < 20 ? 1 : 2, name: `Track ${n + 1}`, duration: "03:20" });
const batch = (...items) => ({ version: 1, items });
const apiError = (status, message = "Rejected") => new BangumiApiError(message, { status, details: { code: "BAD_REQUEST", message } });

async function setup(t) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "bgm-wiki-test-"));
  t.after(async () => {
    assert.equal(path.dirname(dir), path.resolve(os.tmpdir()));
    await rm(dir, { recursive: true, force: true });
  });
  const calls = [];
  let id = 100;
  const client = { config: {} };
  for (const [name, field] of [["createWikiSubject", "subjectID"], ["createWikiPerson", "personID"], ["createWikiCharacter", "characterID"]]) {
    client[name] = async (body, options) => { calls.push({ name, body, options }); return { [field]: ++id }; };
  }
  client.uploadWikiSubjectCover = async (subjectId, body, options) => { calls.push({ name: "cover", subjectId, body, options }); return {}; };
  client.createWikiEpisodes = async (subjectId, body, options) => { calls.push({ name: "episodes", subjectId, body, options }); return { episodeIDs: body.episodes.map(() => ++id) }; };
  let time = 1_800_000_000_000;
  const waits = [];
  const reportFile = path.join(dir, "results.jsonl");
  const run = (data, options = {}) => executeWikiBatch({
    batch: data, baseDir: dir, client, reportFile, now: () => time,
    sleep: async (ms) => { waits.push(ms); time += ms; }, ...options,
  });
  const rows = async () => (await readFile(reportFile, "utf8")).trimEnd().split("\n").map(JSON.parse);
  const clock = () => time;
  const advance = (ms) => { time += ms; };
  return { dir, calls, client, run, rows, reportFile, waits, clock, advance };
}
const commandError = (pattern) => (error) => error instanceof CommandError && pattern.test(error.message);

describe("Wiki input contract", () => {
  it("preserves all prepared text and does not mutate input", async () => {
    const input = subject();
    const original = structuredClone(input);
    const result = await prepareItem(input, process.cwd());
    assert.deepEqual(result.body, original.body);
    assert.deepEqual(input, original);
    assert.equal(digest({ a: 1, b: 2 }), digest({ b: 2, a: 1 }));
  });
  it("reads local image bytes relative to the batch directory", async (t) => {
    const { dir } = await setup(t);
    const bytes = Buffer.from([137, 80, 78, 71, 0, 1, 2]);
    await writeFile(path.join(dir, "cover file.png"), bytes);
    for (const file of ["./cover file.png", path.join(dir, "cover file.png")]) {
      const item = await prepareItem({ ...subject(), image: { file } }, dir);
      assert.equal(item.imageContent, bytes.toString("base64"));
    }
  });
  it("places portrait bytes inside the original p1 envelope", async () => {
    for (const kind of ["person", "character"]) {
      const result = await prepareItem({ ...mono(kind), image: { base64: "YWJj" } }, process.cwd());
      assert.equal(result.body[kind].img, "YWJj");
      assert.equal(result.imageContent, undefined);
    }
  });
  it("accepts the exact decoded image-size boundary", async () => {
    const base64 = Buffer.alloc(IMAGE_SIZE_LIMIT).toString("base64");
    const result = await prepareItem({ ...subject(), image: { base64 } }, process.cwd());
    assert.equal(result.imageContent, base64);
  });
  const badItems = [
    ["missing required field", () => { const v = subject(); delete v.body.name; return v; }],
    ["unsupported kind", () => ({ ...subject(), kind: "blog" })],
    ["unknown field", () => ({ ...subject(), body: { ...subject().body, typo: true } })],
    ["bad subject type", () => ({ ...subject(), body: { ...subject().body, type: 5 } })],
    ["wrong boolean", () => ({ ...subject(), body: { ...subject().body, nsfw: "false" } })],
    ["bad image base64", () => ({ ...subject(), image: { base64: "not base64" } })],
    ["noncanonical base64", () => ({ ...subject(), image: { base64: "YR==" } })],
    ["empty image", () => ({ ...subject(), image: { base64: "" } })],
    ["data URL", () => ({ ...subject(), image: { base64: "data:image/png;base64,YWJj" } })],
    ["remote file URL", () => ({ ...subject(), image: { file: "https://example.invalid/pic.png" } })],
    ["two image sources", () => ({ ...subject(), image: { base64: "YWJj", file: "a.png" } })],
    ["unknown image field", () => ({ ...subject(), image: { url: "https://example.invalid" } })],
    ["missing image file", () => ({ ...subject(), image: { file: "does-not-exist.png" } })],
    ["oversized image", () => ({ ...subject(), image: { base64: Buffer.alloc(IMAGE_SIZE_LIMIT + 1).toString("base64") } })],
    ["duplicate portrait", () => ({ ...mono("person"), body: { person: { ...mono("person").body.person, img: "YWJj" } }, image: { base64: "YWJj" } })],
    ["episode on person", () => ({ ...mono("person"), episodes: [] })],
    ["episode missing ep", () => ({ ...subject(), episodes: [{ name: "No number" }] })],
    ["episode string ep", () => ({ ...subject(), episodes: [{ ep: "1" }] })],
    ["episode with existing id", () => ({ ...subject(), episodes: [{ ep: 1, id: 123 }] })],
    ["bad profession", () => ({ ...mono("person"), body: { person: { ...mono("person").body.person, profession: { artist: "yes" } } } })],
    ["admin impersonation", () => ({ ...mono("person"), body: { ...mono("person").body, authorID: 42 } })],
  ];
  for (const [name, make] of badItems) it(`rejects ${name}`, async (t) => {
    const { dir } = await setup(t);
    await assert.rejects(prepareItem(make(), dir));
  });
  it("names the actual mistake for a missing envelope and unusable image files", async (t) => {
    const { dir } = await setup(t);
    await writeFile(path.join(dir, "empty.png"), "");
    const withoutEnvelope = { key: "flat", kind: "character", body: mono("character").body.character };
    await assert.rejects(prepareItem(withoutEnvelope, dir), commandError(/body\.character is required/));
    await assert.rejects(prepareItem({ ...subject(), image: { file: "empty.png" } }, dir), commandError(/image\.file is empty/));
    await assert.rejects(prepareItem({ ...subject(), image: { file: "absent.png" } }, dir), commandError(/image\.file does not exist/));
  });
  it("rejects ambiguous batch identity and unsupported versions", () => {
    assert.throws(() => validateBatch({ version: 2, items: [] }));
    assert.throws(() => validateBatch(batch(subject("same"), subject("same"))));
  });
});

describe("Wiki execution and results", () => {
  it("creates all three kinds with exact bodies, and makes no requests for dry-run", async (t) => {
    const { run, calls, reportFile } = await setup(t);
    const input = batch(subject(), mono("person"), mono("character"));
    const dry = await run(input, { dryRun: true });
    assert.equal(dry.ok, true);
    assert.equal(dry.summary.ready, 3);
    assert.equal(calls.length, 0);
    await assert.rejects(readFile(reportFile), { code: "ENOENT" });
    const result = await run(input);
    assert.equal(result.ok, true);
    assert.deepEqual(result.items.map((x) => x.id), [101, 102, 103]);
    assert.deepEqual(calls.map((c) => c.body), input.items.map((i) => i.body));
    assert.ok(calls.every((c) => c.options.signal instanceof AbortSignal));
    assert.match(formatDisplayResult(result), /album: succeeded \(ID 101\)/);
  });
  for (const count of [0, 40, 41, 83]) it(`keeps ${count} episodes in order with chunks of at most 40`, async (t) => {
    const { run, calls } = await setup(t);
    const episodes = Array.from({ length: count }, (_, n) => episode(n));
    const result = await run(batch({ ...subject(), episodes, image: { base64: "YWJj" } }));
    assert.equal(result.ok, true);
    assert.deepEqual(calls.slice(0, 2).map((c) => c.name), ["createWikiSubject", "cover"]);
    const chunks = calls.filter((c) => c.name === "episodes");
    assert.equal(chunks.length, Math.ceil(count / 40));
    assert.deepEqual(chunks.flatMap((c) => c.body.episodes), episodes);
    assert.ok(chunks.every((c) => c.subjectId === 101 && c.body.episodes.length <= 40));
  });
  it("records invalid rows and continues valid entries", async (t) => {
    const { run, calls, rows } = await setup(t);
    const result = await run(batch(null, { ...subject("bad"), image: { file: "missing" } }, subject("good")));
    assert.equal(result.ok, false);
    assert.equal(result.summary.failed, 2);
    assert.equal(result.summary.succeeded, 1);
    assert.equal(calls.length, 1);
    assert.equal((await rows()).filter((r) => r.event === "validation-failed").length, 2);
  });
  it("rejects malformed batch structure and missing report before calling API", async (t) => {
    const { run, calls } = await setup(t);
    await assert.rejects(run({ version: 2, items: [subject()] }));
    await assert.rejects(run(batch(subject()), { reportFile: undefined }));
    assert.equal(calls.length, 0);
  });
  it("continues after an explicit rejection and never attaches to a failed create", async (t) => {
    const { run, client, calls } = await setup(t);
    client.createWikiSubject = async () => { throw apiError(400, "Invalid infobox"); };
    const result = await run(batch({ ...subject(), image: { base64: "YWJj" }, episodes: [episode(0)] }, mono("person")));
    assert.equal(result.items[0].status, "failed");
    assert.equal(result.items[1].status, "succeeded");
    assert.deepEqual(result.items[0].unfinishedSteps, ["create", "cover", "episodes:0"]);
    assert.equal(calls.length, 1);
  });
  it("preserves subject ID and submits episodes even after a rejected cover", async (t) => {
    const { run, client } = await setup(t);
    client.uploadWikiSubjectCover = async () => { throw apiError(400); };
    const result = await run(batch({ ...subject(), image: { base64: "YWJj" }, episodes: [episode(0)] }));
    assert.equal(result.items[0].id, 101);
    assert.equal(result.items[0].status, "partial");
    assert.deepEqual(result.items[0].steps.map((s) => s.status), ["succeeded", "failed", "succeeded"]);
  });
  const stopReasons = { 401: "authentication", 403: "permission", 429: "rate-limit" };
  for (const status of [401, 403, 429, 500, 408]) it(`stops the batch on HTTP ${status}`, async (t) => {
    const { run, client, calls } = await setup(t);
    client.createWikiSubject = async () => { throw apiError(status); };
    const result = await run(batch(subject(), mono("person")));
    assert.equal(result.ok, false);
    assert.equal(result.items[1].status, "pending");
    assert.equal(calls.length, 0);
    assert.equal(result.stopped.reason, stopReasons[status] ?? "unknown");
  });
  it("uses a rolling rate limiter with a fake clock", async (t) => {
    const { run, calls, waits } = await setup(t);
    const result = await run(batch(...Array.from({ length: 31 }, (_, i) => subject(`s${i}`))));
    assert.equal(result.ok, true);
    assert.equal(calls.length, 31);
    assert.deepEqual(waits, [301000]);
  });
  it("opens the next rate-limit window only after the oldest response has aged out", async (t) => {
    const { run, client, clock, advance } = await setup(t);
    const sentAt = [];
    const respondedAt = [];
    client.createWikiSubject = async () => {
      sentAt.push(clock());
      advance(sentAt.length === 1 ? 2500 : 100);
      respondedAt.push(clock());
      return { subjectID: 100 + sentAt.length };
    };
    const result = await run(batch(...Array.from({ length: 31 }, (_, i) => subject(`s${i}`))));
    assert.equal(result.ok, true);
    assert.ok(sentAt[30] - respondedAt[0] > 300_000);
  });
  it("treats a refused connection as never sent, stops, and lets resume retry it", async (t) => {
    const { run, rows } = await setup(t);
    let online = false;
    t.mock.method(globalThis, "fetch", async () => {
      if (!online) throw Object.assign(new TypeError("fetch failed"), { cause: { code: "ECONNREFUSED" } });
      return Response.json({ subjectID: 7 });
    });
    const client = new BangumiClient({ accessToken: "token" });
    const first = await run(batch(subject(), mono("person")), { client });
    assert.equal(first.items[0].status, "failed");
    assert.equal(first.items[1].status, "pending");
    assert.equal(first.stopped.reason, "network");
    assert.equal((await rows()).at(-1).event, "failed");
    online = true;
    const resumed = await run(batch(subject()), { client, resume: true });
    assert.equal(resumed.ok, true);
    assert.equal(resumed.items[0].id, 7);
  });
  it("announces a created ID before the result is written to the report", async (t) => {
    const { run, reportFile } = await setup(t);
    const lastEventWhenAnnounced = [];
    await run(batch(subject()), { onProgress: (message) => {
      if (/created subject ID 101/.test(message)) lastEventWhenAnnounced.push(JSON.parse(readFileSync(reportFile, "utf8").trimEnd().split("\n").at(-1)).event);
    } });
    assert.deepEqual(lastEventWhenAnnounced, ["started"]);
  });
  it("requires valid create and episode IDs before recording success", async (t) => {
    const { run, client } = await setup(t);
    client.createWikiSubject = async () => ({ id: 100 });
    const result = await run(batch(subject()));
    assert.equal(result.items[0].status, "unknown");
    assert.equal(result.stopped.reason, "unknown");
  });
  it("aborts through the HTTP client and records an uncertain write", async (t) => {
    const { run, calls } = await setup(t);
    let requests = 0;
    t.mock.method(globalThis, "fetch", (_url, { signal }) => new Promise((_resolve, reject) => {
      requests++;
      const keepAlive = setTimeout(() => reject(new Error("Test timeout")), 5000);
      signal.addEventListener("abort", () => { clearTimeout(keepAlive); reject(signal.reason); }, { once: true });
    }));
    const result = await run(batch(subject(), mono("person")), { client: new BangumiClient({}), timeoutMs: 5 });
    assert.equal(requests, 1);
    assert.equal(calls.length, 0);
    assert.equal(result.items[0].status, "unknown");
    assert.equal(result.items[1].status, "pending");
  });
  it("marks incomplete episode responses uncertain", async (t) => {
    const { run, client } = await setup(t);
    client.createWikiEpisodes = async () => ({ episodeIDs: [] });
    const result = await run(batch({ ...subject(), episodes: [episode(0)] }));
    assert.equal(result.items[0].id, 101);
    assert.equal(result.items[0].status, "unknown");
  });
  it("flushes a started record before making the request and redacts diagnostics", async (t) => {
    const { run, client, rows, reportFile } = await setup(t);
    client.config = { accessToken: "secret-access-token", privateSessionId: "secret-session" };
    client.createWikiPerson = async () => {
      assert.equal((await rows()).at(-1).event, "started");
      throw apiError(400, "secret-access-token secret-session YWJj");
    };
    await run(batch({ ...mono("person"), image: { base64: "YWJj" } }));
    const log = await readFile(reportFile, "utf8");
    assert.doesNotMatch(log, /secret-access-token|secret-session|YWJj/);
    assert.match(log, /\[redacted\]/);
  });
});

describe("Wiki resume safety", () => {
  it("skips successful create and chapters, retries only failed cover", async (t) => {
    const { run, calls, client } = await setup(t);
    const original = client.uploadWikiSubjectCover;
    client.uploadWikiSubjectCover = async () => { throw apiError(400); };
    const input = batch({ ...subject(), image: { base64: "YWJj" }, episodes: [episode(0)] });
    await run(input);
    calls.length = 0;
    client.uploadWikiSubjectCover = original;
    const result = await run(input, { resume: true });
    assert.equal(result.ok, true);
    assert.equal(result.items[0].id, 101);
    assert.deepEqual(calls.map((c) => c.name), ["cover"]);
    assert.equal(result.items[0].steps[2].resumed, true);
  });
  it("allows correcting a definitively failed payload", async (t) => {
    const { run, client, calls } = await setup(t);
    const original = client.createWikiSubject;
    client.createWikiSubject = async () => { throw apiError(400); };
    await run(batch(subject()));
    const changed = subject(); changed.body.infobox = "{{Infobox Album\n|Artist=Corrected\n}}";
    client.createWikiSubject = original;
    const result = await run(batch(changed), { resume: true });
    assert.equal(result.ok, true);
    assert.equal(calls[0].body.infobox, changed.body.infobox);
  });
  it("blocks all writes if any successful payload changed or disappeared", async (t) => {
    const { run, calls } = await setup(t);
    await run(batch(subject())); calls.length = 0;
    const changed = subject(); changed.body.name = "Changed";
    await assert.rejects(run(batch(subject("new"), changed), { resume: true }), /Successful request changed/);
    await assert.rejects(run(batch(subject("new")), { resume: true }), /Cannot remove/);
    assert.equal(calls.length, 0);
  });
  it("allows correcting a rejected episode chunk while successful chunks stay fixed", async (t) => {
    const { run, client, calls } = await setup(t);
    const original = client.createWikiEpisodes;
    let count = 0;
    client.createWikiEpisodes = async (...args) => ++count === 2 ? Promise.reject(apiError(400)) : original(...args);
    const item = { ...subject(), episodes: Array.from({ length: 83 }, (_, i) => episode(i)) };
    const first = await run(batch(item)); calls.length = 0;
    assert.deepEqual(first.items[0].steps.map((s) => s.status), ["succeeded", "succeeded", "failed", "succeeded"]);
    const tampered = structuredClone(item);
    tampered.episodes[0].name = "Changed inside a successful chunk";
    await assert.rejects(run(batch(tampered), { resume: true }), /Successful request changed/);
    const shifted = structuredClone(item);
    shifted.episodes.splice(45, 1);
    await assert.rejects(run(batch(shifted), { resume: true }), /Successful request changed/);
    assert.equal(calls.length, 0);
    item.episodes[45].duration = "03:21";
    const resumed = await run(batch(item), { resume: true });
    assert.equal(resumed.ok, true);
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0].body.episodes, item.episodes.slice(40, 80));
  });
  it("reports a missing report or report directory as a plain command error", async (t) => {
    const { dir, run, calls } = await setup(t);
    await assert.rejects(run(batch(subject()), { resume: true }), commandError(/does not exist/));
    await assert.rejects(run(batch(subject()), { reportFile: path.join(dir, "missing", "results.jsonl") }), commandError(/Cannot create/));
    await assert.rejects(loadBatch(path.join(dir, "missing.json")), commandError(/Cannot read/));
    assert.equal(calls.length, 0);
  });
  it("blocks retry after timeout, even when the unknown item is omitted", async (t) => {
    const { run, client, calls } = await setup(t);
    client.createWikiSubject = async () => { throw new Error("Network request timed out"); };
    await run(batch(subject()));
    const result = await run(batch(mono("person")), { resume: true });
    assert.equal(result.stopped.reason, "unknown");
    assert.equal(calls.length, 0);
  });
  it("treats a persisted start with no result as uncertain", async (t) => {
    const { run, calls, dir, reportFile } = await setup(t);
    const item = await prepareItem(subject(), dir);
    const step = itemSteps(item)[0];
    const log = await openReport(reportFile);
    await log.record({ event: "started", key: item.key, kind: item.kind, step: step.step, hash: step.hash });
    await log.close();
    const result = await run(batch(subject()), { resume: true });
    assert.equal(result.items[0].status, "unknown");
    assert.equal(calls.length, 0);
  });
  it("never truncates an existing report and rejects corrupt reports", async (t) => {
    const { run, reportFile, calls } = await setup(t);
    await run(batch(subject()));
    const original = await readFile(reportFile, "utf8");
    await assert.rejects(run(batch(subject())), /already exists/);
    assert.equal(await readFile(reportFile, "utf8"), original);
    await writeFile(reportFile, `${original}{"event":`);
    calls.length = 0;
    await assert.rejects(run(batch(subject()), { resume: true }), /truncated/);
    assert.equal(calls.length, 0);
  });
  it("prevents simultaneous writers to the same report", async (t) => {
    const { reportFile } = await setup(t);
    const report = await openReport(reportFile);
    try { await assert.rejects(openReport(reportFile, { resume: true }), /locked/); }
    finally { await report.close(); }
  });
  it("retains request timestamps across resume for rate limiting", async (t) => {
    const { run, waits } = await setup(t);
    const items = Array.from({ length: 30 }, (_, i) => subject(`old-${i}`));
    await run(batch(...items));
    const result = await run(batch(...items, subject("new")), { resume: true });
    assert.equal(result.ok, true);
    assert.deepEqual(waits, [301000]);
  });
  it("permits changing a failed cover while retaining the successful subject", async (t) => {
    const { run, client, calls } = await setup(t);
    const original = client.uploadWikiSubjectCover;
    client.uploadWikiSubjectCover = async () => { throw apiError(400); };
    await run(batch({ ...subject(), image: { base64: "YWJj" } }));
    calls.length = 0;
    client.uploadWikiSubjectCover = original;
    const result = await run(batch({ ...subject(), image: { base64: "ZGVm" } }), { resume: true });
    assert.equal(result.ok, true);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].body.content, "ZGVm");
    assert.equal(calls[0].subjectId, 101);
  });
  it("does not resend successful images when the file bytes change", async (t) => {
    const { dir, run, calls } = await setup(t);
    const file = path.join(dir, "cover.png");
    await writeFile(file, "abc");
    const data = batch({ ...subject(), image: { file } });
    await run(data);
    await writeFile(file, "def");
    calls.length = 0;
    await assert.rejects(run(data, { resume: true }), /Successful request changed/);
    assert.equal(calls.length, 0);
  });
});

describe("Wiki p1 client wiring", () => {
  it("uses correct endpoints, exact request bodies, one auth channel and signal", async (t) => {
    const calls = [];
    t.mock.method(globalThis, "fetch", async (url, options) => {
      calls.push({ url: String(url), options });
      return new Response("{}", { headers: { "Content-Type": "application/json" } });
    });
    const client = new BangumiClient({ privateSessionId: "session", accessToken: "token" });
    const signal = new AbortController().signal;
    for (const [kind, method] of [["subject", "createWikiSubject"], ["person", "createWikiPerson"], ["character", "createWikiCharacter"]]) {
      const body = kind === "subject" ? subject().body : mono(kind).body;
      await client[method](body, { signal });
      assert.deepEqual(JSON.parse(calls.at(-1).options.body), body);
    }
    await client.uploadWikiSubjectCover(123, { content: "YWJj" }, { signal });
    await client.createWikiEpisodes(123, { episodes: [episode(0)] }, { signal });
    assert.deepEqual(calls.map((c) => c.url), [
      "https://next.bgm.tv/p1/wiki/subjects", "https://next.bgm.tv/p1/wiki/persons", "https://next.bgm.tv/p1/wiki/characters",
      "https://next.bgm.tv/p1/wiki/subjects/123/covers", "https://next.bgm.tv/p1/wiki/subjects/123/ep",
    ]);
    assert.ok(calls.every((c) => c.options.method === "POST" && c.options.signal === signal));
    assert.ok(calls.every((c) => c.options.headers.Cookie === "chiiNextSessionID=session" && !c.options.headers.Authorization));
    await new BangumiClient({ accessToken: "token" }).createWikiSubject(subject().body);
    assert.equal(calls.at(-1).options.headers.Authorization, "Bearer token");
  });
});
