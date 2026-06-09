# Community Boundaries

This reference helps agents avoid overpromising unsupported Bangumi community actions through `bgm`.

## Stable Community-Like Operations

These are the most realistic public operations to expose through the CLI:

- user profile reads
- friend and follower list reads
- notification list reads and mark-read operations
- subject search and reads
- subject interest comments, discussion topic lists, latest subject discussions, topic detail, topic replies, and supported subject topic/post reactions
- collection list, get, and update
- character, person, and index collection reads; character/person/index collect and uncollect operations
- episode list and episode progress updates when the parent subject is already collected
- book progress reads and writes (`book get`, `book ep`, `book vol`) for book-type subjects when the parent subject is already collected
- episode comments by episode ID or by resolving a subject episode number
- group list and group detail reads
- group topic detail and topic list reads
- group membership list reads
- derived group discovery views such as recent topics, latest replies, hot groups, and hot topics
- group topic creation and replies when the CLI can obtain a valid Turnstile token
- new blog reads such as list, detail, comments, photos, and related subjects
- experimental blog comment writes when the CLI can obtain a valid Turnstile token
- character/person search, detail, related resources, photos, photo comments, and comment writes when the CLI can obtain a valid Turnstile token
- index reads and writes (list, get, comments, related items) when auth permits
- timeline list, user timeline, replies, delete, and reaction operations
- timeline `say` and `reply` when the CLI can obtain a valid Turnstile token
- weekly anime broadcast calendar reads

## Treat As Limited Or Unsupported

Do not assume stable public support for:

- Rakuen
- blog entry CRUD
- forum-style topic CRUD outside the exposed group surfaces
- friend/follow relationship mutations such as add, remove, accept, reject, or block
- accepting or rejecting friend requests directly from notifications
- blacklist management

Also avoid promising other Bangumi community surfaces unless the command is visible in current CLI help.

If a user asks for these, verify current CLI support first. If the CLI does not expose them, say so plainly instead of guessing.

## Collection Caveats

- private collections require the right auth context
- collection `updated_at` is not a reliable last-change timestamp
- completion progress fields are not universally safe across all subject types
- for book-type subjects, use dedicated `book` commands (`book get`, `book ep`, `book vol`)
- for non-book subjects, prefer dedicated episode endpoints over subject collection `ep_status`
- Bangumi currently ties episode writes to "subject is collected" rather than to a specific collection status such as `doing`
- NSFW episode reads may fail with an auth-looking `404` when no usable auth context is attached
- for `p1` requests, the CLI uses a private session cookie when available and falls back to Access Token when no session is saved

## Operator Rule

When the request touches ambiguous community features, prefer:

1. checking the CLI help
2. checking whether the command exists
3. reporting the supported scope precisely
4. calling out Turnstile requirements for supported write flows
5. marking blog comment writes as experimental when relevant
6. calling out that Turnstile now prefers the hosted official flow and only falls back to the local helper when needed

Do not infer unsupported commands from Bangumi website features alone.
