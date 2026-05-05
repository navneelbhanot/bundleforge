# Inventory

How bundle sales affect your component stock — and why this is the
part of bundling apps that most often goes wrong elsewhere.

## The model in one sentence

A bundle is a **virtual SKU**; selling one decrements every component
SKU by `quantity × bundles ordered`, atomically, with a permanent
audit log entry per component.

## Why this matters

Most Shopify bundle apps end up with one of these failure modes:

- Cart shows in stock; customer pays; component was actually sold out
  in another order seconds earlier; your fulfillment team has no
  bundle to ship.
- Inventory updates partially fail (component A decremented, B did
  not); your stock-on-hand drifts from reality over weeks.
- A bug rewrites historical inventory rows; you lose the audit trail
  needed to reconcile a customer dispute or a return.

BundleForge's inventory engine is designed to make all three
impossible:

| Risk | How BundleForge prevents it |
|---|---|
| Race conditions between two orders | Every adjustment runs in a Postgres `transaction` with row-level locks |
| Partial updates | One transaction = all components updated or none |
| Audit drift | The `inventory_audit_log` table has a database-level `BEFORE UPDATE` trigger that **rejects every UPDATE**. Rows are insert-only. |

## What the audit log tells you

Every adjustment writes one row per component:

```
| timestamp | bundle_id | component_sku | delta | reason | order_id |
```

You can see this in the admin under **Inventory → Audit**, or query
it directly via `GET /api/v1/inventory/audit`. The route supports
filters by SKU, date range, and reason.

## What happens when stock runs low

Two configurable behaviors per bundle (default in **bold**):

- **Continue selling until any component hits zero**, then auto-mark
  the bundle as out-of-stock on the storefront.
- Stop selling at a configurable threshold (e.g. ≤ 5 units of any
  component).

Either way, the storefront and admin agree on the bundle's
availability via the same Inventory Health endpoint
(`GET /api/v1/inventory/health`).

## Reconciling with Shopify inventory

BundleForge writes to its own `inventory_sync_state` table — not
Shopify's inventory directly — for two reasons:

1. **Multi-location**. Shopify's per-location inventory model doesn't
   cover bundle composition cleanly; we maintain a per-shop view that
   sums where it makes sense.
2. **Auditability**. Shopify's inventory_levels table is mutable;
   ours is append-only.

When you sync to a 3PL or marketplace (ShipStation, Amazon), the
adapter reads from `inventory_sync_state`, not Shopify directly.

## Returns and exchanges

When a Shopify order is refunded:

1. The `refunds/create` webhook fires.
2. BundleForge's order processor walks the bundle's components.
3. Each component gets an inventory adjustment with `reason: 'refund'`,
   linked back to the original order in the audit log.

Partial refunds (one component returned, one kept) are handled — the
refund webhook payload includes line-item-level detail, and the
processor only re-credits the component(s) actually returned.

## What to watch for

- **A bundle won't publish if any component's `inventory_quantity` is
  null** (Shopify's "inventory not tracked" flag). Set up tracking on
  every SKU you bundle, or BundleForge can't keep books for them.
- **Pre-orders** (Shopify's "Continue selling when out of stock") and
  bundles don't compose well. You can do it, but the audit log will
  show negative deltas — readable, but expect questions.

---

**Next:** [Storefront integration](storefront.md) — how bundles render
to your customer.
