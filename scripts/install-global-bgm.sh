#!/usr/bin/env sh

set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPO_DIR=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)

chmod +x "$REPO_DIR/bgm" 2>/dev/null || true
chmod +x "$SCRIPT_DIR/install-global-bgm.sh" 2>/dev/null || true

install_dependencies() {
  if [ ! -f "$REPO_DIR/package.json" ]; then
    return
  fi

  if ! command -v npm >/dev/null 2>&1; then
    printf 'Error: npm is required to install bgm-cli dependencies.\n' >&2
    exit 1
  fi

  printf 'Installing bgm-cli dependencies...\n'
  (cd "$REPO_DIR" && npm ci --omit=dev)
}

detect_rc_file() {
  SHELL_NAME=$(basename "${SHELL:-}")

  if [ -n "${ZSH_VERSION:-}" ]; then
    printf '%s\n' "${ZDOTDIR:-$HOME}/.zshrc"
    return
  fi

  if [ "$SHELL_NAME" = "zsh" ]; then
    printf '%s\n' "${ZDOTDIR:-$HOME}/.zshrc"
    return
  fi

  if [ -n "${BASH_VERSION:-}" ]; then
    printf '%s\n' "$HOME/.bashrc"
    return
  fi

  if [ "$SHELL_NAME" = "bash" ]; then
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
CONFIG_DIR="$REPO_DIR/.bgm-cli"
MARKER_FILE="$CONFIG_DIR/.global-install-enabled"
USER_CONFIG_DIR="${HOME}/.config/bgm-cli"
USER_CONFIG_FILE="$USER_CONFIG_DIR/config.json"
PROJECT_CONFIG_FILE="$REPO_DIR/.bgm-cli/config.json"

install_dependencies

mkdir -p "$(dirname "$RC_FILE")"
touch "$RC_FILE"
mkdir -p "$CONFIG_DIR"
touch "$MARKER_FILE"
mkdir -p "$USER_CONFIG_DIR"

if [ ! -f "$USER_CONFIG_FILE" ] && [ -f "$PROJECT_CONFIG_FILE" ]; then
  cp "$PROJECT_CONFIG_FILE" "$USER_CONFIG_FILE"
fi

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
