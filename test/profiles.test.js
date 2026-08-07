import { describe, it } from "node:test";
import assert from "node:assert";
import {
  buildProfileListPayload,
  computeProfileDelete,
  computeProfileSave,
  computeProfileSwitch,
  listAuthEnvOverrides,
  pickAuthSnapshot,
  snapshotHasCredentials,
  validateProfileName,
} from "../src/utils/profiles.js";
import { AUTH_CONFIG_KEYS } from "../src/core/config.js";

const TOKEN_A = "tokenAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const TOKEN_B = "tokenBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";
const SESSION_A = "sessionAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

function baseConfig(extra = {}) {
  return {
    accessToken: TOKEN_A,
    tokenType: "Bearer",
    proxy: "http://127.0.0.1:7890",
    timezone: "Asia/Shanghai",
    ...extra,
  };
}

describe("validateProfileName", () => {
  it("accepts simple and punctuated names", () => {
    assert.strictEqual(validateProfileName("main"), "main");
    assert.strictEqual(validateProfileName("a.b-c_1"), "a.b-c_1");
    assert.strictEqual(validateProfileName(" alt "), "alt");
  });

  it("rejects invalid names", () => {
    for (const name of ["", "  ", "__proto__", "-x", ".hidden", "a".repeat(33), "with space", "中文", undefined, null]) {
      assert.throws(() => validateProfileName(name), /Invalid profile name/);
    }
  });
});

describe("pickAuthSnapshot", () => {
  it("picks only auth keys that exist", () => {
    const snapshot = pickAuthSnapshot(baseConfig({ privateSessionId: SESSION_A }));
    assert.deepStrictEqual(Object.keys(snapshot).sort(), ["accessToken", "privateSessionId", "tokenType"]);
    assert.strictEqual(snapshot.proxy, undefined);
    assert.strictEqual(snapshot.timezone, undefined);
  });

  it("returns empty object for empty or non-object input", () => {
    assert.deepStrictEqual(pickAuthSnapshot({}), {});
    assert.deepStrictEqual(pickAuthSnapshot(null), {});
    assert.deepStrictEqual(pickAuthSnapshot("x"), {});
  });
});

describe("snapshotHasCredentials", () => {
  it("requires an access token or private session", () => {
    assert.strictEqual(snapshotHasCredentials({ accessToken: TOKEN_A }), true);
    assert.strictEqual(snapshotHasCredentials({ privateSessionId: SESSION_A }), true);
    assert.strictEqual(snapshotHasCredentials({ tokenType: "Bearer", refreshToken: null }), false);
    assert.strictEqual(snapshotHasCredentials({}), false);
  });
});

describe("computeProfileSave", () => {
  it("creates a new profile and marks it active", () => {
    const change = computeProfileSave(baseConfig(), "main");
    assert.strictEqual(change.set.activeProfile, "main");
    assert.deepStrictEqual(change.set.profiles.main, { accessToken: TOKEN_A, tokenType: "Bearer" });
    assert.deepStrictEqual(change.remove, []);
  });

  it("rejects saving when no credentials are stored", () => {
    assert.throws(() => computeProfileSave({ proxy: "http://x" }, "main"), /No saved auth credentials/);
  });

  it("requires --force to overwrite a non-active profile", () => {
    const raw = baseConfig({ profiles: { alt: { accessToken: TOKEN_B } }, activeProfile: "main" });
    assert.throws(() => computeProfileSave(raw, "alt"), /Pass --force/);
    const forced = computeProfileSave(raw, "alt", { force: true });
    assert.strictEqual(forced.set.profiles.alt.accessToken, TOKEN_A);
  });

  it("always allows re-saving the active profile", () => {
    const raw = baseConfig({ profiles: { main: { accessToken: TOKEN_B } }, activeProfile: "main" });
    const change = computeProfileSave(raw, "main");
    assert.strictEqual(change.set.profiles.main.accessToken, TOKEN_A);
  });

  it("keeps other profile entries", () => {
    const raw = baseConfig({ profiles: { alt: { accessToken: TOKEN_B } } });
    const change = computeProfileSave(raw, "main");
    assert.strictEqual(change.set.profiles.alt.accessToken, TOKEN_B);
  });
});

describe("computeProfileSwitch", () => {
  it("loads the target snapshot and removes keys it lacks", () => {
    const raw = baseConfig({
      privateSessionId: SESSION_A,
      profiles: { alt: { accessToken: TOKEN_B, tokenType: "Bearer" } },
      activeProfile: "main",
    });
    const change = computeProfileSwitch(raw, "alt");
    assert.strictEqual(change.set.accessToken, TOKEN_B);
    assert.strictEqual(change.set.activeProfile, "alt");
    assert.ok(change.remove.includes("privateSessionId"));
    assert.ok(!change.remove.includes("accessToken"));
  });

  it("syncs the current credentials back into the previous profile", () => {
    const raw = baseConfig({
      profiles: { main: { accessToken: TOKEN_B }, alt: { accessToken: TOKEN_B } },
      activeProfile: "main",
    });
    const change = computeProfileSwitch(raw, "alt");
    assert.strictEqual(change.syncedPrevious, true);
    assert.strictEqual(change.previousProfile, "main");
    assert.strictEqual(change.set.profiles.main.accessToken, TOKEN_A);
  });

  it("does not overwrite the previous profile with an empty snapshot", () => {
    const raw = {
      profiles: { main: { accessToken: TOKEN_A }, alt: { accessToken: TOKEN_B } },
      activeProfile: "main",
    };
    const change = computeProfileSwitch(raw, "alt");
    assert.strictEqual(change.syncedPrevious, false);
    assert.strictEqual(change.set.profiles.main.accessToken, TOKEN_A);
  });

  it("recreates a dangling active profile entry instead of losing credentials", () => {
    const raw = baseConfig({
      profiles: { alt: { accessToken: TOKEN_B } },
      activeProfile: "gone",
    });
    const change = computeProfileSwitch(raw, "alt");
    assert.strictEqual(change.set.profiles.gone.accessToken, TOKEN_A);
  });

  it("rejects unknown targets and lists saved names", () => {
    const raw = baseConfig({ profiles: { main: { accessToken: TOKEN_A } } });
    assert.throws(() => computeProfileSwitch(raw, "nope"), /Profile not found: nope. Saved profiles: main/);
    assert.throws(() => computeProfileSwitch(baseConfig(), "nope"), /Saved profiles: \(none\)/);
  });
});

describe("computeProfileDelete", () => {
  it("deletes a non-active profile and keeps the pointer", () => {
    const raw = baseConfig({
      profiles: { main: { accessToken: TOKEN_A }, alt: { accessToken: TOKEN_B } },
      activeProfile: "main",
    });
    const change = computeProfileDelete(raw, "alt");
    assert.strictEqual(change.wasActive, false);
    assert.deepStrictEqual(change.remove, []);
    assert.strictEqual(change.set.profiles.alt, undefined);
    assert.strictEqual(change.set.profiles.main.accessToken, TOKEN_A);
  });

  it("deleting the active profile removes the pointer only", () => {
    const raw = baseConfig({ profiles: { main: { accessToken: TOKEN_A } }, activeProfile: "main" });
    const change = computeProfileDelete(raw, "main");
    assert.strictEqual(change.wasActive, true);
    assert.deepStrictEqual(change.remove, ["activeProfile"]);
    assert.deepStrictEqual(change.set.profiles, {});
    assert.strictEqual(change.set.accessToken, undefined);
  });

  it("rejects unknown profiles", () => {
    assert.throws(() => computeProfileDelete(baseConfig(), "nope"), /Profile not found/);
  });
});

describe("buildProfileListPayload", () => {
  it("marks the active profile and masks credentials", () => {
    const raw = baseConfig({
      profiles: {
        main: { accessToken: TOKEN_A, privateSessionId: SESSION_A, privateSessionUpdatedAt: "2026-08-01T00:00:00.000Z" },
        alt: { accessToken: TOKEN_B },
      },
      activeProfile: "main",
    });
    const payload = buildProfileListPayload(raw, { configFile: "/tmp/config.json" });
    assert.strictEqual(payload.resource, "auth-profile-list");
    assert.strictEqual(payload.activeProfile, "main");
    assert.strictEqual(payload.activeProfileMissing, false);
    const main = payload.profiles.find((profile) => profile.name === "main");
    assert.strictEqual(main.active, true);
    assert.strictEqual(main.accessTokenSaved, true);
    assert.strictEqual(main.privateSessionSaved, true);
    const serialized = JSON.stringify(payload);
    assert.ok(!serialized.includes(TOKEN_A));
    assert.ok(!serialized.includes(TOKEN_B));
    assert.ok(!serialized.includes(SESSION_A));
  });

  it("handles empty and malformed profile entries", () => {
    const payload = buildProfileListPayload({ profiles: { bad: "not-an-object" } }, {});
    assert.deepStrictEqual(payload.profiles, []);
    const empty = buildProfileListPayload({}, {});
    assert.strictEqual(empty.activeProfile, null);
    assert.deepStrictEqual(empty.profiles, []);
  });

  it("flags a dangling active profile pointer", () => {
    const payload = buildProfileListPayload({ activeProfile: "gone", profiles: {} }, {});
    assert.strictEqual(payload.activeProfileMissing, true);
  });
});

describe("listAuthEnvOverrides", () => {
  it("returns only non-empty auth env names", () => {
    assert.deepStrictEqual(
      listAuthEnvOverrides({ BGM_ACCESS_TOKEN: "x", BGM_REFRESH_TOKEN: " ", BGM_PRIVATE_SESSION_ID: "" , PATH: "/bin" }),
      ["BGM_ACCESS_TOKEN"],
    );
    assert.deepStrictEqual(listAuthEnvOverrides({}), []);
  });
});

describe("AUTH_CONFIG_KEYS", () => {
  it("keeps the full credential field set", () => {
    assert.deepStrictEqual(AUTH_CONFIG_KEYS, [
      "accessToken",
      "refreshToken",
      "tokenType",
      "privateSessionId",
      "privateSessionUpdatedAt",
      "clientId",
      "clientSecret",
      "redirectUri",
    ]);
  });
});
