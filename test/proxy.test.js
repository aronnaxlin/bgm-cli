import { spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import assert from "node:assert";
import { formatDisplayResult } from "../src/core/output.js";
import { resolveProxyUrl } from "../src/core/proxy.js";

const CLI = "node";
const CLI_ARGS = ["src/cli.js"];
const ISOLATED_CONFIG_DIR = mkdtempSync(path.join(os.tmpdir(), "bgm-proxy-test-"));

function run(args, env) {
  return spawnSync(CLI, [...CLI_ARGS, ...args], {
    encoding: "utf-8",
    cwd: process.cwd(),
    env,
  });
}

function buildEnv(extra = {}) {
  const env = { ...process.env };
  delete env.BGM_PROXY;
  delete env.HTTPS_PROXY;
  delete env.https_proxy;
  delete env.HTTP_PROXY;
  delete env.http_proxy;
  env.BGM_CONFIG_DIR = ISOLATED_CONFIG_DIR;
  return { ...env, ...extra };
}

describe("proxy config", () => {
  it("reports BGM_PROXY as an environment proxy", () => {
    const result = run(
      ["--json", "proxy", "show"],
      buildEnv({ BGM_PROXY: "http://127.0.0.1:7890" }),
    );

    assert.strictEqual(result.status, 0, result.stderr);
    const payload = JSON.parse(result.stdout);
    assert.strictEqual(payload.proxy.url, "http://127.0.0.1:7890");
    assert.strictEqual(payload.proxy.source, "env:BGM_PROXY");
    assert.strictEqual(payload.proxy.active, true);
  });

  it("prefers saved proxy config over BGM_PROXY", () => {
    const originalProxy = process.env.BGM_PROXY;
    process.env.BGM_PROXY = "http://127.0.0.1:7890";

    try {
      assert.deepStrictEqual(
        resolveProxyUrl({ proxy: "http://127.0.0.1:7891" }),
        { url: "http://127.0.0.1:7891", source: "config" },
      );
    } finally {
      if (originalProxy === undefined) {
        delete process.env.BGM_PROXY;
      } else {
        process.env.BGM_PROXY = originalProxy;
      }
    }
  });

  it("redacts proxy credentials in plain proxy output", () => {
    const result = run(
      ["proxy", "show"],
      buildEnv({ BGM_PROXY: "http://alice:secret@127.0.0.1:7890" }),
    );

    assert.strictEqual(result.status, 0, result.stderr);
    assert.ok(result.stdout.includes("http://****:****@127.0.0.1:7890"));
    assert.ok(!result.stdout.includes("alice"));
    assert.ok(!result.stdout.includes("secret"));
  });

  it("redacts proxy credentials in plain config output", () => {
    const output = formatDisplayResult({
      configFile: "/tmp/bgm-cli/config.json",
      config: {
        proxy: "http://alice:secret@127.0.0.1:7890",
      },
      effectiveProxy: {
        url: "http://alice:secret@127.0.0.1:7890",
        source: "config",
        active: true,
      },
    });

    assert.ok(output.includes("http://****:****@127.0.0.1:7890"));
    assert.ok(!output.includes("alice"));
    assert.ok(!output.includes("secret"));
  });
});
