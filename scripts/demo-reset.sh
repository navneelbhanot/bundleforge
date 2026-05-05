#!/usr/bin/env bash
# M-151 — wipe + reseed the demo shop.
#
# Idempotent: drops all rows for the dev shop, runs `prisma db seed`,
# leaves the database otherwise untouched. Use against the dev DB only;
# refuses to run unless DATABASE_URL contains the substring "dev" or
# CONFIRM=yes is set.
set -euo pipefail

DB="${DATABASE_URL:?DATABASE_URL must be set}"
CONFIRM="${CONFIRM:-no}"

if [[ "${DB}" != *dev* ]] && [[ "${CONFIRM}" != "yes" ]]; then
  echo "DATABASE_URL doesn't look like a dev DB and CONFIRM≠yes — refusing." >&2
  exit 2
fi

echo "→ Truncating dev-shop data"
psql "${DB}" -v ON_ERROR_STOP=1 <<'SQL'
DELETE FROM bundle_orders WHERE shop_id IN (
  SELECT id FROM shops WHERE shopify_domain = 'bundleforge-dev.myshopify.com'
);
DELETE FROM inventory_audit_log WHERE shop_id IN (
  SELECT id FROM shops WHERE shopify_domain = 'bundleforge-dev.myshopify.com'
);
DELETE FROM bundles WHERE shop_id IN (
  SELECT id FROM shops WHERE shopify_domain = 'bundleforge-dev.myshopify.com'
);
SQL

echo "→ Reseeding"
npm run db:seed

echo "✓ demo store reset"
