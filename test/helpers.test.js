import { describe, it } from "node:test";
import assert from "node:assert";
import { resolveUsernameOrMe } from "../src/utils/helpers.js";

describe("resolveUsernameOrMe", () => {
  it("should keep an explicit username", async () => {
    let called = false;
    const client = {
      async getMe() {
        called = true;
        return { username: "me" };
      },
    };

    const username = await resolveUsernameOrMe(client, "sai");
    assert.strictEqual(username, "sai");
    assert.strictEqual(called, false);
  });

  it("should trim and keep an explicit username", async () => {
    const client = {
      async getMe() {
        throw new Error("getMe should not be called");
      },
    };

    const username = await resolveUsernameOrMe(client, "  sai  ");
    assert.strictEqual(username, "sai");
  });

  it("should fall back to the current user", async () => {
    const client = {
      async getMe() {
        return { username: " current-user " };
      },
    };

    const username = await resolveUsernameOrMe(client);
    assert.strictEqual(username, "current-user");
  });
});
