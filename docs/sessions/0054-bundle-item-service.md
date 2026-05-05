# Session 0054 — BundleItem service

`src/services/bundles/itemService.ts`: tenant-safe add/update/remove/
reorder. `assertOwned` verifies the parent Bundle's shopId before any
write. `reorder` uses Prisma `$transaction` for positional updates. DI
via `BundleItemRepo` interface. 8 unit tests.
