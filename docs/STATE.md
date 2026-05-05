# STATE.md — Live Project State

> Updated at the end of every session, in the same commit as the work.

---

## Current milestone

**M-061 — Vertical slice: BXGY (buy X, get Y)**

## Exact next action

Boot phase, then write `docs/specs/M-061-bxgy-slice.md`. BXGY differs
from BOGO in that the "Y" can be from a different SKU set than the
"X". For now BXGY uses the same `bogo` rule type with explicit
itemBundleId tags; the slice test asserts the price calculation. Pattern
mirrors M-056..M-060 (vi.mocked repo, buildPricingInput helper).

## Blockers

None.

## Carry-overs (still active)

- Lint deferred behavior absent (lint is wired since M-012).
- Broader Shopify SDK upgrade (api v13, app-express v7, prisma v6, etc.)
  flagged for ADR before going live.
- npm audit findings → M-140.
- `prisma/seed.ts` excluded from main tsc build; M-010 verifies it
  compiles under ts-node. **Both M-001 stub-exclusion carry-overs
  cleared as of M-053.**

## Recently completed

- M-060 — BOGO vertical slice. `docs/sessions/0060-bogo-slice.md`.
- M-059 — mix-and-match slice. `docs/sessions/0059-mix-match-slice.md`.
- M-058 — volume slice. `docs/sessions/0058-volume-slice.md`.
- M-057 — multipack slice. `docs/sessions/0057-multipack-slice.md`.
- M-056 — fixed bundle slice. `docs/sessions/0056-fixed-slice.md`.
- M-055 — PricingRule service. `docs/sessions/0055-pricing-rule-service.md`.
- M-054 — BundleItem service. `docs/sessions/0054-bundle-item-service.md`.
- M-053 — bundle routes. `docs/sessions/0053-bundle-routes.md`.
- M-052 — bundle archive. `docs/sessions/0052-bundle-archive.md`.
- M-051 — bundle publish. `docs/sessions/0051-bundle-publish.md`.
- M-050 — bundle duplicate. `docs/sessions/0050-bundle-duplicate.md`.
- M-049 — bundle service CRUD rewrite. `docs/sessions/0049-bundle-service.md`.
- M-048 — bundle config validators. `docs/sessions/0048-bundle-validators.md`.
- M-047 — condition evaluator verified. `docs/sessions/0047-conditions.md`.
- M-046 — stackability + priority verified. `docs/sessions/0046-stackability.md`.
- M-045 — bogo rule. `docs/sessions/0045-bogo-rule.md`.
- M-044 — volume rule. `docs/sessions/0044-volume-rule.md`.
- M-043 — tiered rule. `docs/sessions/0043-tiered-rule.md`.
- M-042 — flat_discount rule. `docs/sessions/0042-flat-discount-rule.md`.
- M-041 — percentage rule. `docs/sessions/0041-percentage-rule.md`.
- (Earlier history in PLAN.md.)

## Working branch

`claude/review-product-plan-jfMlf`
