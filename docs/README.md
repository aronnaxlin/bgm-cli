# Documentation Layout

Repository documentation lives under `docs/`.

## Sections

- `skills/`
  Public, installable skill packages intended for external agent ecosystems such as `npx skills add`. This is the canonical skill distribution surface.

- `docs/skills/`
  Repository-owned skill indexes and authoring notes. Start with `docs/skills/README.md` for the current skill index and discovery guidance.

- `docs/research/`
  Topic notes, external API investigation, and one-off reference writeups that are useful to keep in the repo but are not part of the core operator or development guides.
  Recent examples:
  - `docs/research/agent-skills-publishing.zh-CN.md`
  - `docs/research/bangumi-community-features.md`
  - `docs/research/group-ranking-and-freshness.md`
  - `docs/research/access-token-private-session-turnstile.zh-CN.md`
  - `docs/research/turnstile-manual-token.zh-CN.md`
  - `docs/research/official-turnstile-path-design.zh-CN.md`

- `docs/experimental/`
  Experimental documents that are kept in the repository for reference but are not part of the default user path.
  Current example:
  - `docs/experimental/oauth-backend-deployment.zh-CN.md`

## Rule

Do not create a parallel top-level `doc/` directory.

New Markdown documents should go somewhere under `docs/` so the repository keeps a single documentation root.
