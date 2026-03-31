# bgm-cli Skills

This repository includes agent-facing guidance so Codex or other coding agents can understand how to work on `bgm-cli` without guessing project conventions.

If an agent is touching this repo, start here.

## Primary Skill

### `bgm-cli-non-tui`

Use this skill for the non-TUI half of the project:

- Bangumi API client behavior
- config loading and persistence
- auth and token flows
- JSON and human-readable output
- collection semantics
- setup and install-path logic
- the optional `oauth-backend` service

Do not treat `bgm tui` as the default entrypoint for automation or repository understanding. This project's scriptable and source-driven behavior lives primarily in the ordinary CLI and core modules.

## Read Order

1. `README.md`
2. `docs/ai/bgm-cli-non-tui/references/source-map.md`
3. `docs/ai/bgm-cli-non-tui/references/config-and-auth.md` when the task touches config or auth
4. `docs/ai/bgm-cli-non-tui/references/collection-semantics.md` when the task touches collection writes or Bangumi-specific behavior

## Working Rules

- Prefer ordinary CLI commands and `--json` over `bgm tui` for implementation and verification.
- Treat direct access-token login as the stable and preferred auth path.
- Treat OAuth helper flows as secondary unless the task is explicitly about OAuth support or auth debugging.
- Treat the hosted `oauth-backend` as experimental, not the default user path.
- When changing collection write behavior, preserve existing Bangumi-specific constraints and post-write verification behavior.

## Ownership Map

- `src/cli.js`: command routing, init flow, and non-TUI business rules
- `src/core/client.js`: Bangumi API and OAuth clients
- `src/core/http.js`: request transport and error normalization
- `src/core/config.js`: config precedence and persistence
- `src/core/output.js`: human-readable and JSON output contracts
- `oauth-backend/src/*`: optional hosted OAuth backend

## Verification Defaults

- `node --check src/cli.js`
- `node --check src/core/client.js`
- `node --check src/core/config.js`
- `node --check src/core/http.js`
- `node --check src/core/output.js`
- `node src/cli.js --help`
- `node src/cli.js --json <command...>`

If a task depends on live Bangumi credentials, network access, or deployed backend behavior, separate static verification from live verification and state what was not tested.

## Public References

- `docs/ai/bgm-cli-non-tui/references/source-map.md`
- `docs/ai/bgm-cli-non-tui/references/config-and-auth.md`
- `docs/ai/bgm-cli-non-tui/references/collection-semantics.md`

## Codex Trigger File

Codex still uses the repository-local trigger file at `.codex/skills/bgm-cli-non-tui/SKILL.md`.

That file exists for automatic skill discovery. This `SKILLS.md` file is the public, top-level entrypoint you can link from the homepage.
