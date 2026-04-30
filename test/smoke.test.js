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
  it("should show calendar in help", () => {
    const result = run(["--help"]);
    assert.strictEqual(result.status, 0);
    assert.ok(result.stdout.includes("calendar"), "help should mention calendar");
  });

  it("should show calendar subcommand help", () => {
    const result = run(["calendar", "--help"]);
    assert.strictEqual(result.status, 0);
    assert.ok(result.stdout.includes("monday"), "calendar help should mention weekday subcommands");
  });

  it("should print version/status without error", () => {
    const result = run(["--version"]);
    assert.strictEqual(result.status, 0);
  });
});
