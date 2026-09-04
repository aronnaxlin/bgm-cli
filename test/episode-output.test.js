import { describe, it } from "node:test";
import assert from "node:assert";
import { formatDisplayResult } from "../src/core/output.js";

const EPISODE = {
  id: 519,
  name: "アステロイド・ブルース Asteroid Blues",
  name_cn: "小行星蓝调",
  nameCN: "小行星蓝调",
  type: 0,
  ep: 1,
  sort: 1,
  airdate: "1998-10-23",
  duration: "00:24:43",
  comment: 109,
  disc: 0,
  desc: "Episode summary.",
  subject_id: 253,
  subjectID: 253,
  subject: {
    id: 253,
    name: "カウボーイビバップ",
    nameCN: "星际牛仔",
    type: 2,
  },
};

describe("episode detail formatting", () => {
  it("should not fall through to the subject formatter", () => {
    const output = formatDisplayResult(EPISODE);
    assert.match(output, /^Episode #519/);
    assert.doesNotMatch(output, /Subject #519/);
  });

  it("should use the episode type table, not the subject one", () => {
    assert.match(formatDisplayResult(EPISODE), /Type: Main/);
    assert.match(formatDisplayResult({ ...EPISODE, type: 2 }), /Type: OP/);
  });

  it("should link to the episode page, not the subject page", () => {
    const output = formatDisplayResult(EPISODE);
    assert.match(output, /URL: https:\/\/bgm\.tv\/ep\/519/);
    assert.doesNotMatch(output, /bgm\.tv\/subject\/519/);
  });

  it("should keep episode-only fields", () => {
    const output = formatDisplayResult(EPISODE);
    assert.match(output, /Number: EP 1/);
    assert.match(output, /Air date: 1998-10-23/);
    assert.match(output, /Duration: 00:24:43/);
    assert.match(output, /Comments: 109/);
    assert.match(output, /Summary/);
  });

  it("should name the parent subject", () => {
    assert.match(formatDisplayResult(EPISODE), /Subject: #253 星际牛仔/);
  });

  it("should fall back to sort for non-main episodes", () => {
    const output = formatDisplayResult({ ...EPISODE, type: 1, ep: 0, sort: 27 });
    assert.match(output, /Number: Sort 27/);
  });

  it("should tolerate a bare episode payload", () => {
    const output = formatDisplayResult({ id: 7, name: "Bare", type: 0, sort: 3, subject_id: 9 });
    assert.match(output, /^Episode #7/);
    assert.match(output, /Subject: #9$/m);
  });

  it("should still format a subject as a subject", () => {
    const output = formatDisplayResult({
      id: 253,
      name: "カウボーイビバップ",
      name_cn: "星际牛仔",
      type: 2,
      date: "1998-10-23",
    });
    assert.match(output, /^Subject #253/);
    assert.match(output, /Type: Anime/);
  });

  it("should leave resource-tagged payloads alone", () => {
    const output = formatDisplayResult({
      resource: "episode-list",
      subjectId: 253,
      data: [],
      total: 0,
    });
    assert.match(output, /^Episodes: #253/);
  });
});

describe("subject platform formatting", () => {
  it("should render a private API platform object", () => {
    const output = formatDisplayResult({
      id: 253,
      name: "カウボーイビバップ",
      type: 2,
      platform: { id: 1, type: "TV", typeCN: "TV", alias: "tv" },
    });
    assert.match(output, /Platform: TV/);
    assert.doesNotMatch(output, /\[object Object\]/);
  });

  it("should prefer the localized platform label", () => {
    const output = formatDisplayResult({
      id: 1,
      name: "Book",
      type: 1,
      platform: { type: "Comic", typeCN: "漫画" },
    });
    assert.match(output, /Platform: 漫画/);
  });

  it("should fall back to alias when no type is present", () => {
    const output = formatDisplayResult({
      id: 1,
      name: "Thing",
      type: 2,
      platform: { alias: "tv" },
    });
    assert.match(output, /Platform: tv/);
  });

  it("should keep supporting a plain string platform", () => {
    const output = formatDisplayResult({ id: 253, name: "Name", type: 2, platform: "TV" });
    assert.match(output, /Platform: TV/);
  });

  it("should omit the line for an empty platform object", () => {
    const output = formatDisplayResult({ id: 253, name: "Name", type: 2, platform: {} });
    assert.doesNotMatch(output, /Platform:/);
  });
});
