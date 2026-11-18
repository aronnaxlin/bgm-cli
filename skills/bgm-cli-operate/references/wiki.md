# Wiki batch creation

Use `bgm wiki create` with already prepared p1 JSON to create subjects, persons and characters, optionally with local images and subject episodes. It does not scrape, fetch remote images, clean text, generate infoboxes, search duplicates, edit existing entries or create associations. BNWH `infos[]` exports need conversion outside the CLI.

```bash
bgm --json wiki create --file batch.json --dry-run
bgm --json wiki create --file batch.json --report results.jsonl
bgm --json wiki create --file batch.json --report results.jsonl --resume
```

Input: `{ "version": 1, "items": [{ "key": "unique-key", "kind": "subject|person|character", "body": {} }] }`.

- `body` is the exact p1 create payload: subject fields directly, or `{ "person": {...} }` / `{ "character": {...} }`. Supply name, complete infobox text, summary and the appropriate type. Subjects also require platform, nsfw and metaTags; persons may include profession flags.
- `type` values: subject 1 book, 2 anime, 3 music, 4 game, 6 real; person 1 individual, 2 company, 3 group; character 1 character, 2 mecha, 3 ship, 4 organization.
- There is no `nameCN` field: a person's or character's Chinese name goes in the infobox as `简体中文名`.
- New persons and characters are created unlinked. Relations to subjects and voice-actor casts are outside this command and have to be added on the website afterwards.
- Optional `image`: exactly `{ "file": "./image.png" }` or `{ "base64": "raw padded base64" }`, decoded size at most 4 MiB. Do not combine it with a person's/character's native `img`. No image URLs or data URLs.
- Optional subject-only `episodes`: prepared p1 fields, with numeric `ep` required. Disc and episode numbering is supplied by the caller. The CLI batches at most 40 episodes per request.
- Server limits to plan around: music subjects (`type: 3`) are currently rejected with 400 because the server has no platform list for them. For anime and real subjects, an infobox with `话数` / `集数` makes the server insert that many blank episodes (up to 50) on creation, so also sending `episodes` produces a second set that p1 cannot delete; omit one of the two.
- `--file -` accepts JSON stdin. Image paths are relative to the JSON file, or cwd for stdin.
- Existing `--profile` and proxy options work. Writes execute directly without interactive confirmation. Follow the user's task authorization; this command does not add an Agent approval workflow.

For an authorized write, inspect dry-run diagnostics first. A dry run makes no API requests and cannot establish online permission or Wiki syntax validity. Inspect every item in actual JSON results: `succeeded`, `failed`, `partial`, `unknown`, `pending`; successful rows include created IDs. Progress is on stderr; any incomplete batch exits 1.

Use the same report with `--resume`. Never replace a report merely to bypass a failure: a new report can duplicate objects. Resume skips successful steps and rejects changes to them. Confirmed failures can be corrected, including a rejected episode chunk; episodes covered by a successful chunk must stay unchanged and keep their array positions. Authentication (401), permission (403) and rate-limit (429) failures stop the batch, as does a connection that could not be established; resume after resolving them.

An uncertain request (`unknown` or an unresolved `started` record) blocks the whole report. Inspect the actual online result; do not automatically retry, remove the record, or invent an ID. The CLI has no force-resend option. A lock left by a killed process can only be removed after verifying its owner has exited; removing the lock does not make an uncertain write retryable.

Full repository contract and examples: `docs/wiki-create.zh-CN.md`, `docs/examples/wiki-create.json`.
