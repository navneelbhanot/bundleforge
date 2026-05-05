# ADR-0004 — Security review pass (M-140)

- **Status:** accepted
- **Date:** 2026-05-05
- **Deciders:** Claude Code session (M-140), user

---

## Context

Pre-launch sweep covering OWASP Top 10 + known npm audit findings.
Records the current security posture, what's implemented, and what's
explicitly accepted as residual risk.

## Implemented controls (by OWASP category)

### A01 Broken access control

- All `/api/v1/*` routes require an authenticated Shopify session
  (`shopify.validateAuthenticatedSession`, M-021) AND a resolved
  `Shop` row (`requireShopSession`, M-019).
- Repositories filter by `shopId` in every query — no cross-tenant
  reads. Tests in `src/services/bundles/itemService.test.ts` and
  `pricingRuleService.test.ts` exercise the deny-cross-tenant path.
- App Proxy routes verify HMAC signatures via `timingSafeEqual`
  (M-085).
- Webhook routes verify HMAC against the raw body (M-024).

### A02 Cryptographic failures

- AES-256-GCM at rest for `Shop.accessToken` and integration creds
  (M-002, ADR-0002 doesn't apply here — this is encryption, not
  pricing).
- 12-byte IV, 16-byte tag, base64url, version-prefixed wire format.
- `ENCRYPTION_KEY` validated as exactly 64 hex chars.
- All HTTP traffic in production must be TLS (operational; not
  enforced in code beyond Helmet's HSTS).

### A03 Injection

- Prisma parameterized queries everywhere. Raw SQL only in migrations.
- `BundleService.list` allowlists sortable columns (`ALLOWED_SORT_BY`)
  to prevent ORDER BY injection via query params.
- Zod validates every external input (env, route bodies, webhook
  payloads after HMAC verification).

### A04 Insecure design

- ADR-0003 + ADR-0003a: inventory_audit_log is append-only via
  database-level triggers (BEFORE UPDATE blocks; BEFORE DELETE was
  relaxed for GDPR cascade, with rationale).
- Pricing engine is a pure function with a shared contract enforced
  by cross-runtime fixtures (ADR-0002).

### A05 Security misconfiguration

- Helmet configured server-wide (CSP off — Shopify owns CSP for
  embedded apps).
- Rate limiter mounted on `/api` (M-008), per-shop key, plan-aware
  budgets.
- Errors never leak stack traces in 5xx bodies (M-007). Stacks go to
  Pino + Sentry.

### A06 Vulnerable + outdated components

`npm audit` output (production deps): **3 moderate**, all rooted in
`uuid <14` pulled by `@shopify/shopify-api` ≤ 11.14.1.

  - **Risk:** missing buffer bounds check in `uuid.v3/v5/v6` when an
    explicit `buf` argument is provided.
  - **Exposure:** we do not call `uuid.v3/v5/v6` with a `buf`
    argument anywhere in our codebase. Verified by grep.
  - **Plan:** upgrade Shopify SDK to api v13 + app-express v7 +
    session-storage-prisma v9 (the version-bump previously flagged in
    M-001's carry-over). Tracked separately; not blocking M-140.

`npm audit` for dev deps adds 4 more in the `vite/vite-node/vitest`
chain via transitive `esbuild`. **Dev-only — not shipped to
production runtimes.** Will be picked up by routine vitest upgrades.

### A07 Identification + authentication failures

- Shopify OAuth handled by `@shopify/shopify-app-express`. Sessions
  persisted via `PrismaSessionStorage` (M-020).
- `requireShopSession` middleware refuses uninstalled shops (`M-019`).
- HMAC verification uses `crypto.timingSafeEqual` to prevent timing
  attacks (M-024, M-085).

### A08 Software + data integrity failures

- Database-level immutability triggers on `inventory_audit_log`.
- Server-side input validation (Zod) for everything coming in.
- Webhook deduplication via `jobId = webhookId` in the BullMQ enqueue
  (M-025).

### A09 Security logging + monitoring failures

- Pino structured logs with `service`, `version`, `module`, `reqId`
  on every line.
- Sentry seam (M-015) captures 5xx + uncaught errors.
- Audit trail (`inventory_audit_log`) is the durable record for
  inventory mutations.

### A10 Server-side request forgery

- Outbound HTTP calls in adapters (Shopify, ShipStation, Recharge,
  Bold, Klaviyo, Amazon) hit fixed, hard-coded base URLs. None take
  user-supplied URLs to fetch.
- AI service URL comes from `env.AI_SERVICE_URL`, not user input.

## Residual risk accepted at M-140

1. **uuid <14 in Shopify SDK transitive deps.** Mitigated by the
   fact we don't call the vulnerable code path. Resolved when the
   Shopify SDK upgrade lands.
2. **Vite/vitest dev chain advisories.** Dev-only.
3. **No SOC 2 audit yet.** Out of scope for M-140; planned alongside
   public launch (M-153+).
4. **Rate limiter is per-shop, not per-IP-and-shop.** A noisy
   merchant on a shared IP could accidentally exhaust capacity. Add
   per-IP secondary limiter only if abuse is observed.

## Action items completed in M-140

- This ADR.
- Verified `npm audit` output and confirmed each finding's exposure.
- Added `npm run audit:prod` script to surface production-only
  findings reproducibly.

## Action items deferred

- Shopify SDK upgrade (api v13 / app-express v7 / session-storage-prisma
  v9 / prisma v6) — already in the M-001 carry-over.
- Vite + vitest upgrade — routine; do alongside next dep bump.
- SOC 2 — pre-public-launch milestone.
