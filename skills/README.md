# Published Skills

This directory contains the repository's public, installable Agent Skills.

These packages are the canonical distribution surface for tools such as `npx skills add`.

The structure follows the standard Vercel / Agent Skills repository format:

- `skills/<skill-name>/SKILL.md`

Repository-local indexes and authoring notes live under `docs/skills/`.

## Available Skills

### `bgm-cli-operate`

Location: `skills/bgm-cli-operate/SKILL.md`

Use this when an agent needs to install `bgm-cli` if necessary and then operate it safely for an end user.

Main capabilities:

- detect whether `bgm` or `./bgm` is already available
- install `bgm-cli` on macOS, Linux, or Windows when it is missing
- choose between remote managed install and repository-local install-path flows
- set up auth with a preference for direct Access Token login
- run deterministic reads and supported writes after setup
- explain community boundaries and common troubleshooting steps

### `bgm-cli-develop`

Location: `skills/bgm-cli-develop/SKILL.md`

Use this when an agent needs to change code or docs in the `bgm-cli` repository itself.

Main capabilities:

- onboard quickly into repository structure and ownership
- apply implementation conventions and change boundaries
- preserve auth, collection, and output behavior
- use the lightweight default verification path

## Install Examples

List skills in this repository:

```bash
npx skills add aronnaxlin/bgm-cli --list
```

Install the operator skill for OpenCode globally:

```bash
npx skills add aronnaxlin/bgm-cli --skill bgm-cli-operate -g -a opencode -y
```

Install the development skill for Codex globally:

```bash
npx skills add aronnaxlin/bgm-cli --skill bgm-cli-develop -g -a codex -y
```

Install both skills from the current local checkout:

```bash
npx skills add . --skill bgm-cli-operate --skill bgm-cli-develop -a opencode -y
```
