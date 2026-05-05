# STATE.md — Live Project State

> Updated at the end of every session, in the same commit as the work.

---

## Current milestone

**M-101 — Visual builder: pricing rules editor**

## Exact next action

Boot phase, then write `docs/specs/M-101-pricing-rules-editor.md`.
Add a Polaris-based pricing rules editor component (DataTable +
inline editors) that consumes `/api/v1/bundles/:id` rules array and
calls back via `onChange(rules)`. RTL tests render two rules and
assert they show in the table. Wire into `BundleDetailPage`.

## Blockers

None.

## Carry-overs (still active)

- npm audit findings → M-140 (security review).
- Broader Shopify SDK upgrade (api v13, app-express v7, prisma v6)
  flagged for ADR before going live.
- ResourcePicker integration on ProductPicker (M-099) deferred until
  App Bridge actions are wired in a follow-up.
- Cross-runtime fixture set will keep growing as new rule types or
  edge cases land. ADR-0002 holds.

## Recently completed

- M-100 — Type-specific config panels. `docs/sessions/0094-frontend-scaffold.md`.
- M-099 — Product picker. `docs/sessions/0094-frontend-scaffold.md`.
- M-098 — Bundle detail page. `docs/sessions/0094-frontend-scaffold.md`.
- M-097 — Bundles list page. `docs/sessions/0094-frontend-scaffold.md`.
- M-096 — Admin routing. `docs/sessions/0094-frontend-scaffold.md`.
- M-095 — App Bridge integration. `docs/sessions/0094-frontend-scaffold.md`.
- M-094 — Frontend scaffold. `docs/sessions/0094-frontend-scaffold.md`.
- M-093 — Theme i18n strings. `docs/sessions/0088-theme-extension.md`.
- M-092 — BOGO theme block. `docs/sessions/0088-theme-extension.md`.
- M-091 — Mix-match theme block. `docs/sessions/0088-theme-extension.md`.
- M-090 — Build-a-box theme block. `docs/sessions/0088-theme-extension.md`.
- M-089 — Variant selector theme block. `docs/sessions/0088-theme-extension.md`.
- M-088 — Bundle display theme block. `docs/sessions/0088-theme-extension.md`.
- M-087 — Validation Function. `docs/sessions/0087-validation-function.md`.
- M-086 — Checkout Guardian. `docs/sessions/0085-app-proxy-and-guardian.md`.
- M-085 — App Proxy bundle config. `docs/sessions/0085-app-proxy-and-guardian.md`.
- M-084 — Cross-runtime parity. `docs/sessions/0081-cart-transform-function.md`.
- M-083 — Cart Transform pricing port. `docs/sessions/0081-cart-transform-function.md`.
- M-082 — Cart Transform attribute markers. `docs/sessions/0081-cart-transform-function.md`.
- M-081 — Cart Transform scaffold. `docs/sessions/0081-cart-transform-function.md`.
- (Earlier history in PLAN.md.)

## Working branch

`claude/review-product-plan-jfMlf`
