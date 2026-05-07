# M-168 — Settings · API & webhooks tab

> Eighth and final milestone of Phase R1
> (`docs/plans/rich-admin-ui-roadmap.md`). Split out from M-167's
> original draft because two new Prisma models + two CRUD routes is
> its own milestone per CLAUDE.md §4 sizing. Closes Phase R1.

---

## Why

Two related capabilities the merchant needs to integrate
MintBundle with their own stack:

1. **Per-shop API tokens** — Hydrogen storefronts, agency tools,
   one-off scripts. Issued from the admin, sent as
   `Authorization: Bearer <token>`.
2. **Outbound webhook subscriptions** — POST a payload to a URL
   the merchant chooses when a bundle event fires (published,
   archived, low-stock, etc.). Lets merchants forward events to
   their own backend without reverse-polling our API.

Both are baseline features competitor apps charge for at higher
tiers. Surfacing them on the free / Growth tier widens our value
delta vs Bundler / BOGOS / Kaching.

---

## Scope

### Server — Prisma schema additions

Two new models in `prisma/schema.prisma`:

```prisma
model ApiToken {
  id          String    @id @default(uuid()) @db.Uuid
  shopId      String    @map("shop_id") @db.Uuid
  label       String                                  // human-readable, e.g. "Hydrogen storefront"
  prefix      String                                  // first 8 chars of the token, shown in UI
  hashedToken String    @map("hashed_token")          // bcrypt
  lastUsedAt  DateTime? @map("last_used_at")
  createdAt   DateTime  @default(now()) @map("created_at")
  revokedAt   DateTime? @map("revoked_at")

  shop        Shop      @relation(fields: [shopId], references: [id], onDelete: Cascade)

  @@index([shopId, revokedAt])
  @@map("api_tokens")
}

model OutboundWebhook {
  id          String    @id @default(uuid()) @db.Uuid
  shopId      String    @map("shop_id") @db.Uuid
  url         String
  events      String[]                                // ["bundle.published", "bundle.archived", ...]
  hmacSecret  String    @map("hmac_secret")           // AES-256 encrypted
  lastFiredAt DateTime? @map("last_fired_at")
  failCount   Int       @default(0) @map("fail_count")
  createdAt   DateTime  @default(now()) @map("created_at")
  disabledAt  DateTime? @map("disabled_at")

  shop        Shop      @relation(fields: [shopId], references: [id], onDelete: Cascade)

  @@index([shopId])
  @@map("outbound_webhooks")
}
```

Add the two relations to `model Shop {}`:

```prisma
apiTokens         ApiToken[]
outboundWebhooks  OutboundWebhook[]
```

Migration file: `prisma/migrations/<ts>_api_tokens_and_outbound_webhooks/migration.sql`
created in source. **The migration is NOT applied in this
session** — per CLAUDE.md §5 it's reviewed before applying. CI's
`prisma migrate deploy` will pick it up on next deploy.

### Server — `/api/v1/api-tokens`

`src/routes/apiTokens.ts` (new file):

- **GET /** — list this shop's tokens. Returns
  `{ id, label, prefix, lastUsedAt, createdAt, revokedAt }[]`.
  **Never returns the hash or the plaintext.**
- **POST /** — body `{ label }`. Generates a 32-byte token
  (`crypto.randomBytes(32).toString("hex")`), bcrypts it (cost
  10), persists with the first 8 chars as `prefix`. Returns the
  plaintext **exactly once** in the response:
  `{ id, label, prefix, plaintext: "bf_..." }`.
- **DELETE /:id** — sets `revokedAt`. Doesn't hard-delete (audit
  trail).

Mounted at `/api/v1/api-tokens`.

### Server — `/api/v1/outbound-webhooks`

`src/routes/outboundWebhooks.ts` (new file):

- **GET /** — list. Returns the full row except `hmacSecret`
  is replaced with a `secretKeys: ["v1:<encrypted blob>"]`
  marker so the UI shows "saved" without leaking the value.
- **POST /** — `{ url, events: string[] }`. Generates a fresh
  32-byte HMAC secret, AES-encrypts via `src/utils/encryption.ts`,
  persists. Response includes `secretPlaintext` **exactly once**.
- **PUT /:id** — update url / events / disabledAt. Doesn't
  rotate the secret.
- **DELETE /:id** — hard delete (recreate at the same URL works).

Mounted at `/api/v1/outbound-webhooks`.

Allowed event names (Zod enum):
- `bundle.published`
- `bundle.archived`
- `bundle.low_stock`
- `order.dispatched`

Both endpoints DI-friendly via the same `client`-injection pattern
as the integrations route, so tests don't need a real DB.

### Client

Flip the API & webhooks TabSpec from `"deferred"` → `"ready"`.

**Tokens card:**
- IndexTable with rows: label, prefix (`bf_xxxx•••`), last-used
  (relative time or "Never"), revoked badge if applicable, Revoke
  button.
- "Create token" button opens a Modal:
  - TextField for label.
  - On Save, calls POST and shows the plaintext token in a
    one-time `Banner tone="info"` with a "Copy" button + warning
    that it won't be shown again.

**Outbound webhooks card:**
- IndexTable: URL, events (comma-joined), enabled/disabled,
  failCount, lastFiredAt.
- "Add webhook" Modal:
  - TextField for URL (must be https://).
  - ChoiceList allowMultiple for events.
  - On Save, shows the HMAC secret once with a Copy button.

Both cards include a Banner explaining that **delivery itself is
deferred to M-168b** (worker job emitting POSTs when events fire);
the configuration surface persists today so merchants can prepare
their endpoints and MintBundle can start firing as soon as the
worker lands.

### Tests

- `src/routes/apiTokens.test.ts` (new):
  - GET returns scoped list with no hashes.
  - POST returns plaintext exactly once + persists bcrypt hash.
  - DELETE sets revokedAt.
  - Cross-tenant: shop A can't list/revoke shop B's tokens.

- `src/routes/outboundWebhooks.test.ts` (new):
  - POST returns plaintext HMAC secret once + persists encrypted.
  - PUT updates url/events.
  - GET never returns the plaintext.
  - DELETE hard-deletes.

- `frontend/src/pages/SettingsPage.test.tsx` — Updated placeholder
  test removed (since no tabs are placeholders any more).

- New component tests for the new tab content if it gets its own
  component file (likely keep inline in SettingsPage like the
  other tabs).

---

## Acceptance criteria

- [x] Compiles, lints clean, all vitest pass.
- [x] /settings#api renders Tokens + Outbound webhooks cards.
- [x] No tab in the settings shell shows the placeholder copy.
- [x] Token plaintext returned exactly once on create; bcrypt
  hash persisted.
- [x] HMAC secret AES-encrypted at rest; plaintext returned
  exactly once.
- [x] Phase R1 closed in PLAN.md (8/8 milestones done).

---

## Out of scope (deferred)

- **M-168b** — worker job that emits the outbound webhooks. Walks
  subscriptions for the firing event, signs the body with the
  decrypted HMAC, POSTs with retry + failCount tracking. Same
  ticket can wire the M-165 Notifications config (Slack/Teams/
  email channel emitters) since both need the same per-shop
  delivery infra.
- Per-token scopes / read-only tokens — today every token is a
  full read-write Bearer. Scope vocabulary lands when merchants
  ask.
- Webhook deliverability "Send test" button — needs the worker
  round-trip; lands with M-168b.
- Token rotation — today merchants revoke + recreate. Self-
  service rotation is a future enhancement.
