# Session 0140 — Security review pass

Documented in `docs/decisions/0004-security-review.md`. Highlights:

- **OWASP A01..A10** mapped to existing controls: tenant scoping
  via `requireShopSession`, AES-256-GCM at rest (M-002), HMAC
  verification on App Proxy + webhooks via `timingSafeEqual`,
  Prisma parameterized queries + Zod input validation, sort-column
  allowlist on bundle list, append-only audit log, structured Pino
  logs + Sentry seam.
- **`npm audit`**: 3 moderate findings in production deps (all rooted
  in `uuid <14` pulled by `@shopify/shopify-api`); we don't call the
  vulnerable `uuid.v3/v5/v6(buf)` code path. 4 more dev-only findings
  in the `vite/vitest/esbuild` chain. Documented as residual risk.
- New script: `npm run audit:prod` surfaces production-only findings.
- Shopify SDK upgrade (api v13 / app-express v7 / session-storage-prisma
  v9 / prisma v6) tracked separately — already in M-001 carry-overs.

431 tests pass. **Closes Phase N partial work (M-137..M-140) and the
M-101..M-140 target.**
