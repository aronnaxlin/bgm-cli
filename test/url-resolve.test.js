import { spawnSync } from "node:child_process";
import { describe, it } from "node:test";
import assert from "node:assert";
import {
  formatResolvedCommand,
  looksLikeBangumiUrl,
  parseBangumiUrl,
  resolveBangumiUrl,
} from "../src/utils/bangumi-url.js";
import { splitUrlArgs } from "../src/commands/url.js";
import { parseGlobalArgs } from "../src/utils/args.js";

function line(url) {
  return formatResolvedCommand(resolveBangumiUrl(url));
}

function expectError(url) {
  return assert.throws(() => resolveBangumiUrl(url), { name: "CommandError" });
}

describe("looksLikeBangumiUrl", () => {
  const accepted = [
    "https://bgm.tv/subject/253",
    "http://bangumi.tv/subject/253",
    "https://www.bgm.tv/subject/253",
    "https://chii.in/subject/253",
    "https://next.bgm.tv/subject/253",
    "https://api.bgm.tv/v0/subjects/253",
    "bgm.tv/subject/253",
  ];
  for (const url of accepted) {
    it(`should accept ${url}`, () => {
      assert.strictEqual(looksLikeBangumiUrl(url), true);
    });
  }

  const rejected = [
    "subject",
    "collection",
    "https://example.com/subject/253",
    "https://notbgm.tv/subject/253",
    "ftp://bgm.tv/subject/253",
    "",
    "https://bgm.tv.evil.com/subject/253",
  ];
  for (const value of rejected) {
    it(`should reject ${value || "(empty)"}`, () => {
      assert.strictEqual(looksLikeBangumiUrl(value), false);
    });
  }

  it("should not shadow any existing command group", () => {
    const groups = [
      "tui", "config", "proxy", "auth", "setup", "subject", "character", "person",
      "episode", "ep", "group", "blog", "timeline", "trending", "index",
      "collection", "book", "status", "user", "search", "notify", "calendar", "url",
    ];
    for (const group of groups) {
      assert.strictEqual(looksLikeBangumiUrl(group), false, `${group} must not parse as a URL`);
    }
  });
});

describe("parseBangumiUrl", () => {
  it("should strip the www prefix and lowercase the host", () => {
    assert.strictEqual(parseBangumiUrl("https://WWW.BGM.TV/subject/253").host, "bgm.tv");
  });

  it("should tolerate trailing and duplicate slashes", () => {
    assert.strictEqual(parseBangumiUrl("https://bgm.tv//subject//253/").path, "/subject/253");
  });

  it("should decode percent-encoded path segments", () => {
    assert.strictEqual(parseBangumiUrl("https://bgm.tv/subject_search/%E6%B5%B7%E8%B4%BC").segments[1], "海贼");
  });

  it("should expose the fragment without the hash", () => {
    assert.strictEqual(parseBangumiUrl("https://bgm.tv/group/topic/1#post_2").hash, "post_2");
  });
});

describe("resolveBangumiUrl: subject", () => {
  const cases = [
    ["https://bgm.tv/subject/253", "bgm subject get 253"],
    ["https://bgm.tv/subject/253/comments", "bgm subject comments 253"],
    ["https://bgm.tv/subject/253/reviews", "bgm subject reviews 253"],
    ["https://bgm.tv/subject/253/board", "bgm subject topics 253"],
    ["https://bgm.tv/subject/253/characters", "bgm subject characters 253"],
    ["https://bgm.tv/subject/253/persons", "bgm subject staff 253"],
    ["https://bgm.tv/subject/253/collections", "bgm subject collects 253"],
    ["https://bgm.tv/subject/253/index", "bgm subject indexes 253"],
    ["https://bgm.tv/subject/253/ep", "bgm episode list 253"],
    ["https://bgm.tv/subject/topic/1", "bgm subject topic 1"],
    ["https://bgm.tv/subject/topic/1#post_2", "bgm subject post 2"],
    ["https://bgm.tv/subject/253/comments?type=do", "bgm subject comments 253 --type doing"],
  ];
  for (const [url, expected] of cases) {
    it(`${url} -> ${expected}`, () => assert.strictEqual(line(url), expected));
  }

  it("should reject the fake /discussion path with a suggestion", () => {
    assert.throws(() => resolveBangumiUrl("https://bgm.tv/subject/253/discussion"), (error) => {
      assert.match(error.message, /Did you mean: bgm subject get 253/);
      return true;
    });
  });
});

describe("resolveBangumiUrl: group", () => {
  const cases = [
    ["https://bangumi.tv/group/topic/469977", "bgm group topic 469977"],
    ["https://bangumi.tv/group/topic/469977#post_4029724", "bgm group post 4029724"],
    ["https://bgm.tv/group/boring", "bgm group get boring"],
    ["https://bgm.tv/group/boring/forum", "bgm group topics boring"],
    ["https://bgm.tv/group/boring/members", "bgm group members boring"],
    ["https://bgm.tv/group/boring/members?role=member", "bgm group members boring --role member"],
    ["https://bgm.tv/group/category/all", "bgm group list --mode all"],
  ];
  for (const [url, expected] of cases) {
    it(`${url} -> ${expected}`, () => assert.strictEqual(line(url), expected));
  }
});

describe("resolveBangumiUrl: mono, blog, index, episode", () => {
  const cases = [
    ["https://bgm.tv/ep/519", "bgm episode get 519"],
    ["https://bgm.tv/character/1", "bgm character get 1"],
    ["https://bgm.tv/character/1/collections", "bgm character collects 1"],
    ["https://bgm.tv/character/1/indices", "bgm character indexes 1"],
    ["https://bgm.tv/character/1/album", "bgm character photos 1"],
    ["https://bgm.tv/person/1", "bgm person get 1"],
    ["https://bgm.tv/person/1/works", "bgm person works 1"],
    ["https://bgm.tv/person/1/works/voice", "bgm person works 1"],
    ["https://bgm.tv/person/1/collabs", "bgm person relations 1"],
    ["https://bgm.tv/person/1/album", "bgm person photos 1"],
    ["https://bgm.tv/blog/1", "bgm blog get 1"],
    ["https://bgm.tv/blog/1/photos", "bgm blog photos 1"],
    ["https://bgm.tv/index/1", "bgm index get 1"],
    ["https://bgm.tv/index/1/comments", "bgm index comments 1"],
  ];
  for (const [url, expected] of cases) {
    it(`${url} -> ${expected}`, () => assert.strictEqual(line(url), expected));
  }
});

describe("resolveBangumiUrl: user and collections", () => {
  const cases = [
    ["https://bgm.tv/user/snape", "bgm user get snape"],
    ["https://bgm.tv/user/snape/timeline", "bgm timeline user snape"],
    ["https://bgm.tv/user/snape/blog", "bgm blog list --user snape"],
    ["https://bgm.tv/user/snape/index", "bgm index user snape"],
    ["https://bgm.tv/user/snape/friends", "bgm user friends snape"],
    ["https://bgm.tv/user/snape/followers", "bgm user followers snape"],
    ["https://bgm.tv/user/snape/groups", "bgm group user snape"],
    ["https://bgm.tv/user/snape/mono/character", "bgm collection characters --user snape"],
    ["https://bgm.tv/user/snape/mono/person", "bgm collection persons --user snape"],
    ["https://bgm.tv/anime/list/snape", "bgm collection list --user snape --type anime"],
    ["https://bgm.tv/anime/list/snape/wish", "bgm collection list --user snape --type anime --status wish"],
    ["https://bgm.tv/anime/list/snape/do", "bgm collection list --user snape --type anime --status doing"],
    ["https://bgm.tv/book/list/snape/collect", "bgm collection list --user snape --type book --status collect"],
    ["https://bgm.tv/game/list/snape/on_hold", "bgm collection list --user snape --type game --status on_hold"],
    ["https://bgm.tv/real/list/snape/dropped", "bgm collection list --user snape --type real --status dropped"],
  ];
  for (const [url, expected] of cases) {
    it(`${url} -> ${expected}`, () => assert.strictEqual(line(url), expected));
  }

  it("should refuse the ambiguous /mono page and suggest both commands", () => {
    assert.throws(() => resolveBangumiUrl("https://bgm.tv/user/snape/mono"), (error) => {
      assert.match(error.message, /collection characters --user snape/);
      assert.match(error.message, /collection persons --user snape/);
      return true;
    });
  });
});

describe("resolveBangumiUrl: browse and search", () => {
  const cases = [
    ["https://bgm.tv/anime/browser", "bgm subject list --type anime"],
    ["https://bgm.tv/anime/browser?sort=rank", "bgm subject list --type anime --sort rank"],
    ["https://bgm.tv/anime/browser?sort=nonsense", "bgm subject list --type anime"],
    ["https://bgm.tv/anime/tag/科幻", "bgm subject list --type anime --tag 科幻"],
    ["https://bgm.tv/subject_search/EVA", "bgm subject search EVA"],
    ["https://bgm.tv/subject_search/EVA?cat=2", "bgm subject search EVA --type anime"],
    ["https://bgm.tv/subject_search/EVA?cat=1&sort=rank", "bgm subject search EVA --type book --sort rank"],
    ["https://bgm.tv/mono_search/EVA?cat=1", "bgm character search EVA"],
    ["https://bgm.tv/mono_search/EVA?cat=2", "bgm person search EVA"],
    ["https://bgm.tv/calendar", "bgm calendar all"],
    ["https://bgm.tv/timeline", "bgm timeline list"],
    ["https://bgm.tv/notify", "bgm notify list"],
  ];
  for (const [url, expected] of cases) {
    it(`${url} -> ${expected}`, () => assert.strictEqual(line(url), expected));
  }
});

describe("resolveBangumiUrl: api.bgm.tv", () => {
  const cases = [
    ["https://api.bgm.tv/v0/subjects/253", "bgm subject get 253"],
    ["https://api.bgm.tv/v0/subjects/253/characters", "bgm subject characters 253"],
    ["https://api.bgm.tv/v0/subjects/253/persons", "bgm subject staff 253"],
    ["https://api.bgm.tv/v0/subjects/253/subjects", "bgm subject relations 253"],
    ["https://api.bgm.tv/v0/episodes/519", "bgm episode get 519"],
    ["https://api.bgm.tv/v0/episodes?subject_id=253", "bgm episode list 253"],
    ["https://api.bgm.tv/v0/characters/1", "bgm character get 1"],
    ["https://api.bgm.tv/v0/persons/1", "bgm person get 1"],
    ["https://api.bgm.tv/v0/persons/1/subjects", "bgm person works 1"],
    ["https://api.bgm.tv/v0/users/snape", "bgm user get snape"],
    ["https://api.bgm.tv/v0/users/snape/collections", "bgm collection list --user snape"],
    ["https://api.bgm.tv/v0/indices/1", "bgm index get 1"],
    ["https://api.bgm.tv/v0/indices/1/subjects", "bgm index related 1 --cat subject"],
    ["https://api.bgm.tv/v0/me", "bgm user me"],
    ["https://api.bgm.tv/calendar", "bgm calendar all"],
  ];
  for (const [url, expected] of cases) {
    it(`${url} -> ${expected}`, () => assert.strictEqual(line(url), expected));
  }
});

describe("resolveBangumiUrl: cross-host equivalence", () => {
  for (const host of ["bgm.tv", "bangumi.tv", "chii.in", "next.bgm.tv"]) {
    it(`${host} resolves like bgm.tv`, () => {
      assert.strictEqual(line(`https://${host}/group/topic/469977#post_4029724`), "bgm group post 4029724");
      assert.strictEqual(line(`https://${host}/subject/253`), "bgm subject get 253");
    });
  }
});

describe("resolveBangumiUrl: paging", () => {
  it("should leave page=1 alone", () => {
    assert.strictEqual(line("https://bgm.tv/subject/253/comments?page=1"), "bgm subject comments 253");
  });

  it("should turn page=3 into a pinned limit and offset", () => {
    assert.strictEqual(
      line("https://bgm.tv/subject/253/comments?page=3"),
      "bgm subject comments 253 --limit 20 --offset 40",
    );
  });

  it("should honour an explicit limit when computing the offset", () => {
    assert.strictEqual(
      line("https://bgm.tv/subject/253/comments?page=3&limit=10"),
      "bgm subject comments 253 --limit 10 --offset 20",
    );
  });

  it("should prefer an explicit offset over page", () => {
    assert.strictEqual(
      line("https://bgm.tv/subject/253/comments?page=3&offset=5"),
      "bgm subject comments 253 --limit 20 --offset 5",
    );
  });

  it("should ignore unknown query keys", () => {
    assert.strictEqual(line("https://bgm.tv/subject/253?utm_source=x&foo=bar"), "bgm subject get 253");
  });
});

describe("resolveBangumiUrl: errors", () => {
  it("should reject an unsupported host", () => expectError("https://example.com/subject/253"));
  it("should reject a non-numeric subject id", () => expectError("https://bgm.tv/subject/abc"));
  it("should reject an unknown top-level path", () => expectError("https://bgm.tv/settings"));
  it("should reject the site homepage", () => expectError("https://bgm.tv/"));

  it("should point rakuen group topic links at the group command", () => {
    assert.throws(() => resolveBangumiUrl("https://bangumi.tv/rakuen/topic/group/469977"), (error) => {
      assert.match(error.message, /Did you mean: bgm group topic 469977/);
      return true;
    });
  });

  it("should point rakuen subject topic links at the subject command", () => {
    assert.throws(() => resolveBangumiUrl("https://bangumi.tv/rakuen/topic/subject/1"), (error) => {
      assert.match(error.message, /Did you mean: bgm subject topic 1/);
      return true;
    });
  });
});

describe("splitUrlArgs", () => {
  it("should read the url from the first positional", () => {
    const parsed = splitUrlArgs(["https://bgm.tv/subject/253", "--verbose"]);
    assert.strictEqual(parsed.url, "https://bgm.tv/subject/253");
    assert.strictEqual(parsed.dryRun, false);
    assert.deepStrictEqual(parsed.passthrough, ["--verbose"]);
  });

  it("should not let --dry-run swallow the url", () => {
    const parsed = splitUrlArgs(["--dry-run", "https://bgm.tv/subject/253"]);
    assert.strictEqual(parsed.url, "https://bgm.tv/subject/253");
    assert.strictEqual(parsed.dryRun, true);
    assert.deepStrictEqual(parsed.passthrough, []);
  });

  it("should keep flag order for passthrough", () => {
    const parsed = splitUrlArgs(["https://bgm.tv/subject/253", "--limit", "5", "--offset", "1"]);
    assert.deepStrictEqual(parsed.passthrough, ["--limit", "5", "--offset", "1"]);
  });
});

describe("parseGlobalArgs --url", () => {
  it("should read --url <value>", () => {
    assert.strictEqual(parseGlobalArgs(["--url", "https://bgm.tv/subject/253"]).url, "https://bgm.tv/subject/253");
  });

  it("should read --url=<value>", () => {
    assert.strictEqual(parseGlobalArgs(["--url=https://bgm.tv/subject/253"]).url, "https://bgm.tv/subject/253");
  });

  it("should accept the -url alias", () => {
    assert.strictEqual(parseGlobalArgs(["-url", "https://bgm.tv/subject/253"]).url, "https://bgm.tv/subject/253");
    assert.strictEqual(parseGlobalArgs(["-url=https://bgm.tv/subject/253"]).url, "https://bgm.tv/subject/253");
  });

  it("should reject a missing value", () => {
    assert.throws(() => parseGlobalArgs(["--url"]), { name: "CommandError" });
    assert.throws(() => parseGlobalArgs(["--url="]), { name: "CommandError" });
  });

  it("should leave other args untouched", () => {
    const parsed = parseGlobalArgs(["--json", "--url", "https://bgm.tv/subject/253", "--dry-run"]);
    assert.strictEqual(parsed.json, true);
    assert.deepStrictEqual(parsed.args, ["--dry-run"]);
  });
});

describe("url command end to end (offline)", () => {
  function run(args) {
    return spawnSync("node", ["src/cli.js", ...args], { encoding: "utf-8", cwd: process.cwd() });
  }

  it("should resolve a bare url via --dry-run", () => {
    const result = run(["https://bangumi.tv/group/topic/469977#post_4029724", "--dry-run"]);
    assert.strictEqual(result.status, 0);
    assert.match(result.stdout, /bgm group post 4029724/);
  });

  it("should resolve the url subcommand", () => {
    const result = run(["url", "https://bgm.tv/subject/253/characters", "--dry-run"]);
    assert.strictEqual(result.status, 0);
    assert.match(result.stdout, /bgm subject characters 253/);
  });

  it("should resolve the --url flag with json output", () => {
    const result = run(["--json", "--url", "https://bgm.tv/ep/519", "--dry-run"]);
    assert.strictEqual(result.status, 0);
    const payload = JSON.parse(result.stdout);
    assert.strictEqual(payload.resource, "url-resolve");
    assert.strictEqual(payload.command, "episode get");
    assert.deepStrictEqual(payload.args, ["519"]);
  });

  it("should forward extra flags into the resolved command", () => {
    const result = run(["https://bgm.tv/subject/253/comments", "--limit", "5", "--dry-run", "--json"]);
    assert.strictEqual(result.status, 0);
    assert.deepStrictEqual(JSON.parse(result.stdout).args, ["253", "--limit", "5"]);
  });

  it("should fail with a suggestion on an unsupported path", () => {
    const result = run(["https://bgm.tv/subject/1234/wiki", "--dry-run"]);
    assert.notStrictEqual(result.status, 0);
    assert.match(result.stderr + result.stdout, /Did you mean: bgm subject get 1234/);
  });

  it("should show url help", () => {
    const result = run(["url", "--help"]);
    assert.strictEqual(result.status, 0);
    assert.match(result.stdout, /Supported hosts/);
  });
});
