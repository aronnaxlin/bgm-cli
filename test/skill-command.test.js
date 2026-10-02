import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import assert from "node:assert";

const root = path.resolve(import.meta.dirname, "..");
const emptyHome = mkdtempSync(path.join(tmpdir(), "bgm-skill-"));

after(() => rmSync(emptyHome, { recursive: true, force: true }));

// An empty HOME with no config, token or session, to prove --skill needs none of them.
function run(args) {
  const env = { ...process.env, HOME: emptyHome, XDG_CONFIG_HOME: path.join(emptyHome, ".config"), USERPROFILE: emptyHome };
  for (const key of Object.keys(env)) {
    if (key.startsWith("BGM_")) delete env[key];
  }
  return spawnSync("node", ["src/cli.js", ...args], { cwd: root, encoding: "utf8", env });
}

const read = (...parts) => readFileSync(path.join(root, "skills", ...parts), "utf8");

describe("bgm --skill", () => {
  it("should print the operate skill verbatim, frontmatter included, by default", () => {
    const result = run(["--skill"]);
    assert.strictEqual(result.status, 0);
    assert.strictEqual(result.stdout, read("bgm-cli-operate", "SKILL.md"));
    assert.ok(result.stdout.startsWith("---\nname: \"bgm-cli-operate\""));
  });

  it("should print the develop skill on request", () => {
    for (const name of ["develop", "bgm-cli-develop"]) {
      const result = run(["--skill", name]);
      assert.strictEqual(result.status, 0);
      assert.strictEqual(result.stdout, read("bgm-cli-develop", "SKILL.md"));
    }
  });

  it("should print a reference file verbatim", () => {
    for (const ref of ["reactions", "reactions.md"]) {
      const result = run(["--skill", "operate", ref]);
      assert.strictEqual(result.status, 0);
      assert.strictEqual(result.stdout, read("bgm-cli-operate", "references", "reactions.md"));
    }
  });

  it("should cover every reference the operate skill points at", () => {
    const skill = read("bgm-cli-operate", "SKILL.md");
    const names = [...skill.matchAll(/`references\/([\w-]+)\.md`/g)].map((match) => match[1]);
    assert.ok(names.length > 0);
    for (const name of new Set(names)) {
      assert.strictEqual(run(["--skill", "operate", name]).status, 0, `reference ${name}`);
    }
  });

  it("should fail clearly for an unknown skill or reference", () => {
    const skill = run(["--skill", "nope"]);
    assert.strictEqual(skill.status, 1);
    assert.match(skill.stderr, /Unknown skill "nope"\. Available: operate, develop/);
    assert.strictEqual(skill.stdout, "");

    const ref = run(["--skill", "operate", "nope"]);
    assert.strictEqual(ref.status, 1);
    assert.match(ref.stderr, /Unknown reference "nope".*Available: commands/);
  });

  it("should not treat --json as a skill name", () => {
    const result = run(["--skill", "--json"]);
    assert.strictEqual(result.status, 0);
    assert.strictEqual(result.stdout, read("bgm-cli-operate", "SKILL.md"));
  });

  it("should tell AI agents about it in --help", () => {
    const result = run(["--help"]);
    assert.strictEqual(result.status, 0);
    assert.match(result.stdout, /For AI agents/);
    assert.match(result.stdout, /If the bgm-cli skill is already in your context, skip this/);
    assert.match(result.stdout, /bgm --skill/);
  });
});

describe("published package", () => {
  it("should ship the skills directory", () => {
    const result = spawnSync("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], { cwd: root, encoding: "utf8" });
    assert.strictEqual(result.status, 0, result.stderr);
    const files = JSON.parse(result.stdout)[0].files.map((file) => file.path);
    assert.ok(files.includes("skills/bgm-cli-operate/SKILL.md"));
    assert.ok(files.includes("skills/bgm-cli-develop/SKILL.md"));
    assert.ok(files.includes("skills/bgm-cli-operate/references/commands.md"));
  });
});
