import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { APP_VERSION } from "../src/utils/version.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const script = path.join(root, "scripts", "next-version.sh");

describe("APP_VERSION", () => {
  it("should come from package.json", () => {
    const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
    assert.strictEqual(APP_VERSION, pkg.version);
  });
});

describe("scripts/next-version.sh", () => {
  let dir;
  const git = (...args) =>
    execFileSync("git", args, {
      cwd: dir,
      encoding: "utf8",
      env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_SYSTEM: "/dev/null" },
    }).trim();
  const commit = (message) => {
    writeFileSync(path.join(dir, "f.txt"), `${Math.random()}`);
    git("add", "-A");
    git("-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "-m", message);
  };
  const next = (ref = "HEAD") => execFileSync("bash", [script, ref], { cwd: dir, encoding: "utf8" }).trim();

  before(() => {
    dir = mkdtempSync(path.join(tmpdir(), "next-version-"));
    git("init", "-q", "-b", "main");
  });

  after(() => rmSync(dir, { recursive: true, force: true }));

  it("should start at 0.0.1 when there is no tag", () => {
    commit("first");
    assert.strictEqual(next(), "0.0.1");
  });

  it("should print nothing when HEAD is already released", () => {
    git("tag", "v1.1.3");
    assert.strictEqual(next(), "");
  });

  it("should bump the patch once there are new commits", () => {
    commit("feat: something");
    assert.strictEqual(next(), "1.1.4");
  });

  it("should sort versions numerically, not lexically", () => {
    git("tag", "v1.1.9");
    commit("fix: more");
    git("tag", "v1.1.10");
    commit("fix: even more");
    assert.strictEqual(next(), "1.1.11");
  });

  it("should ignore prerelease tags", () => {
    git("tag", "v9.9.9-rc1");
    assert.strictEqual(next(), "1.1.11");
  });

  it("should honour [skip release]", () => {
    commit("docs: typo [skip release]");
    assert.strictEqual(next(), "");
  });
});
