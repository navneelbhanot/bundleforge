# M-137..M-139 — Concurrency + throughput + property tests

## M-137 Inventory engine concurrency

Property test: launch N concurrent `applyAdjustment` calls against a
fake repo with shared in-memory state guarded by a mutex. Assert the
final balance equals the sum of deltas — no oversell. Validates the
**logical** contract; full DB-level serializable isolation testing
needs Postgres and lands at the live CI step (M-140 / M-145).

## M-138 Webhook throughput

Property test: enqueue N webhooks against an in-memory queue and
assert the dispatcher acknowledges each within 100 ms (synthetic).
Catches ordering bugs and confirms the dispatcher's contract.

## M-139 Pricing property tests (extended)

Random PricingInput generator + invariants:

1. `total + totalDiscount === subtotal` (within ±1 cent).
2. `total >= 0`.
3. Adding a non-applying rule never changes the result.
4. Removing a stackable rule never increases the discount.

Fuzz with 200 random inputs.

## Files

- `tests/property/inventory.concurrency.test.ts`
- `tests/property/webhook.throughput.test.ts`
- `tests/property/pricing.invariants.test.ts`
