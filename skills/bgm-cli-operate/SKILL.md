---
name: "bgm-cli-operate"
description: "Use to install, configure, authenticate, and run bgm-cli for Bangumi operations: subjects, episodes, books, collections, user data, groups, blogs, timelines, notifications, and Turnstile-gated writes."
---

# bgm-cli Operate

Operate `bgm-cli` on macOS, Linux, or Windows. Prefer non-interactive CLI commands and `--json` for automation.

## Discovery and Runtime Context

Do not rely on memorized command flags or references. Query runtime commands directly:

```bash
bgm --help                       # Compact command overview
bgm <group> --help               # Subcommands and flags (e.g., bgm episode --help)
bgm --skill operate <reference>  # Built-in reference documents:
                                 # commands, install-and-auth, troubleshooting,
                                 # community-boundaries, reactions
```

## Setup and Auth

1. Executable check: Try `bgm`, then `./bgm`. If missing, follow `references/install-and-auth.md`.
2. Authentication flow:
   - Guided login: `bgm --init` or `bgm auth login`.
   - Access token: `bgm auth set-token <token>`.
   - Check state: `bgm auth status` or `bgm user me`.

## Operational Guidelines

- JSON automation: Pass `--json` for machine-readable output.
- Link resolution: Pass Bangumi URLs directly to `bgm "<url>"` or `bgm url "<url>"` instead of manual URL parsing. Use `--dry-run` to preview offline. Always quote URLs containing `#`.
- Episodes vs. books:
  - Anime, games, and real subjects: Use `bgm episode` (`episode watch`, `episode status`).
  - Books: Use `bgm book` (`book ep`, `book vol`).
  - Prerequisite: Subject must be in collection first.
- Turnstile CAPTCHA:
  - Gated writes (topic creation, replies, comments, timeline posts) require Cloudflare verification.
  - In agent environments without a local browser, run `bgm auth turnstile`, output the URL for the user to complete manually, then pass the returned token via `--turnstile-token <token>`.
- Reactions (贴贴): Stickers use fixed integer IDs (e.g., `140` for +1). See `references/reactions.md`.
- Write verification: Query updated state after write operations (e.g., `bgm --json collection get <id>`).

## Quick Reference

```bash
bgm --json user me
bgm --json subject get <id>
bgm --json subject search "<keyword>" --type anime --limit 5
bgm --json collection get <id>
bgm --json collection status <id> <wish|collect|doing|on_hold|dropped>
bgm --json episode list <id> --type main --limit 10
bgm episode watch <subject_id> <ep_number>
bgm book ep <subject_id> <chapter>
bgm group topic <topic_id>
bgm group reply <topic_id> "<content>" --turnstile-token <token>
bgm "<bangumi_url>"
```
