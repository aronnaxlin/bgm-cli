import { afterEach, describe, it } from "node:test";
import assert from "node:assert";
import { runSearchCommand } from "../src/commands/search.js";
import { BangumiCommunityApiError } from "../src/core/community-api.js";

const originalFetch = globalThis.fetch;
const originalLog = console.log;

afterEach(() => {
  globalThis.fetch = originalFetch;
  console.log = originalLog;
});

function envelope(data = []) {
  return new Response(
    JSON.stringify({ data, pagination: { total: data.length, limit: 20, offset: 0 }, meta: { executionMs: 1 } }),
    { headers: { "content-type": "application/json" } },
  );
}

async function runJson(command, args) {
  const requests = [];
  globalThis.fetch = async (url) => {
    requests.push(new URL(url));
    return envelope();
  };
  const lines = [];
  console.log = (line) => lines.push(line);
  await runSearchCommand(command, args, { json: true });
  console.log = originalLog;
  return { requests, output: JSON.parse(lines.join("\n")) };
}

describe("search command (SearchEncore)", () => {
  it("should forward --source for reply search", async () => {
    const { requests, output } = await runJson("reply", ["user:wataame", "--source", "EP", "--sort", "newest", "--limit", "3"]);

    assert.strictEqual(requests.length, 1);
    assert.strictEqual(requests[0].pathname, "/v1/search/replies");
    assert.strictEqual(requests[0].searchParams.get("q"), "user:wataame");
    assert.strictEqual(requests[0].searchParams.get("source"), "ep");
    assert.strictEqual(requests[0].searchParams.get("sort"), "newest");
    assert.strictEqual(requests[0].searchParams.get("limit"), "3");
    assert.strictEqual(output.filters.source, "ep");
    assert.strictEqual(output._meta.isSearchEncore, true);
  });

  it("should omit source when not given", async () => {
    const { requests, output } = await runJson("replies", ["hello"]);

    assert.strictEqual(requests[0].searchParams.has("source"), false);
    assert.strictEqual("source" in output.filters, false);
  });

  it("should reject an unknown reply source before any request", async () => {
    let called = false;
    globalThis.fetch = async () => {
      called = true;
      return envelope();
    };

    await assert.rejects(
      runSearchCommand("reply", ["x", "--source", "bogus"], { json: true }),
      /Invalid --source/,
    );
    assert.strictEqual(called, false);
  });

  it("should not send source for other resources", async () => {
    const { requests } = await runJson("subject", ["ghost", "--source", "blog"]);

    assert.strictEqual(requests[0].pathname, "/v1/search/subjects");
    assert.strictEqual(requests[0].searchParams.has("source"), false);
  });

  it("should translate --type into a type: directive for subject search", async () => {
    const { requests, output } = await runJson("subject", ["EVA", "--type", "anime"]);

    assert.strictEqual(requests[0].pathname, "/v1/search/subjects");
    assert.strictEqual(requests[0].searchParams.get("q"), "EVA type:anime");
    assert.deepStrictEqual(output.filters.type, ["anime"]);
    assert.strictEqual(output.filters.keyword, "EVA");
  });

  it("should map numeric --type to its canonical name", async () => {
    const { requests } = await runJson("subject", ["EVA", "--type", "2"]);

    assert.strictEqual(requests[0].searchParams.get("q"), "EVA type:anime");
  });

  it("should reject an unknown --type before any request", async () => {
    let called = false;
    globalThis.fetch = async () => {
      called = true;
      return envelope();
    };

    await assert.rejects(
      runSearchCommand("subject", ["x", "--type", "bogus"], { json: true }),
      /Unsupported subject type/,
    );
    assert.strictEqual(called, false);
  });

  it("should not translate --type for other resources", async () => {
    const { requests, output } = await runJson("blog", ["ghost", "--type", "anime"]);

    assert.strictEqual(requests[0].searchParams.get("q"), "ghost");
    assert.strictEqual("type" in output.filters, false);
  });

  it("should translate --user/--group/--exact into directives on any resource", async () => {
    const { requests, output } = await runJson("topic", ["太可爱了", "--user", "wataame", "--group", "bangumi", "--exact"]);

    assert.strictEqual(requests[0].pathname, "/v1/search/group-topics");
    assert.strictEqual(
      requests[0].searchParams.get("q"),
      "太可爱了 user:wataame group:bangumi exact:true",
    );
    assert.deepStrictEqual(output.filters.user, ["wataame"]);
    assert.deepStrictEqual(output.filters.group, ["bangumi"]);
    assert.strictEqual(output.filters.exact, true);
  });

  it("should translate --include/--exclude into directives", async () => {
    const { requests, output } = await runJson("subject", ["R18", "--include", "nsfw", "--exclude", "nsfw"]);

    assert.strictEqual(requests[0].searchParams.get("q"), "R18 include:nsfw exclude:nsfw");
    assert.deepStrictEqual(output.filters.include, ["nsfw"]);
    assert.deepStrictEqual(output.filters.exclude, ["nsfw"]);
  });

  it("should reject an invalid --include value before any request", async () => {
    let called = false;
    globalThis.fetch = async () => {
      called = true;
      return envelope();
    };

    await assert.rejects(
      runSearchCommand("subject", ["x", "--include", "bogus"], { json: true }),
      /Invalid --include/,
    );
    assert.strictEqual(called, false);
  });

  it("should reject a bare --user flag before any request", async () => {
    let called = false;
    globalThis.fetch = async () => {
      called = true;
      return envelope();
    };

    await assert.rejects(
      runSearchCommand("blog", ["x", "--user"], { json: true }),
      /--user requires a value/,
    );
    assert.strictEqual(called, false);
  });

  it("should report a Cloudflare challenge concisely", async () => {
    globalThis.fetch = async () =>
      new Response('<html><script src="/cdn-cgi/challenge-platform/h/b/orchestrate"></script></html>', {
        status: 403,
        headers: { "content-type": "text/html" },
      });

    await assert.rejects(runSearchCommand("subject", ["x"], { json: true }), (error) => {
      assert.ok(error instanceof BangumiCommunityApiError);
      assert.match(error.message, /Cloudflare bot challenge \(HTTP 403\)/);
      assert.ok(error.message.length < 200);
      return true;
    });
  });
});
