# Skills

This directory contains the repository's agent-facing skills.

## Purpose

- keep all skill definitions under one stable documentation root
- make it easy to discover what each skill is for
- separate operator guidance from development-oriented docs under `docs/ai/`

## Available Skills

### `bgm-cli-cli-operator`

Location: `docs/skills/bgm-cli-cli-operator/SKILL.md`

Use this skill when an agent needs to operate `bgm` as a Bangumi CLI tool instead of editing this repository.

Main capabilities:

- check CLI availability and auth status
- inspect config and install-path related operator surfaces
- read the current user or a public user profile
- search subjects and fetch subject details
- read groups, group topics, and group member lists
- create group topics or replies with Turnstile-supported flows
- list, read, and update collections
- prefer deterministic non-interactive commands
- prefer machine-readable output with `--json`

### `bgm-cli-development-onboarding`

Location: `docs/skills/bgm-cli-development-onboarding/SKILL.md`

Use this skill when an agent needs a fast project introduction before starting repository development.

Main capabilities:

- explain what `bgm-cli` contains and what the main product surfaces are
- point to the right read order for development entrypoints
- map command handlers and core ownership boundaries
- give a practical starting workflow for code changes
- suggest the default verification path

### `bgm-cli-development-conventions`

Location: `docs/skills/bgm-cli-development-conventions/SKILL.md`

Use this skill when an agent is already editing the repository and needs the implementation rules and repo-specific conventions.

Main capabilities:

- define the repository's change philosophy and layering rules
- document auth, collection, and output behavior that should be preserved
- explain where different kinds of code should live
- define documentation placement and index update rules
- define lightweight default verification expectations

## Related Docs

- `SKILLS.md`: top-level skill index for agents
- `docs/README.md`: documentation layout overview
