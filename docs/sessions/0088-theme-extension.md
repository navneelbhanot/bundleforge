# Sessions 0088..0093 — Theme extension blocks + i18n

Five App Block Liquid files + one shared Web Components asset:

- `blocks/bundle-display.liquid` (M-088) — `<bundleforge-bundle>`
- `blocks/variant-selector.liquid` (M-089) — `<bundleforge-variant-picker>`
- `blocks/build-box-stepper.liquid` (M-090) — `<bundleforge-build-box>`
- `blocks/mix-match-grid.liquid` (M-091) — `<bundleforge-mix-match>`
- `blocks/bogo-display.liquid` (M-092) — `<bundleforge-bogo>`
- `assets/bundleforge-bundle.js` — five custom elements, fetches
  bundle config from `/apps/bundleforge/bundle/<slug>` (App Proxy)
- `assets/bundleforge.css` — base styles, themes can override
- `locales/{en.default,es,fr}.json` (M-093) — i18n strings

No automated tests yet — these are browser-only. M-141 (load test)
will add Playwright coverage when the test runner lands.

349 tests pass.
