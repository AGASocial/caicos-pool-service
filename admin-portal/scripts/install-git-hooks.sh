#!/bin/sh
set -e

ROOT=$(git rev-parse --show-toplevel 2>/dev/null) || {
  echo "install-git-hooks: not inside a git repository"
  exit 0
}

HOOKS_DIR="$ROOT/.git/hooks"
SRC_DIR="$ROOT/admin-portal/scripts/hooks"

mkdir -p "$HOOKS_DIR"
cp "$SRC_DIR/pre-commit" "$HOOKS_DIR/pre-commit"
cp "$SRC_DIR/prepare-commit-msg" "$HOOKS_DIR/prepare-commit-msg"
chmod +x "$HOOKS_DIR/pre-commit" "$HOOKS_DIR/prepare-commit-msg"

rm -f "$HOOKS_DIR/commit-msg"

echo "Installed git hooks → $HOOKS_DIR/pre-commit, $HOOKS_DIR/prepare-commit-msg"
