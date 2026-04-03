# Documentation Layout

Repository documentation lives under `docs/`.

## Sections

- `docs/ai/`
  Development-oriented reference material for agents or contributors working on the `bgm-cli` codebase.

- `docs/agent-skills/`
  Operator-facing skill material for agents that use `bgm` as a CLI tool instead of developing this repository.

- `docs/research/`
  Topic notes, external API investigation, and one-off reference writeups that are useful to keep in the repo but are not part of the core operator or development guides.
  Recent examples:
  - `docs/research/bangumi-community-features.md`
  - `docs/research/group-ranking-and-freshness.md`
  - `docs/research/turnstile-manual-token.zh-CN.md`

- `docs/oauth-backend-deployment.zh-CN.md`
  Deployment notes for the optional hosted OAuth backend.

## Rule

Do not create a parallel top-level `doc/` directory.

New Markdown documents should go somewhere under `docs/` so the repository keeps a single documentation root.
