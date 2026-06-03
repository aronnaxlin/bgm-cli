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
