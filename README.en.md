# bgm-cli

[简体中文](./README.md) | [繁體中文（台灣）](./README.zh-TW.md) | [English](./README.en.md)

`bgm-cli` is a command-line tool for Bangumi focused on getting users productive quickly from a terminal.

## Quick Start

### Requirements

- Node.js `>= 20`

### Install

macOS / Linux:

```bash
curl -fsSL https://raw.githubusercontent.com/aronnaxlin/bgm-cli/main/scripts/install-remote.sh | sh
```

Windows PowerShell:

```powershell
irm https://raw.githubusercontent.com/aronnaxlin/bgm-cli/main/scripts/install-remote.ps1 | iex
```

If you already have a local checkout, you can also run:

```bash
./bgm --help
```

### Authentication

The recommended path is to use a Bangumi Access Token:

```bash
bgm --init
```

If you already have a token:

```bash
bgm auth set-token YOUR_ACCESS_TOKEN
bgm auth status
```

### Common Commands

```bash
bgm user me
bgm subject search "Heike Monogatari" --type anime --limit 5
bgm subject get 348335
bgm collection get 348335
bgm group list --sort members --limit 10
bgm --json user me
```

## Documentation Index

- This project also ships installable Skills for AI or agent workflows around `bgm-cli`.
- You can add this project's Skills with `npx skills add aronnaxlin/bgm-cli`.
- [`docs/README.md`](./docs/README.md): documentation entry
- [`docs/guide.zh-CN.md`](./docs/guide.zh-CN.md): product guide, recommended paths, install modes, and common usage
- [`docs/features.zh-CN.md`](./docs/features.zh-CN.md): full feature list and command index
- [`docs/implementation.zh-CN.md`](./docs/implementation.zh-CN.md): config model, output model, collection semantics, repository structure, and development notes
- [`docs/experimental.zh-CN.md`](./docs/experimental.zh-CN.md): experimental capabilities and notes on OAuth, Turnstile, private session, and hosted backend
- [`oauth-backend/README.md`](./oauth-backend/README.md): optional self-hosted OAuth backend deployment notes
- [`SKILLS.md`](./SKILLS.md): entrypoint for AI or agent usage

Detailed split documentation is currently maintained in Simplified Chinese under `docs/`.

## Core Risks And Boundaries

- This project is not an official Bangumi product and is not affiliated with Bangumi.
- Ordinary users should default to Access Token; OAuth, private session, and hosted backend flows are not the primary path.
- Some community write actions depend on Turnstile, and some experimental writes may still fail on the Bangumi side.
- For automation, prefer `--json` instead of parsing the human-readable terminal output.
- Bangumi recommends a custom `User-Agent` that identifies the developer and app.

## Acknowledgements

- Thanks to [`bgm.tv`](https://bgm.tv/) for the main Bangumi site and community ecosystem.
- Thanks to [`bangumi/server-private`](https://github.com/bangumi/server-private) for private API implementation references.
- Thanks to [`bangumi/api`](https://github.com/bangumi/api) for public API implementation and documentation foundations.
- Thanks to [`bgm-status.ry.mk`](https://bgm-status.ry.mk/) for the community-run Bangumi availability status service used by this feature; the service author is [`wataame`](https://bangumi.tv/user/wataame).
- This repository tries to reflect currently verifiable Bangumi behavior, but it does not promise full website feature coverage or long-term stability of third-party behaviors.

## License

This repository is licensed under `AGPL-3.0-only`. See [LICENSE](./LICENSE).
