---
name: "bgm-cli-develop"
description: "Use when contributing to or modifying the bgm-cli codebase: code conventions, architecture mapping, testing requirements, release workflows, and Bangumi domain quirks."
---

# bgm-cli Develop

Guidance for developing and maintaining the `bgm-cli` repository.

## Architecture and File Ownership

Follow the three-tier structure:

- API transport (`src/core/client.js`, `src/core/http.js`): Bangumi REST client, request transport, error normalization.
- Configuration and formatting (`src/core/config.js`, `src/core/output.js`): Config persistence, JSON passthrough, table and human rendering. Non-API strings must be English only.
- Command routing (`src/cli.js`, `src/commands/*.js`): CLI argument parsing, subcommands, and high-level workflows.

For self-hosted backend code, see `oauth-backend/src/`. Installation scripts live under `scripts/`.

## Key Conventions and Domain Quirks

- Command style: Use positional subcommands for actions (e.g., `bgm calendar all`, not `--all`). Flags are reserved for options (e.g., `--limit 5`).
- Arg parsing in `main()`: Flag tokens can occupy the `command` slot if placed immediately after the group. Merge `--` prefixed `command` arguments back into `args` when checking flags.
- Dual-channel auth:
  - Official web session (`p1` cookie) takes precedence.
  - Personal Access Token acts as fallback.
  - Never double-send session cookies and Access Tokens on `p1` requests.
- Episode vs. book progress:
  - Anime/game/real uses dedicated episode endpoints.
  - Books use `book` commands (`ep_status` / `vol_status`).
  - Both require the subject to exist in the user's collection before updating progress.
- Link resolution: Maintained in `src/utils/bangumi-url.js`. Keep host handling and fragment routing aligned with web URL structures.

## Verification Checklist

Run checks and test suite before submitting changes:

```bash
node --check src/core/client.js
node --check src/core/output.js
node --check src/cli.js
npm test
```

Unit tests use Node.js built-in `node:test` and `node:assert`. Test CLI behavior (parsing, formatting, sorting) using mock data rather than repeatedly hitting upstream APIs.

## Release Process

Releases trigger automatically via git tags (`vX.Y.Z`). `package.json` holds a `0.0.0-dev` placeholder; do not bump versions manually in files. Push commits with `[skip release]` to bypass automated patch releases.
