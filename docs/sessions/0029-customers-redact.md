# Session 0029 — GDPR customers/redact

- **Date:** 2026-05-04
- **Milestone(s):** M-029

## What was done

- Mirror of M-028. Ack-only handler (no PII stored). Logs metadata.
- 2 tests; registered in webhooksWorker.

## Acceptance

- [x] All criteria; 122 tests.

## Handoff

Next: **M-030 — shop/redact**. The meaningful one — Shopify gives 48h
notice that an uninstalled shop's data must be deleted. Cascade-delete
the shop row (everything else falls via FK cascade). Tests with vi.fn()
prisma mock.
