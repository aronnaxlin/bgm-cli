# Command Reference

This reference is for agents operating `bgm-cli` as a user-facing tool.

## Preferred Patterns

- prefer `bgm --json <command...>` for reads
- prefer exact IDs over title search
- prefer ordinary CLI commands over `bgm tui`
- keep search result sets small
- re-read state after important writes

## Capability And Config

```bash
bgm --help
bgm --json config show
bgm auth status
bgm auth session-status
```

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

## Group Reads

```bash
bgm --json group list --sort members --limit 10
bgm --json group get boring
bgm --json group topics boring --limit 20
bgm --json group topic 498114
bgm --json group members boring --role member --limit 20
bgm --json group recent-topics --mode all --limit 10
bgm --json group latest-replies --limit 10
bgm --json group hot --window day --limit 10
bgm --json group hot-topics --window week --limit 10
```

## Group Writes

With an explicit Turnstile token:

```bash
bgm group create-topic boring "Title" "Content" --turnstile-token YOUR_TOKEN
bgm group reply 498114 "Reply content" --turnstile-token YOUR_TOKEN
```

Using the built-in local helper flow:

```bash
bgm group create-topic boring "Title" "Content"
bgm group reply 498114 "Reply content"
bgm group create-topic boring "Title" "Content" --manual --port 8765
bgm group reply 498114 "Reply content" --manual --port 8765
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
bgm collection comment --search "Heike Monogatari" "Backfill" --pick 1
```

## Verification After Writes

```bash
bgm --json collection get 348335
bgm --json group topic 498114
```

Use this when:

- the user needs strong confirmation
- the write result was terse
- the command depended on search and pick resolution
- the final visible state matters
