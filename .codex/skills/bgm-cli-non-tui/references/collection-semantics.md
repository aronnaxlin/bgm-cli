# Collection Semantics

## Command surface

Primary collection commands:

- `collection list`
- `collection get`
- `collection collect`
- `collection comment`
- `collection rate`
- `collection status`

These are implemented in `src/cli.js` and use `BangumiClient` from `src/core/client.js`.

## Target resolution

Collection commands can operate in two modes:

- direct `subject_id`
- `--search <keyword>` plus optional `--pick <n>`

Important behavior:

- if `--search` finds one subject, it is used automatically
- if multiple subjects are found and `--pick` is omitted, the CLI prompts only when stdin/stdout are TTYs
- in non-interactive contexts, multiple matches are an error and the caller must pass `--pick`

This matters for agents and scripts. Prefer explicit `subject_id` or `--pick`.

## Server-side Bangumi constraints already modeled here

- `wish` collections cannot hold a positive rating
- `rate 0` clears the rating
- `collection collect <subject_id> collect` is accepted as a shorthand status update
- subject uncollect is intentionally not exposed

Do not remove these constraints unless the Bangumi API behavior is clearly revalidated.

## Post-write verification

The repository does not always trust write responses blindly.

Notable pattern:

- some write commands read the collection back after the mutation
- rating and collect flows perform explicit persistence checks
- verification retries briefly before failing

Preserve this pattern when changing write behavior, especially for fields Bangumi may ignore under certain collection states.

## Filtering and sorting

`collection list` fetches all pages, then filters and sorts client-side.

Supported sort fields:

- `updated`
- `name`
- `rank`
- `community_score`
- `user_score`
- `date`

Aliases are normalized in `src/cli.js`. If you add a new sort mode, update both normalization and the actual sorter.

## Related helpers to inspect before changing behavior

- `resolveCollectionTarget`
- `selectSubjectFromSearch`
- `buildCollectionMutationPayload`
- `fetchMySubjectCollection`
- `fetchMySubjectCollectionVerified`
- `normalizeCollectionStatusValue`
- `normalizeRateValue`
- `fetchAllCollections`
- `sortCollections`

## Verification suggestions

Use `--json` when checking semantics so you can inspect exact values:

- `node src/cli.js --json collection get <subject_id>`
- `node src/cli.js --json collection list --status doing --type anime --limit 5`
- `node src/cli.js --json collection rate --search \"keyword\" 8 --pick 1`

If live Bangumi credentials are unavailable, limit yourself to syntax checks and explain that collection semantics were reasoned from code rather than exercised against the API.
