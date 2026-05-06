# M-167b — Logo upload to Shopify Files

> Behavior wiring sub-milestone for M-167's Settings General
> tab. Today the Brand card has a `logoUrl` text field where
> merchants paste an external URL. M-167b lets them upload a
> file directly; the server hands the file to Shopify Files
> via the GraphQL Admin API and returns the persistent CDN
> URL that gets stored in `settings.general.logoUrl`.

---

## Why

Pasting an external URL is fragile: the merchant's image
host can rotate URLs, go down, or block the request from
Shopify storefront origins. Shopify Files solves all three —
the CDN is fronted by Shopify, the URL is stable as long as
the file exists, and CSP / CORS posture is correct out of
the box for storefront use.

The whole Shopify Files mutation flow is well-trodden
territory (`stagedUploadsCreate` → PUT to staged target →
`fileCreate`). M-167b just wires it up.

---

## Scope

### Server

New route `POST /api/v1/settings/logo`:
- Body: `{ filename: string, mimeType: string, dataBase64: string }`.
  - `filename` — what the merchant picked (used as the
    Shopify Files alt + filename).
  - `mimeType` — `image/png | image/jpeg | image/gif | image/webp | image/svg+xml`.
  - `dataBase64` — file content as a base64 string. (Avoids
    pulling in multer/busboy; logos are small.)
- Server-side validation:
  - MIME must be one of the 5 above.
  - Decoded byte length ≤ 2 MiB (covers the typical logo;
    larger users can paste a URL).
- Calls Shopify Files via two GraphQL mutations:
  1. `stagedUploadsCreate(input: [{filename, mimeType, resource: IMAGE, fileSize: <bytes>, httpMethod: PUT}])`
     → returns `{ url, parameters[], resourceUrl }`.
  2. PUT the decoded bytes to `url` with `parameters` as
     headers (Shopify's S3-style staged upload).
  3. `fileCreate(files: [{originalSource: resourceUrl, contentType: IMAGE}])`
     → returns the persisted file object, which we poll
     for `READY` to extract `image.url`.
- Polling: up to 5 attempts × 1s for `fileStatus = READY`.
  If still PROCESSING after 5s, return the file's
  `preview.image.url` if available, else 504.
- Response: `{ url: string, fileId: string }`.

The route is dependency-injected so tests can stub the
Shopify GraphQL client + the staged-upload PUT without
hitting the network.

### Frontend

`SettingsPage.tsx` Brand card:
- Add "Upload logo" button next to the existing URL
  TextField.
- Clicking opens a hidden `<input type="file" accept="image/*">`.
- On file pick:
  - Read as ArrayBuffer → base64 (browser-side, no new dep).
  - POST to `/api/v1/settings/logo`.
  - On success, set the URL field to the returned `url` and
    fire the same Save flow that the URL-paste path uses
    (writes to `settings.general.logoUrl`).
  - On error, surface via the M-182 toast hook.
- Disable the Upload button while in flight.
- A small "Uploading…" inline label (uses M-182's
  `InlineLoader`).

### Tests

- `src/routes/settings.logo.test.ts` (new, 4 cases):
  - Happy path: stub stagedUploadsCreate + fetch PUT +
    fileCreate, assert returned URL.
  - Rejects bad mimeType.
  - Rejects oversize file (decoded > 2 MiB).
  - When the polling loop times out, returns 504.

- Frontend SettingsPage test gets +1: clicking the upload
  button POSTs to `/api/v1/settings/logo` (verified via
  fetch stub).

---

## Acceptance criteria

- [x] Compiles, lints clean (no new violations), all vitest
  pass.
- [x] Merchant clicks Upload, picks a PNG, the URL field
  fills with a Shopify CDN URL, the Save action persists.
- [x] No new third-party deps.
- [x] Server-side hardening: MIME allowlist, 2 MiB cap,
  GraphQL errors surface as 5xx with a useful message.

---

## Out of scope (deferred)

- Crop / resize before upload.
- Replacing an existing logo (Shopify Files keeps the old
  one; cleanup is a separate ticket).
- File browser ("here are all your previously uploaded
  logos").
- Drag-and-drop.
