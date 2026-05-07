# Session 0202 — M-202 Resend transactional email

- **Date:** 2026-05-07
- **Milestone(s):** M-202
- **Branch:** claude/objective-sinoussi-77ae86
- **Commit(s):** (this session)

---

## Goal

The user has Workspace set up for the human inbox at
`support@bundleforge.app`. Wire Resend for outbound transactional
email on a separate subdomain (`mail.bundleforge.app`) and ship the
two cap notifications (warning at 80%, reached at 100%) so the
M-200 wall doesn't surprise merchants.

## What was done

### Email service

- `src/services/email/client.ts` — lazy Resend SDK singleton.
  `getResend()` returns `null` when `RESEND_API_KEY` is unset;
  the app runs fine without it. Default From header
  `BundleForge <notifications@mail.bundleforge.app>`.
- `src/services/email/index.ts` — `sendEmail({to, subject, html,
  text})`. Returns `{ok, id?, error?, skipped?}`. **Never throws.**
  When the key is unset, returns `{ok: true, skipped: true}` and
  warn-logs.
- `src/services/email/templates/capWarning.ts` —
  `capWarningTemplate({shopName, count, cap, upgradeUrl})`. HTML +
  plain text. Polaris-green CTA button, escapes shop names.
- `src/services/email/templates/capReached.ts` — same shape for the
  100%-reached email. Communicates the storefront-pause behaviour.

### Notification orchestration

- `src/services/email/notifications.ts` —
  `maybeNotifyCapStatus(prisma, shop, deps?)`. Logic:
  1. Fetch `isOverOrderCap` for the shop.
  2. No-op when `cap === null` (paid plan).
  3. Read `shop.settings.capNotifications.{warning,reached}SentMonth`.
  4. If `over` and `reachedSentMonth !== YYYY-MM(now)` → send +
     persist.
  5. Else if `count/cap >= 0.8` and not over and
     `warningSentMonth !== YYYY-MM(now)` → send + persist.
  6. Otherwise no-op.
- Idempotent per shop per calendar month (UTC). Small race window
  is documented and accepted.
- Returns a structured `NotifyCapOutcome` so the caller can log
  it without re-deriving the state.

### Webhook integration

- `src/webhooks/handlers/ordersCreate.ts` extended:
  - New `notifyCapStatus?: (shopId: string) => Promise<void>`
    injection on `OrdersCreateDeps`.
  - Default impl: re-fetch the shop with the email-relevant
    fields (`name`, `email`, `planName`, `settings`), then call
    `maybeNotifyCapStatus(prisma, shop)`.
  - Hook fires **once per webhook**, AFTER the entire bundle-line
    loop (not per line). Wrapped in try/catch — failure logs a
    warn and the webhook still completes.

### Env

- `src/config/env.ts` — added optional `RESEND_API_KEY` and
  optional `EMAIL_FROM`.
- `.env.example` — same entries with explanatory comments.

### Tests

- `src/services/email/templates/capWarning.test.ts` — 5 cases
  (subject content, URL inclusion in both bodies, HTML escaping,
  remaining-orders math, clamp at 0).
- `src/services/email/templates/capReached.test.ts` — 4 cases.
- `src/services/email/notifications.test.ts` — 11 cases covering:
  paid-plan no-op, below-threshold no-op, warning at 80% with
  persistence, idempotency on already-sent, re-fire in a new
  month, reached at 100%, reached preferred over warning at
  >100%, send-failure does NOT persist, and unrelated settings
  keys preserved.
- `src/webhooks/handlers/ordersCreate.test.ts` — extended with 3
  new cases (notify fires once per webhook regardless of line
  count, notify failure doesn't fail the webhook, no-bundle order
  skips notify entirely). Existing 5 cases got
  `notifyCapStatus: vi.fn()` injection to silence the previously-
  ignored Prisma noise.

### Ops

- `docs/ops/email-setup.md` — step-by-step user guide. Covers
  Resend signup → adding `mail.bundleforge.app` as a sending
  domain → pasting the four DNS records (MX, SPF, DKIM, DMARC)
  into Cloudflare → verification → API key → Railway env →
  smoke test (both via Resend dashboard and end-to-end via the
  app).

## Acceptance criteria status

- [x] `npm run typecheck` clean.
- [x] `npm run lint` — 2 pre-existing errors unchanged, no new.
- [x] `npx vitest run src/services/email/` — 20/20.
- [x] `npx vitest run src/webhooks/handlers/ordersCreate.test.ts` —
      10/10 (was 7, +3 new).
- [x] Full suite: 873 pass / 13 skip / 886 total (+23 new).
- [x] With `RESEND_API_KEY` unset, sendEmail returns
      `{ok: true, skipped: true}` and the webhook continues.
- [x] Per-shop-per-month idempotency verified by tests.
- [x] No DB migration. Re-uses `Shop.settings` JSON for the
      sent-month tracking.

## Notes / lessons

- Prisma's `Prisma.JsonValue` and `InputJsonValue` are NOT
  exported from `@prisma/client` directly in the 6.x version
  this codebase uses. The codebase imports the client from
  `src/generated/prisma` (a relative path), and the JSON types
  are exposed there. Caught by typecheck — easy fix once located.
- The `notifyCapStatus` default does a fresh `prisma.shop.findUnique`
  rather than threading the full shop record through the
  ordersCreate dependency chain. Keeps the existing `loadShop`
  signature minimal and the email path self-contained.
- A successful Resend smoke test on a new sending domain will
  often land in Promotions tab on the first send. Documented in
  the setup guide — "send 5–10 test emails over a couple days,
  mark Not spam, reputation builds in a week."

## What the user has to do next (from the M-202 setup guide)

1. Sign up at resend.com (free tier).
2. Add `mail.bundleforge.app` as a sending domain.
3. Paste the four DNS records into Cloudflare (DNS only,
   not Proxied).
4. Wait for verify ✓.
5. Generate `bundleforge-production` API key.
6. Add `RESEND_API_KEY=re_…` to Railway env on the web service.
7. Optionally override `EMAIL_FROM`.
8. Smoke test from the Resend dashboard.

Once that's done, the next bundle order on the dev store that
crosses an 80% / 100% threshold will trigger the email
automatically — no further code change needed.

## Deferred follow-ups (still in STATE.md)

- M-203: trial-ending email + daily cron job.
- Welcome-on-install email.
- Plan-change confirmation email.
- Per-merchant unsubscribe / notification preferences (only
  needed if/when we add marketing-style emails).
