# Skills Index

This directory is the repository-owned index for the published skills.

The canonical installable skill payloads now live only under the top-level `skills/` directory in the standard Agent Skills / Vercel-compatible format:

- `skills/<skill-name>/SKILL.md`

## Published Skills

### `bgm-cli-operate`

Location: `skills/bgm-cli-operate/SKILL.md`

Use this when an agent needs to get `bgm-cli` running for an end user and then operate it safely.

Main capabilities:

- detect whether `bgm` or `./bgm` is available
- install `bgm-cli` when missing
- choose between managed install and repo-local install-path setup
- set up Bangumi auth and verify the current user
- run normal reads and supported writes safely after setup

### `bgm-cli-develop`

Location: `skills/bgm-cli-develop/SKILL.md`

Use this when an agent needs to edit code or docs in this repository.

Main capabilities:

- fast repository onboarding
- ownership and entrypoint mapping
- implementation conventions and behavior constraints
- default verification for repository changes

## Why This Directory Still Exists

- it gives agents and humans one stable documentation index
- it avoids duplicating installable `SKILL.md` payloads under `docs/`
- it keeps repository docs and published skill packages separate

## Related Docs

- `SKILLS.md`: top-level skill index for agents
- `docs/README.md`: documentation layout overview
- `skills/README.md`: published skill distribution entrypoint
