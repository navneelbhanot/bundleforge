# Session 0196 — M-186 · Onboarding checklist + app language selector

- **Date:** 2026-05-07
- **Milestone(s):** M-186
- **Branch:** claude/objective-sinoussi-77ae86

---

## Goal

Add a persistent setup checklist + app-language quick-select to
the dashboard so a new merchant has a clear ship-readiness path
beyond just "create your first bundle." User shared a competitor
(Bundler) screenshot with this pattern; goal was to ship our
own version.

## What was done

- **Spec:** `docs/specs/M-186-onboarding-checklist.md`.

### Server

- **Modified** `src/routes/settings.ts`:
  - New `OnboardingPatch` Zod schema with four nullable ISO
    datetime fields: `firstBundleAt`, `publishedBundleAt`,
    `blockAddedAt`, `dismissedAt`.
  - Extended `PatchSchema` with `onboarding: OnboardingPatch.optional()`.
  - GET response now includes
    `onboarding: isObject(settings.onboarding) ? ... : {}`.
  - PUT merges via `mergeSubobject(prev.onboarding, patch.onboarding)`
    so saving `blockAddedAt` doesn't wipe `dismissedAt`.

### Frontend

- **New** `frontend/src/lib/locales.ts` — extracted as single
  source of truth for the 15 supported locales + their human
  labels (English / Español / Français / etc.). Imported by
  both the Localization settings tab and the new dashboard
  language selector.
- **New** `frontend/src/components/dashboard/AppLanguageSelect.tsx` —
  Polaris Select wrapped in an InlineStack with a "Saving"
  Spinner. Renders 15 options with native-language labels.
- **New** `frontend/src/components/dashboard/SetupChecklist.tsx` —
  Polaris Card with header (title + "N of M complete" + X
  dismiss icon-button), `<ProgressBar>`, and 3 step rows.
  Each step row shows an icon (CheckCircleIcon when done,
  dashed circle CSS-only when not), title, body, and primary +
  optional secondary CTAs. Done steps render with
  `bg-surface-success` background. Component returns null when
  dismissed OR when every step is complete (auto-retire).
- **Modified** `frontend/src/pages/DashboardPage.tsx` —
  - Fetches three endpoints in parallel on mount:
    `/api/v1/bundles?limit=1`, `/api/v1/bundles?status=active&limit=1`,
    `/api/v1/settings`.
  - Computes step completion: step 1 from `bundleTotal > 0`,
    step 2 from active count > 0, step 3 from
    `settings.onboarding.blockAddedAt`.
  - "Mark complete" PATCHes `settings.onboarding.blockAddedAt`
    with `new Date().toISOString()`.
  - "Dismiss" PATCHes `settings.onboarding.dismissedAt` with
    the same.
  - "Open theme editor" external link constructed as:
    `https://{shopifyDomain}/admin/themes/current/editor?template=product&addAppBlockId={CLIENT_ID}/bundle-display&target=mainSection`.
    `CLIENT_ID` read from the `<meta name="shopify-api-key">`
    tag in index.html (same value App Bridge uses). Falls back
    gracefully (just opens the editor) if the meta tag isn't
    found.
  - AppLanguageSelect rendered above the checklist, right-aligned.
- **Modified** `frontend/src/pages/SettingsPage.tsx` — replaced
  the inline `SUPPORTED_LOCALES` array with an import from
  `lib/locales.ts`. No behavior change.

### Why "embed + product page block" collapsed into a single step

Looking at our `extensions/theme-extension/`:
- `assets/` (JS files for the theme blocks)
- `blocks/` (5 Liquid section blocks, all `target: section`)
- `locales/` (i18n strings)

There's no `embed/` folder and no `target: body` block.
BundleForge's storefront is delivered via theme **blocks**, not
a theme **app embed**. The competitor screenshot's "Enable app
embed" + "Add product page element" steps map to a single step
for us: "Add the Bundle block to your storefront." Documented
in the spec's Why section.

## Tests

- **Settings route** (`src/routes/settings.test.ts`): 2 new cases
  — `round-trips an onboarding patch` and `rejects malformed
  onboarding datetime`. 44/44 pass (was 42).
- **SetupChecklist** (`SetupChecklist.test.tsx`): 6 cases —
  renders titles, returns null when dismissed, auto-retires
  when all done, dismiss icon fires onDismiss, progress count
  renders correctly, mark-complete button shows on pending
  step.
- **AppLanguageSelect** (`AppLanguageSelect.test.tsx`): 3 cases
  — current value selected, onChange fires with picked locale,
  disabled while busy.
- **DashboardPage** (`DashboardPage.test.tsx`): tests rewritten
  to mock the new 3-fetch pattern; checklist visibility logic
  added (renders when onboarding empty; hides when
  `dismissedAt` set).
- Net **+13 cases** vs M-185 (803/803 pass).

## Tests + lint

- `npm run typecheck` — clean.
- `npx vitest run` — 803 passed, 13 skipped.
- `npm run lint` — 6 errors / 16 warnings (baseline, unchanged).

## Verified by hand

- N/A this session — visual verification on the dev store is
  the user's next step after deploy.

## Surprises and learnings

- **Polaris Select fires `onChange(value, id)`** with the input
  ID as the second argument. Test had to assert
  `mock.calls[0][0]` rather than `toHaveBeenCalledWith("de")`.
- **`fireEvent.change` with `getByRole("combobox")`** doesn't
  reliably target Polaris Select — it wraps the native
  `<select>` and the role isn't always "combobox". The
  established pattern in this codebase
  (SettingsPage.test.tsx) is `container.querySelector("select")`
  and fireEvent.change on that. Followed it here.
- **Toast error tone** is `{ error: true }`, not `{ tone: "critical" }` —
  the `useToasts()` hook from M-182 ships a minimal opts
  surface; first attempt used Polaris's Toast `tone` prop name
  out of habit. Caught at typecheck.
- **`bg-surface-success-subdued` is not a Polaris token** — the
  available subtle-success token is just `bg-surface-success`.
  Caught at typecheck.

## Deferred

- **Auto-detection of "Bundle block added to storefront"** —
  requires a Shopify Admin GraphQL query on the active theme's
  product template, parsing the resulting JSON for our block
  id. Substantial work; v1 trusts merchant click-through.
- **Re-show the checklist after dismiss.** No "show again"
  button today — once dismissed, stays dismissed.
- **Custom illustration on the checklist Card.** Polaris icons
  used instead.

## Handoff

Phase R5 milestones now: M-184, M-185, M-186 all done. No
queued roadmap milestone. Open backlog items in STATE.md
unchanged from M-185 close (post-launch work, ops fixes).
