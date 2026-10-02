/**
 * Serves the bundled agent skills (skills/<name>/SKILL.md) verbatim, so an agent
 * can read them from the CLI instead of relying on a copied or linked skill
 * directory that may be missing or stale. Nothing here touches config or login.
 */

import { readFileSync, readdirSync } from "node:fs";
import { CommandError } from "../core/output.js";

const SKILLS_DIR = new URL("../../skills/", import.meta.url);

export const DEFAULT_SKILL = "operate";

const SKILL_DIRS = {
  operate: "bgm-cli-operate",
  develop: "bgm-cli-develop",
};

function resolveSkillDir(name) {
  const key = String(name).replace(/^bgm-cli-/, "");
  const dir = SKILL_DIRS[key];
  if (!dir) {
    throw new CommandError(
      `Unknown skill "${name}". Available: ${Object.keys(SKILL_DIRS).join(", ")}.`,
    );
  }
  return dir;
}

function listReferences(dir) {
  try {
    return readdirSync(new URL(`${dir}/references/`, SKILLS_DIR))
      .filter((file) => file.endsWith(".md"))
      .map((file) => file.slice(0, -3))
      .sort();
  } catch {
    return [];
  }
}

/**
 * Return the raw text of a skill's SKILL.md, or of one of its references/*.md
 * when `reference` is given (with or without the .md suffix).
 */
export function readSkill(name = DEFAULT_SKILL, reference) {
  const dir = resolveSkillDir(name);

  if (reference === undefined) {
    return readFileSync(new URL(`${dir}/SKILL.md`, SKILLS_DIR), "utf8");
  }

  const ref = String(reference).replace(/\.md$/, "");
  const available = listReferences(dir);
  if (!available.includes(ref)) {
    const hint = available.length > 0 ? `Available: ${available.join(", ")}.` : "This skill has no references.";
    throw new CommandError(`Unknown reference "${reference}" for skill "${name}". ${hint}`);
  }
  return readFileSync(new URL(`${dir}/references/${ref}.md`, SKILLS_DIR), "utf8");
}
