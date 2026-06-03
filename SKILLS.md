# bgm-cli Agent Skill Index

This repository publishes its canonical skills under the standard top-level `skills/` directory so tools such as `npx skills add` can discover them directly.

The skill set is intentionally consolidated into two jobs:

- operating `bgm-cli` for end users
- developing the `bgm-cli` repository itself

Those are the two supported primary entrypoints.

## Skills

### Operate `bgm-cli`

Use this when an agent needs to install or run `bgm` on behalf of a user:

- [skills/bgm-cli-operate/SKILL.md](skills/bgm-cli-operate/SKILL.md)

This skill covers:

- executable detection
- first-time installation on macOS, Linux, or Windows
- choosing between managed install and repo-local install-path setup
- auth bootstrap with `bgm --init` / `bgm auth login` as the recommended official login path, while keeping Access Token as the second channel
- subject, episode, group, user, collection, blog, and timeline operations
- hosted-official-first Turnstile-aware write flows with local fallback
- Bangumi-specific episode and NSFW behavior constraints that matter during operation
- troubleshooting and supported-scope boundaries

### Develop `bgm-cli`

Use this when an agent needs to change code or docs in this repository:

- [skills/bgm-cli-develop/SKILL.md](skills/bgm-cli-develop/SKILL.md)

This skill covers:

- repository scope and entrypoints
- file ownership and layering rules
- auth, collection, episode-progress, and output behavior constraints
- documentation placement rules
- lightweight default verification

## Discovery Notes

- published installable skill payloads live under `skills/`
- `docs/skills/README.md` remains the repository-owned skill index
- the repository does not ship duplicate skill payloads under `docs/skills/`

## Recommended Starting Points

If the task is to operate the CLI:

1. [skills/bgm-cli-operate/SKILL.md](skills/bgm-cli-operate/SKILL.md)
2. [skills/bgm-cli-operate/references/install-and-auth.md](skills/bgm-cli-operate/references/install-and-auth.md)
3. [skills/bgm-cli-operate/references/commands.md](skills/bgm-cli-operate/references/commands.md)

If the task is to develop the repository:

1. `README.md`
2. [skills/bgm-cli-develop/SKILL.md](skills/bgm-cli-develop/SKILL.md)
3. [docs/skills/README.md](docs/skills/README.md)
