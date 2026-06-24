#!/bin/sh
set -e

prisma generate

if OUTPUT=$(prisma migrate deploy 2>&1); then
  printf '%s\n' "$OUTPUT"
  exit 0
fi

printf '%s\n' "$OUTPUT" >&2

if printf '%s\n' "$OUTPUT" | grep -q P3005; then
  echo "Baselining existing database (P3005)..."
  prisma migrate resolve --applied 20260622000000_baseline
  prisma migrate deploy
else
  exit 1
fi
