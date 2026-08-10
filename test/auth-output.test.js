import { describe, it } from "node:test";
import assert from "node:assert";
import { formatDisplayResult } from "../src/core/output.js";

describe("auth output", () => {
  it("should format auth status as two separate channels", () => {
    const output = formatDisplayResult({
      resource: "auth-status",
      configFile: "/tmp/config.json",
      policy: "p1 requests use the private session cookie when saved; Access Token is not sent together with it.",
      channels: {
        accessToken: {
          saved: true,
          tokenPreview: "abc...123",
          refreshTokenSaved: false,
          statusCommand: "bgm auth token-status",
          setCommand: "bgm auth set-token <access_token>",
        },
        privateSession: {
          saved: true,
          sessionPreview: "sess...ion",
          updatedAt: "2026-06-03T00:00:00.000Z",
          loginCommand: "bgm auth login",
          logoutCommand: "bgm auth logout",
        },
      },
    });

    assert.match(output, /Access Token channel/);
    assert.match(output, /Access Token is not sent together/);
    assert.match(output, /Validate: bgm auth token-status/);
    assert.match(output, /Private session channel/);
    assert.match(output, /Login: bgm auth login/);
    assert.ok(!output.includes("Active profile"));
    assert.ok(!output.includes("Profile override"));
  });

  it("should show active profile and override lines only when present", () => {
    const output = formatDisplayResult({
      resource: "auth-status",
      configFile: "/tmp/config.json",
      activeProfile: "main",
      profileOverride: "alt",
      channels: {
        accessToken: { saved: false },
        privateSession: { saved: false },
      },
    });

    assert.match(output, /Active profile: main/);
    assert.match(output, /Profile override \(--profile\): alt/);
  });

  it("should format the auth profile list with masked previews", () => {
    const output = formatDisplayResult({
      resource: "auth-profile-list",
      configFile: "/tmp/config.json",
      activeProfile: "main",
      activeProfileMissing: false,
      envOverrides: ["BGM_ACCESS_TOKEN"],
      profiles: [
        {
          name: "main",
          active: true,
          accessTokenSaved: true,
          accessTokenPreview: "abc123...wxyz",
          refreshTokenSaved: false,
          privateSessionSaved: false,
          privateSessionPreview: null,
          privateSessionUpdatedAt: null,
        },
        {
          name: "alt",
          active: false,
          accessTokenSaved: false,
          accessTokenPreview: null,
          refreshTokenSaved: false,
          privateSessionSaved: true,
          privateSessionPreview: "sess12...89ab",
          privateSessionUpdatedAt: "2026-08-01T00:00:00.000Z",
        },
      ],
    });

    assert.match(output, /Auth profiles/);
    assert.match(output, /main \(active\)/);
    assert.match(output, /abc123\.\.\.wxyz/);
    assert.match(output, /sess12\.\.\.89ab/);
    assert.match(output, /Warning: environment variables override saved credentials: BGM_ACCESS_TOKEN/);
  });

  it("should format an empty auth profile list with a hint", () => {
    const output = formatDisplayResult({
      resource: "auth-profile-list",
      configFile: "/tmp/config.json",
      activeProfile: null,
      activeProfileMissing: false,
      envOverrides: [],
      profiles: [],
    });

    assert.match(output, /Profiles: none/);
    assert.match(output, /bgm auth profile save <name>/);
  });

  it("should format profile save, use, and delete mutations", () => {
    const save = formatDisplayResult({
      resource: "auth-profile-mutation",
      action: "save",
      profile: "main",
      activeProfile: "main",
      configFile: "/tmp/config.json",
      envOverrides: [],
    });
    assert.match(save, /Auth profile saved/);
    assert.match(save, /Profile: main/);

    const use = formatDisplayResult({
      resource: "auth-profile-mutation",
      action: "use",
      profile: "alt",
      activeProfile: "alt",
      previousProfile: "main",
      syncedPrevious: true,
      configFile: "/tmp/config.json",
      envOverrides: [],
    });
    assert.match(use, /Auth profile switched/);
    assert.match(use, /Previous profile: main \(snapshot updated\)/);

    const removed = formatDisplayResult({
      resource: "auth-profile-mutation",
      action: "delete",
      profile: "main",
      activeProfile: null,
      credentialsRetained: true,
      configFile: "/tmp/config.json",
      envOverrides: [],
    });
    assert.match(removed, /Auth profile deleted/);
    assert.match(removed, /Active credentials are kept/);
  });
});

describe("notification output", () => {
  it("should format friend request notifications by type instead of raw title nickname", () => {
    const output = formatDisplayResult({
      resource: "notifications",
      total: 1,
      filters: {},
      data: [
        {
          id: 1,
          type: 14,
          title: "Alice",
          sender: {
            id: 100,
            username: "alice",
            nickname: "Alice",
          },
          unread: true,
          createdAt: 1780000000,
        },
      ],
    });

    assert.match(output, /请求与你成为好友/);
    assert.match(output, /Alice/);
  });
});
