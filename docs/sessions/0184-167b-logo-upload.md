# Session 0184 — M-167b · Logo upload to Shopify Files

- **Date:** 2026-05-06
- **Milestone(s):** M-167b
- **Branch:** claude/objective-sinoussi-77ae86

---

## What was done

- **Spec:** `docs/specs/M-167b-logo-upload.md`.
- **Server** (`src/routes/settingsLogo.ts`, new):
  - `POST /api/v1/settings/logo` accepts
    `{ filename, mimeType, dataBase64 }`. Three-step
    Shopify Files flow: stagedUploadsCreate → PUT bytes
    → fileCreate → poll for READY (5×1s, fall back to
    preview URL).
  - MIME allowlist (png/jpeg/gif/webp/svg) + 2 MiB cap.
  - DI seam for the GraphQL caller and the staged-upload
    PUT, so tests stub without touching the network.
- **Server tests** (`src/routes/settingsLogo.test.ts`,
  5 cases): happy path, bad MIME, oversize, polling
  timeout → 504, missing session → 401.
- **Frontend** (`SettingsPage.tsx` Brand card): added an
  Upload button next to the Logo URL field. Reads the
  picked file via ArrayBuffer → base64 → POST. On success
  fills the URL field; on error surfaces a banner.
- **Mounted** at `/api/v1/settings` in the server.

## Tests + lint

- `npx vitest run` → 709 passed, 13 skipped (+5 net).
- Typecheck clean.
- Lint baseline unchanged.
