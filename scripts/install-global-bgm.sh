#!/usr/bin/env sh

set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPO_DIR=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)

chmod +x "$REPO_DIR/bgm" 2>/dev/null || true
chmod +x "$SCRIPT_DIR/install-global-bgm.sh" 2>/dev/null || true

detect_rc_file() {
  if [ -n "${ZSH_VERSION:-}" ]; then
    printf '%s\n' "${ZDOTDIR:-$HOME}/.zshrc"
    return
  fi

  if [ -n "${BASH_VERSION:-}" ]; then
    printf '%s\n' "$HOME/.bashrc"
    return
  fi

  if [ -f "$HOME/.zshrc" ]; then
    printf '%s\n' "$HOME/.zshrc"
    return
  fi

  if [ -f "$HOME/.bashrc" ]; then
    printf '%s\n' "$HOME/.bashrc"
    return
  fi

  printf '%s\n' "$HOME/.profile"
}

RC_FILE=$(detect_rc_file)
PATH_LINE="export PATH=\"$REPO_DIR:\$PATH\""

mkdir -p "$(dirname "$RC_FILE")"
touch "$RC_FILE"

if grep -F "$PATH_LINE" "$RC_FILE" >/dev/null 2>&1; then
  printf 'PATH already contains %s in %s\n' "$REPO_DIR" "$RC_FILE"
else
  {
    printf '\n'
    printf '# bgm-cli\n'
    printf '%s\n' "$PATH_LINE"
  } >>"$RC_FILE"
  printf 'Added bgm-cli to PATH in %s\n' "$RC_FILE"
fi

printf '\nNext steps:\n'
printf '1. Run: source %s\n' "$RC_FILE"
printf '2. Verify: bgm --help\n'
