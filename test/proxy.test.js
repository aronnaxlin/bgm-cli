import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import assert from "node:assert";

const CLI = "node";
const CLI_ARGS = ["src/cli.js"];

function run(args, env) {
  return spawnSync(CLI, [...CLI_ARGS, ...args], {
    encoding: "utf-8",
    cwd: process.cwd(),
    env,
  });
}

function withTempHome(callback) {
  const home = mkdtempSync(path.join(os.tmpdir(), "bgm-cli-proxy-"));
  try {
    return callback(home);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
}

function buildEnv(home, extra = {}) {
  const env = { ...process.env, HOME: home, ...extra };
  delete env.BGM_PROXY;
  delete env.HTTPS_PROXY;
  delete env.https_proxy;
  delete env.HTTP_PROXY;
  delete env.http_proxy;
  return { ...env, ...extra };
}

function writeUserConfig(home, config) {
  const configDir = path.join(home, ".config", "bgm-cli");
  mkdirSync(configDir, { recursive: true });
  writeFileSync(path.join(configDir, "config.json"), `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

describe("proxy config", () => {
  it("reports BGM_PROXY as an environment proxy", () => withTempHome((home) => {
    const result = run(
      ["--json", "proxy", "show"],
      buildEnv(home, { BGM_PROXY: "http://127.0.0.1:7890" }),
    );

    assert.strictEqual(result.status, 0, result.stderr);
    const payload = JSON.parse(result.stdout);
    assert.strictEqual(payload.proxy.url, "http://127.0.0.1:7890");
    assert.strictEqual(payload.proxy.source, "env:BGM_PROXY");
    assert.strictEqual(payload.proxy.active, true);
  }));

  it("prefers saved proxy config over BGM_PROXY", () => withTempHome((home) => {
    writeUserConfig(home, { proxy: "http://127.0.0.1:7891" });

    const result = run(
      ["--json", "proxy", "show"],
      buildEnv(home, { BGM_PROXY: "http://127.0.0.1:7890" }),
    );

    assert.strictEqual(result.status, 0, result.stderr);
    const payload = JSON.parse(result.stdout);
    assert.strictEqual(payload.proxy.url, "http://127.0.0.1:7891");
    assert.strictEqual(payload.proxy.source, "config");
  }));

  it("redacts proxy credentials in plain proxy output", () => withTempHome((home) => {
    const result = run(
      ["proxy", "show"],
      buildEnv(home, { BGM_PROXY: "http://alice:secret@127.0.0.1:7890" }),
    );

    assert.strictEqual(result.status, 0, result.stderr);
    assert.ok(result.stdout.includes("http://****:****@127.0.0.1:7890"));
    assert.ok(!result.stdout.includes("alice"));
    assert.ok(!result.stdout.includes("secret"));
  }));

  it("redacts proxy credentials in plain config output", () => withTempHome((home) => {
    writeUserConfig(home, { proxy: "http://alice:secret@127.0.0.1:7890" });

    const result = run(["config", "show"], buildEnv(home));

    assert.strictEqual(result.status, 0, result.stderr);
    assert.ok(result.stdout.includes("http://****:****@127.0.0.1:7890"));
    assert.ok(!result.stdout.includes("alice"));
    assert.ok(!result.stdout.includes("secret"));
  }));
});
