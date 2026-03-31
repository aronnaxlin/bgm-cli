#!/usr/bin/env sh

set -eu

REPO_OWNER="aronnaxlin"
REPO_NAME="bgm-cli"
REPO_BRANCH="main"
ARCHIVE_URL="https://github.com/${REPO_OWNER}/${REPO_NAME}/archive/refs/heads/${REPO_BRANCH}.tar.gz"
INSTALL_ROOT="${HOME}/.local/share"
INSTALL_DIR="${INSTALL_ROOT}/${REPO_NAME}"
TMP_DIR="${TMPDIR:-/tmp}"
WORK_DIR="$(mktemp -d "${TMP_DIR%/}/${REPO_NAME}.XXXXXX")"
ARCHIVE_FILE="${WORK_DIR}/${REPO_NAME}.tar.gz"
EXTRACT_DIR="${WORK_DIR}/extract"
SOURCE_DIR="${EXTRACT_DIR}/${REPO_NAME}-${REPO_BRANCH}"

cleanup() {
  rm -rf "$WORK_DIR"
}

trap cleanup EXIT INT TERM

download() {
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL "$ARCHIVE_URL" -o "$ARCHIVE_FILE"
    return
  fi

  if command -v wget >/dev/null 2>&1; then
    wget -qO "$ARCHIVE_FILE" "$ARCHIVE_URL"
    return
  fi

  printf 'Error: curl or wget is required for installation.\n' >&2
  exit 1
}

printf 'bgm-cli remote install\n'
printf 'Source: %s\n' "$ARCHIVE_URL"
printf 'Install dir: %s\n' "$INSTALL_DIR"
printf '\n'

if ! command -v tar >/dev/null 2>&1; then
  printf 'Error: tar is required for installation.\n' >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  printf 'Warning: Node.js was not found in PATH.\n'
  printf 'bgm-cli requires Node.js >= 20 to run after installation.\n'
  printf '\n'
fi

mkdir -p "$EXTRACT_DIR"
mkdir -p "$INSTALL_ROOT"

download
tar -xzf "$ARCHIVE_FILE" -C "$EXTRACT_DIR"

if [ ! -d "$SOURCE_DIR" ]; then
  printf 'Error: extracted source directory was not found: %s\n' "$SOURCE_DIR" >&2
  exit 1
fi

rm -rf "$INSTALL_DIR"
mkdir -p "$(dirname "$INSTALL_DIR")"
mv "$SOURCE_DIR" "$INSTALL_DIR"

chmod +x "$INSTALL_DIR/bgm" 2>/dev/null || true
chmod +x "$INSTALL_DIR/install.sh" 2>/dev/null || true
chmod +x "$INSTALL_DIR/scripts/install-global-bgm.sh" 2>/dev/null || true
chmod +x "$INSTALL_DIR/scripts/install-remote.sh" 2>/dev/null || true

exec "$INSTALL_DIR/scripts/install-global-bgm.sh"
