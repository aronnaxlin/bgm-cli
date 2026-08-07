import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import assert from "node:assert";
import { AUTH_CONFIG_KEYS } from "../src/core/config.js";

const CLI = "node";
const CLI_ARGS = ["src/cli.js"];
const TOKEN_A = "fixtureTokenAxxxxxxxxxxxxxxxxxxxxxxxxxxx";
const TOKEN_B = "fixtureTokenBxxxxxxxxxxxxxxxxxxxxxxxxxxx";
const SESSION_A = "fixtureSessionAxxxxxxxxxxxxxxxxxxxxxxxxx";

function makeConfigDir(fixture) {
  const dir = mkdtempSync(path.join(os.tmpdir(), "bgm-profile-test-"));
  writeFileSync(path.join(dir, "config.json"), `${JSON.stringify(fixture, null, 2)}\n`, "utf8");
  return dir;
}

function readConfigFile(dir) {
  return JSON.parse(readFileSync(path.join(dir, "config.json"), "utf8"));
}

function run(args, configDir, extraEnv = {}) {
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (key.startsWith("BGM_")) {
      delete env[key];
    }
  }
  env.BGM_CONFIG_DIR = configDir;
  Object.assign(env, extraEnv);
  return spawnSync(CLI, [...CLI_ARGS, ...args], {
    encoding: "utf-8",
    cwd: process.cwd(),
    env,
  });
}

function baseFixture(extra = {}) {
  return {
    accessToken: TOKEN_A,
    tokenType: "Bearer",
    privateSessionId: SESSION_A,
    ...extra,
  };
}

describe("auth profile integration", () => {
  it("saves the current credentials as a named profile", () => {
    const dir = makeConfigDir(baseFixture());
    const result = run(["auth", "profile", "save", "main"], dir);
    assert.strictEqual(result.status, 0, result.stderr);
    const config = readConfigFile(dir);
    assert.strictEqual(config.activeProfile, "main");
    assert.strictEqual(config.profiles.main.accessToken, TOKEN_A);
    assert.strictEqual(config.profiles.main.privateSessionId, SESSION_A);
    assert.strictEqual(config.accessToken, TOKEN_A);
  });

  it("switches accounts and syncs the previous profile snapshot", () => {
    const dir = makeConfigDir(baseFixture());
    assert.strictEqual(run(["auth", "profile", "save", "main"], dir).status, 0);
    assert.strictEqual(run(["auth", "set-token", TOKEN_B], dir).status, 0);
    assert.strictEqual(run(["auth", "profile", "save", "alt"], dir).status, 0);
    const use = run(["auth", "profile", "use", "main"], dir);
    assert.strictEqual(use.status, 0, use.stderr);
    const config = readConfigFile(dir);
    assert.strictEqual(config.activeProfile, "main");
    assert.strictEqual(config.accessToken, TOKEN_A);
    assert.strictEqual(config.privateSessionId, SESSION_A);
    assert.strictEqual(config.profiles.alt.accessToken, TOKEN_B);
    assert.strictEqual(config.profiles.main.accessToken, TOKEN_A);
  });

  it("lists profiles as JSON without leaking raw tokens", () => {
    const dir = makeConfigDir(baseFixture({
      profiles: { main: { accessToken: TOKEN_A }, alt: { accessToken: TOKEN_B } },
      activeProfile: "main",
    }));
    const result = run(["--json", "auth", "profile", "list"], dir);
    assert.strictEqual(result.status, 0, result.stderr);
    const payload = JSON.parse(result.stdout);
    assert.strictEqual(payload.resource, "auth-profile-list");
    assert.strictEqual(payload.activeProfile, "main");
    assert.strictEqual(payload.profiles.length, 2);
    assert.ok(!result.stdout.includes(TOKEN_A));
    assert.ok(!result.stdout.includes(TOKEN_B));
  });

  it("rejects switching to an unknown profile", () => {
    const dir = makeConfigDir(baseFixture());
    const result = run(["auth", "profile", "use", "nope"], dir);
    assert.strictEqual(result.status, 1);
    assert.ok(result.stderr.includes("Profile not found: nope"));
  });

  it("deleting the active profile keeps the active credentials", () => {
    const dir = makeConfigDir(baseFixture());
    assert.strictEqual(run(["auth", "profile", "save", "main"], dir).status, 0);
    const result = run(["auth", "profile", "delete", "main"], dir);
    assert.strictEqual(result.status, 0, result.stderr);
    const config = readConfigFile(dir);
    assert.strictEqual(config.activeProfile, undefined);
    assert.strictEqual(config.profiles.main, undefined);
    assert.strictEqual(config.accessToken, TOKEN_A);
  });

  it("does not poison saved snapshots after auth clear", () => {
    const dir = makeConfigDir(baseFixture());
    assert.strictEqual(run(["auth", "profile", "save", "main"], dir).status, 0);
    assert.strictEqual(run(["auth", "clear"], dir).status, 0);
    const cleared = readConfigFile(dir);
    assert.strictEqual(cleared.accessToken, undefined);
    assert.strictEqual(cleared.activeProfile, undefined);
    assert.strictEqual(cleared.profiles.main.accessToken, TOKEN_A);
    const use = run(["auth", "profile", "use", "main"], dir);
    assert.strictEqual(use.status, 0, use.stderr);
    const config = readConfigFile(dir);
    assert.strictEqual(config.accessToken, TOKEN_A);
    assert.strictEqual(config.profiles.main.accessToken, TOKEN_A);
  });

  it("keeps legacy single-account outputs byte-identical", () => {
    const dir = makeConfigDir(baseFixture());

    const show = run(["--json", "config", "show"], dir);
    assert.strictEqual(show.status, 0, show.stderr);
    const showPayload = JSON.parse(show.stdout);
    assert.ok(!("profiles" in showPayload.config));
    assert.ok(!("activeProfile" in showPayload.config));

    const status = run(["--json", "auth", "status"], dir);
    assert.strictEqual(status.status, 0, status.stderr);
    const statusPayload = JSON.parse(status.stdout);
    assert.ok(!("activeProfile" in statusPayload));
    assert.ok(!("profileOverride" in statusPayload));

    const clear = run(["--json", "auth", "clear"], dir);
    assert.strictEqual(clear.status, 0, clear.stderr);
    assert.deepStrictEqual(JSON.parse(clear.stdout).cleared, AUTH_CONFIG_KEYS);
  });

  it("never exposes the profiles map through config show", () => {
    const dir = makeConfigDir(baseFixture({
      profiles: { main: { accessToken: TOKEN_B } },
      activeProfile: "main",
    }));
    const result = run(["--json", "config", "show"], dir);
    assert.strictEqual(result.status, 0, result.stderr);
    const payload = JSON.parse(result.stdout);
    assert.ok(!("profiles" in payload.config));
    assert.ok(!result.stdout.includes(TOKEN_B));
  });

  it("runs one command as another profile with --profile", () => {
    const dir = makeConfigDir(baseFixture({
      profiles: { alt: { accessToken: TOKEN_B } },
      activeProfile: "main",
    }));
    const result = run(["--json", "--profile", "alt", "auth", "status"], dir);
    assert.strictEqual(result.status, 0, result.stderr);
    const payload = JSON.parse(result.stdout);
    assert.strictEqual(payload.profileOverride, "alt");
    assert.strictEqual(payload.channels.accessToken.tokenPreview, `${TOKEN_B.slice(0, 6)}...${TOKEN_B.slice(-4)}`);
    assert.strictEqual(payload.channels.privateSession.saved, false);
  });

  it("refuses credential writes under --profile and leaves the file untouched", () => {
    const fixture = baseFixture({
      profiles: { alt: { accessToken: TOKEN_B } },
      activeProfile: "main",
    });
    const dir = makeConfigDir(fixture);
    const result = run(["--profile", "alt", "auth", "set-token", "newTokenXxxxxxxxxxxx"], dir);
    assert.strictEqual(result.status, 1);
    assert.ok(result.stderr.includes("read-only account override"));
    assert.deepStrictEqual(readConfigFile(dir), fixture);
  });

  it("fails fast when --profile names an unknown profile", () => {
    const dir = makeConfigDir(baseFixture());
    const result = run(["--profile", "nope", "auth", "status"], dir);
    assert.strictEqual(result.status, 1);
    assert.ok(result.stderr.includes("Profile not found: nope"));
  });

  it("reports auth env overrides in the profile list", () => {
    const dir = makeConfigDir(baseFixture({
      profiles: { main: { accessToken: TOKEN_A } },
      activeProfile: "main",
    }));
    const result = run(["--json", "auth", "profile", "list"], dir, { BGM_ACCESS_TOKEN: TOKEN_B });
    assert.strictEqual(result.status, 0, result.stderr);
    const payload = JSON.parse(result.stdout);
    assert.deepStrictEqual(payload.envOverrides, ["BGM_ACCESS_TOKEN"]);
  });
});
