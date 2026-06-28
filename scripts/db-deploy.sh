#!/bin/sh
set -e

# Client is generated at build time (postinstall + build). Skip here to speed cold starts.
MAX_RECOVERY_ATTEMPTS=10
attempt=0

run_deploy() {
  bunx prisma migrate deploy 2>&1
}

extract_failed_migration() {
  printf '%s\n' "$1" | sed -n \
    -e 's/.*Migration name: \([^ ]*\).*/\1/p' \
    -e 's/.*The `\([^`]*\)` migration.*/\1/p' \
    | head -1
}

is_legacy_schema_conflict() {
  printf '%s\n' "$1" | grep -qiE \
    'already exists|duplicate column|duplicate key|relation "[^"]+" does not exist'
}

resolve_failed_migration() {
  FAILED_MIGRATION=$(extract_failed_migration "$1")
  if [ -n "$FAILED_MIGRATION" ]; then
    echo "Recovering failed migration: marking $FAILED_MIGRATION as applied"
    bunx prisma migrate resolve --applied "$FAILED_MIGRATION"
    return 0
  fi
  return 1
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
    bunx prisma migrate resolve --applied 20260622000000_baseline
    continue
  fi

  # P3009: a prior deploy left a failed row in _prisma_migrations (blocks all new deploys).
  if printf '%s\n' "$OUTPUT" | grep -q P3009; then
    resolve_failed_migration "$OUTPUT" && continue
  fi

  # P3018: migration failed mid-apply (e.g. column already exists from legacy db push).
  if printf '%s\n' "$OUTPUT" | grep -q P3018 && is_legacy_schema_conflict "$OUTPUT"; then
    resolve_failed_migration "$OUTPUT" && continue
  fi

  exit 1
done

echo "Migration deploy exceeded max recovery attempts ($MAX_RECOVERY_ATTEMPTS)" >&2
exit 1
