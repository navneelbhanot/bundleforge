# Sessions 0116..0120 — integration adapters

- `src/services/integrations/types.ts` (M-116) —
  `IntegrationAdapter` interface, `BundleOrderEvent` shape,
  `FetchLike` for DI.
- `src/services/integrations/registry.ts` (M-116) — registry +
  `dispatchOrder(shopId, order, loader?)` walks active integrations,
  decrypts credentials (M-002), per-adapter error capture so one
  broken integration can't break the rest.
- `src/services/integrations/shipstation.ts` (M-117) — Basic auth +
  `/orders/createorder`. 5 unit tests with `vi.fn()` fetcher.
- `src/services/integrations/amazon.ts` (M-118) — basic stub; real
  SP-API SigV4 in a follow-up.
- `src/services/integrations/recharge.ts` (M-119) —
  `X-Recharge-Access-Token` + `/checkouts`.
- `src/services/integrations/bold.ts` (M-120) — `BC-API-Key` +
  `/shops/:id/orders`.
- `src/services/integrations/index.ts` re-exports the registry +
  types.

Adapter dispatch is wired into the order pipeline indirectly:
the registry's `dispatchOrder` is ready; `ordersCreate` handler can
call it as soon as an Integration row exists for the shop. Tests
exercise the registry against fake integrations.

385 tests pass.
