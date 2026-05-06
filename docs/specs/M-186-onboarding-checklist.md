# M-186 — Dashboard onboarding checklist + app language selector

- **Phase:** R5+ (post-roadmap polish)
- **Status:** spec
- **Depends on:** M-184 (DashboardPage exists), M-167 (Localization
  settings tab — provides `fallbackLocale`)
- **Followed by:** none queued

---

## Why

A new merchant installs BundleForge, lands on the dashboard, and
has no clear runway to "the storefront shows my bundle." Today
the only nudges are:

1. The fresh-shop welcome card with a "Create your first bundle"
   CTA (only shown when zero bundles exist).
2. Nothing else, ever, after the first bundle is created.

Once the merchant has any bundle in any state, the welcome
disappears and the dashboard is silent on the next two real
gates: **publishing the bundle** (creates the Shopify product +
makes its status `active`) and **adding the Bundle block to a
storefront page** (so the widget actually renders for shoppers).

The user shared a competitor screenshot (Bundler) with a 3-step
checklist + a language selector. We're not copying their visuals
or phrasing — we're shipping our own three-step persistent
checklist that maps to BundleForge's actual ship-readiness path.

## What ships

### 1. Setup checklist on DashboardPage

A Polaris Card at the top of the dashboard (above the Revenue
snapshot widget) with three steps. Visible until either all
three are complete or the merchant dismisses it.

**Step 1 — Create your first bundle**
- *Detection:* auto, `bundleTotal > 0` (already fetched in
  DashboardPage on mount).
- *CTA when incomplete:* "Create bundle" button → `/bundles/new`.
- *State indicator when complete:* green checkmark + the bundle
  count ("3 bundles created").

**Step 2 — Publish a bundle**
- *Detection:* auto, at least one bundle with `status === "active"`.
  Fetched via `/api/v1/bundles?status=active&limit=1` (already
  used by the BundleCountsWidget; reuse the response).
- *CTA when incomplete:* "Browse bundles" → `/bundles` so the
  merchant can publish a draft.
- *State indicator when complete:* green checkmark + active count.

**Step 3 — Add the Bundle block to your storefront**
- *Detection:* manual. We can't reliably detect whether a theme
  app block is added to a template without reading the theme's
  product template JSON via Admin API, which is fiddly and
  per-theme. v1 trusts the merchant's "Mark complete" click.
- *CTAs when incomplete:*
  - "Open theme editor" — opens a new tab with the Shopify
    theme editor deep-link that pre-targets the product
    template + offers our `bundle-display` block:
    `https://{shopifyDomain}/admin/themes/current/editor?template=product&addAppBlockId={CLIENT_ID}/bundle-display&target=mainSection`
  - "Mark complete" — PATCH `settings.onboarding.blockAddedAt = ISO`.
- *State indicator when complete:* green checkmark + "Added".

**Header actions:**
- Title "Get set up with BundleForge"
- Subtitle progress: "2 of 3 complete"
- Dismiss `<Button icon={XIcon} variant="plain">` — PATCH
  `settings.onboarding.dismissedAt = ISO`.

**Visibility rules:**
- Hidden when `dismissedAt` is set.
- Hidden when all three are complete (so the card auto-retires
  on success — no extra dismiss click needed).
- Otherwise rendered above the widget Grid.

### 2. App language selector

A small Polaris `Select` rendered in the dashboard's
`secondaryActions` slot (right of the page title). Reads/writes
`settings.localization.fallbackLocale`. 15 supported locales
(same registry as the Localization tab — single source of truth
in `frontend/src/lib/locales.ts` extracted as a side-effect of
this milestone so the Localization tab and dashboard agree).

**Behaviour:**
- Initial value: current `fallbackLocale` from settings (default
  `"en"`).
- onChange: PATCH `/api/v1/settings` with
  `{ localization: { fallbackLocale: "..." } }`. Inline busy
  spinner while saving; toast "Language saved" on success;
  Polaris error banner on failure.

## File-level changes

### Server

- **Modify** `src/routes/settings.ts`:
  - New `OnboardingPatch` Zod schema with four nullable ISO
    datetime fields:
    - `firstBundleAt` (auto-set on first bundle published, but
      we mostly compute this client-side from bundleTotal — the
      field is here for future server-side detection).
    - `publishedBundleAt` (same — future).
    - `blockAddedAt` (manual mark-complete from the dashboard).
    - `dismissedAt` (X click).
  - Extend `PatchSchema` with `onboarding: OnboardingPatch.optional()`.
  - Extend the GET response with
    `onboarding: isObject(settings.onboarding) ? ... : {}`.
  - Add `mergeSubobject(prev.onboarding, patch.onboarding)` to
    the PUT merge block.

### Frontend

- **New** `frontend/src/components/dashboard/SetupChecklist.tsx`:
  Polaris Card; takes `{ steps, dismissed, onMarkBlock,
  onDismiss }` props; renders 3 step rows + header actions.
  ~150 LOC.
- **New** `frontend/src/components/dashboard/AppLanguageSelect.tsx`:
  Polaris Select wrapped in a small InlineStack with a busy
  spinner; takes `{ value, onChange }` props; ~50 LOC.
- **New** `frontend/src/lib/locales.ts` — extract the
  `SUPPORTED_LOCALES` constant + locale labels (`en` → "English",
  etc.) from the Localization tab so the dashboard reuses the
  same registry. Localization tab updated to import from this
  file.
- **Modified** `frontend/src/pages/DashboardPage.tsx`:
  - Fetch `/api/v1/settings` on mount alongside `/api/v1/bundles?limit=1`.
  - Compute step completion: step1 from bundleTotal>0; step2
    from activeBundleTotal>0 (new fetch); step3 from
    `settings.onboarding.blockAddedAt`.
  - Render `<SetupChecklist>` above the Grid when not dismissed
    AND not all complete.
  - Render `<AppLanguageSelect>` in the page's secondaryActions
    (or a custom row right of the title — Polaris `Page` only
    accepts string + onAction in secondaryActions, so we'll
    render the Select in a custom slot above the Grid, right-
    aligned).

## Acceptance criteria

- [ ] `npm run typecheck`, `npx vitest run`, `npm run lint` all
      pass at session close.
- [ ] Settings PUT round-trips an `onboarding.blockAddedAt`
      patch (set, then GET returns the value).
- [ ] Dashboard renders the checklist Card above the widgets
      when (a) shop has bundles AND (b) `settings.onboarding`
      is empty.
- [ ] Step 1 auto-checks when bundleTotal > 0.
- [ ] Step 2 auto-checks when at least one active bundle exists.
- [ ] Step 3 checks when "Mark complete" is clicked AND a
      subsequent reload still shows it complete.
- [ ] Clicking the X dismisses the card; reload still hidden.
- [ ] The card auto-retires (renders nothing) when all 3 steps
      are complete, even without a dismiss click.
- [ ] AppLanguageSelect renders in the dashboard top area;
      changing the value PATCHes settings; reload restores the
      same selection; surface a toast on success.
- [ ] Tests:
  - Settings route: onboarding patch round-trip (1-2 cases).
  - SetupChecklist component: renders 3 steps, "Mark complete"
    fires the prop, "Dismiss" fires the prop, all-complete
    auto-hide (~3 cases).
  - AppLanguageSelect: renders 15 options, onChange fires the
    prop with the picked locale (1-2 cases).
  - DashboardPage: checklist visibility logic (renders when
    shop has bundles + not dismissed; hides when dismissed; hides
    when all-complete) (~2 cases).

## Out of scope (deferred)

- **Auto-detection of "Bundle block added to storefront"** —
  requires a Shopify Admin GraphQL query on the active theme's
  product template, parsing the resulting JSON for our block id,
  and a periodic re-check. Substantial work; skip in v1 and trust
  merchant click-through.
- **Re-show the checklist after dismiss.** If the merchant
  dismissed it, it stays dismissed — no "show again" button. We
  can add one to the help drawer later if needed.
- **More than 3 steps.** Future ideas (Configure billing, Run a
  test cart, Invite a teammate) deferred. Three steps respects
  the screenshot's information density.
- **Custom illustration for the checklist Card.** The competitor
  uses dotted circles; we'll use Polaris `CheckCircleIcon` for
  complete and `CircleDashedIcon` (or similar) for incomplete.

## Risks

- **Reload latency for step completion.** Steps 1 and 2 require
  bundle counts that aren't available until the dashboard's
  fetches resolve. While loading, we show a brief skeleton row;
  no flicker because the Card itself only mounts after the
  initial settings fetch.
- **Theme editor deep-link format may drift.** Shopify documents
  the `addAppBlockId` query string but reserves the right to
  evolve it. If it stops working, the "Open theme editor" button
  still opens the editor (just doesn't pre-target our block) —
  graceful degradation.
- **`SUPPORTED_LOCALES` extracted from SettingsPage** is a small
  cross-file refactor; keep it minimal and don't touch other
  Localization tab logic.

## Followed by

No queued milestone. Phase R5+ idea backlog (custom illustrations,
auto-detection, more checklist steps) tracked in STATE.md.
