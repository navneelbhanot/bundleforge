# Why BundleForge

A short, honest answer to "why pick this app over the seven other
bundle apps on the Shopify App Store?" Backed by tests in this repo
that you can read.

## Three things you cannot copy-paste from a feature list

### 1. Checkout-parity tested pricing engine

Most bundle apps compute discounts in two places — the cart widget
and the actual checkout. When those two places drift, the customer
sees one price in the cart and a different one at checkout. That
mismatch is the #1 complaint in negative reviews of native Shopify
Bundles ("validation rule mismatches", "incompatibility with X").

BundleForge runs **the same pricing function** on the server (for
the admin and the order processor) AND inside Shopify's Cart
Transform Function (for the live cart and checkout). Both call the
same pure module. A test asserts they agree on every commit.

- See: [extensions/cart-transform/src/pricing.test.ts](../../extensions/cart-transform/src/pricing.test.ts)
- See: [src/services/pricing/engine.ts](../../src/services/pricing/engine.ts)

If those two files ever disagree, CI is red and the merchant never
sees the inconsistency.

### 2. Inventory audit trail enforced at the database

Most bundle apps maintain inventory state in the application code.
That means a bug, a misconfigured admin user, or a CSV import can
silently rewrite history.

BundleForge writes every inventory adjustment to
`inventory_audit_log`, then enforces immutability at the **Postgres
trigger level**: a `BEFORE UPDATE` trigger raises an exception on
any UPDATE. There is no in-app code path that can rewrite history
because the database refuses.

- See: [prisma/migrations/20260504000001_audit_log_immutable/migration.sql](../../prisma/migrations/20260504000001_audit_log_immutable/migration.sql)
- See: [docs/decisions/0003-inventory-transaction-model.md](../decisions/0003-inventory-transaction-model.md)

This matters when a customer disputes a charge, a 3PL insists the
quantities are wrong, or you're reconciling a return. Your audit log
is the source of truth and it cannot have been tampered with.

### 3. A/B testing with a real significance calculator

Three bundle-app categories advertise A/B testing in their listing
copy. Of those, BundleForge is the only one publishing **what test
of significance is being computed and how**.

Two-proportion z-test, normal CDF, p-value reported, winner declared
only when significant. Property tests run 200 random inputs through
each invariant on every commit.

- See: [src/services/analytics/abTest.ts](../../src/services/analytics/abTest.ts)
- See: [tests/property/pricing.invariants.test.ts](../../tests/property/pricing.invariants.test.ts)

If a competitor app says "Variant B wins!" without showing the math,
you're being told a colour, not a result.

## What this doc deliberately does NOT say

- We do not have years of merchants. Every paid competitor on the
  App Store does. Brand and review-volume gaps are real and only
  close with time.
- We do not advertise more bundle types than competitors who already
  offer 13 (Bundler) or 15 (Simple Bundles). Type breadth is a tie.
- We do not have the 3PL/WMS depth Simple Bundles built in 5 years.
  If your business turns on Simple Bundles' specific 3PL workflows,
  pick them. We tie or lose on that axis.

## Where we honestly trade off

| Axis | BundleForge | Competitor leader |
|---|---|---|
| Bundle type breadth (configurable in admin) | 13 declared, 9 fully editable in admin | Simple Bundles ~15 |
| Multi-language (admin + theme) | 6 locales (en, es, fr, de, it, pt) | Bundler 16+, Shopify Bundles 19 |
| Support — installed base + reviews | 0 installs, 0 reviews | Kaching 4,175 reviews, 5.0★ |
| Live chat in-app | Crisp wired (env-gated) | Most competitors offer this |
| 3PL/WMS workflow depth | ShipStation adapter; Amazon stub | Simple Bundles is the category leader |

We're picking three places to win and being honest about the rest.

## How to verify any claim above

Every code path cited links into this repo. `git clone`, run
`npm test`, and the assertions either pass or they don't. Nothing
above relies on you taking our word for it.
