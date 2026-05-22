import { afterEach, describe, it } from "node:test";
import assert from "node:assert";
import { BangumiClient } from "../src/core/client.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("BangumiClient collection mutations", () => {
  it("should send rating updates as subject collection PUT payloads", async () => {
    const requests = [];
    globalThis.fetch = async (url, options) => {
      requests.push({ url, options });
      return jsonResponse({});
    };

    const client = new BangumiClient({ accessToken: "token", userAgent: "test" });
    await client.patchMyCollection(1424, { rate: 9 });

    assert.strictEqual(requests.length, 1);
    assert.strictEqual(requests[0].url.toString(), "https://next.bgm.tv/p1/collections/subjects/1424");
    assert.strictEqual(requests[0].options.method, "PUT");
    assert.deepStrictEqual(JSON.parse(requests[0].options.body), { rate: 9 });
  });

  it("should send subject progress updates as PATCH payloads", async () => {
    const requests = [];
    globalThis.fetch = async (url, options) => {
      requests.push({ url, options });
      return jsonResponse({});
    };

    const client = new BangumiClient({ accessToken: "token", userAgent: "test" });
    await client.patchMyCollection(1424, { ep_status: 12 });

    assert.strictEqual(requests.length, 1);
    assert.strictEqual(requests[0].url.toString(), "https://next.bgm.tv/p1/collections/subjects/1424");
    assert.strictEqual(requests[0].options.method, "PATCH");
    assert.deepStrictEqual(JSON.parse(requests[0].options.body), { epStatus: 12 });
  });

  it("should treat p1 no-update collection responses as idempotent success", async () => {
    globalThis.fetch = async () => jsonResponse({
      statusCode: 400,
      code: "BAD_REQUEST",
      error: "Bad Request",
      message: "no update",
    }, { status: 400 });

    const client = new BangumiClient({ accessToken: "token", userAgent: "test" });
    await assert.doesNotReject(() => client.patchMyCollection(1424, { rate: 9 }));
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
