#!/bin/sh
set -e

# Client is generated at build time (postinstall + build). Skip here to speed cold starts.
MAX_RECOVERY_ATTEMPTS=10
attempt=0

run_deploy() {
  prisma migrate deploy 2>&1
}

extract_failed_migration() {
  printf '%s\n' "$1" | sed -n 's/.*Migration name: \([^ ]*\).*/\1/p' | head -1
}

is_legacy_schema_conflict() {
  printf '%s\n' "$1" | grep -qiE \
    'already exists|duplicate column|duplicate key|relation "[^"]+" does not exist'
}

while [ "$attempt" -lt "$MAX_RECOVERY_ATTEMPTS" ]; do
  attempt=$((attempt + 1))

  if OUTPUT=$(run_deploy); then
    printf '%s\n' "$OUTPUT"
    exit 0
  fi

  printf '%s\n' "$OUTPUT" >&2

  if printf '%s\n' "$OUTPUT" | grep -q P3005; then
    echo "Baselining existing database (P3005)..."
    prisma migrate resolve --applied 20260622000000_baseline
    continue
  fi

  if printf '%s\n' "$OUTPUT" | grep -q P3018 && is_legacy_schema_conflict "$OUTPUT"; then
    FAILED_MIGRATION=$(extract_failed_migration "$OUTPUT")
    if [ -n "$FAILED_MIGRATION" ]; then
      echo "Recovering legacy db-push schema (P3018): marking $FAILED_MIGRATION as applied"
      prisma migrate resolve --applied "$FAILED_MIGRATION"
      continue
    fi
  fi

  exit 1
done

echo "Migration deploy exceeded max recovery attempts ($MAX_RECOVERY_ATTEMPTS)" >&2
exit 1
