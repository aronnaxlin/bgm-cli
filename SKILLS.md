# bgm-cli Agent Skill Index

This repository no longer ships an auto-trigger skill for repository development under `.codex/skills`.

That change is intentional. The previous skill mixed two different jobs:

- helping an agent develop `bgm-cli`
- helping an agent use `bgm-cli` as a Bangumi command-line tool

Those are different tasks and should not share the same trigger surface.

## What This Index Is For

This file now points future agents to the operator-facing skill for using `bgm` as a CLI tool.

It is not a repository-development onboarding guide.

## Operator Skill

Use this when an agent needs to run `bgm` or `./bgm` on behalf of a user:

- [docs/agent-skills/bgm-cli-cli-operator/SKILL.md](/home/aronnax/code/bgm-cli/docs/agent-skills/bgm-cli-cli-operator/SKILL.md)

That skill is written for:

- auth checks
- profile reads
- subject search
- collection reads and writes
- normal non-TUI command execution
- machine-readable JSON output

That skill is explicitly not for:

- editing this repository
- understanding source ownership
- changing command behavior
- changing auth internals
- changing config persistence

## Why The Path Changed

The operator skill is intentionally stored outside `.codex/skills`.

Reason:

- future agents can still read and use it deliberately
- automatic local skill discovery will not treat it as a development skill for this repo
- development sessions stay focused on source docs and code instead of loading an end-user CLI operation guide

## If An Agent Needs To Develop `bgm-cli`

Do not use the operator skill.

Read these directly instead:

1. `README.md`
2. `docs/ai/bgm-cli-non-tui/README.md`
3. `docs/ai/bgm-cli-non-tui/references/source-map.md`
4. `docs/ai/bgm-cli-non-tui/references/config-and-auth.md` when auth or config is involved
5. `docs/ai/bgm-cli-non-tui/references/collection-semantics.md` when collection logic is involved

## If An Agent Needs To Operate The CLI

Start with:

1. [docs/agent-skills/bgm-cli-cli-operator/SKILL.md](/home/aronnax/code/bgm-cli/docs/agent-skills/bgm-cli-cli-operator/SKILL.md)
2. [docs/agent-skills/bgm-cli-cli-operator/references/commands.md](/home/aronnax/code/bgm-cli/docs/agent-skills/bgm-cli-cli-operator/references/commands.md)
3. [docs/agent-skills/bgm-cli-cli-operator/references/community-boundaries.md](/home/aronnax/code/bgm-cli/docs/agent-skills/bgm-cli-cli-operator/references/community-boundaries.md)
