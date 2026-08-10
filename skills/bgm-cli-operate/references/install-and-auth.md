# Install And Auth Reference

Use this reference when the agent needs to get `bgm-cli` working from zero.

## Install Decision Table

| Situation | Preferred action |
| --- | --- |
| User only wants a working `bgm` command | Use the remote managed installer |
| User is already inside a cloned `bgm-cli` checkout and wants this checkout as `bgm` | Use the repo install script or `bgm setup install-path` |
| User only needs commands in the current checkout | Use `./bgm` directly |

## Remote Managed Install

### macOS / Linux

```bash
curl -fsSL https://raw.githubusercontent.com/aronnaxlin/bgm-cli/main/scripts/install-remote.sh | sh
```

### Windows PowerShell

```powershell
irm https://raw.githubusercontent.com/aronnaxlin/bgm-cli/main/scripts/install-remote.ps1 | iex
```

This path does not require a prior `git clone`.

It downloads the current `main` branch to a managed local directory and performs the global install automatically.

If the managed install already exists, rerunning the same command updates it in place and tries to preserve local config.

## Repository-Local Install

### Use the repo install scripts

macOS / Linux:

```bash
./install.sh
```

Windows PowerShell:

```powershell
./install.ps1
```

### Expose the current checkout as global `bgm`

```bash
bgm setup install-path
```

Use this when `bgm` is already running from the repository checkout and the user wants that checkout installed into PATH.

## Verify Installation

Preferred verification:

```bash
bgm --version
bgm --help
```

If only the repository-local executable is being used:

```bash
./bgm --help
```

## Update Managed Install

```bash
bgm setup update
```

This is only for installs created by the remote managed installer.

Do not use it to update a development checkout.

## Auth Priority

Preferred order:

1. interactive `bgm --init`, choosing the recommended official Bangumi login
2. direct `bgm auth login` when the user wants to skip the broader init wizard
3. Access Token channel when the user already has a token or needs scripting compatibility
4. OAuth helper flow only when explicitly requested
5. manual private session import only when a session-specific task needs it

## Official Login

```bash
bgm --init
bgm auth status
bgm user me
```

`bgm --init` now offers official Bangumi login first and Access Token second. The official login path is the same private-session flow as:

```bash
bgm auth login
```

It prompts for email, hides the password input, opens the official Turnstile verification flow when needed, and saves the resulting `next.bgm.tv` private session.

## Access Token Channel

```bash
bgm auth set-token YOUR_ACCESS_TOKEN
bgm auth token-status
bgm user me
```

Use this when the user already has a token or when a scripting workflow specifically depends on Access Token auth.

## OAuth Helper Commands

```bash
bgm auth login-url --state random-state
bgm auth token --code YOUR_CODE --save
bgm auth refresh --save
```

Use these only when the user explicitly wants OAuth-style setup.

If the repository's hosted OAuth relay is configured and the user explicitly wants to debug browser OAuth authorization, the CLI can also let the hosted callback page send the final token payload back to the current terminal automatically. This is not part of the normal `bgm --init` login path.

## Manual Private Session Commands

```bash
bgm auth login
bgm auth session-login
bgm auth set-session YOUR_CHIINEXTSESSIONID
bgm auth session-status
```

`bgm auth login` is the normal official login path. `session-login` and `set-session` are manual helper paths for importing an existing browser session.

## Clear Auth

To remove all saved auth state (Access Token, Refresh Token, Private Session) for clean testing or re-authentication:

```bash
bgm auth clear
```

`bgm auth clear` does not delete saved account profiles; run `bgm auth profile delete <name>` for those.

## Multiple Accounts

Named profiles snapshot one account's credentials each. The active credentials always live in the flat top-level config keys; switching copies them back into the previous profile first, then loads the target profile.

```bash
bgm auth profile save main
bgm auth profile list
bgm auth profile use another
bgm auth profile delete old-account
bgm --profile another user me
```

Operational notes:

- `bgm --profile <name> <command>` is a read-only per-command override: it never writes to disk, and credential-writing commands (`auth login`, `auth set-token`, `auth clear`, `auth profile save/use/delete`, `--init`, `tui`, `config set <auth key>`) refuse to run with it
- overwriting an existing non-active profile with `auth profile save` requires `--force`
- auth environment variables such as `BGM_ACCESS_TOKEN` still win over any profile; the profile commands print a warning listing the overriding variables when they are set

## Turnstile Helper

Group writes, timeline writes, and experimental blog comment writes may require a fresh Turnstile token.

Default path:

- let `bgm` try Bangumi's hosted official Turnstile page first
- let it fall back to the local helper automatically if needed

Manual helper entrypoint:

```bash
bgm auth turnstile --manual --port 8765
```

Many group write commands and `bgm blog reply` can also trigger the local helper automatically when a token is not provided.

Timeline `say` and `reply` follow the same Turnstile rules.

## Minimum Ready State

The CLI is effectively ready when all of these succeed as expected:

```bash
bgm --help
bgm auth status
bgm user me
```
