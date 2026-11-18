import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { CommandError } from "../core/output.js";

export const IMAGE_SIZE_LIMIT = 4 * 1024 * 1024;
const PROFESSIONS = ["producer", "mangaka", "artist", "seiyu", "writer", "illustrator", "actor"];
const own = (value, key) => Object.hasOwn(value, key);
const fail = (message) => { throw new CommandError(message); };
const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const text = (value) => typeof value === "string";
const nonempty = (value) => text(value) && value.length > 0;
const number = (value) => typeof value === "number" && Number.isFinite(value);
const boolean = (value) => typeof value === "boolean";
const date = (value) => text(value) && /^\d{4}-\d{2}-\d{2}$/.test(value);

function fields(value, required, optional, label) {
  if (!object(value)) fail(`${label} must be an object.`);
  const rules = { ...required, ...optional };
  for (const key of Object.keys(required)) {
    if (!own(value, key)) fail(`${label}.${key} is required.`);
  }
  for (const key of Object.keys(value)) {
    if (!own(rules, key)) fail(`${label}.${key} is not supported.`);
    if (!rules[key](value[key])) fail(`${label}.${key} has an invalid type or value.`);
  }
}

export function validateBatch(batch) {
  fields(batch, { version: (v) => v === 1, items: Array.isArray }, {}, "batch");
  const keys = new Set();
  for (const item of batch.items) {
    if (object(item) && nonempty(item.key)) {
      if (keys.has(item.key)) fail(`Duplicate item key: ${item.key}`);
      keys.add(item.key);
    }
  }
  return batch;
}

export async function loadBatch(file, stdin = process.stdin) {
  let raw;
  if (file === "-") {
    if (stdin.isTTY) fail("--file - requires JSON on stdin.");
    const chunks = [];
    for await (const chunk of stdin) chunks.push(Buffer.from(chunk));
    raw = Buffer.concat(chunks).toString("utf8");
  } else {
    try { raw = await readFile(file, "utf8"); }
    catch (error) { fail(`Cannot read input file ${file}: ${error.code ?? error.message}`); }
  }
  let batch;
  try { batch = JSON.parse(raw.replace(/^\uFEFF/, "")); }
  catch { fail("Input is not valid JSON."); }
  return { batch: validateBatch(batch), baseDir: file === "-" ? process.cwd() : path.dirname(path.resolve(file)) };
}

export function validateBase64(value) {
  if (!nonempty(value)) fail("Image must be nonempty raw base64.");
  if (value.length > Math.ceil(IMAGE_SIZE_LIMIT / 3) * 4) fail("Image exceeds the decoded 4 MiB limit.");
  if (value.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) {
    fail("Image must be raw, padded base64 (not a URL or data URL).");
  }
  const bytes = Buffer.from(value, "base64");
  if (bytes.length > IMAGE_SIZE_LIMIT) fail("Image exceeds the decoded 4 MiB limit.");
  if (bytes.toString("base64") !== value) fail("Image is not canonical base64.");
  return value;
}

async function loadImage(image, baseDir) {
  fields(image, {}, { file: nonempty, base64: nonempty }, "image");
  if (own(image, "file") === own(image, "base64")) fail("image requires exactly one of file or base64.");
  if (own(image, "base64")) return validateBase64(image.base64);
  if (/^[a-z][a-z\d+.-]*:\/\//i.test(image.file)) fail("image.file must be a local path, not a URL.");
  const file = path.resolve(baseDir, image.file);
  let info;
  try { info = await stat(file); }
  catch (error) {
    if (error.code === "ENOENT") fail(`image.file does not exist: ${image.file}`);
    throw error;
  }
  if (!info.isFile()) fail("image.file must be a regular file.");
  if (info.size === 0) fail("image.file is empty.");
  if (info.size > IMAGE_SIZE_LIMIT) fail("Image exceeds the decoded 4 MiB limit.");
  return validateBase64((await readFile(file)).toString("base64"));
}

export async function prepareItem(input, baseDir) {
  fields(input, {
    key: nonempty,
    kind: (v) => ["subject", "person", "character"].includes(v),
    body: object,
  }, { image: object, episodes: Array.isArray }, "item");
  const { key, kind } = input;
  const body = structuredClone(input.body);
  if (kind === "subject") {
    fields(body, {
      name: nonempty, type: (v) => [1, 2, 3, 4, 6].includes(v),
      platform: Number.isInteger, infobox: nonempty, nsfw: boolean,
      metaTags: (v) => Array.isArray(v) && v.every(text), summary: text,
    }, { series: boolean, date }, "body");
  } else {
    fields(body, { [kind]: object }, {}, "body");
    fields(body[kind], {
      name: nonempty, infobox: nonempty, summary: text,
      type: (v) => (kind === "person" ? [1, 2, 3] : [1, 2, 3, 4]).includes(v),
    }, { img: text, ...(kind === "person" ? { profession: object } : {}) }, `body.${kind}`);
    if (own(body[kind], "profession")) {
      fields(body[kind].profession, {}, Object.fromEntries(PROFESSIONS.map((p) => [p, boolean])), "profession");
    }
    if (own(body[kind], "img")) validateBase64(body[kind].img);
    if (own(input, "episodes")) fail("episodes is only supported for subjects.");
    if (own(input, "image") && own(body[kind], "img")) fail("Use image or body image bytes, not both.");
  }
  const episodes = input.episodes ?? [];
  for (const [index, episode] of episodes.entries()) {
    fields(episode, { ep: number }, {
      name: text, nameCN: text, type: (v) => [0, 1, 2, 3, 4, 5, 6].includes(v),
      disc: number, duration: text, date, summary: text,
    }, `episodes[${index}]`);
  }
  const imageContent = own(input, "image") ? await loadImage(input.image, baseDir) : undefined;
  if (kind !== "subject" && imageContent !== undefined) body[kind].img = imageContent;
  return { key, kind, body, imageContent: kind === "subject" ? imageContent : undefined, episodes: structuredClone(episodes) };
}

export function digest(value) {
  function canonical(v) {
    if (Array.isArray(v)) return v.map(canonical);
    if (object(v)) return Object.fromEntries(Object.keys(v).sort().map((key) => [key, canonical(v[key])]));
    return v;
  }
  return createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
}

export function itemSteps(item, subjectId) {
  const resource = { subject: "subjects", person: "persons", character: "characters" }[item.kind];
  const steps = [{ step: "create", path: `/p1/wiki/${resource}`, body: item.body }];
  if (item.kind === "subject") {
    if (item.imageContent !== undefined) {
      steps.push({ step: "cover", path: `/p1/wiki/subjects/${subjectId}/covers`, body: { content: item.imageContent } });
    }
    for (let start = 0; start < item.episodes.length; start += 40) {
      steps.push({
        step: `episodes:${start / 40}`, path: `/p1/wiki/subjects/${subjectId}/ep`,
        body: { episodes: item.episodes.slice(start, start + 40) },
      });
    }
  }
  return steps.map((step) => ({ ...step, hash: digest({ method: "POST", path: step.path, body: step.body }) }));
}
