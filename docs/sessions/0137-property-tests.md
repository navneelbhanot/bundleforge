# Sessions 0137..0139 — Property tests

- **M-137** `tests/property/inventory.concurrency.test.ts` — fake
  repo with an in-memory mutex simulating Postgres' SELECT … FOR
  UPDATE. 100 concurrent decrements reach 0 with all audit rows
  written; mixed +/- deltas converge to the algebraic sum (with a
  filter that mirrors the engine's negative-rejection rule). Validates
  the **logical** contract; full DB-level isolation testing needs
  Postgres at M-145.
- **M-138** `tests/property/webhook.throughput.test.ts` — drives 100
  webhooks at the dispatcher with an in-memory queue spy and asserts
  every ack returns within 5 s plus all 100 are enqueued. Catches
  accidental serialization or async-blocking regressions.
- **M-139** `tests/property/pricing.invariants.test.ts` — random
  PricingInput generator (deterministic mulberry32 seed) + four
  invariants over 200 inputs:
    1. `total + totalDiscount === subtotal` (cents-exact).
    2. `total >= 0`.
    3. Adding a non-applying rule never changes the result.
    4. Removing a stackable rule never increases the discount.

431 tests pass after this batch.
