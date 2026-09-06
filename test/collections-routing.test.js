import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BangumiClient } from "../src/core/client.js";

describe("BangumiClient listCollections routing", () => {
  it("should route to /p1/collections/subjects when username is current user", async () => {
    const requestedUrls = [];
    globalThis.fetch = async (url) => {
      requestedUrls.push(url.pathname);
      if (url.pathname === "/p1/me") {
        return jsonResponse({ username: "aronnax" });
      }
      if (url.pathname === "/p1/collections/subjects") {
        return jsonResponse({
          data: [
            {
              id: 49131,
              type: 2,
              name: "デート・ア・ライブ",
              nameCN: "约会大作战",
              interest: {
                id: 123,
                type: 2,
                private: true,
                rate: 0,
                updatedAt: 1788657630,
              },
            },
          ],
          total: 1,
        });
      }
      throw new Error(`Unexpected request: ${url.pathname}`);
    };

    const client = new BangumiClient();
    const result = await client.listCollections("aronnax", { subjectType: 2 });
    assert.ok(requestedUrls.includes("/p1/collections/subjects"));
    assert.equal(result.data.length, 1);
    assert.equal(result.data[0].subject_id, 49131);
    assert.equal(result.data[0].private, true);
  });

  it("should route to /p1/users/:username/collections/subjects when querying another user", async () => {
    const requestedUrls = [];
    globalThis.fetch = async (url) => {
      requestedUrls.push(url.pathname);
      if (url.pathname === "/p1/me") {
        return jsonResponse({ username: "aronnax" });
      }
      if (url.pathname === "/p1/users/ceynri/collections/subjects") {
        return jsonResponse({
          data: [
            {
              id: 5649,
              type: 2,
              name: "生徒会役員共",
              nameCN: "妄想学生会",
              interest: {
                id: 456,
                type: 3,
                rate: 0,
                updatedAt: 1788508508,
              },
            },
          ],
          total: 1,
        });
      }
      throw new Error(`Unexpected request: ${url.pathname}`);
    };

    const client = new BangumiClient();
    const result = await client.listCollections("ceynri", { subjectType: 2 });
    assert.ok(requestedUrls.includes("/p1/users/ceynri/collections/subjects"));
    assert.equal(result.data.length, 1);
    assert.equal(result.data[0].subject_id, 5649);
  });
});

function jsonResponse(payload, options = {}) {
  return new Response(JSON.stringify(payload), {
    status: options.status ?? 200,
    headers: {
      "content-type": "application/json",
    },
  });
}
