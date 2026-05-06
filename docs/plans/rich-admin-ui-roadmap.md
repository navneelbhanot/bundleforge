# Rich Admin UI Roadmap (Multi-session)

> Drafted 2026-05-06 in response to "build rich UI and almost all options
> what others are giving, comprehensive settings page with all options."
> Source feature comparison: `docs/competitive-audit-2026-05-06.md`.
>
> Each milestone below is sized for one Claude Code session per
> CLAUDE.md §4 (200–800 LOC, fits in 2–6h). Specs go in
> `docs/specs/M-NNN-*.md` *before* implementation, per CLAUDE.md §3.2.

---

## Goal

Match the breadth of options users see in Kaching, BOGOS, Bundler,
Fast Bundle, and Simple Bundles, in three surfaces:

1. **Bundle Detail page** — currently 4 sections, target ~10 with
   tabbed navigation.
2. **Bundle List page** — currently table + stats, target merchant-grade
   filters/bulk-actions/saved-views.
3. **Settings page** — currently 2 toggles, target ~10-tab settings
   shell with every option a competitor offers.

Plus four cross-cutting polish milestones (search, help, toasts,
empty states).

**Scope discipline.** Where a UI option needs server-side behavior
that's already wired (e.g. existing config fields, existing
endpoints), this plan ships it end-to-end. Where the option would
require new backend work that can't fit in the same session, the UI
ships behind a `(connects in M-XXX)` label and the milestone is
explicit about the wiring deferred.

---

## Phase R1 — Settings depth (M-161 → M-167)

Replace `frontend/src/pages/SettingsPage.tsx` (107 lines, 2 toggles)
with a tabbed shell mirroring the schema in
`src/routes/settings.ts` (which currently only stores `safetyLock`
and `notifications`). Each milestone adds one tab and the matching
server-side schema.

### M-161 — Settings shell + General tab
- Polaris `Tabs` with 10 placeholders.
- General tab: shop info (read-only from session), default currency,
  default locale, timezone, brand color, logo upload (Shopify Files API).
- Server: extend Prisma `Shop.settings` JSON with `general` subobject;
  add Zod validator; PATCH endpoint accepts partial updates per tab.
- Tests: settings shell renders all tabs; General persists and reloads.

### M-162 — Display defaults tab
- Theme block defaults: layout (grid/list/carousel), color preset,
  image preference (component photos vs bundle hero), Add to Cart copy,
  sold-out behavior (hide / disable / waitlist).
- CSS override textarea with syntax check.
- Tests: snapshot of every default; changes round-trip through PATCH.

### M-163 — Inventory + Pricing tab
- Inventory: low-stock threshold, oversell policy
  (`prevent` / `allow_negative` / `allow_to_zero`), audit retention
  (days), snapshot frequency, low-stock alert toggle.
- Pricing: default rounding rule (.99 / .95 / nearest cent),
  currency formatter override, B2B markup default, default discount
  type for new bundles.
- Wires to existing `inventory_audit_log` and pricing engine —
  no new backend behavior, just defaults.

### M-164 — Cart & Checkout tab
- Default mode: bundle-as-product vs components-as-attributes
  (informs whether publish() emits the components metafield expansion
  vs the line-attribute path).
- Atomic checkout enforcement toggle.
- Abandonment behavior: keep selections / clear / prompt.
- Tests + integration test verifying cart-transform behavior toggles
  follow this setting.

### M-165 — Notifications & alerts tab
- Email recipients (multi-input), Slack webhook URL, Teams webhook URL.
- Alert rules: low stock, failed webhook, AI service down,
  publish failure, bundle order without resolved bundle.
- Per-rule channel selection.
- Server: persist; cron/worker reads on alert events
  (worker change scoped to follow-on milestone if it grows).

### M-166 — Integrations tab
- Status row per integration: Crisp, ShipStation, Recharge, Bold,
  Klaviyo, Google Merchant, Amazon.
- Each row: connected/disconnected badge + "Configure" drawer with
  the API key / store ID / store URL per integration's adapter file
  in `src/services/integrations/`.
- Test connection button hits the adapter's `ping()` (add ping where
  missing).
- Tests: drawer opens, save round-trips, ping shows green/red.

### M-167 — API tokens + webhooks tab
- Per-shop API tokens (create / revoke / last-used).
- Custom webhook subscriptions (URL + events).
- HMAC secret display with copy-to-clipboard.
- Server: new tables `ApiToken`, `OutboundWebhook` with migrations.
- Tests: token cycle + webhook fires on event.

> After R1: SettingsPage covers ~80% of competitor option surface.
> Remaining (Localization tab, Billing & usage tab) overlap with
> existing `BillingPage.tsx` — fold in during R4 polish, not a
> standalone milestone.

---

## Phase R2 — Bundle Detail richness (M-168 → M-174)

Currently `BundleDetailPage.tsx` is a single scrolling form with 4
cards (items, pricing rules, type config, sidebar). Target: tabbed
detail shell with one tab per concern.

### M-168 — Detail shell tab refactor
- Polaris `Tabs`: Setup, Schedule, Display, Customers, Inventory,
  Performance, Activity, Advanced.
- "Setup" tab inherits the existing items + pricing-rules + type-
  config layout — visual parity with today, just one tab.
- Live Preview sidebar persists across tabs.
- Tests: each tab renders without 500; navigation preserves dirty state.

### M-169 — Schedule tab
- Start date, end date, recurring (daily/weekly/monthly with cron-like
  picker), timezone (default from shop).
- Auto-archive on end vs auto-pause.
- Server: extends existing `Bundle.startsAt`/`endsAt` and adds
  `recurringRule` JSON field.
- Tests: validates start ≤ end; reads through to existing
  `validateCart.ts` window check.

### M-170 — Display tab
- Per-bundle override of Settings → Display defaults.
- Badges: "Save N%", custom text, color, position.
- Image gallery: pick which component photos appear, optional bundle
  hero image (uploads to Shopify Files).
- Layout override (grid/list/carousel).
- Custom CSS override.
- Server: extend `Bundle.displaySettings` JSON.

### M-171 — Customers tab
- Tag-based eligibility (must-have / must-not-have customer tags).
- Segment-based eligibility (Shopify Segments dropdown).
- Login required toggle.
- Market/locale gating (multi-select Shopify Markets).
- Server: extend `Bundle.eligibility` JSON; cart-transform reads at
  checkout time. Cart-transform wiring scoped to M-171b
  (split if it doesn't fit).

### M-172 — Inventory tab
- Per-bundle oversell override.
- Per-bundle low-stock threshold override (defaults to Settings value).
- "Pause when any component < N" toggle.
- Component-only mode (sells components individually too).
- Server: extends `Bundle.inventoryRules` JSON.

### M-173 — Performance tab + Activity log
- Performance: revenue, AOV, conversion rate, cart adds, checkout
  abandonment for this bundle. Pulls from existing analytics tables.
- Activity log: who created, who edited what (uses existing
  `inventory_audit_log` + new `bundle_activity_log` table).
- Date range picker.

### M-174 — Advanced tab
- Custom metafields editor (add / remove `bundleforge.<key>` JSON
  metafields written to the Shopify product on publish).
- SEO override (handle, meta title, meta description, social card).
- Per-bundle GA4 event names.
- Per-bundle theme template hint.

---

## Phase R3 — Bundle List richness (M-175 → M-178)

### M-175 — IndexFilters + saved views
- Polaris `IndexFilters` with: status, type, date range, has-sales,
  search.
- Saved views persist per shop in settings.
- Tests: filter state syncs to URL; saved view round-trips.

### M-176 — Bulk actions
- Multi-select rows with primary actions: Publish all, Archive all,
  Duplicate all, Delete all (soft).
- Dry-run preview before executing.
- Server: batch endpoint with per-bundle error reporting.

### M-177 — Sort + view modes
- Sort: created, updated, revenue, sales count, AOV.
- View modes: table (default), grid (cards), kanban (by status).
- Persist per-shop.

### M-178 — Templates / Presets gallery
- Library of predefined bundle templates ("Black Friday BOGO",
  "Holiday Build-a-Box", "Subscription Sampler", etc.).
- Server: ship 10–15 JSON templates in `src/assets/bundle-templates/`.
- "Use this template" pre-fills BundleCreatePage.
- Optional: merchant can save their own bundle as a template.

---

## Phase R4 — Cross-cutting polish (M-179 → M-182)

### M-179 — Global cmd+k search
- Polaris `TopBar` search → keyboard shortcut.
- Indexes: bundles, orders, settings, help docs.
- Lightweight client-side fuzzy match against `/api/v1/{bundles,orders}`
  + the `docs/help/*` markdown files.

### M-180 — In-app help drawer
- Right-side drawer triggered by "?" key or button.
- Renders `docs/help/*.md` content via remark.
- "Contact support" button hands off to Crisp (existing).

### M-181 — Unified toast / confirm / skeleton system
- Replace ad-hoc Banners and inline errors with a single
  `useToast()` hook + a `ConfirmModal` provider.
- Replace per-page loading states with the existing `PageLoading`
  variants everywhere.
- Tests: every page shows skeletons; destructive actions confirm.

### M-182 — Empty-state illustrations + guided CTAs
- Hand-drawn or SVG illustration per major empty state (no bundles,
  no orders, no inventory events, no analytics, no AI suggestions).
- Each empty state has a single primary CTA + 1–2 secondary links.
- Polish pass: typography, spacing, hover states across all pages.

---

## Total scope

- **22 milestones** ≈ 22 sessions.
- ~5,000–8,000 LOC across frontend + a few backend extensions.
- New tables: `ApiToken`, `OutboundWebhook`, `bundle_activity_log`.
- New JSON columns: `Shop.settings.{general,display,inventory,pricing,cart,notifications}`,
  `Bundle.{recurringRule,eligibility,inventoryRules}`.

Pick-and-choose: the four phases are independent. Want only a richer
Settings page? Run R1 alone (7 sessions). Want only a deeper bundle
detail? R2 alone (7 sessions). Want bigger list page + polish? R3+R4
(8 sessions).

---

## Driving this through future sessions

1. Each session, run boot phase (CLAUDE.md §3.1) — read STATE.md,
   PLAN.md, last session log, then `docs/specs/M-NNN-*.md`.
2. First job each session: write the spec for M-NNN if it doesn't
   exist yet. Specs go in `docs/specs/M-NNN-<slug>.md` per the
   project pattern.
3. Tests are part of the milestone — not deferred.
4. Update STATE.md + PLAN.md + write `docs/sessions/NNNN-<slug>.md`
   in the same commit as the work.
5. Commit message format: `M-NNN: <short summary>`.

---

## Out of scope for this roadmap

- POS publication wiring (separate post-launch task; flagged in
  STATE.md).
- Cart Transform: applying pricingRules during the expand op (flagged
  in `docs/sessions/0160-competitive-audit-closures.md`).
- Trial-warning emails (separate cron worker task).
- AI diagnostic bot (separate; not on competitor parity path,
  research first).

These are tracked separately and shouldn't be folded into this
roadmap because each has its own architectural trade-off worth
deciding on its own merits.
