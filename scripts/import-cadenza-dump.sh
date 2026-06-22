#!/usr/bin/env bash
# Import pg_dump COPY-format SQL files into the linked Supabase project.
# Requires psql (brew install libpq) OR Docker.
#
# Usage:
#   export NEW_DB_URL='postgresql://postgres:PASSWORD@db.ejhrfnauifgvopshnnuv.supabase.co:5432/postgres'
#   ./scripts/import-cadenza-dump.sh auth
#   ./scripts/import-cadenza-dump.sh data
#   ./scripts/import-cadenza-dump.sh all
#
# NOTE: supabase db query does NOT work for COPY ... FROM stdin dumps.

set -euo pipefail

MODE="${1:-all}"
DATA_DIR="${DATA_DIR:-/Users/gabrielvega/Projects/agasocial}"
AUTH_FILE="$DATA_DIR/detodounpoco_auth_minimal.sql"
CADENZA_FILE="$DATA_DIR/detodounpoco_cadenza_only.sql"

if [[ -z "${NEW_DB_URL:-}" ]]; then
  echo "Set NEW_DB_URL to your new project's Postgres connection string."
  echo "Example: export NEW_DB_URL='postgresql://postgres:PASSWORD@db.ejhrfnauifgvopshnnuv.supabase.co:5432/postgres'"
  exit 1
fi

run_psql() {
  local file="$1"
  if command -v psql >/dev/null 2>&1; then
    psql "$NEW_DB_URL" -v ON_ERROR_STOP=1 -f "$file"
    return
  fi
  if [[ -x /opt/homebrew/opt/libpq/bin/psql ]]; then
    /opt/homebrew/opt/libpq/bin/psql "$NEW_DB_URL" -v ON_ERROR_STOP=1 -f "$file"
    return
  fi
  if command -v docker >/dev/null 2>&1; then
    docker run --rm -i \
      -v "$DATA_DIR:/data:ro" \
      postgres:15 \
      psql "$NEW_DB_URL" -v ON_ERROR_STOP=1 -f "/data/$(basename "$file")"
    return
  fi
  echo "psql not found. Install with: brew install libpq"
  echo 'Then: export PATH="/opt/homebrew/opt/libpq/bin:$PATH"'
  exit 1
}

import_auth() {
  echo "Importing auth (users + identities)..."
  run_psql "$AUTH_FILE"
}

import_data() {
  echo "Importing cadenza_* tables..."
  run_psql "$CADENZA_FILE"
}

case "$MODE" in
  auth) import_auth ;;
  data) import_data ;;
  all)
    import_auth
    import_data
    ;;
  *)
    echo "Usage: $0 [auth|data|all]"
    exit 1
    ;;
esac

echo "Done."
