import { describe, it } from "node:test";
import assert from "node:assert";
import { formatDisplayResult } from "../src/core/output.js";

describe("subject topic formatting", () => {
  it("should format subject topic detail for human-readable output", () => {
    const output = formatDisplayResult({
      id: 29892,
      title: "Topic title",
      creatorID: 1,
      parentID: 18624,
      replyCount: 1,
      createdAt: 1716475376,
      updatedAt: 1730859313,
      subject: {
        id: 18624,
        name: "Original subject",
        nameCN: "Localized subject",
      },
      creator: {
        id: 1,
        username: "author",
        nickname: "Author",
      },
      replies: [
        {
          id: 10,
          creatorID: 1,
          createdAt: 1716475376,
          content: "Main post content",
          creator: {
            id: 1,
            username: "author",
            nickname: "Author",
          },
        },
        {
          id: 11,
          creatorID: 2,
          createdAt: 1730859313,
          content: "Reply content",
          creator: {
            id: 2,
            username: "reply-user",
            nickname: "Reply User",
          },
        },
      ],
    });

    assert.ok(output.includes("Subject topic #29892"));
    assert.ok(output.includes("Title: Topic title"));
    assert.ok(output.includes("Subject: Localized subject / Original subject (#18624)"));
    assert.ok(output.includes("Content"));
    assert.ok(output.includes("Main post content"));
    assert.ok(output.includes("Replies"));
    assert.ok(output.includes("Reply content"));
    assert.ok(!output.trim().startsWith("{"), "should not fall back to JSON output");
  });
});
