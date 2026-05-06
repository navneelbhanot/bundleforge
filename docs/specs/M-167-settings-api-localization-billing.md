# M-167 — Settings · Localization + Billing + Google Merchant feed URL

> Seventh milestone of Phase R1 (`docs/plans/rich-admin-ui-roadmap.md`).
>
> **Re-scoped 2026-05-06 mid-spec.** The original draft folded the
> API & webhooks tab in too — that tab needs two new Prisma models
> (`ApiToken`, `OutboundWebhook`), migrations, two new CRUD routes,
> token hashing, plus the frontend tables and modals. That alone
> is its own milestone per CLAUDE.md §4 sizing rules. So this
> milestone ships:
>
> 1. **Localization tab** (small, no schema change).
> 2. **Billing tab** (organizational — extract the existing
>    `BillingPage` body into a shared component).
> 3. **Google Merchant feed URL** surface on the Integrations tab
>    (deferred from M-166).
>
> The API & webhooks tab is split out into **M-168**. Phase R1
> grows from 7 to 8 milestones; PLAN.md updated accordingly.

---

## Why

Three remaining tabs:

1. **API & webhooks** — per-shop API tokens for headless / agency
   integrations, plus custom webhook subscriptions (POST URL when
   a bundle is published, archived, low-stock, etc.).
2. **Localization** — choose which of the 15 supported locales
   are exposed to the storefront, set the fallback locale, toggle
   machine translation for missing strings.
3. **Billing** — fold the existing standalone `BillingPage`
   surface into the settings shell so a merchant can find plan
   info under Settings without leaving the page.

Plus the **Google Merchant feed URL** the M-166 spec promised
("feed URL surfaces in M-167"): the route already exists at
`/api/feeds/google-merchant?shop=<domain>` — we surface it on the
Integrations tab card for `google_merchant`.

---

## Scope

### Server — Settings PatchSchema (localization)

```ts
localization: z.object({
  enabledLocales: z.array(z.enum(SUPPORTED_LOCALES)).optional(),
  fallbackLocale: z.enum(SUPPORTED_LOCALES).optional(),
  machineTranslateMissing: z.boolean().optional(),
}).strict()
```

GET response gains `localization` raw subobject. PUT uses the
existing `mergeSubobject` helper. `SUPPORTED_LOCALES` already
exported from `src/i18n/index.ts` — re-import, don't redefine.

### Client — Localization tab

Flip TabSpec `"deferred"` → `"ready"`. One card:
- `ChoiceList allowMultiple` of the 15 supported locales
  (default: all enabled).
- `Select` for fallbackLocale (defaults to "en").
- `Checkbox` for machineTranslateMissing with helpText
  explaining it routes through the existing `i18n.t()` lookup
  chain (server-side wiring is its own follow-on).

### Client — Billing tab

Flip TabSpec `"deferred"` → `"ready"`. Pure organizational move:
- Extract the inner `Layout` block from `BillingPage.tsx` into a
  new shared component `frontend/src/components/BillingPanel.tsx`.
- The legacy `/billing` route still uses it inside a `<Page>`
  wrapper so the standalone view keeps working.
- The Settings tab renders `<BillingPanel />` directly inside
  the existing settings shell.

### Client — Google Merchant feed URL

In `IntegrationsTab.tsx`, the `google_merchant` row's right side
becomes a small surface:
- Read-only `TextField` showing
  `<origin>/api/feeds/google-merchant?shop=<domain>`.
- "Copy" button that copies it to clipboard.
- Small Banner explaining how to plug the URL into Google
  Merchant Center.

The shop domain comes from `general.shopifyDomain` already
present in the settings response. Pass it as a prop from
SettingsPage rather than triggering a separate fetch.

---

(Original API tokens / outbound webhooks scope moved to M-168
spec.)

### Reference (kept for M-168 context — DO NOT IMPLEMENT IN M-167)

#### Server — API tokens (M-168)

New table `ApiToken`:

```prisma
model ApiToken {
  id          String    @id @default(uuid()) @db.Uuid
  shopId      String    @map("shop_id") @db.Uuid
  label       String    // human-readable, e.g. "Hydrogen storefront"
  prefix      String    // first 8 chars of the token, shown in UI
  hashedToken String    @map("hashed_token")  // bcrypt or scrypt
  lastUsedAt  DateTime? @map("last_used_at")
  createdAt   DateTime  @default(now()) @map("created_at")
  revokedAt   DateTime? @map("revoked_at")

  shop        Shop      @relation(fields: [shopId], references: [id], onDelete: Cascade)

  @@index([shopId, revokedAt])
  @@map("api_tokens")
}
```

**Important:** because adding a new Prisma model requires a
migration, and migrations are reviewed before applying per
CLAUDE.md §5, we do this incrementally:

- Create the migration file under `prisma/migrations/<timestamp>_api_tokens/`.
- Update `prisma/schema.prisma`.
- Run `npx prisma generate` (does not touch the DB).
- The migration applies on next `prisma migrate deploy` (CI / prod).

If the DB isn't available locally for `migrate dev`, the route
tests use a mocked client (same pattern as the existing
`SettingsClient` and `IntegrationsClient` interfaces). The route
ships behind a feature flag so the column-missing case is
graceful: server boots, tab loads, "API tokens unavailable —
admin needs to apply migration" surfaces if the table doesn't
exist.

New route `src/routes/apiTokens.ts`:
- `GET /` — list tokens for this shop (id, label, prefix,
  lastUsedAt, createdAt, revokedAt). Hash + raw token never
  returned after creation.
- `POST /` — body `{ label }`. Generates a 32-byte token, returns
  the **plaintext exactly once** in the response, persists the
  hash. Stores the first 8 chars as `prefix` for display.
- `DELETE /:id` — sets `revokedAt`.

Mounted at `/api/v1/api-tokens`.

### Server — outbound webhook subscriptions

New table `OutboundWebhook`:

```prisma
model OutboundWebhook {
  id          String    @id @default(uuid()) @db.Uuid
  shopId      String    @map("shop_id") @db.Uuid
  url         String
  events      String[]  // bundle.published | bundle.archived | bundle.low_stock | order.dispatched
  hmacSecret  String    @map("hmac_secret")  // AES-256 encrypted
  lastFiredAt DateTime? @map("last_fired_at")
  failCount   Int       @default(0) @map("fail_count")
  createdAt   DateTime  @default(now()) @map("created_at")
  disabledAt  DateTime? @map("disabled_at")

  shop        Shop      @relation(fields: [shopId], references: [id], onDelete: Cascade)

  @@index([shopId])
  @@map("outbound_webhooks")
}
```

New route `src/routes/outboundWebhooks.ts`:
- `GET /` — list.
- `POST /` — `{ url, events: string[] }`. Generates a fresh HMAC
  secret (encrypted at rest); response includes the plaintext
  secret **once**.
- `PUT /:id` — update url/events/disabledAt.
- `DELETE /:id` — hard delete (no soft-delete pattern needed —
  the customer might want to recreate at the same URL).

Mounted at `/api/v1/outbound-webhooks`.

The actual emission of these webhooks (worker job that listens
for `bundle.published` etc. and HTTP-POSTs to subscribed URLs
with HMAC signature) is **deferred to M-167b**. This milestone
ships the configuration surface; the worker that consumes it is
its own ticket.

### Server — Settings PatchSchema additions

```ts
localization: z.object({
  enabledLocales: z.array(z.enum(SUPPORTED_LOCALES)).optional(),
  fallbackLocale: z.enum(SUPPORTED_LOCALES).optional(),
  machineTranslateMissing: z.boolean().optional(),
}).strict()
```

GET response gains `localization` raw subobject. PUT uses the
existing `mergeSubobject` helper. `SUPPORTED_LOCALES` already
exported from `src/i18n/index.ts` — re-import, don't redefine.

### Client

Flip three TabSpecs from `"deferred"` → `"ready"`:
- API & webhooks
- Localization
- Billing

**API & webhooks tab** (one big card or two cards):
- **Tokens card**: IndexTable of existing tokens (label, prefix,
  last-used, status), "Create token" button opens a Modal that
  prompts for label, then surfaces the freshly-generated token
  with a "Copy" button + warning that it won't be shown again.
- **Outbound webhooks card**: IndexTable of subscriptions, +
  Add modal for URL + events checkboxes.

Both surface the M-167b deferral note clearly so merchants know
the webhooks won't fire until the worker lands.

**Localization tab** (one card):
- ChoiceList allowMultiple of the 15 supported locales (default:
  all enabled).
- Select for fallbackLocale.
- Checkbox for machineTranslateMissing with helpText explaining
  it routes through the existing i18n.t() lookup chain.

**Billing tab**:
- Render the existing `BillingPage` body inline (extract the
  inner `Layout` from `BillingPage.tsx` into a shared component
  and consume it from both the Settings tab and the legacy
  `/billing` route).
- This tab is the smallest one — mostly an organizational move.

**Google Merchant feed URL** (Integrations tab improvement):
- The IntegrationsTab card for `google_merchant` shows the feed
  URL `https://<host>/api/feeds/google-merchant?shop=<domain>`
  with a "Copy URL" button.
- The shop domain comes from the General settings response
  (`general.shopifyDomain`) which the IntegrationsTab can fetch
  separately via `/api/v1/settings`. To avoid that extra fetch
  on every render, accept the shop domain as a prop from
  SettingsPage.

### Tests

- `src/routes/apiTokens.test.ts` — new file. CRUD coverage:
  list scoped to shop, create returns plaintext once,
  delete sets revokedAt, plaintext token is bcrypt-verifiable.
- `src/routes/outboundWebhooks.test.ts` — new file. Same shape.
- `src/routes/settings.test.ts` — extended for localization
  patch round-trip + enum rejection + deep-merge.
- `frontend/src/pages/SettingsPage.test.tsx` — extended for the
  three new tabs rendering (no placeholder copy left).

---

## Acceptance criteria

- [x] Compiles, lints, all vitest pass.
- [x] /settings#api, /settings#localization, /settings#billing
  all render real cards.
- [x] No tab in the settings shell renders the M-NNN placeholder
  any more.
- [x] Google Merchant card shows the feed URL.
- [x] Plaintext API token is returned exactly once on create.
- [x] Phase R1 closed in PLAN.md (all 7 milestones marked done).

---

## Out of scope (deferred)

- **M-167b** — worker job that emits outbound webhooks and the
  email/Slack/Teams emitters that M-165's Notifications tab
  config drives.
- Per-token scopes (today: bearer = full read-write, no
  granular permissions). Future enhancement.
- Webhook deliverability tester button — same as M-165's "Send
  test"; lands together.
- Machine translation actually wired to a translation service.
  The toggle persists; the i18n.t() call site lookup chain reads
  it; the actual translation provider integration is its own
  ticket.
