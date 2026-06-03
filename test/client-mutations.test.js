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

describe("BangumiClient auth and notifications", () => {
  it("should send official p1 login and extract the private session cookie", async () => {
    const requests = mockFetchRequests({
      responseHeaders: {
        "set-cookie": "chiiNextSessionID=session-token; Path=/; HttpOnly",
      },
      responsePayload: {
        id: 1,
        username: "sai",
        nickname: "Sai",
      },
    });
    const client = new BangumiClient({ userAgent: "test" });

    const result = await client.login({
      email: "user@example.com",
      password: "secret",
      turnstileToken: "turnstile",
    });

    assert.deepStrictEqual(requests.map(requestSummary), [
      ["POST", "https://next.bgm.tv/p1/login", {
        email: "user@example.com",
        password: "secret",
        turnstileToken: "turnstile",
      }],
    ]);
    assert.strictEqual(result.resource, "auth-login");
    assert.strictEqual(result.privateSessionId, "session-token");
    assert.strictEqual(result.user.username, "sai");
  });

  it("should normalize p1 login credential failures", async () => {
    globalThis.fetch = async () => jsonResponse({
      code: "INVALID_CREDENTIALS",
      error: "Unauthorized",
    }, { status: 401 });
    const client = new BangumiClient({ userAgent: "test" });

    await assert.rejects(
      () => client.login({
        email: "missing@example.com",
        password: "wrong",
        turnstileToken: "turnstile",
      }),
      /email\/account does not exist|password is incorrect/,
    );
  });

  it("should normalize p1 login Turnstile failures", async () => {
    globalThis.fetch = async () => jsonResponse({
      code: "CAPTCHA_ERROR",
      error: "captcha failed",
    }, { status: 400 });
    const client = new BangumiClient({ userAgent: "test" });

    await assert.rejects(
      () => client.login({
        email: "user@example.com",
        password: "secret",
        turnstileToken: "expired",
      }),
      /Turnstile verification was rejected or expired/,
    );
  });

  it("should send p1 logout and notification requests", async () => {
    const requests = mockFetchRequests();
    const client = new BangumiClient({
      accessToken: "token",
      privateSessionId: "session-token",
      userAgent: "test",
    });

    await client.logout();
    await client.listNotifications({ limit: 10, unread: true });
    await client.clearNotifications([1, 2]);
    await client.clearNotifications();

    assert.deepStrictEqual(requests.map(requestSummary), [
      ["POST", "https://next.bgm.tv/p1/logout", {}],
      ["GET", "https://next.bgm.tv/p1/notify?limit=10&unread=true", undefined],
      ["POST", "https://next.bgm.tv/p1/clear-notify", { id: [1, 2] }],
      ["POST", "https://next.bgm.tv/p1/clear-notify", {}],
    ]);
  });

  it("should prefer private session over access token for p1 requests", async () => {
    const requests = mockFetchRequests();
    const client = new BangumiClient({
      accessToken: "access-token",
      privateSessionId: "session-token",
      userAgent: "test",
    });

    await client.listNotifications({ limit: 1 });

    assert.strictEqual(requests[0].options.headers.Cookie, "chiiNextSessionID=session-token");
    assert.strictEqual(requests[0].options.headers.Authorization, undefined);
  });
});

describe("BangumiClient topic and mono mutations", () => {
  it("should send subject topic and post mutations to p1 endpoints", async () => {
    const requests = mockFetchRequests();
    const client = new BangumiClient({ accessToken: "token", userAgent: "test" });

    await client.listRecentSubjectTopics({ limit: 10, offset: 5 });
    await client.createSubjectTopic(1424, { title: "t", content: "c", turnstileToken: "ts" });
    await client.updateSubjectTopic(100, { title: "t2", content: "c2" });
    await client.createSubjectReply(100, { content: "r", replyTo: 0, turnstileToken: "ts" });
    await client.updateSubjectPost(200, { content: "edited" });
    await client.deleteSubjectPost(201);
    await client.likeSubjectPost(202, 54);
    await client.unlikeSubjectPost(202);

    assert.deepStrictEqual(requests.map(requestSummary), [
      ["GET", "https://next.bgm.tv/p1/subjects/-/topics?limit=10&offset=5", undefined],
      ["POST", "https://next.bgm.tv/p1/subjects/1424/topics", { title: "t", content: "c", turnstileToken: "ts" }],
      ["PUT", "https://next.bgm.tv/p1/subjects/-/topics/100", { title: "t2", content: "c2" }],
      ["POST", "https://next.bgm.tv/p1/subjects/-/topics/100/replies", { content: "r", replyTo: 0, turnstileToken: "ts" }],
      ["PUT", "https://next.bgm.tv/p1/subjects/-/posts/200", { content: "edited" }],
      ["DELETE", "https://next.bgm.tv/p1/subjects/-/posts/201", undefined],
      ["PUT", "https://next.bgm.tv/p1/subjects/-/posts/202/like", { value: 54 }],
      ["DELETE", "https://next.bgm.tv/p1/subjects/-/posts/202/like", undefined],
    ]);
  });

  it("should send group topic and post mutations to p1 endpoints", async () => {
    const requests = mockFetchRequests();
    const client = new BangumiClient({ accessToken: "token", userAgent: "test" });

    await client.updateGroupTopic(100, { title: "t", content: "c" });
    await client.updateGroupPost(200, { content: "edited" });
    await client.deleteGroupPost(201);
    await client.likeGroupPost(202, 54);
    await client.unlikeGroupPost(202);

    assert.deepStrictEqual(requests.map(requestSummary), [
      ["PUT", "https://next.bgm.tv/p1/groups/-/topics/100", { title: "t", content: "c" }],
      ["PUT", "https://next.bgm.tv/p1/groups/-/posts/200", { content: "edited" }],
      ["DELETE", "https://next.bgm.tv/p1/groups/-/posts/201", undefined],
      ["PUT", "https://next.bgm.tv/p1/groups/-/posts/202/like", { value: 54 }],
      ["DELETE", "https://next.bgm.tv/p1/groups/-/posts/202/like", undefined],
    ]);
  });

  it("should reject placeholder reaction values for topic posts", async () => {
    const client = new BangumiClient({ accessToken: "token", userAgent: "test" });

    await assert.rejects(
      () => client.likeGroupPost(202, 1),
      /Unsupported reaction value 1 for group topic reply/,
    );
  });

  it("should send character and person comment mutations to p1 endpoints", async () => {
    const requests = mockFetchRequests();
    const client = new BangumiClient({ accessToken: "token", userAgent: "test" });

    await client.createCharacterComment(1, { content: "c", replyTo: 0, turnstileToken: "ts" });
    await client.updateCharacterComment(2, { content: "edited" });
    await client.deleteCharacterComment(3);
    await client.createPersonComment(4, { content: "c", replyTo: 0, turnstileToken: "ts" });
    await client.updatePersonComment(5, { content: "edited" });
    await client.deletePersonComment(6);

    assert.deepStrictEqual(requests.map(requestSummary), [
      ["POST", "https://next.bgm.tv/p1/characters/1/comments", { content: "c", replyTo: 0, turnstileToken: "ts" }],
      ["PUT", "https://next.bgm.tv/p1/characters/-/comments/2", { content: "edited" }],
      ["DELETE", "https://next.bgm.tv/p1/characters/-/comments/3", undefined],
      ["POST", "https://next.bgm.tv/p1/persons/4/comments", { content: "c", replyTo: 0, turnstileToken: "ts" }],
      ["PUT", "https://next.bgm.tv/p1/persons/-/comments/5", { content: "edited" }],
      ["DELETE", "https://next.bgm.tv/p1/persons/-/comments/6", undefined],
    ]);
  });

  it("should send simple character person and index collection mutations to p1 endpoints", async () => {
    const requests = mockFetchRequests();
    const client = new BangumiClient({ accessToken: "token", userAgent: "test" });

    await client.addCharacterCollection(1);
    await client.deleteCharacterCollection(1);
    await client.addPersonCollection(2);
    await client.deletePersonCollection(2);
    await client.addIndexCollection(3);
    await client.deleteIndexCollection(3);

    assert.deepStrictEqual(requests.map(requestSummary), [
      ["PUT", "https://next.bgm.tv/p1/collections/characters/1", undefined],
      ["DELETE", "https://next.bgm.tv/p1/collections/characters/1", undefined],
      ["PUT", "https://next.bgm.tv/p1/collections/persons/2", undefined],
      ["DELETE", "https://next.bgm.tv/p1/collections/persons/2", undefined],
      ["PUT", "https://next.bgm.tv/p1/collections/indexes/3", undefined],
      ["DELETE", "https://next.bgm.tv/p1/collections/indexes/3", undefined],
    ]);
  });

  it("should send episode comment mutations to p1 endpoints", async () => {
    const requests = mockFetchRequests();
    const client = new BangumiClient({ accessToken: "token", userAgent: "test" });

    await client.createEpisodeComment(11, { content: "c", replyTo: 0, turnstileToken: "ts" });
    await client.updateEpisodeComment(12, { content: "edited" });
    await client.deleteEpisodeComment(13);
    await client.likeEpisodeComment(14, 54);
    await client.unlikeEpisodeComment(14);

    assert.deepStrictEqual(requests.map(requestSummary), [
      ["POST", "https://next.bgm.tv/p1/episodes/11/comments", { content: "c", replyTo: 0, turnstileToken: "ts" }],
      ["PUT", "https://next.bgm.tv/p1/episodes/-/comments/12", { content: "edited" }],
      ["DELETE", "https://next.bgm.tv/p1/episodes/-/comments/13", undefined],
      ["PUT", "https://next.bgm.tv/p1/episodes/-/comments/14/like", { value: 54 }],
      ["DELETE", "https://next.bgm.tv/p1/episodes/-/comments/14/like", undefined],
    ]);
  });

  it("should send mono photo detail requests to p1 endpoints", async () => {
    const requests = mockFetchRequests();
    const client = new BangumiClient({ accessToken: "token", userAgent: "test" });

    await client.listCharacterPhotoPreview(1, { limit: 6 });
    await client.getCharacterPhoto(1, 2);
    await client.listCharacterPhotoComments(1, 2);
    await client.listPersonPhotoPreview(3, { limit: 6 });
    await client.getPersonPhoto(3, 4);
    await client.listPersonPhotoComments(3, 4);

    assert.deepStrictEqual(requests.map(requestSummary), [
      ["GET", "https://next.bgm.tv/p1/characters/1/photos/preview?limit=6", undefined],
      ["GET", "https://next.bgm.tv/p1/characters/1/photos/2", undefined],
      ["GET", "https://next.bgm.tv/p1/characters/1/photos/2/comments", undefined],
      ["GET", "https://next.bgm.tv/p1/persons/3/photos/preview?limit=6", undefined],
      ["GET", "https://next.bgm.tv/p1/persons/3/photos/4", undefined],
      ["GET", "https://next.bgm.tv/p1/persons/3/photos/4/comments", undefined],
    ]);
  });

  it("should send subject collect reactions to p1 endpoints", async () => {
    const requests = mockFetchRequests();
    const client = new BangumiClient({ accessToken: "token", userAgent: "test" });

    await client.likeSubjectCollect(100, 54);
    await client.unlikeSubjectCollect(100);

    assert.deepStrictEqual(requests.map(requestSummary), [
      ["PUT", "https://next.bgm.tv/p1/subjects/-/collects/100/like", { value: 54 }],
      ["DELETE", "https://next.bgm.tv/p1/subjects/-/collects/100/like", undefined],
    ]);
  });

  it("should reject unsupported subject collect reaction values", async () => {
    const client = new BangumiClient({ accessToken: "token", userAgent: "test" });

    await assert.rejects(
      () => client.likeSubjectCollect(100, 79),
      /Unsupported reaction value 79 for subject collection comment/,
    );
  });
});

describe("BangumiClient timeline SSE", () => {
  it("should collect bounded timeline events from the SSE stream", async () => {
    const requests = [];
    globalThis.fetch = async (url, options) => {
      requests.push({ url, options });
      return new Response(new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("data: {\"event\":\"connected\"}\n\n"));
          controller.enqueue(new TextEncoder().encode("data: {\"event\":\"timeline\",\"timeline\":{\"id\":1,\"cat\":5,\"content\":\"hi\"}}\n\n"));
          controller.close();
        },
      }), {
        status: 200,
        headers: {
          "content-type": "text/event-stream",
        },
      });
    };

    const client = new BangumiClient({ accessToken: "token", userAgent: "test" });
    const events = await client.listTimelineEvents({
      mode: "friends",
      cat: 5,
      limit: 2,
      timeoutMs: 1000,
    });

    assert.strictEqual(requests[0].url.toString(), "https://next.bgm.tv/p1/timeline/-/events?mode=friends&cat=5");
    assert.strictEqual(requests[0].options.headers.Accept, "text/event-stream");
    assert.deepStrictEqual(events, [
      { event: "connected" },
      { event: "timeline", timeline: { id: 1, cat: 5, content: "hi" } },
    ]);
  });
});

function mockFetchRequests(mockOptions = {}) {
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push({ url, options });
    return jsonResponse(mockOptions.responsePayload ?? {}, {
      headers: mockOptions.responseHeaders,
      status: mockOptions.responseStatus,
    });
  };
  return requests;
}

function requestSummary(request) {
  return [
    request.options.method,
    request.url.toString(),
    request.options.body === undefined ? undefined : JSON.parse(request.options.body),
  ];
}

function jsonResponse(payload, options = {}) {
  return new Response(JSON.stringify(payload), {
    status: options.status ?? 200,
    headers: {
      "content-type": "application/json",
      ...options.headers,
    },
  });
}
