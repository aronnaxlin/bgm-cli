# Documentation Layout

Repository documentation lives under `docs/`.

## Sections

- `docs/skills/`
  Agent-facing skill material for using `bgm` as a CLI tool. Start with `docs/skills/README.md` for the current index and scope of each skill.

- `docs/research/`
  Topic notes, external API investigation, and one-off reference writeups that are useful to keep in the repo but are not part of the core operator or development guides.
  Recent examples:
  - `docs/research/bangumi-community-features.md`
  - `docs/research/group-ranking-and-freshness.md`
  - `docs/research/turnstile-manual-token.zh-CN.md`

- `docs/experimental/`
  Experimental documents that are kept in the repository for reference but are not part of the default user path.
  Current example:
  - `docs/experimental/oauth-backend-deployment.zh-CN.md`

## Rule

Do not create a parallel top-level `doc/` directory.

New Markdown documents should go somewhere under `docs/` so the repository keeps a single documentation root.
