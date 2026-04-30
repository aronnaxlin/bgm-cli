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
  it("should return valid calendar JSON", () => {
    const data = runJson(["calendar"]);
    assert.strictEqual(data.resource, "calendar");
    assert.ok(Array.isArray(data.data), "data should be an array");
    assert.ok(data.data.length >= 1, "should have at least one weekday");
    assert.ok(data.data[0].weekday, "should have weekday info");
    assert.ok(Array.isArray(data.data[0].items), "should have items array");
  });

  it("should return 7 days with 'all' subcommand", () => {
    const data = runJson(["calendar", "all"]);
    assert.strictEqual(data.data.length, 7, "should return all 7 weekdays");
  });

  it("should return 1 day with 'mon' subcommand", () => {
    const data = runJson(["calendar", "mon"]);
    assert.strictEqual(data.data.length, 1, "should return exactly 1 weekday");
    assert.strictEqual(data.data[0].weekday.id, 1, "should be Monday");
  });

  it("should return 1 day with 'sun' subcommand", () => {
    const data = runJson(["calendar", "sun"]);
    assert.strictEqual(data.data.length, 1, "should return exactly 1 weekday");
    assert.strictEqual(data.data[0].weekday.id, 7, "should be Sunday");
  });

  it("should default to today", () => {
    const data = runJson(["calendar"]);
    assert.strictEqual(data.data.length, 1);
    const jsDay = new Date().getDay();
    const expectedId = jsDay === 0 ? 7 : jsDay;
    assert.strictEqual(data.data[0].weekday.id, expectedId, "default should be today");
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

  it("should handle empty items gracefully", () => {
    const payload = {
      resource: "calendar",
      data: [
        {
          weekday: { id: 2, en: "Tue", cn: "Tuesday", ja: "火耀日" },
          items: [],
        },
      ],
    };
    const output = formatDisplayResult(payload);
    assert.ok(output.includes("Tue"), "should include weekday");
    // empty items should not crash; formatTable with 0 rows produces header + separator
  });

  it("should fallback to name when name_cn is missing", () => {
    const payload = {
      resource: "calendar",
      data: [
        {
          weekday: { id: 3, en: "Wed", cn: "Wednesday", ja: "水耀日" },
          items: [
            {
              id: 456,
              name: "Original Name",
              rating: { score: 6.0 },
              collection: { doing: 0 },
            },
          ],
        },
      ],
    };
    const output = formatDisplayResult(payload);
    assert.ok(output.includes("Original Name"), "should fallback to name");
  });

  it("should show '-' for missing score", () => {
    const payload = {
      resource: "calendar",
      data: [
        {
          weekday: { id: 4, en: "Thu", cn: "Thursday", ja: "木耀日" },
          items: [
            {
              id: 789,
              name: "No Score",
              name_cn: "",
              collection: { doing: 5 },
            },
          ],
        },
      ],
    };
    const output = formatDisplayResult(payload);
    assert.ok(output.includes("No Score"), "should show name");
    assert.ok(output.includes("-"), "should show dash for missing score");
  });
});
