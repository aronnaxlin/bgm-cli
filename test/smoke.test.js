import { spawnSync } from "node:child_process";
import { describe, it } from "node:test";
import assert from "node:assert";

const CLI = "node";
const CLI_ARGS = ["src/cli.js"];

function run(args) {
  return spawnSync(CLI, [...CLI_ARGS, ...args], {
    encoding: "utf-8",
    cwd: process.cwd(),
  });
}

describe("smoke", () => {
  it("should print version/status without error", () => {
    const result = run(["--version"]);
    assert.strictEqual(result.status, 0);
  });

  it("should show top-level help", () => {
    const result = run(["--help"]);
    assert.strictEqual(result.status, 0);
    assert.ok(result.stdout.includes("calendar"), "help should mention calendar");
    assert.ok(result.stdout.includes("subject"), "help should mention subject");
    assert.ok(result.stdout.includes("collection"), "help should mention collection");
  });

  const groups = [
    "auth",
    "config",
    "user",
    "notify",
    "subject",
    "character",
    "person",
    "collection",
    "episode",
    "group",
    "blog",
    "index",
    "timeline",
    "trending",
    "status",
    "calendar",
  ];

  for (const group of groups) {
    it(`should show ${group} --help`, () => {
      const result = run([group, "--help"]);
      assert.strictEqual(result.status, 0, `${group} help should exit 0`);
      assert.ok(result.stdout.length > 0, `${group} help should produce output`);
    });
  }
});
