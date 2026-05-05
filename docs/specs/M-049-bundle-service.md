# M-049 — Bundle service: CRUD rewrite

## Goal

Replace the inherited stub in `src/services/bundles/index.ts` with a
proper service that supports list / get / create / update / softDelete.
Remove from `tsconfig.json` exclude.

## Why

Every API route under `/api/v1/bundles` (M-053) routes through this
service. Until the stub is replaced, none of those routes can be wired.

## Out of scope

- Publish (M-051), duplicate (M-050), archive (M-052), bulk import
  (M-069). Those land separately.
- Plan-cap enforcement at create (delegated to M-036 middleware).

## Design

```ts
// src/services/bundles/repository.ts (new)
export const bundleRepo = {
  list, count, findById, create, update, softDelete,
};
```

```ts
// src/services/bundles/index.ts (rewrite)
export class BundleService {
  list(shopId, params, filters): Promise<PaginatedResponse>;
  getById(shopId, id): Promise<BundleWithRelations>;
  create(shopId, input): Promise<BundleWithRelations>;
  update(shopId, id, input): Promise<BundleWithRelations>;
  softDelete(shopId, id): Promise<void>;
}
```

`create` validates config via M-048 `validateBundleConfig`. Slug
auto-derived from title.

## Acceptance

- [ ] `src/services/bundles/index.ts` removed from tsconfig exclude.
- [ ] Service typed against generated Prisma client (no `any`).
- [ ] Pure logic (slug normalization, payload->prisma mapping)
      exercised in unit tests with vi.fn() mocks for the prisma client.
- [ ] Soft delete sets `deletedAt` + `status = "deleted"`.
- [ ] Create rejects unknown bundle types.

## Files

- `src/services/bundles/repository.ts` (new)
- `src/services/bundles/index.ts` (rewritten)
- `src/services/bundles/index.test.ts` (new)
- `tsconfig.json` (un-exclude services/bundles)
