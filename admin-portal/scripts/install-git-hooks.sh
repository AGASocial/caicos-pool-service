#!/bin/sh
set -e

ROOT=$(git rev-parse --show-toplevel 2>/dev/null) || {
  echo "install-git-hooks: not inside a git repository"
  exit 0
}

HOOKS_DIR="$ROOT/.git/hooks"
SRC="$ROOT/admin-portal/scripts/hooks/commit-msg"

mkdir -p "$HOOKS_DIR"
cp "$SRC" "$HOOKS_DIR/commit-msg"
chmod +x "$HOOKS_DIR/commit-msg"
echo "Installed commit-msg hook → $HOOKS_DIR/commit-msg"
