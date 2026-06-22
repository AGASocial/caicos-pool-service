#!/usr/bin/env bash
# Extract cadenza_* public data (+ optional auth users/identities) from a full supabase db dump.
#
# Usage:
#   ./scripts/extract-cadenza-dump.sh ../detodounpoco_data.sql ../detodounpoco_auth.sql
#
# Outputs (next to input files):
#   detodounpoco_cadenza_only.sql
#   detodounpoco_auth_minimal.sql

set -euo pipefail

DATA_FILE="${1:?data sql file required}"
AUTH_FILE="${2:-}"

OUT_DIR="$(dirname "$DATA_FILE")"
CADENZA_OUT="$OUT_DIR/detodounpoco_cadenza_only.sql"

write_header() {
  cat <<'EOF'
SET session_replication_role = replica;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;

EOF
}

{
  echo "-- Cadenza public tables only (cadenza_*). Excludes cadenza_waitlist."
  write_header
  awk '
/^COPY "public"\."cadenza_/ {
  if ($0 ~ /"cadenza_waitlist"/) { skip=1; next }
  keep=1
}
skip && /^\\.$/ { skip=0; next }
skip { next }
keep { print }
/^\\.$/ && keep { keep=0 }
' "$DATA_FILE"
  echo ""
  echo "SET session_replication_role = DEFAULT;"
} > "$CADENZA_OUT"

echo "Wrote $CADENZA_OUT"
rg '^COPY ' "$CADENZA_OUT" || true

if [[ -n "$AUTH_FILE" && -f "$AUTH_FILE" ]]; then
  AUTH_OUT="$OUT_DIR/detodounpoco_auth_minimal.sql"
  {
    echo "-- auth.users + auth.identities only"
    write_header
    awk '
/^COPY "auth"\."(users|identities)"/ { keep=1 }
keep { print }
/^\\.$/ && keep { keep=0 }
' "$AUTH_FILE"
    echo ""
    echo "SET session_replication_role = DEFAULT;"
  } > "$AUTH_OUT"
  echo "Wrote $AUTH_OUT"
  rg '^COPY ' "$AUTH_OUT" || true
fi
