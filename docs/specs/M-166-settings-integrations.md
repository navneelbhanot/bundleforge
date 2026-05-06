# M-166 — Settings · Integrations tab

> Sixth milestone of Phase R1 (`docs/plans/rich-admin-ui-roadmap.md`).
> First R-phase milestone that adds a new server route — the
> existing tabs all reused `/api/v1/settings`. Integrations need
> credential encryption, per-adapter ping, and per-type rows so they
> get their own endpoint.

---

## Why

`src/services/integrations/{shipstation,recharge,bold,klaviyo,
googleMerchant,amazon,registry}.ts` already exist with adapter
shapes (`ping(creds)` and `pushOrder()`); the order-dispatch
worker walks the registry on every BundleOrder. The merchant just
has no UI to:

- See which integrations are connected vs available.
- Add or update credentials.
- Test that the credentials they pasted actually work
  (without waiting for the next order to dispatch).

Today the only way credentials reach the registry is via a manual
DB insert. This milestone fixes that.

---

## Scope

### Server — new route `/api/v1/integrations`

`src/routes/integrations.ts` (new file):

- **GET /** — list this shop's integrations, joined with the
  adapter registry to show *all known types* (active + inactive).
  Returns:
  ```jsonc
  [
    {
      "type": "shipstation",
      "status": "active",                  // active | inactive | error
      "lastSyncedAt": "2026-05-06T...",
      "errorMessage": null,
      "credentialKeys": ["apiKey","apiSecret"],   // present keys, NOT values
      "settings": { ... }
    },
    {
      "type": "klaviyo",
      "status": "inactive",                // never connected
      "credentialKeys": [],
      "settings": {}
    },
    ...
  ]
  ```
  Important: never returns the credential **values**. UI shows a
  redacted "•••• 5821" using the last 4 chars of the persisted
  value when re-rendering an existing record.

- **PUT /:type** — upsert the integration. Body:
  `{ credentials: { apiKey: "...", apiSecret: "..." }, settings: {} }`.
  Server AES-encrypts the whole `credentials` object via
  `src/utils/encryption.ts` before persisting (the existing
  pattern for Shop.accessToken). Sets `status: "active"`.

- **POST /:type/test** — calls `adapter.ping(decrypted creds)`
  and returns `{ ok: boolean; message?: string }`. Doesn't mutate
  the integration row. Useful before saving to validate
  credentials.

- **DELETE /:type** — soft-disable: set `status: "inactive"`
  and clear credentials. Doesn't remove the row (preserves the
  `lastSyncedAt` history).

All endpoints are tenant-scoped via the existing `req.shopId`.

A new `IntegrationType` literal is added: `"google_merchant"` was
already in the type union but doesn't have an adapter (it's a feed
generator, not push-based). Mark it `feed-only` in the registry
so the UI knows to render a different row (no credentials, just a
copy-the-feed-URL surface — full feed wiring is M-167).

### Server — registry helper

Add `listKnownAdapters()` to
`src/services/integrations/registry.ts` returning
`{ type, hasPing, hasPushOrder, expectedCredKeys }[]` so the
route can answer "what integrations should the UI offer rows
for" without hard-coding the list.

`expectedCredKeys` per adapter (extracted from each adapter's
inline doc comment):

| Type            | Keys                          |
|-----------------|-------------------------------|
| shipstation     | apiKey, apiSecret             |
| recharge        | accessToken                   |
| bold            | apiKey, shopId                |
| klaviyo         | privateKey                    |
| amazon          | endpoint                      |
| google_merchant | (none — feed-only)            |

### Client

Flip Integrations TabSpec from `"deferred"` → `"ready"`.

One **IntegrationRow** per known type — Polaris Card with:
- Logo / icon space (text-only "ShipStation" / "Klaviyo" etc.
  for now; real icons in cross-cutting polish).
- Status `Badge` (success "Connected" / `info` "Not connected" /
  `critical` "Error").
- For non-feed adapters: a "Configure" `Button` opens a Polaris
  `Modal`.
- For feed-only `google_merchant`: shows the feed URL with copy
  button + a "Wire in M-167" note.

**Configure modal** per row:
- One TextField per `expectedCredKeys` entry, typed `password`
  (so the value is masked).
- For an existing connection, fields are pre-filled with
  `••••<last 4>` placeholder text; submitting empty fields means
  "leave unchanged" so the merchant can update only what they
  want.
- "Test connection" button calls `POST /:type/test` with the
  current form values; surfaces inline `Banner` (success or
  error message).
- "Save" calls `PUT /:type`; closes modal on success.
- "Disconnect" button (only for connected rows): calls
  `DELETE /:type`.

### Tests

- `src/routes/integrations.test.ts` (new):
  - GET returns 7 rows (all known types) including inactive ones.
  - GET never includes credential values.
  - PUT encrypts credentials before DB insert.
  - POST `/:type/test` calls the right adapter's `ping()`.
  - DELETE marks status inactive without removing the row.
  - Cross-tenant: a request scoped to shop A can't read shop B's
    rows.

- `frontend/src/pages/SettingsPage.test.tsx`:
  - Integrations tab no longer placeholder.
  - One row per integration is rendered.
  - Clicking Configure opens the modal.
  - Test connection success surfaces a success banner.

---

## Acceptance criteria

- [x] Compiles, lints, all vitest pass.
- [x] /settings#integrations renders one row per known type.
- [x] Configure modal lets the merchant paste credentials, test,
  and save.
- [x] Credentials are never returned by GET (only `credentialKeys`).
- [x] Integrations TabSpec flipped to `"ready"`.

---

## Out of scope (deferred)

- Real integration icons / logos — UI polish in R4.
- Google Merchant feed URL wiring — M-167 (alongside the API &
  webhooks tab; the feed URL is a public read endpoint with the
  same shape).
- Per-integration deep-config (e.g. ShipStation warehouse pick,
  Klaviyo metric name) — surfaced in the modal as a `settings`
  JSON for now; structured config lands per-adapter in follow-on
  tickets when merchants ask.
- Webhook subscription management — M-167 (API & webhooks tab).
