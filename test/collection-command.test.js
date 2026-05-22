import { describe, it } from "node:test";
import assert from "node:assert";
import { buildPreservedCollectionMutationPayload } from "../src/commands/collection.js";

describe("collection command mutation payloads", () => {
  it("should preserve existing collection fields when changing status", () => {
    const payload = buildPreservedCollectionMutationPayload({
      type: 3,
      rate: 9,
      comment: "",
      private: false,
      tags: ["music"],
    }, {
      type: 2,
    });

    assert.deepStrictEqual(payload, {
      type: 2,
      rate: 9,
      comment: "",
      private: false,
      tags: ["music"],
    });
  });

  it("should clear rating when moving a collection back to wish", () => {
    const payload = buildPreservedCollectionMutationPayload({
      type: 2,
      rate: 9,
      comment: "nice",
      private: false,
      tags: [],
    }, {
      type: 1,
    });

    assert.deepStrictEqual(payload, {
      type: 1,
      rate: 0,
      comment: "nice",
      private: false,
      tags: [],
    });
  });
});
