import { afterEach, describe, it } from "node:test";
import assert from "node:assert";
import {
  executeEpisodeCommentsCommand,
  executeEpisodeListCommand,
  executeEpisodeWatchCommand,
} from "../src/commands/episode.js";
import {
  executeBookGetCommand,
  executeBookEpCommand,
  executeBookVolCommand,
} from "../src/commands/book.js";

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

describe("episode command book-type hint", () => {
  it("episode list should show book-type hint", async () => {
    globalThis.fetch = async (url, options) => {
      if (url.pathname === "/p1/subjects/3510/episodes") {
        return jsonResponse({ data: [], total: 0 });
      }
      if (url.pathname === "/p1/subjects/3510") {
        return jsonResponse({ id: 3510, type: 1, name: "ONE PIECE" });
      }
      throw new Error(`Unexpected request: ${url.toString()}`);
    };

    await assert.rejects(
      async () => executeEpisodeListCommand(["3510"]),
      (err) => {
        assert.ok(err.message.includes("book-type entry"));
        assert.ok(err.message.includes("bgm book ep"));
        return true;
      },
    );
  });

  it("episode watch should show book-type hint", async () => {
    globalThis.fetch = async (url, options) => {
      if (url.pathname === "/p1/subjects/3510/episodes") {
        return jsonResponse({ data: [], total: 0 });
      }
      if (url.pathname === "/p1/subjects/3510") {
        return jsonResponse({ id: 3510, type: 1, name: "ONE PIECE" });
      }
      throw new Error(`Unexpected request: ${url.toString()}`);
    };

    await assert.rejects(
      async () => executeEpisodeWatchCommand(["3510", "10"]),
      (err) => {
        assert.ok(err.message.includes("book-type entry"));
        assert.ok(err.message.includes("bgm book ep"));
        return true;
      },
    );
  });

  it("episode comments should show book-type hint", async () => {
    globalThis.fetch = async (url, options) => {
      if (url.pathname === "/p1/subjects/3510/episodes") {
        return jsonResponse({ data: [], total: 0 });
      }
      if (url.pathname === "/p1/subjects/3510") {
        return jsonResponse({ id: 3510, type: 1, name: "ONE PIECE" });
      }
      throw new Error(`Unexpected request: ${url.toString()}`);
    };

    await assert.rejects(
      async () => executeEpisodeCommentsCommand(["3510", "1"]),
      (err) => {
        assert.ok(err.message.includes("book-type entry"));
        assert.ok(err.message.includes("bgm book ep"));
        return true;
      },
    );
  });
});

describe("book command", () => {
  it("book get should return reading progress", async () => {
    globalThis.fetch = async (url, options) => {
      if (url.pathname === "/p1/subjects/3510") {
        return jsonResponse({ id: 3510, type: 1, name: "ONE PIECE", interest: { type: 3, ep_status: 10, vol_status: 2 } });
      }
      if (url.pathname === "/p1/me") {
        return jsonResponse({ username: "testuser" });
      }
      throw new Error(`Unexpected request: ${url.toString()}`);
    };

    const result = await executeBookGetCommand(["3510"]);
    assert.strictEqual(result.action, "get");
    assert.strictEqual(result.actionLabel, "Book reading progress");
    assert.strictEqual(result.subjectId, 3510);
    assert.strictEqual(result.collection.ep_status, 10);
    assert.strictEqual(result.collection.vol_status, 2);
  });

  it("book get should reject non-book subjects", async () => {
    globalThis.fetch = async (url, options) => {
      if (url.pathname === "/p1/subjects/975") {
        return jsonResponse({ id: 975, type: 2, name: "ONE PIECE" });
      }
      throw new Error(`Unexpected request: ${url.toString()}`);
    };

    await assert.rejects(
      async () => executeBookGetCommand(["975"]),
      (err) => {
        assert.ok(err.message.includes("not a book-type entry"));
        return true;
      },
    );
  });

  it("book ep should update chapter progress", async () => {
    let patched = false;
    globalThis.fetch = async (url, options) => {
      if (url.pathname === "/p1/subjects/3510") {
        return jsonResponse({ id: 3510, type: 1, name: "ONE PIECE", interest: { type: 3, ep_status: patched ? 15 : 10, vol_status: 0 } });
      }
      if (url.pathname === "/p1/me") {
        return jsonResponse({ username: "testuser" });
      }
      if (url.pathname === "/p1/collections/subjects/3510" && options.method === "PATCH") {
        patched = true;
        return jsonResponse({});
      }
      throw new Error(`Unexpected request: ${url.toString()}`);
    };

    const result = await executeBookEpCommand(["3510", "15"]);
    assert.strictEqual(result.action, "ep");
    assert.strictEqual(result.actionLabel, "Chapter progress updated");
    assert.strictEqual(result.subjectId, 3510);
  });

  it("book vol should update volume progress", async () => {
    let patched = false;
    globalThis.fetch = async (url, options) => {
      if (url.pathname === "/p1/subjects/3510") {
        return jsonResponse({ id: 3510, type: 1, name: "ONE PIECE", interest: { type: 3, ep_status: 10, vol_status: patched ? 3 : 2 } });
      }
      if (url.pathname === "/p1/me") {
        return jsonResponse({ username: "testuser" });
      }
      if (url.pathname === "/p1/collections/subjects/3510" && options.method === "PATCH") {
        patched = true;
        return jsonResponse({});
      }
      throw new Error(`Unexpected request: ${url.toString()}`);
    };

    const result = await executeBookVolCommand(["3510", "3"]);
    assert.strictEqual(result.action, "vol");
    assert.strictEqual(result.actionLabel, "Volume progress updated");
    assert.strictEqual(result.subjectId, 3510);
  });

  it("book ep should require collection first", async () => {
    globalThis.fetch = async (url, options) => {
      if (url.pathname === "/p1/subjects/3510") {
        return jsonResponse({ id: 3510, type: 1, name: "ONE PIECE" });
      }
      if (url.pathname === "/p1/me") {
        return jsonResponse({ username: "testuser" });
      }
      if (
        url.pathname === "/p1/users/testuser/collections/subjects" ||
        url.pathname === "/p1/collections/subjects"
      ) {
        return jsonResponse({ data: [], total: 0, limit: 100, offset: 0 });
      }
      throw new Error(`Unexpected request: ${url.toString()}`);
    };

    await assert.rejects(
      async () => executeBookEpCommand(["3510", "10"]),
      (err) => {
        assert.ok(err.message.includes("not in your collection"));
        return true;
      },
    );
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
