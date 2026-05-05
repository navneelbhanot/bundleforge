#!/usr/bin/env bash
# M-145 — logical Postgres backup.
#
# Usage:
#   DATABASE_URL=postgres://... ./scripts/backup.sh /var/backups/bundleforge
#
# Produces a compressed pg_dump in the target dir, named with an ISO8601 UTC
# timestamp. Designed to be cron'd hourly in production. Restore via
# scripts/restore.sh. Drill procedure documented in
# docs/runbook-incidents.md.
set -euo pipefail

DEST="${1:-./backups}"
DB="${DATABASE_URL:?DATABASE_URL must be set}"
TS="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="${DEST}/bundleforge-${TS}.sql.gz"

mkdir -p "${DEST}"

echo "→ pg_dump → ${OUT}"
pg_dump --no-owner --no-acl --format=plain "${DB}" | gzip -9 > "${OUT}"

# Keep only the 168 most recent files (1 week @ hourly). Adjust per RPO.
find "${DEST}" -name 'bundleforge-*.sql.gz' -type f -printf '%T@ %p\n' \
  | sort -nr | tail -n +169 | awk '{$1=""; sub(/^ /,""); print}' \
  | while read -r f; do echo "  pruning ${f}"; rm -f -- "${f}"; done

echo "✓ backup complete: ${OUT}"
