# bgm-cli Operator Command Reference

This reference is for agents using `bgm` as a CLI tool, not for repository development.

## Preferred Patterns

- Prefer `bgm --json <command...>` for reads.
- Prefer exact IDs over title search.
- Prefer ordinary commands over `bgm tui`.
- Prefer one-shot commands over interactive flows.

## Capability Check

```bash
bgm --help
bgm auth status
```

If global install is unavailable, try:

```bash
./bgm --help
./bgm auth status
```

## Auth

```bash
bgm auth status
bgm auth set-token YOUR_ACCESS_TOKEN
bgm auth login-url --state random-state
bgm auth token --code YOUR_CODE --save
bgm auth refresh --save
```

Preferred auth path for agents:

- direct token with `bgm auth set-token`

## User Reads

```bash
bgm --json user me
bgm --json user get sai
```

## Subject Reads

```bash
bgm --json subject get 12
bgm --json subject list --type anime --sort rank --limit 10
bgm --json subject search "Ghost in the Shell" --type anime --limit 5
```

## Collection Reads

```bash
bgm --json collection list --status doing --type anime --sort updated
bgm --json collection get 348335
bgm --json collection get --search "Heike Monogatari" --pick 1
```

## Collection Writes

```bash
bgm collection collect 348335 collect
bgm collection status 348335 doing
bgm collection rate 348335 8
bgm collection comment 348335 "Backfill"
```

Search-first variants:

```bash
bgm collection status --search "Gundam" doing --pick 1
bgm collection rate --search "Heike Monogatari" 8 --pick 1
```

## Verification After Writes

For important writes, re-read:

```bash
bgm --json collection get 348335
```

Use this when:

- the user needs confirmation
- the write result is terse
- the command depended on search and pick resolution
