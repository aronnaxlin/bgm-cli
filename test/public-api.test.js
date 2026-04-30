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

describe("subject reads", () => {
  it("should search subjects", () => {
    const data = runJson(["subject", "search", "ghost", "--limit", "1"]);
    assert.ok(Array.isArray(data.data));
    assert.ok(data.total >= 0);
  });

  it("should list subjects", () => {
    const data = runJson(["subject", "list", "--type", "anime", "--limit", "1"]);
    assert.ok(Array.isArray(data.data));
    assert.ok(data.total >= 0);
  });

  it("should get a subject", () => {
    const data = runJson(["subject", "get", "12"]);
    assert.strictEqual(typeof data.id, "number");
    assert.ok(data.name);
  });

  it("should list episodes", () => {
    const data = runJson(["episode", "list", "12", "--limit", "1"]);
    assert.ok(Array.isArray(data.data));
  });
});

describe("user reads", () => {
  it("should get a user profile", () => {
    const data = runJson(["user", "get", "ganeid"]);
    assert.strictEqual(typeof data.id, "number");
    assert.ok(data.username || data.nickname);
  });
});

describe("group reads", () => {
  it("should list groups", () => {
    const data = runJson(["group", "list", "--limit", "1"]);
    assert.ok(Array.isArray(data.data));
    assert.ok(data.total >= 0);
  });

  it("should get a group", () => {
    const data = runJson(["group", "get", "dev"]);
    assert.strictEqual(typeof data.id, "number");
    assert.ok(data.name);
  });

  it("should list group topics", () => {
    const data = runJson(["group", "topics", "dev", "--limit", "1"]);
    assert.ok(Array.isArray(data.data));
  });
});

describe("blog reads", () => {
  it("should list blogs", () => {
    const data = runJson(["blog", "list", "--limit", "1"]);
    assert.ok(Array.isArray(data.data));
    assert.ok(data.total >= 0);
  });

  it("should get a blog", () => {
    const data = runJson(["blog", "get", "371953"]);
    assert.strictEqual(typeof data.id, "number");
    assert.strictEqual(typeof data.uid, "number");
  });
});

describe("index reads", () => {
  it("should get an index", () => {
    const data = runJson(["index", "get", "1"]);
    assert.strictEqual(typeof data.id, "number");
    assert.ok(data.title);
  });
});

describe("collection reads", () => {
  it("should list a user's collections", () => {
    const data = runJson(["collection", "list", "--user", "ganeid", "--limit", "1"]);
    assert.ok(Array.isArray(data.data));
    assert.strictEqual(typeof data.total, "number");
    if (data.data.length > 0) {
      assert.strictEqual(typeof data.data[0].subject_id, "number");
      assert.ok(data.data[0].subject);
    }
  });
});

describe("status reads", () => {
  it("should show status", () => {
    const data = runJson(["status"]);
    assert.strictEqual(data.resource, "status-current");
    assert.ok(data.status);
  });
});
