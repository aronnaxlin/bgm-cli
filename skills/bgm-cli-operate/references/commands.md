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
bgm --version
bgm --help
bgm episode --help
bgm --json config show
bgm auth status
bgm auth session-status
bgm auth clear
```

Use `bgm --help` for the compact overview only. For detailed command discovery, prefer `bgm <group> --help`.

## User Reads

```bash
bgm --json user me
bgm --json user get sai
bgm --json user friends sai --limit 10
bgm --json user followers sai --limit 10
```

## Notifications

```bash
bgm --json notify --limit 10
bgm --json notify list --limit 10 --unread true
bgm notify clear 123456
bgm notify clear
```

Operational notes:

- `notify clear` with no IDs marks all notifications as read
- friend request notifications use notification type to produce a human-readable title; accepting or rejecting the request is not exposed through `notify`

## Subject Reads

```bash
bgm --json subject get 12
bgm subject get 12 --verbose
bgm --json subject list --type anime --sort rank --limit 10
bgm --json subject search "Ghost in the Shell" --type anime --limit 5
bgm --json subject comments 12 --limit 10
bgm --json subject topics 12 --limit 10
bgm --json subject recent-topics --limit 10
bgm --json subject topic 29892
bgm --json subject characters 12 --limit 10
bgm --json subject collects 12 --type doing --limit 10
bgm --json subject staff 12 --limit 10
bgm --json subject indexes 12 --limit 10
bgm --json subject relations 12 --limit 10
bgm --json subject recs 12 --limit 10
bgm --json trending subject-topics --limit 10
```

## Subject Topic Writes

Preferred path: let the CLI obtain a token automatically through Bangumi's hosted official Turnstile page.

```bash
bgm subject create-topic 12 "Title" "Content"
bgm subject reply 29892 "Reply content"
```

With an explicit Turnstile token:

```bash
bgm subject create-topic 12 "Title" "Content" --turnstile-token YOUR_TOKEN
bgm subject reply 29892 "Reply content" --reply-to 123456 --turnstile-token YOUR_TOKEN
bgm subject edit-topic 29892 "Updated title" "Updated content"
bgm subject post 123456
bgm subject edit-post 123456 "Updated reply"
bgm subject delete-post 123456
bgm subject like-post 123456 1
bgm subject unlike-post 123456
bgm subject like-collect 123456 1
bgm subject unlike-collect 123456
```

Operational notes:

- subject topic create/reply are Turnstile-gated
- edit/delete/reaction commands require the target to be valid for the current user and Bangumi-side permissions

## Episode Reads

```bash
bgm --json episode list 253 --type main --limit 5
bgm --json episode list 253 --type sp --limit 5
bgm --json episode list 253 --type op_ed --limit 10
bgm --json episode comments 103232
bgm --json episode comments 253 1
bgm --json episode comments 253 1 --type main
```

Operational notes:

- `episode watch` only works by main-story episode number
- `episode status` works by concrete `episode_id`
- `episode comments <subject_id> <episode_number>` resolves the concrete episode inside that subject first
- NSFW / R18 subjects may return a misleading `404` when no usable auth context is attached
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

Other timeline operations:

```bash
bgm timeline delete 123456
bgm timeline like 123456 1
bgm timeline unlike 123456
```

## Collection Reads

```bash
bgm --json collection list --status doing --type anime --sort updated
bgm --json collection list --user sai --type anime --limit 10 --offset 0
bgm --json collection get 348335
bgm --json collection get --search "Heike Monogatari" --pick 1
bgm --json collection characters --user sai --limit 10
bgm --json collection persons --user sai --limit 10
bgm --json collection indexes --user sai --limit 10
```

## Collection Writes

```bash
bgm collection collect 348335 collect
bgm collection status 348335 doing
bgm collection rate 348335 8
bgm collection comment 348335 "Backfill"
bgm collection collect-character 1
bgm collection uncollect-character 1
bgm collection collect-person 1
bgm collection uncollect-person 1
bgm collection collect-index 1
bgm collection uncollect-index 1
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

## Character Reads and Writes

```bash
bgm --json character search "夏娜" --limit 5
bgm --json character get 1
bgm --json character casts 1 --limit 10
bgm --json character collects 1 --limit 10
bgm --json character comments 1 --limit 10
bgm --json character indexes 1 --limit 10
bgm --json character photos 1 --limit 10
bgm --json character photos-preview 1 --limit 5
bgm --json character photo 1 123
bgm --json character photo-comments 1 123
bgm --json character relations 1 --limit 10
bgm character comment 1 "Comment content" --turnstile-token YOUR_TOKEN
bgm character edit-comment 123456 "Updated content"
bgm character delete-comment 123456
```

## Person Reads and Writes

```bash
bgm --json person search "坂本真綾" --career seiyu --limit 5
bgm --json person get 1
bgm --json person casts 1 --limit 10
bgm --json person collects 1 --limit 10
bgm --json person comments 1 --limit 10
bgm --json person indexes 1 --limit 10
bgm --json person photos 1 --limit 10
bgm --json person photos-preview 1 --limit 5
bgm --json person photo 1 123
bgm --json person photo-comments 1 123
bgm --json person relations 1 --limit 10
bgm --json person works 1 --limit 10
bgm person comment 1 "Comment content" --turnstile-token YOUR_TOKEN
bgm person edit-comment 123456 "Updated content"
bgm person delete-comment 123456
```

Operational notes:

- character/person comment creation is Turnstile-gated
- edit/delete commands require Bangumi-side permission on the comment

## Index Reads and Writes

```bash
bgm --json index get 1
bgm --json index comments 1
bgm --json index related 1 --cat subject --type anime --limit 10
bgm --json index user sai --limit 10
bgm index create "My Index" "Description" --private false
bgm index update 123 --title "New Title" --desc "New Description"
bgm index delete 123
bgm index comment 123 "Nice index" --turnstile-token YOUR_TOKEN
bgm index edit-comment 456 "Updated comment"
bgm index delete-comment 456
bgm index add-related 123 --cat subject --sid 348335 --order 1 --comment "Why"
bgm index update-related 123 456 --order 2 --comment "Updated"
bgm index delete-related 123 456
```

## Calendar Reads

```bash
bgm --json calendar
bgm --json calendar all
bgm --json calendar mon
bgm --json calendar tue
```

Operational notes:

- `calendar` with no subcommand defaults to today
- `calendar all` returns the full 7-day schedule
- weekday abbreviations are accepted (`mon`, `tue`, `wed`, `thu`, `fri`, `sat`, `sun`)

## Verification After Writes

```bash
bgm --json collection get 348335
bgm --json collection get 253
bgm --json group topic 498114
bgm --json subject topic 29892
bgm --json blog comments 371953
bgm --json character comments 1 --limit 5
bgm --json person comments 1 --limit 5
bgm --json timeline user - --limit 5
```

Use this when:

- the user needs strong confirmation
- the write result was terse
- the command depended on search and pick resolution
- the final visible state matters
