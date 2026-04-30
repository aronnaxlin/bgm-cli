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

1. direct Access Token
2. interactive `--init`
3. OAuth helper flow
4. optional private `p1` session only when a session-specific task needs it

## Direct Access Token Login

```bash
bgm auth set-token YOUR_ACCESS_TOKEN
bgm auth status
bgm user me
```

This is the default recommendation for most users and agents.

## Interactive Guided Setup

```bash
bgm --init
```

Use this when the user wants the CLI to guide them interactively.

Do not treat this as the preferred automation path.

## OAuth Helper Commands

```bash
bgm auth login-url --state random-state
bgm auth token --code YOUR_CODE --save
bgm auth refresh --save
```

Use these only when the user explicitly wants OAuth-style setup.

If the repository's hosted OAuth relay is configured and the user wants to test browser authorization, the CLI can also let the hosted callback page send the final token payload back to the current terminal automatically.

## Optional Private Session Commands

```bash
bgm auth session-login
bgm auth set-session YOUR_CHIINEXTSESSIONID
bgm auth session-status
```

Treat this as auxiliary session state, not the main login path.

## Clear Auth

To remove all saved auth state (Access Token, Refresh Token, Private Session) for clean testing or re-authentication:

```bash
bgm auth clear
```

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
