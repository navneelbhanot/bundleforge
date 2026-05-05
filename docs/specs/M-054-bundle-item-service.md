# M-054 — BundleItem service

Operations on individual items within a bundle (add/remove/update/reorder).
Used later by the visual builder; for M-054 we expose a thin service so
M-053 routes (or future routes) can drive it.

## API

```ts
class BundleItemService {
  add(bundleId, item): Promise<BundleItem>;
  update(itemId, patch): Promise<BundleItem>;
  remove(itemId): Promise<void>;
  reorder(bundleId, orderedIds[]): Promise<void>;
}
```

Tenant safety: every operation verifies the parent Bundle's shopId before
touching items.
