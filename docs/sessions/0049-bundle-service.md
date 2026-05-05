# Session 0049 — bundle service CRUD rewrite

- Replaced the inherited stub at `src/services/bundles/index.ts`. New:
  - `bundleRepo` in `./repository.ts` (narrow Prisma surface).
  - `BundleService` with `list`, `getById`, `create`, `update`,
    `softDelete`. Strictly typed (no `any`).
  - `slugify` exported pure helper.
  - `ALLOWED_SORT_BY` allowlist prevents arbitrary column sorts (defense
    against SQL-injection-flavored sort params).
  - Per-type config validation via M-048.
- **Removed `src/services/bundles/index.ts` from tsconfig exclude** —
  one of two M-001 carry-overs cleared.
- 11 vi.mock() tests against the repo.
- 232 tests pass.
