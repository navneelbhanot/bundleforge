# M-202 — Transactional email service (Resend) + cap notifications

## Why

M-200 enforces the Starter `maxOrdersPerMonth` cap; M-201 surfaces a
banner in the admin Dashboard when a shop crosses 80% / 100%. But
the admin Dashboard is only a signal *if the merchant logs in*.
For shops that don't visit the admin daily — which is most paid-tier
shops — the banner can sit there for days while orders silently
rack up against the cap.

Email is the only channel that meets the merchant where they
already are. A 100%-of-cap email is also a strict prerequisite for
the storefront wall to feel acceptable: when bundle checkouts start
rejecting at 100, the merchant must already know it's coming.

This milestone wires Resend (chosen in the M-201 follow-up
conversation) for outbound transactional email, ships two cap
templates that fire from the existing `ordersCreate` webhook, and
documents the DNS / Resend setup the user needs to complete.

Trial-ending email is OUT of scope and deferred to M-203 — it
requires a daily cron (orders/create can't trigger it because the
trigger is calendar-driven, not order-driven).

## Scope

In-scope:

1. **`resend` npm dependency** + new env vars on
   `src/config/env.ts`:
   - `RESEND_API_KEY` (optional). Absence → email sends no-op +
     warn-log; the app works fine without it (local dev, CI, the
     pre-Resend production state).
   - `EMAIL_FROM` (optional). Default
     `BundleForge <notifications@mail.bundleforge.app>` — matches
     the subdomain split discussed with the user.

2. **Email service:**
   - `src/services/email/client.ts` — lazy Resend singleton
     (mirrors the `src/shopify/index.ts` pattern). Returns `null`
     when `RESEND_API_KEY` is unset.
   - `src/services/email/index.ts` — `sendEmail({to, subject, html,
     text})`. Returns `{ok, id?, error?, skipped?}`. Never throws —
     a failed email send must NEVER fail the webhook handler that
     called it.
   - `src/services/email/templates/capWarning.ts` — factory
     `capWarningTemplate({shopName, count, cap, upgradeUrl})` →
     `{subject, html, text}`.
   - `src/services/email/templates/capReached.ts` — same shape
     for the 100%-reached email.

3. **Notification orchestration:**
   - `src/services/email/notifications.ts` —
     `maybeNotifyCapStatus({prisma, shop, now})`:
     1. Fetch `isOverOrderCap` for the shop.
     2. No-op when `cap === null` (paid plan).
     3. Read `shop.settings.capNotifications` for
        `warningSentMonth` / `reachedSentMonth`.
     4. If `over && reachedSentMonth !== YYYY-MM(now)` → send
        `capReached` email, update settings.
     5. Else if `count/cap >= 0.8 && !over &&
        warningSentMonth !== YYYY-MM(now)` → send `capWarning`,
        update settings.
   - Idempotent at the per-month level. A small race window exists
     where two simultaneous orders could both decide to send the
     same email — accepted for first ship; documented in code.

4. **Webhook integration:**
   - `src/webhooks/handlers/ordersCreate.ts` calls
     `maybeNotifyCapStatus` AFTER the BundleOrder row is created.
     Wrapped in try/catch — email failure NEVER fails the webhook.
   - Injectable via the existing `OrdersCreateDeps` pattern so
     tests pass a stub.

5. **Tests:**
   - `src/services/email/templates/capWarning.test.ts` —
     subject/text smoke + variable substitution.
   - `src/services/email/templates/capReached.test.ts` — same.
   - `src/services/email/notifications.test.ts` — the four-state
     matrix (under/approaching/over × already-sent/not-sent),
     plus the paid-plan no-op.
   - Existing `src/webhooks/handlers/ordersCreate.test.ts`
     extended with one case verifying the notify hook fires.

6. **Ops doc:**
   - `docs/ops/email-setup.md` — step-by-step for the user:
     1. Sign up at resend.com.
     2. Add `mail.bundleforge.app` as a sending domain.
     3. Paste the four DNS records into Cloudflare.
     4. Wait for verify ✓.
     5. Generate API key.
     6. Add `RESEND_API_KEY=re_…` to Railway env.
     7. (Optional) override `EMAIL_FROM`.
     8. Smoke test from Resend dashboard.

Out-of-scope (M-203 / future):

- Trial-ending email + daily cron job.
- Welcome email on install.
- Plan-change confirmation.
- Per-merchant unsubscribe / notification preferences. The two
  emails this milestone ships are **transactional** (cap-status
  affects the merchant's storefront), not promotional. Unsub is
  a marketing-email concept; we're not subject to it for these
  notifications. CAN-SPAM-compliant by virtue of being purely
  account-state-related.

## Acceptance criteria

- [ ] `npm run typecheck` passes.
- [ ] `npm run lint` passes (no new errors beyond the 2 pre-existing).
- [ ] `npx vitest run src/services/email/` — all green.
- [ ] `npx vitest run src/webhooks/handlers/ordersCreate.test.ts` —
      the new notify-fires case green; existing cases unchanged.
- [ ] Static check: with `RESEND_API_KEY` unset (CI / local),
      `sendEmail` returns `{ok: true, skipped: true}` and logs a
      warn — the webhook completes normally.
- [ ] Static check: notifications.ts sends at most ONE email of
      each type per shop per calendar month (UTC).
- [ ] No DB migration. Re-uses `Shop.settings` JSON for the
      sent-month tracking.

## Implementation notes

- The 0.8 threshold is duplicated between
  `src/routes/billing.ts` (M-201 banner) and the notifications
  module here. Acceptable for first ship; if it ever drifts,
  promote it to a constant in `src/services/billing/orderCap.ts`.
- `EMAIL_FROM` defaults to `BundleForge
  <notifications@mail.bundleforge.app>` — the subdomain isolates
  the transactional sender reputation from `support@bundleforge.app`
  on Workspace.
- We deliberately do NOT use React Email or MJML for templates
  yet — plain HTML strings are good enough for two short emails.
  Migrate to React Email when we have 5+ templates.
- The `upgradeUrl` baked into emails should be the merchant's
  embedded admin URL (`/settings#billing`) wrapped through
  Shopify's app-launch URL so clicking from a desktop email
  client deep-links back into Shopify Admin. For first ship,
  use the relative path; the Shopify session cookie won't be
  active so it'll bounce through OAuth — acceptable degradation.
