# bgm-cli

[简体中文](./README.md) | [繁體中文（台灣）](./README.zh-TW.md) | [English](./README.en.md)

`bgm-cli` is a command-line tool for Bangumi focused on getting users productive quickly from a terminal.

## Quick Start

### Requirements

- Node.js `>= 20`

### Install

npm / npx:

```bash
npx @aronnaxlin/bgm-cli --help
npm install -g @aronnaxlin/bgm-cli
```

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

The recommended path is the official Bangumi login:

```bash
bgm --init
```

`bgm --init` offers official login first and keeps Access Token as the second channel. If you already have a token:

```bash
bgm auth set-token YOUR_ACCESS_TOKEN
bgm auth token-status
```

### Multiple accounts

Snapshot the current credentials as a named profile and switch between accounts quickly:

```bash
bgm auth profile save main
bgm auth profile list
bgm auth profile use another
bgm --profile another user me
```

`bgm --profile <name> <command>` runs a single command as that account without switching; it is a read-only override and never writes to disk.

### Proxy

If your network needs a proxy to reach the Bangumi API reliably, configure an HTTP/HTTPS proxy for all CLI requests:

```bash
bgm proxy set http://127.0.0.1:7890
bgm proxy show
```

For one-off commands, use an environment variable:

```bash
BGM_PROXY=http://127.0.0.1:7890 bgm subject get 8
```

Proxy priority is: persisted `bgm proxy set` config > `BGM_PROXY` > `HTTPS_PROXY` / `HTTP_PROXY`.

### Common Commands

```bash
bgm user me
bgm subject search "Heike Monogatari" --type anime --limit 5
bgm subject get 348335
bgm subject comments 348335 --limit 5
bgm character search "Asuka" --limit 3
bgm person search "Anno" --limit 3
bgm collection get 348335
bgm collection indexes --user sai --limit 5
bgm book get 3510
bgm book ep 3510 10
bgm group list --sort members --limit 10
bgm group user sai --limit 5
bgm index user sai --limit 5
bgm search subject "One Piece" --limit 5
bgm trending subjects --type anime --limit 5
bgm --json user me
```

### Paste A Link

Hand a Bangumi web link straight to `bgm` and it resolves to the matching command:

```bash
bgm "https://bangumi.tv/group/topic/469977#post_4029724"   # that single reply -> bgm group post 4029724
bgm url https://bgm.tv/subject/253/characters              # -> bgm subject characters 253
bgm --url https://bgm.tv/anime/list/sai/collect --dry-run  # resolve only, no request
```

- Three equivalent forms: `bgm <url>`, `bgm url <url>`, `bgm --url <url>` (`-url` also works).
- Hosts: `bgm.tv`, `bangumi.tv`, `chii.in`, `next.bgm.tv`, `api.bgm.tv`; the `https://` and `www.` prefixes are optional.
- Resolution is read-only, so a link never triggers a write. `--dry-run` prints the resolution and stops.
- A `#post_<id>` anchor resolves to that single reply; `?page=n` becomes `--offset`.
- Extra flags are forwarded to the resolved command, and `--json` output carries a `resolvedFrom` field.
- Quote links containing `#` so the shell does not truncate them.
- Run `bgm url --help` for the full list of supported link shapes.

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
- Ordinary users should default to the official login in `bgm --init`; Access Token remains available for compatibility and scripting, while OAuth and hosted backend flows are not the primary path.
- Some community write actions depend on Turnstile; this round of automated verification skipped those human-check steps, so those write actions still need manual retesting and may still fail on the Bangumi side.
- For automation, prefer `--json` instead of parsing the human-readable terminal output.
- Bangumi recommends a custom `User-Agent` that identifies the developer and app.

## Acknowledgements

- Thanks to [`bgm.tv`](https://bgm.tv/) for the main Bangumi site and community ecosystem.
- Thanks to [`bangumi/server-private`](https://github.com/bangumi/server-private) for private API implementation references.
- Thanks to [`bangumi/api`](https://github.com/bangumi/api) for public API implementation and documentation foundations.
- Thanks to [`SearchEncore`](https://bgmdb.ry.mk/v1/docs) (`bgmdb.ry.mk`) for the community-maintained Bangumi enhanced search capability; the service author is [`wataame`](https://bangumi.tv/user/wataame). SearchEncore is a community-run search service that complements the official bangumi.tv API.
- Thanks to [`bgm-status.ry.mk`](https://bgm-status.ry.mk/) for the community-run Bangumi availability status service; the service author is also [`wataame`](https://bangumi.tv/user/wataame).
- This repository tries to reflect currently verifiable Bangumi behavior, but it does not promise full website feature coverage.

## License

This repository is licensed under `AGPL-3.0-only`. See [LICENSE](./LICENSE).
