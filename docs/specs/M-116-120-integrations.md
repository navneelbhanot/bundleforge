# M-116..M-120 — Integration adapter framework + 4 adapters

## M-116 Adapter framework

Single interface every external integration implements:

```ts
interface IntegrationAdapter {
  type: "shipstation" | "amazon" | "recharge" | "bold" | "klaviyo" | "google_merchant" | "custom_3pl";
  /** Test the credentials. */
  ping(creds: unknown): Promise<{ ok: boolean; message?: string }>;
  /** Push an event the integration cares about. Optional. */
  pushOrder?(args: { creds: unknown; order: BundleOrderEvent }): Promise<void>;
}
```

Registry at `src/services/integrations/registry.ts`. Loads credentials
from the `Integration` table (decrypting via M-002 helper) and
dispatches by `type`.

## M-117..M-120 Adapters

- **ShipStation** (M-117) — pushOrder forwards SKU breakdown.
- **Amazon** (M-118) — basic pushOrder stub.
- **Recharge** (M-119) — subscription bundle creation hook.
- **Bold** (M-120) — subscription/upsell hook.

Each adapter is a thin HTTP wrapper. Tests use `vi.fn()` fetcher to
avoid hitting real APIs.

## Files

- `src/services/integrations/types.ts`
- `src/services/integrations/registry.ts`
- `src/services/integrations/registry.test.ts`
- `src/services/integrations/shipstation.ts`
- `src/services/integrations/shipstation.test.ts`
- `src/services/integrations/amazon.ts`
- `src/services/integrations/recharge.ts`
- `src/services/integrations/bold.ts`
- (the existing `src/services/integrations/index.ts` becomes a
  re-export hub)
