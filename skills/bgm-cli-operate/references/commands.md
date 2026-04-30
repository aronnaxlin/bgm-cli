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
bgm episode --help
bgm --json config show
bgm auth status
bgm auth session-status
```

Use `bgm --help` for the compact overview only. For detailed command discovery, prefer `bgm <group> --help`.

## User Reads

```bash
bgm --json user me
bgm --json user get sai
```

## Subject Reads

```bash
bgm --json subject get 12
bgm subject get 12 --verbose
bgm --json subject list --type anime --sort rank --limit 10
bgm --json subject search "Ghost in the Shell" --type anime --limit 5
```

## Episode Reads

```bash
bgm --json episode list 253 --type main --limit 5
bgm --json episode list 253 --type sp --limit 5
bgm --json episode list 253 --type op_ed --limit 10
```

Operational notes:

- `episode watch` only works by main-story episode number
- `episode status` works by concrete `episode_id`
- NSFW / R18 subjects may return a misleading `404` when no token is attached
- parent subjects must already be collected before episode progress can be changed

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

Preferred path: let the CLI obtain a token automatically through Bangumi's hosted official Turnstile page.

```bash
bgm group create-topic boring "Title" "Content"
bgm group reply 498114 "Reply content"
```

With an explicit Turnstile token:

```bash
bgm group create-topic boring "Title" "Content" --turnstile-token YOUR_TOKEN
bgm group reply 498114 "Reply content" --turnstile-token YOUR_TOKEN
```

Using the built-in local helper flow explicitly:

```bash
bgm group create-topic boring "Title" "Content"
bgm group reply 498114 "Reply content"
bgm group create-topic boring "Title" "Content" --manual --port 8765
bgm group reply 498114 "Reply content" --manual --port 8765
```

### Agent posting Turnstile human-in-the-loop flow

When an agent is creating a group topic or reply on behalf of a user, the agent cannot complete the Turnstile CAPTCHA itself. Follow this verified workflow:

1. **Attempt the post directly**:
   ```bash
   bgm group create-topic dev "Title" "Content"
   ```
   The CLI will fail with `Turnstile verification is required`.

2. **Generate the official Turnstile URL**:
   ```bash
   bgm auth turnstile
   ```
   The CLI prints an official Bangumi Turnstile URL. In most agent environments, automatic browser launch is unavailable and the command will time out — this is expected.

3. **Send the URL to the user**:
   Copy the printed URL and send it to the user. The user opens it in their browser, completes the CAPTCHA, and is redirected to the hosted callback.

4. **Receive the token from the user**:
   After the user completes verification, the callback URL contains a `token` query parameter. The user copies the full callback URL (or just the token string) and sends it back to the agent.

5. **Re-run the post with the token**:
   ```bash
   bgm group create-topic dev "Title" "Content" --turnstile-token "YOUR_TOKEN"
   ```

The same flow applies to `group reply`, `timeline say`, `timeline reply`, and experimental `blog reply`.

## Blog Reads [New]

```bash
bgm --json blog list --user sai --limit 10
bgm --json blog get 371953
bgm --json blog comments 371953
bgm --json blog photos 371953
bgm --json blog subjects 371953
```

## Blog Writes [Experimental]

Preferred path: let the CLI try Bangumi's hosted official Turnstile page first.

```bash
bgm blog reply 371953 "Reply content"
```

With an explicit Turnstile token:

```bash
bgm blog reply 371953 "Reply content" --turnstile-token YOUR_TOKEN
bgm blog edit-comment 123456 "Updated content"
bgm blog delete-comment 123456
```

Using the built-in local helper flow for reply only:

```bash
bgm blog reply 371953 "Reply content"
bgm blog reply 371953 "Reply content" --manual --port 8765
```

Treat these as experimental. Current Bangumi-side behavior may still fail even with a fresh token.

## Timeline Reads [New]

```bash
bgm --json timeline list --mode friends --limit 10
bgm --json timeline user sai --limit 10
bgm --json timeline replies 123456
```

## Timeline Writes [New]

Preferred path: let the CLI try Bangumi's hosted official Turnstile page first.

```bash
bgm timeline say "off work"
bgm timeline reply 123456 "seen"
```

With an explicit Turnstile token:

```bash
bgm timeline say "off work" --turnstile-token YOUR_TOKEN
bgm timeline reply 123456 "seen" --turnstile-token YOUR_TOKEN
```

Using the built-in local helper flow explicitly:

```bash
bgm timeline say "off work" --manual --port 8765
bgm timeline reply 123456 "seen" --manual --port 8765
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

## Episode Writes

```bash
bgm episode watch 253 1
bgm episode status 103232 watched
bgm episode status 103232 queue
bgm episode status 103232 drop
bgm episode status 103232 remove
```

Write constraints observed in real Bangumi behavior:

- the parent subject must already be in the user's collection
- the parent collection does not need to be `doing`
- `wish`, `collect`, `doing`, `on_hold`, and `dropped` all currently allow episode writes

Search-first variants:

```bash
bgm collection status --search "Gundam" doing --pick 1
bgm collection rate --search "Heike Monogatari" 8 --pick 1
bgm collection comment --search "Heike Monogatari" "Backfill" --pick 1
```

## Verification After Writes

```bash
bgm --json collection get 348335
bgm --json collection get 253
bgm --json group topic 498114
bgm --json blog comments 371953
bgm --json timeline user - --limit 5
```

Use this when:

- the user needs strong confirmation
- the write result was terse
- the command depended on search and pick resolution
- the final visible state matters
