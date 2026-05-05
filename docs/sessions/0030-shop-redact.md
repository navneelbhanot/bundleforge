# Session 0030 — GDPR shop/redact

- **Date:** 2026-05-04
- **Milestone(s):** M-030 (closes Phase B)

## What was done

- Wrote `docs/specs/M-030-shop-redact.md`.
- New `prisma/migrations/20260504_audit_log_relax_delete/migration.sql`:
  drops the BEFORE-DELETE trigger on `inventory_audit_log` so cascade
  delete from Shop deletion can reach the audit table. UPDATE trigger
  (the real integrity defense per ADR-0003) is preserved.
- New ADR `docs/decisions/0003a-audit-log-allow-cascade-delete.md`.
- New `src/webhooks/handlers/shopRedact.ts`: `deleteMany` on Shop by
  `shopifyDomain`. FK CASCADE handles the rest.
- 2 tests; registered in webhooksWorker.

## Phase B complete

M-016 through M-030: Shopify integration end-to-end. OAuth install +
callback + Shop persistence, App Bridge session validation, GraphQL +
REST clients with retry, webhook HMAC verification, BullMQ-backed
dispatch, four privacy/lifecycle handlers (uninstalled, shop/update,
+ three GDPR mandatory).

## Acceptance

- [x] All criteria; 124 tests, 0 lint errors.

## Handoff

Next: **M-031 — Plan registry (full version)**. The stub from M-008
(`src/services/billing/plans.ts`) covers PLAN_CAPS + PLAN_RATE_LIMITS.
M-031 expands with annual prices (20% discount), trial config, and
plan-change rules. Then M-032+ wire the Shopify Billing API.
