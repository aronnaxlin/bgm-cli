#!/usr/bin/env sh

set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
SHELL_NAME=$(basename "${SHELL:-}")

printf 'bgm-cli one-click install\n'
printf 'Repository: %s\n' "$SCRIPT_DIR"
printf '\n'

if ! command -v node >/dev/null 2>&1; then
  printf 'Warning: Node.js was not found in PATH.\n'
  printf 'bgm-cli requires Node.js >= 20 to run.\n'
  printf '\n'
fi

chmod +x "$SCRIPT_DIR/bgm" 2>/dev/null || true
chmod +x "$SCRIPT_DIR/scripts/install-global-bgm.sh" 2>/dev/null || true

if [ -n "${ZSH_VERSION:-}" ] || [ "$SHELL_NAME" = "zsh" ]; then
  exec zsh "$SCRIPT_DIR/scripts/install-global-bgm.sh"
fi

exec "$SCRIPT_DIR/scripts/install-global-bgm.sh"
