#!/usr/bin/env bash
# M-145 — restore a logical Postgres backup produced by scripts/backup.sh.
#
# Usage:
#   DATABASE_URL=postgres://... ./scripts/restore.sh /path/to/backup.sql.gz
#
# IMPORTANT: this drops + recreates the public schema first. Never run it
# against the live database without an explicit confirmation; the wrapper
# below requires CONFIRM=yes in the environment.
set -euo pipefail

SRC="${1:?usage: restore.sh <path-to-backup.sql.gz>}"
DB="${DATABASE_URL:?DATABASE_URL must be set}"
CONFIRM="${CONFIRM:-no}"

if [[ "${CONFIRM}" != "yes" ]]; then
  echo "Refusing to drop schema without CONFIRM=yes. Set CONFIRM=yes to proceed." >&2
  exit 2
fi

if [[ ! -f "${SRC}" ]]; then
  echo "Backup file not found: ${SRC}" >&2
  exit 1
fi

echo "→ Dropping & recreating public schema on target DB"
psql "${DB}" -v ON_ERROR_STOP=1 -c 'DROP SCHEMA IF EXISTS public CASCADE;'
psql "${DB}" -v ON_ERROR_STOP=1 -c 'CREATE SCHEMA public;'

echo "→ Restoring from ${SRC}"
gunzip -c "${SRC}" | psql "${DB}" -v ON_ERROR_STOP=1

echo "✓ restore complete from ${SRC}"
echo "  Run \`prisma generate\` and verify \`/health\` reports db: true."
