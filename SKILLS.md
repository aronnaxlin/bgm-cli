# bgm-cli Agent Skill Index

This repository no longer ships an auto-trigger skill for repository development under `.codex/skills`.

That change is intentional. The previous skill mixed two different jobs:

- helping an agent develop `bgm-cli`
- helping an agent use `bgm-cli` as a Bangumi command-line tool

Those are different tasks and should not share the same trigger surface.

## What This Index Is For

This file now points future agents to the operator-facing skill for using `bgm` as a CLI tool.

It is not a repository-development onboarding guide.

## Skills

### Operator Skill

Use this when an agent needs to run `bgm` or `./bgm` on behalf of a user:

- [docs/skills/bgm-cli-cli-operator/SKILL.md](docs/skills/bgm-cli-cli-operator/SKILL.md)

That skill is written for:

- auth checks
- config inspection and install-path setup when operating the CLI
- profile reads
- subject search and list/get reads
- group list, topic, member, and ranking reads
- group topic creation and replies when Turnstile flow is available
- collection reads and writes
- normal non-TUI command execution
- machine-readable JSON output

That skill is explicitly not for:

- editing this repository
- understanding source ownership
- changing command behavior
- changing auth internals
- changing config persistence

### Development Onboarding Skill

Use this when an agent needs to get into the repository quickly before making changes:

- [docs/skills/bgm-cli-development-onboarding/SKILL.md](docs/skills/bgm-cli-development-onboarding/SKILL.md)

That skill is written for:

- understanding repository scope
- finding the owning modules quickly
- choosing the right entrypoints before editing
- starting development safely
- default verification for source changes

### Development Conventions Skill

Use this when an agent is already implementing changes and needs repository-specific engineering rules:

- [docs/skills/bgm-cli-development-conventions/SKILL.md](docs/skills/bgm-cli-development-conventions/SKILL.md)

That skill is written for:

- smallest-correct-change guidance
- file ownership and layering rules
- auth and collection behavior constraints
- documentation placement rules
- verification expectations

## Why The Path Changed

The operator skill is intentionally stored under `docs/skills/` instead of `.codex/skills`.

Reason:

- future agents can still read and use it deliberately
- automatic local skill discovery will not treat it as a development skill for this repo
- development sessions stay focused on source docs and code instead of loading an end-user CLI operation guide

## If An Agent Needs To Develop `bgm-cli`

Do not use the operator skill as the primary development guide.

Start with these instead:

1. `README.md`
2. `docs/skills/bgm-cli-development-onboarding/SKILL.md`
3. `docs/skills/bgm-cli-development-conventions/SKILL.md`

## If An Agent Needs To Operate The CLI

Start with:

1. [docs/skills/bgm-cli-cli-operator/SKILL.md](docs/skills/bgm-cli-cli-operator/SKILL.md)
2. [docs/skills/bgm-cli-cli-operator/references/commands.md](docs/skills/bgm-cli-cli-operator/references/commands.md)
3. [docs/skills/bgm-cli-cli-operator/references/community-boundaries.md](docs/skills/bgm-cli-cli-operator/references/community-boundaries.md)
