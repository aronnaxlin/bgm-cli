import { afterEach, describe, it } from "node:test";
import assert from "node:assert";
import { executeEpisodeCommentsCommand } from "../src/commands/episode.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("episode command comments", () => {
  it("should keep direct episode id comments lookup", async () => {
    const requests = [];
    globalThis.fetch = async (url, options) => {
      requests.push({ url, options });
      return jsonResponse([]);
    };

    const result = await executeEpisodeCommentsCommand(["1001"]);

    assert.deepStrictEqual(requests.map((request) => request.url.toString()), [
      "https://next.bgm.tv/p1/episodes/1001/comments",
    ]);
    assert.strictEqual(result.resource, "episode-comments");
    assert.strictEqual(result.episodeId, 1001);
    assert.strictEqual(result.subjectId, undefined);
  });

  it("should resolve comments from subject id and episode number", async () => {
    const requests = [];
    globalThis.fetch = async (url, options) => {
      requests.push({ url, options });

      if (url.pathname === "/p1/subjects/348335/episodes") {
        return jsonResponse({
          data: [
            { id: 1001, subjectID: 348335, sort: 1, type: 0, name: "Episode 1", comment: 2 },
          ],
          total: 1,
        });
      }

      if (url.pathname === "/p1/episodes/1001/comments") {
        return jsonResponse([
          { id: 2001, mainID: 1001, creatorID: 1, relatedID: 0, createdAt: 1, content: "nice", state: 0 },
        ]);
      }

      throw new Error(`Unexpected request: ${url.toString()}`);
    };

    const result = await executeEpisodeCommentsCommand(["348335", "1"]);

    assert.deepStrictEqual(requests.map((request) => request.url.toString()), [
      "https://next.bgm.tv/p1/subjects/348335/episodes?type=0&limit=200&offset=0",
      "https://next.bgm.tv/p1/episodes/1001/comments",
    ]);
    assert.strictEqual(result.resource, "episode-comments");
    assert.strictEqual(result.subjectId, 348335);
    assert.strictEqual(result.episodeId, 1001);
    assert.strictEqual(result.episodeNumber, 1);
    assert.deepStrictEqual(result.filters, { type: "main" });
    assert.strictEqual(result.data.length, 1);
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
