# Sessions 0094..0100 — Admin frontend scaffold + first pages

- `frontend/` directory created with its own `tsconfig.json` and
  `vite.config.ts`. Built output lands in `dist/frontend/`.
- `frontend/index.html` loads App Bridge via the v4 meta tag + CDN
  script. No Provider component is needed in v4.
- `frontend/src/main.tsx` mounts `<App />` with React 18's
  `createRoot`.
- `frontend/src/App.tsx` (M-096) wires Polaris `<AppProvider>` and
  `react-router-dom` routes for /, /bundles/:id, /orders, /settings,
  /billing.
- `frontend/src/AppBridgeProvider.tsx` (M-095) is a pass-through —
  App Bridge v4 self-initializes.
- `frontend/src/pages/BundlesListPage.tsx` (M-097) — fetches
  `/api/v1/bundles`, renders Polaris IndexTable.
- `frontend/src/pages/BundleDetailPage.tsx` (M-098) — loads
  `/api/v1/bundles/:id`, layout with TypeConfigPanel + ProductPicker.
- `frontend/src/components/ProductPicker.tsx` (M-099) — Polaris
  ResourceList over current items. Shopify ResourcePicker integration
  to add new items lands when App Bridge actions are wired.
- `frontend/src/components/TypeConfigPanel.tsx` (M-100) — switches
  on bundle type; renders forms for fixed, mix_match, build_box,
  multipack, wholesale, and a free-form fallback.
- Placeholder pages for Orders / Settings / Billing point at their
  later milestones.

## Test infrastructure

- Installed `@testing-library/react`, `@testing-library/dom`,
  `@testing-library/jest-dom`, `jsdom`.
- `vitest.config.ts` adds `frontend/**/*.test.{ts,tsx}` to include and
  uses `environmentMatchGlobs` to apply `jsdom` only to
  `frontend/**`. Setup file polyfills `window.matchMedia` and
  `ResizeObserver` for Polaris.
- `tsconfig.json` adds `allowJs: true` (extensions are JS) and
  extends `rootDirs` to `["./src", "./tests", "./extensions"]`.
- New scripts: `typecheck:server`, `typecheck:frontend`. The default
  `typecheck` runs both.
- 3 RTL tests for `TypeConfigPanel` (multipack, mix_match, custom
  fallback).

352 tests pass. **Closes M-094..M-100 target.**
