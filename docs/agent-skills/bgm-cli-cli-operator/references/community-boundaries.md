# Community Boundaries

This reference helps agents avoid overpromising unsupported Bangumi community actions through `bgm`.

## Stable Community-Like Operations

These are the most realistic public operations to expose through the CLI:

- user profile reads
- subject search and reads
- collection list / get / update
- index reads and writes when implemented in the CLI
- revision history reads when implemented in the CLI
- character / person collection reads and writes when implemented in the CLI

## Treat As Limited Or Unsupported

Do not assume stable public support for:

- groups
- group topics
- Rakuen / 超展开
- timeline / 时光机
- blog CRUD
- forum-style topic CRUD
- friend / follow graph operations

If a user asks for these, verify current CLI support first. If the CLI does not expose them, say so plainly instead of guessing.

## Collection Caveats

- private collections require the right auth context
- collection `updated_at` is not a reliable last-change timestamp
- completion progress fields are not universally safe across all subject types

## Operator Rule

When the request touches ambiguous community features, prefer:

1. checking the CLI help
2. checking whether the command exists
3. reporting the supported scope precisely

Do not infer unsupported commands from Bangumi website features alone.
