import { spawnSync } from "node:child_process";
import { describe, it } from "node:test";
import assert from "node:assert";
import { formatDisplayResult } from "../src/core/output.js";

const CLI = "node";
const CLI_ARGS = ["src/cli.js"];

function run(args) {
  return spawnSync(CLI, [...CLI_ARGS, ...args], {
    encoding: "utf-8",
    cwd: process.cwd(),
  });
}

function runJson(args) {
  const result = run(["--json", ...args]);
  assert.strictEqual(result.status, 0, `CLI failed: ${result.stderr}`);
  return JSON.parse(result.stdout);
}

describe("calendar integration", () => {
  it("should return today's calendar", () => {
    const data = runJson(["calendar"]);
    assert.strictEqual(data.resource, "calendar");
    assert.strictEqual(data.data.length, 1);
    const jsDay = new Date().getDay();
    const expectedId = jsDay === 0 ? 7 : jsDay;
    assert.strictEqual(data.data[0].weekday.id, expectedId, "default should be today");
    assert.ok(Array.isArray(data.data[0].items), "should have items array");
  });
});

describe("calendar formatting", () => {
  it("should format calendar payload as table", () => {
    const payload = {
      resource: "calendar",
      data: [
        {
          weekday: { id: 1, en: "Mon", cn: "Monday", ja: "月耀日" },
          items: [
            {
              id: 123,
              name: "Test Anime",
              name_cn: "Test Anime CN",
              rating: { score: 8.5 },
              collection: { doing: 42 },
            },
          ],
        },
      ],
    };
    const output = formatDisplayResult(payload);
    assert.ok(output.includes("Mon"), "should include weekday");
    assert.ok(output.includes("Test Anime CN"), "should prefer name_cn");
    assert.ok(output.includes("8.5"), "should include score");
    assert.ok(output.includes("42"), "should include doing count");
    assert.ok(output.includes("123"), "should include subject id");
  });

  it("should handle empty items and missing fields", () => {
    const payload = {
      resource: "calendar",
      data: [
        {
          weekday: { id: 3, en: "Wed", cn: "Wednesday", ja: "水耀日" },
          items: [
            {
              id: 456,
              name: "Original Name",
              rating: {},
              collection: { doing: 0 },
            },
          ],
        },
      ],
    };
    const output = formatDisplayResult(payload);
    assert.ok(output.includes("Wed"), "should include weekday");
    assert.ok(output.includes("Original Name"), "should fallback to name");
    assert.ok(output.includes("-"), "should show dash for missing score");
  });
});
