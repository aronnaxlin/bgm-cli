# bgm-cli Non-TUI AI Guide

This is the canonical AI-facing guide for the non-TUI half of `bgm-cli`.

Use this guide when working on:

- Bangumi API client behavior
- config loading and persistence
- auth and token flows
- JSON and human-readable output
- collection semantics
- setup and install-path logic
- the optional `oauth-backend` service

Do not treat `bgm tui` as the default entrypoint for automation or repository understanding. This guide is for the scriptable and source-driven parts of the project.

## Auth maturity

Auth options are not equally mature:

- direct access-token login is the mature and preferred path
- CLI OAuth helper flows are supported but less mature
- hosted `oauth-backend` is experimental and should not be treated as the default user path

If a task can be solved through the token path, prefer that path.

## Quick start

1. Read `README.md` in the repository root for the public contract.
2. Read `references/source-map.md` for code ownership.
3. If the task touches config or auth, read `references/config-and-auth.md`.
4. If the task touches collection writes or Bangumi-specific constraints, read `references/collection-semantics.md`.
5. Prefer non-interactive verification and `--json` output when checking behavior.

## Default workflow

1. Decide whether the task is truly non-TUI.
2. Locate the owning layer.
   - command orchestration: `src/cli.js`
   - API and OAuth clients: `src/core/client.js`
   - config model: `src/core/config.js`
   - request transport and error normalization: `src/core/http.js`
   - output shaping: `src/core/output.js`
   - hosted OAuth service: `oauth-backend/src/*`
3. Read only the relevant reference file.
4. If the task involves auth, first check whether it should remain on the token path instead of expanding OAuth complexity.
5. Implement the narrowest change that preserves existing command semantics.
6. Verify using non-interactive commands.

## Verification defaults

- `node --check src/cli.js`
- `node --check src/core/client.js`
- `node --check src/core/config.js`
- `node --check src/core/http.js`
- `node --check src/core/output.js`
- `node --check oauth-backend/src/app.js`
- `node src/cli.js --help`
- `node src/cli.js --json <command...>`

If live Bangumi credentials or network access are required, state that explicitly and separate static verification from live verification.

## Reference files

- `references/source-map.md`
- `references/config-and-auth.md`
- `references/collection-semantics.md`
