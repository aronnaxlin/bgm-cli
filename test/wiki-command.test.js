import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, writeFile, rm, mkdir, unlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { parseWikiArgs } from "../src/commands/wiki.js";

function replaceFetchWithFakeWikiApi({ appendFileSync, existsSync, readFileSync }) {
  globalThis.fetch = async (url, options) => {
    const target = String(url);
    if (!target.startsWith("https://next.bgm.tv/p1/wiki/")) throw new Error("Unexpected network access in Wiki CLI test");
    const log = process.env.WIKI_TEST_CALLS;
    if (!log) throw new Error("Missing isolated test log");
    const count = existsSync(log) ? readFileSync(log, "utf8").trim().split("\n").length : 0;
    const body = JSON.parse(options.body);
    appendFileSync(log, `${JSON.stringify({ url: target, method: options.method, body, headers: options.headers })}\n`);
    const name = body.name ?? body.person?.name ?? body.character?.name;
    if (name === "Crash") process.exit(17);
    if (name === "Reject") return Response.json({ code: "INVALID_WIKI_SYNTAX", message: "Invalid infobox" }, { status: 400 });
    if (name === "Unauthenticated") return Response.json({ message: "Login required" }, { status: 401 });
    if (name === "Uncertain") throw new Error("Connection interrupted");
    if (target.endsWith("/covers")) return Response.json({});
    if (target.endsWith("/ep")) return Response.json({ episodeIDs: body.episodes.map((_, i) => 1000 + count * 100 + i) });
    const field = target.endsWith("/subjects") ? "subjectID" : target.endsWith("/persons") ? "personID" : "characterID";
    return Response.json({ [field]: 100 + count });
  };
}
const fakeWikiApiPreload = `data:text/javascript,${encodeURIComponent(`import * as fs from "node:fs";\n(${replaceFetchWithFakeWikiApi})(fs);`)}`;

const item = (key = "example", name = "Example") => ({ key, kind: "subject", body: {
  name, type: 3, platform: 0, infobox: "{{Infobox Album}}", nsfw: false, metaTags: [], summary: "",
} });
const batch = (...items) => ({ version: 1, items });

async function fixture(t) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "bgm-wiki-command-"));
  t.after(async () => { assert.equal(path.dirname(dir), path.resolve(os.tmpdir())); await rm(dir, { recursive: true, force: true }); });
  const input = path.join(dir, "batch input.json");
  const report = path.join(dir, "results.jsonl");
  const log = path.join(dir, "calls.jsonl");
  const config = path.join(dir, "config");
  await mkdir(config);
  const env = { ...process.env };
  for (const key of Object.keys(env)) if (/^BGM_|^(HTTP|HTTPS|ALL)_PROXY$/i.test(key)) delete env[key];
  env.BGM_CONFIG_DIR = config;
  env.WIKI_TEST_CALLS = log;
  const run = (args, stdin) => spawnSync(process.execPath, ["--import", fakeWikiApiPreload, "src/cli.js", ...args], {
    cwd: process.cwd(), env, encoding: "utf8", input: stdin, timeout: 10_000,
  });
  const calls = async () => {
    try { return (await readFile(log, "utf8")).trim().split("\n").map(JSON.parse); }
    catch (error) { if (error.code === "ENOENT") return []; throw error; }
  };
  return { dir, input, report, log, config, run, calls };
}

describe("Wiki CLI", () => {
  it("prints Wiki help and mentions it in main help", async (t) => {
    const { run } = await fixture(t);
    for (const args of [["--help"], ["wiki", "--help"], ["wiki", "create", "--help"]]) {
      const result = run(args);
      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stdout, /wiki/i);
    }
    assert.match(run(["--help"]).stdout, /reference files \([^)]*\bwiki\b[^)]*\)/);
  });
  it("supports JSON stdin in dry-run without creating a report or making requests", async (t) => {
    const { run, calls, report } = await fixture(t);
    const result = run(["--json", "wiki", "create", "--dry-run", "--file", "-", "--report", report], JSON.stringify(batch(item())));
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).summary.ready, 1);
    assert.equal((await calls()).length, 0);
    await assert.rejects(readFile(report), { code: "ENOENT" });
  });
  it("reads BOM-prefixed files and relative images from paths with spaces", async (t) => {
    const { dir, input, report, run, calls } = await fixture(t);
    await writeFile(path.join(dir, "cover image.png"), "abc");
    await writeFile(input, `\uFEFF${JSON.stringify(batch({ ...item(), image: { file: "cover image.png" }, episodes: [{ ep: 1, name: "Track" }] }))}`);
    const result = run(["--json", "wiki", "create", "--file", input, "--report", report]);
    assert.equal(result.status, 0, result.stderr);
    const output = JSON.parse(result.stdout);
    assert.equal(output.items[0].id, 100);
    assert.equal(output.items[0].steps[2].episodeIDs.length, 1);
    assert.equal((await calls())[1].body.content, "YWJj");
    assert.match(result.stderr, /example: create/);
    assert.doesNotMatch(result.stdout, /example: create/);
    const resumed = run(["--json", "wiki", "create", "--resume", "--file", input, "--report", report]);
    assert.equal(resumed.status, 0, resumed.stderr);
    assert.equal((await calls()).length, 3);
  });
  it("uses the selected profile for Wiki writes without changing stored credentials", async (t) => {
    const { config, input, report, run, calls } = await fixture(t);
    const stored = JSON.stringify({ accessToken: "default-test-token", profiles: { alternate: { accessToken: "profile-test-token" } } });
    await writeFile(path.join(config, "config.json"), stored);
    await writeFile(input, JSON.stringify(batch(item())));
    const result = run(["--profile", "alternate", "--json", "wiki", "create", "--file", input, "--report", report]);
    assert.equal(result.status, 0, result.stderr);
    assert.equal((await calls())[0].headers.Authorization, "Bearer profile-test-token");
    assert.equal(await readFile(path.join(config, "config.json"), "utf8"), stored);
    assert.doesNotMatch(await readFile(report, "utf8"), /profile-test-token|default-test-token/);
  });
  it("returns per-item failures with exit 1, while continuing other items", async (t) => {
    const { input, report, run, calls } = await fixture(t);
    await writeFile(input, JSON.stringify(batch(item("bad", "Reject"), item("good"))));
    const result = run(["--json", "wiki", "create", "--file", input, "--report", report]);
    assert.equal(result.status, 1);
    const output = JSON.parse(result.stdout);
    assert.deepEqual(output.items.map((x) => x.status), ["failed", "succeeded"]);
    assert.equal((await calls()).length, 2);
  });
  it("halts on uncertain requests and does not resend them on resume", async (t) => {
    const { input, report, run, calls } = await fixture(t);
    await writeFile(input, JSON.stringify(batch(item("unknown", "Uncertain"), item("later"))));
    const args = ["--json", "wiki", "create", "--file", input, "--report", report];
    assert.equal(run(args).status, 1);
    const resumed = run([...args, "--resume"]);
    assert.equal(resumed.status, 1);
    assert.equal(JSON.parse(resumed.stdout).items[0].status, "unknown");
    assert.equal((await calls()).length, 1);
  });
  it("does not repeat a request after a real process interruption", async (t) => {
    const { input, report, run, calls } = await fixture(t);
    await writeFile(input, JSON.stringify(batch(item("crash", "Crash"))));
    const args = ["--json", "wiki", "create", "--file", input, "--report", report];
    assert.equal(run(args).status, 17);
    assert.match(await readFile(report, "utf8"), /"event":"started"/);
    const locked = run([...args, "--resume"]);
    assert.equal(locked.status, 1);
    assert.match(locked.stderr, /locked/);
    await unlink(`${report}.lock`);
    const resumed = run([...args, "--resume"]);
    assert.equal(resumed.status, 1);
    assert.equal(JSON.parse(resumed.stdout).stopped.reason, "unknown");
    assert.equal((await calls()).length, 1);
  });
  it("rejects unreadable input, bad JSON, unsupported versions and missing report without writes", async (t) => {
    const { input, report, run, calls } = await fixture(t);
    const args = ["wiki", "create", "--file", input, "--report", report];
    assert.equal(run(args).status, 1);
    for (const raw of ["not JSON", JSON.stringify({ version: 2, items: [] })]) {
      await writeFile(input, raw);
      assert.equal(run(args).status, 1);
    }
    await writeFile(input, JSON.stringify(batch(item())));
    assert.equal(run(["wiki", "create", "--file", input]).status, 1);
    assert.equal((await calls()).length, 0);
    await assert.rejects(readFile(report), { code: "ENOENT" });
  });
  it("returns exit 1 for invalid dry-run items without network access", async (t) => {
    const { run, calls } = await fixture(t);
    const result = run(["--json", "wiki", "create", "--file", "-", "--dry-run"], JSON.stringify(batch({ key: "invalid" })));
    assert.equal(result.status, 1);
    assert.equal(JSON.parse(result.stdout).summary.failed, 1);
    assert.equal((await calls()).length, 0);
  });
  it("parses explicit boolean flags and preserves equals in filenames", () => {
    assert.deepEqual(parseWikiArgs(["--dry-run", "--file=a=b.json"]), { dryRun: true, resume: false, file: "a=b.json" });
    for (const args of [
      ["--file", "a", "--report", "-"], ["--file", "a", "--dry-run", "true"],
      ["--file", "a", "--dry-run=false"], ["--file", "a", "--dry-run", "--resume"],
      ["--file", "a", "--file", "b", "--dry-run"], ["--file", "a", "--dry-run", "--unknown"],
    ]) assert.throws(() => parseWikiArgs(args));
  });
});
