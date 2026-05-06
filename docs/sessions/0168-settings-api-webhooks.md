# Session 0168 — Settings · API & webhooks tab (closes Phase R1)

- **Date:** 2026-05-06
- **Milestone(s):** M-168
- **Branch:** claude/objective-sinoussi-77ae86
- **Commit(s):** TBD

---

## Goal

Close Phase R1 by adding the API tokens + outbound webhooks tab.
This was the milestone split out of M-167's original draft because
two new Prisma models + migrations + CRUD routes is too much for
one session combined with the simpler Localization/Billing tabs.

## What was done

- **Spec written:** `docs/specs/M-168-settings-api-webhooks.md`.

- **Prisma schema** (`prisma/schema.prisma`):
  - Added `ApiToken` model: id, shopId, label, prefix
    (display-only first 11 chars), hashedToken (scrypt),
    lastUsedAt, createdAt, revokedAt.
  - Added `OutboundWebhook` model: id, shopId, url, events
    (string array), hmacSecret (AES-encrypted), lastFiredAt,
    failCount, createdAt, disabledAt.
  - Added two relation fields on `Shop`.
  - Generated the Prisma client (`npx prisma generate`).

- **Migration file** (NOT applied):
  `prisma/migrations/20260506160000_api_tokens_and_outbound_webhooks/migration.sql`.
  Per CLAUDE.md §5 the user reviews and applies on next deploy.

- **Token hashing util** (`src/utils/tokenHash.ts` + tests, new):
  - `hashToken(plaintext)` returns `v1:<salt-hex>:<hash-hex>` via
    Node's built-in `scryptSync` (N=16384, r=8, p=1, 32-byte key).
  - `verifyToken(plaintext, persisted)` does timing-safe compare.
  - `generateToken()` returns `bf_<64-hex>`.
  - `tokenPrefix(token)` returns first 11 chars.
  - No new deps — built on `node:crypto`.

- **Routes:**
  - `src/routes/apiTokens.ts` — GET/POST/DELETE. Plaintext
    returned exactly once. DELETE soft-revokes (sets revokedAt;
    idempotent).
  - `src/routes/outboundWebhooks.ts` — GET/POST/PUT/DELETE. POST
    returns secretPlaintext exactly once; persisted form is
    AES-encrypted. PUT supports url / events / enabled
    (enabled=false sets disabledAt to a fresh timestamp).
    DELETE is hard.
  - Both routes mounted at `/api/v1/api-tokens` and
    `/api/v1/outbound-webhooks` in `src/server/index.ts`.
  - Both DI-friendly via `client` injection so route tests don't
    need a real DB.

- **Frontend** (`frontend/src/components/ApiWebhooksTab.tsx`,
  new file):
  - `TokensCard` — IndexTable with one row per token. Status
    Badge (Active / Revoked), Revoke button per active row.
    "Create token" Modal: TextField for label → POST → renders
    plaintext in a one-shot info Banner with Copy button.
  - `WebhooksCard` — IndexTable with URL / events / status /
    last-fired / Delete. "Add webhook" Modal: URL TextField +
    events ChoiceList → POST → renders HMAC plaintext in a
    one-shot Banner.
  - Top-level Banner explaining that the worker that actually
    fires the HTTP POSTs lands in M-168b — config is ready
    today.
  - Wired into `SettingsPage` via the existing tab switch.
    The API & webhooks TabSpec flipped to `"ready"`.

## Tests added

- `src/utils/tokenHash.test.ts` (6 cases, new):
  - Hash + verify round-trip.
  - Wrong plaintext rejected.
  - Unique salt per call (same plaintext → different hashes).
  - Malformed persisted strings safely fail.
  - generateToken format matches `/^bf_[a-f0-9]{64}$/`.
  - tokenPrefix returns first 11 chars.

- `src/routes/apiTokens.test.ts` (7 cases, new):
  - GET lists without leaking hash/plaintext.
  - GET scoped to req.shopId.
  - POST returns plaintext exactly once + persists hash.
  - POST rejects empty label.
  - DELETE sets revokedAt.
  - DELETE idempotent on already-revoked.
  - DELETE 404s cross-tenant.

- `src/routes/outboundWebhooks.test.ts` (11 cases, new):
  - GET lists without leaking HMAC secret.
  - GET scoped to req.shopId.
  - POST returns plaintext + encrypts at rest.
  - POST rejects unknown event / non-http URL / empty events.
  - PUT updates url + events.
  - PUT enabled toggle sets/clears disabledAt.
  - PUT 404s cross-tenant.
  - DELETE hard-deletes.
  - DELETE 404s cross-tenant.

- `frontend/src/pages/SettingsPage.test.tsx` (20 cases, +0 net):
  - Updated the placeholder regression test to assert the API
    tab now renders real cards (no more "being built in") and
    surfaces both `API tokens` + `Outbound webhooks` headings.

## Acceptance criteria status

- [x] Compiles, lints clean, all 565 vitest pass.
- [x] /settings#api renders Tokens + Outbound webhooks cards.
- [x] No tab in the settings shell shows the placeholder copy.
- [x] Token plaintext returned exactly once on create; scrypt
  hash persisted.
- [x] HMAC secret AES-encrypted at rest; plaintext returned
  exactly once.
- [x] **Phase R1 closed: 8/8 milestones done.**

## Verified by hand

- `npx vitest run src/utils/tokenHash.test.ts` → 6/6.
- `npx vitest run src/routes/apiTokens.test.ts` → 7/7.
- `npx vitest run src/routes/outboundWebhooks.test.ts` → 11/11.
- `npx vitest run frontend/src/pages/SettingsPage.test.tsx` → 20/20.
- `npx vitest run` (full) → 565 passed, 13 skipped.
- `npm run typecheck` → clean.

## Deferred

- **M-168b** — worker job that:
  - Walks active OutboundWebhook subscriptions when a fire-eligible
    event happens (bundle.published / bundle.archived /
    bundle.low_stock / order.dispatched).
  - Decrypts the HMAC secret, signs the payload body
    (`X-BundleForge-Signature` header), POSTs with retry +
    `failCount` tracking.
  - Same ticket can wire the M-165 Notifications channel emitters
    (Slack/Teams/email) since both share per-shop delivery infra.
- Per-token scopes — today every token is full read-write Bearer.
  Future enhancement when merchants ask.
- "Send test" buttons next to webhook URLs — needs the worker
  round-trip; M-168b.
- Token rotation — today merchants revoke + recreate. Self-service
  rotation is a future enhancement.

## Notes

The decision to use Node's `scryptSync` over installing `bcrypt`/
`bcryptjs` was deliberate: tokens here are 32-byte random strings
(already high entropy), so we don't need argon2's interactive
tuning. scrypt has the right cost knobs and is built-in. This
saves a dependency and a `node-gyp` rebuild risk on Railway.

The migration file is in source but unapplied. CI's
`prisma migrate deploy` will pick it up next deploy. Until then,
the route tests use mocked clients (the same pattern used for
SettingsClient and IntegrationsClient) so 565/565 vitest pass
even on a fresh checkout without running the migration.

The "exactly once" plaintext flow uses a single Banner inside the
existing Modal — copy-to-clipboard + close. No separate confirmation
step. If the merchant closes without copying, they have to revoke
and create a new token. This matches Stripe / GitHub's UX for the
same problem.
