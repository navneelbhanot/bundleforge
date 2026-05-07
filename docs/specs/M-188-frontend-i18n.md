# M-188 — Frontend admin i18n (real translation infrastructure)

- **Phase:** R5+
- **Status:** spec
- **Depends on:** M-186 (locale select wired to settings + cached
  in localStorage), the polarisLocale loader from M-186 polish
- **Followed by:** none queued (extending translations to more
  surfaces is mechanical, doesn't need a milestone per surface)

---

## Why

Today the dashboard's language dropdown swaps Polaris's
shipped strings (Save / Cancel / dialog text / sort labels)
when the merchant picks a locale, but every label *we wrote*
stays English. Page titles, headings, helpText, banner
messages, button copy — all hardcoded English literals.

Per the M-186 commit message: "App copy we wrote stays
English — that's a real i18n milestone for itself." This is
that milestone.

## What ships

### Infrastructure

1. **Install** `i18next` + `react-i18next` + `i18next-browser-languagedetector`.
2. **New** `frontend/src/lib/i18n/index.ts` — initialises
   i18next with:
   - 15 supported locales matching `frontend/src/lib/locales.ts`.
   - English as the source-of-truth + fallback.
   - Synchronous initial language read from `localStorage` (the
     same `mintbundle:polaris-locale` key M-186 polish
     introduced) so the very first paint is in the chosen
     language.
   - `react-i18next` provider wrapping the App tree.
3. **New** `frontend/src/lib/i18n/locales/{locale}.json` — 15
   files, one per supported locale. EN is the source; other 14
   start with a copy of EN that gets progressively translated.
4. **Hook into existing locale state** — App.tsx's
   `usePolarisI18n` hook (which already fires on locale
   change) also calls `i18n.changeLanguage(next)` so both
   Polaris's pack AND our app strings swap together.

### First translation pass — high-leverage surfaces

Translate ~100-150 strings from the most-visible surfaces. EN
is hand-written; ES / FR / DE / IT / PT are hand-translated
(I'll do these myself). The remaining 9 (JA / ZH / KO / NL /
PL / SV / DA / NO / RU) ship as English copies with a
`__needsTranslation: true` flag in the JSON so future PRs can
target them mechanically without changing app code.

Surfaces in scope:

- **Top nav** (`NavMenu.tsx` + `App.tsx NAV_TABS`) — Dashboard,
  Bundles, Orders, Inventory, Audit, Analytics, AI suggestions,
  A/B, Settings, Billing, Help.
- **Settings sidebar** (`SettingsSidebar.tsx` `TABS`) — General,
  Display, Inventory, Pricing, Cart & checkout, Notifications,
  Integrations, API & webhooks, Localization, Billing.
- **Dashboard** (`DashboardPage.tsx`) — page title, subtitle,
  primary/secondary action labels, all 7 widget titles +
  empty-state messages, "Talk to us", "Resources".
- **Setup checklist** (`SetupChecklist.tsx`) — title, "N of M
  complete", all 3 step titles + bodies + CTAs, dismiss aria
  label.
- **Bundle list** (`BundlesListPage.tsx`) — page title,
  Create-bundle CTA, Browse-templates CTA, view-mode labels
  (Table / Compact / Cards), saved-views hint.
- **Status badges** — active / draft / archived (used in many
  places).
- **Common CTAs** — Create / Save / Edit / Delete / Publish /
  Archive / Cancel / Confirm — used across dialogs.

Surfaces explicitly **out of scope** for this milestone:

- Every string in every Settings tab card (~300+ helpText /
  label strings) — stays English, gets translated mechanically
  in follow-on PRs.
- Bundle Detail tabs (Schedule / Display / Customers /
  Inventory / Performance / Activity / Advanced) — stays English.
- Help drawer markdown article bodies — already English-only;
  full localization is a content-team task, not a code task.
- Toast messages, error banners — stays English.
- Server-rendered error responses — server is a separate
  i18n target tracked elsewhere.

### Translation key conventions

Namespace by surface to keep the JSONs scannable:

```
{
  "nav": { "dashboard": "Dashboard", ... },
  "settings": { "general": "General", ... },
  "dashboard": {
    "title": "Dashboard",
    "subtitle": "...",
    "widgets": { "revenue": "Revenue snapshot", ... }
  },
  "checklist": { ... },
  "bundles": { ... },
  "status": { "active": "Active", "draft": "Draft", ... },
  "actions": { "create": "Create", "save": "Save", ... }
}
```

Component code reads via:
```tsx
const { t } = useTranslation();
return <Page title={t("dashboard.title")} ... />;
```

## File-level changes

### Frontend

- **New** `frontend/src/lib/i18n/index.ts` — i18next init,
  exported `i18n` instance, `I18nProvider` wrapper.
- **New** `frontend/src/lib/i18n/locales/en.json` — full EN
  source.
- **New** `frontend/src/lib/i18n/locales/{es,fr,de,it,pt}.json`
  — hand-translated.
- **New** `frontend/src/lib/i18n/locales/{ja,zh,ko,nl,pl,sv,da,no,ru}.json`
  — copy of EN with `__needsTranslation: true` top-level
  marker.
- **Modified** `frontend/src/App.tsx` — wrap the tree in
  `I18nProvider`; call `i18n.changeLanguage` from
  `usePolarisI18n` when locale changes.
- **Modified** ~6-10 page/component files to swap hardcoded
  literals for `t()` calls on the in-scope surfaces.

### Server

No changes. Server-side i18n is separate.

### Bundle size impact

i18next + react-i18next core: ~25 KB minified, ~10 KB gzipped.
15 locale JSON files × ~5-10 KB each = ~100 KB raw, ~30 KB
gzipped (only the active locale loads at runtime via
`i18next-resources-to-backend` if we lazy-load; for v1 we
bundle all eagerly to keep the wiring simple — total ~50 KB
gzipped).

## Acceptance criteria

- [ ] `npm run typecheck`, `npx vitest run`, `npm run lint`
      all pass at session close.
- [ ] `npx vite build` succeeds with all 15 locale JSONs
      bundled.
- [ ] Picking a non-English locale on the dashboard reloads
      and the in-scope surfaces (nav, sidebar, dashboard
      widgets, checklist, status badges, common CTAs)
      render in that locale.
- [ ] Surfaces NOT in scope (settings tab cards, bundle
      detail tabs, helpText) stay English without throwing.
      i18next's default fallback returns the key as-is when a
      translation is missing.
- [ ] All 15 locale JSONs exist and parse cleanly.
- [ ] Tests:
  - i18next init returns the expected language for a given
    localStorage value.
  - `t("nav.dashboard")` returns the right string in EN / FR /
    DE.
  - Missing-key fallback returns the key string, not undefined.

## Out of scope (deferred)

- **Translating every string in every Settings tab card.** The
  surface area is large and the strings are stable copy. A
  follow-on PR can mechanically replace literals with `t()`
  calls.
- **Right-to-left (RTL) layout** for Arabic / Hebrew. Polaris
  supports it but our 15 locales are all LTR.
- **Lazy-loading per-locale JSON** to shrink the initial
  bundle. Worthwhile if/when we add 30+ locales; over-
  engineering at 15.
- **Translation management platform** (Lokalise, Crowdin, etc.)
  — for now JSON files in the repo are the source of truth.

## Followed by

Mechanical translation passes for the deferred surfaces, one
PR per surface (settings tab cards, bundle detail tabs, etc.).
No further milestones queued in PLAN.md — these are
maintenance work.
