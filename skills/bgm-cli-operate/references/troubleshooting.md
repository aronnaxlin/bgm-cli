# Troubleshooting

Use this reference when installation or operation does not behave as expected.

## `bgm: command not found`

Check whether the repository-local executable exists and works:

```bash
./bgm --help
```

If that works, either keep using `./bgm` or install the current checkout into PATH with:

```bash
bgm setup install-path
```

If neither `bgm` nor `./bgm` works, perform the remote managed install.

## Node.js Too Old Or Missing

`bgm-cli` requires Node.js `>= 20`.

Check:

```bash
node --version
```

If Node is missing or older than `20`, install or upgrade Node first, then retry the `bgm-cli` install.

## Managed Install vs Development Checkout

Use `bgm setup update` only for the managed install created by the remote installer.

If the user is running a normal cloned repository, update that checkout with their normal development workflow instead.

## Auth Exists But Requests Fail

Verify the current token state explicitly:

```bash
bgm auth status
bgm user me
```

If `auth status` looks wrong, replace the token directly:

```bash
bgm auth set-token YOUR_ACCESS_TOKEN
```

## Private Session Confusion

A saved `p1` session is not the default login path.

Check it separately:

```bash
bgm auth session-status
```

Do not treat a session as a substitute for Access Token auth unless the task specifically depends on private-session behavior.

## Turnstile-Gated Write Fails

Group topic creation, group replies, timeline writes, and experimental blog comment writes may require Turnstile verification.

Try one of these:

```bash
bgm auth turnstile
bgm auth turnstile --manual --port 8765
bgm group create-topic boring "Title" "Content"
bgm group reply 498114 "Reply content"
bgm blog reply 371953 "Reply content"
bgm timeline say "test"
```

If the user already has a Turnstile token, pass it explicitly with `--turnstile-token`.

Operational guidance:

- by default, prefer the hosted official Turnstile flow
- if the hosted callback cannot reach the current terminal, use `--manual` to force the local helper path
- for blog writes, also warn that Bangumi may still return server-side `500` errors

## Search-Based Targeting Is Ambiguous

When a title search returns multiple candidates, reduce the result set and use `--pick` for commands that support it.

Prefer exact IDs whenever possible.

## JSON Needed For Stable Agent Consumption

If human-readable output is hard to parse or verify, rerun the read command with `--json`.

Examples:

```bash
bgm --json user me
bgm --json subject get 253
bgm --json collection get 253
```

## Unsupported Community Surface

If the user asks for a Bangumi website feature that the CLI does not expose, check the current CLI help and report the supported scope plainly.

Do not guess missing commands.
