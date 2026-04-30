import { spawnSync } from "node:child_process";
import { describe, it } from "node:test";
import assert from "node:assert";

const CLI = "node";
const CLI_ARGS = ["src/cli.js"];

function runJson(args) {
  const result = spawnSync(CLI, [...CLI_ARGS, "--json", ...args], {
    encoding: "utf-8",
    cwd: process.cwd(),
  });
  assert.strictEqual(result.status, 0, `CLI failed: ${result.stderr}`);
  return JSON.parse(result.stdout);
}

describe("public api reads", () => {
  it("should search subjects", () => {
    const data = runJson(["subject", "search", "ghost", "--limit", "1"]);
    assert.ok(Array.isArray(data.data), "should return subjects array");
    assert.ok(data.total >= 0, "should have total count");
  });

  it("should get a subject by id", () => {
    const data = runJson(["subject", "get", "12"]);
    assert.strictEqual(typeof data.id, "number");
    assert.ok(data.name, "should have name");
  });

  it("should list groups", () => {
    const data = runJson(["group", "list", "--limit", "1"]);
    assert.ok(Array.isArray(data.data), "should return groups array");
    assert.ok(data.total >= 0, "should have total count");
  });

  it("should show status", () => {
    const data = runJson(["status"]);
    assert.strictEqual(data.resource, "status-current");
    assert.ok(data.status, "should have status info");
  });
});
