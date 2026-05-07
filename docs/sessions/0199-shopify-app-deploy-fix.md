# Session 0199 — Unblock `shopify app deploy`

- **Date:** 2026-05-07
- **Milestone(s):** Deploy plumbing — no roadmap milestone
- **Branch:** claude/objective-sinoussi-77ae86
- **Commit(s):** ec00e5c, 72e02cd, 774f28c, e7f434d, 188222d, 413a088, 25c294f
- **Outcome:** `bundleforge-3` released to users via `npx shopify app deploy`.

---

## Goal

Make `npx shopify app deploy` succeed end-to-end. The command had been
chained-failing on a long sequence of validation rules (Function build,
Function library install, Flow schema format, Flow field key regex, Flow
trigger field types). Each fix surfaced the next error.

## What was done

### Shopify Function build pipeline (cart-transform, checkout-validation)

Replaced the homegrown esbuild + javy build with the official Shopify CLI
pipeline.

- **Library**: depend on `@shopify/shopify_function@~2.0.0` per
  extension (`extensions/cart-transform/package.json`,
  `extensions/checkout-validation/package.json`). v2 is required by
  the deploy server; v1 works locally but the upload check rejects it.
- **Build script**: each extension's `build` is now
  `shopify app function build` (delegates to the Shopify CLI).
- **Entrypoint**: renamed `src/run.js` → `src/index.js` in both
  extensions — the CLI looks for `src/index.{js,ts}` to detect
  JavaScript functions. Tests updated to import from `./index.js`.
- **TOML build block**:
  ```toml
  [extensions.build]
  command = ""
  path = "dist/function.wasm"
  typegen_command = "echo"
  ```
  Empty `command` lets the CLI build internally (avoids the
  npm-recursion trap when the script is also `shopify app function build`).
  `typegen_command = "echo"` skips graphql-codegen since we ship
  untyped JS.
- **Output**: `cart-transform` 17,968 B, `checkout-validation` 2,800 B.
  Both export `run:function` and import the
  `shopify_functions_javy_v1/{canonical_abi_realloc,invoke,memory}`
  triplet (Shopify-provided QuickJS provider).

### Per-extension dependency install

Root `npm install` does not recurse into `extensions/*` (the project is
not an npm workspace). Added `scripts/install-extensions.cjs` and wired
it as the root `postinstall` hook so any tooling that runs a root install
(local dev, CI, Railway) leaves both extensions ready to build.

The script is idempotent (skips an extension whose
`@shopify/shopify_function` is already present), best-effort (warns on
per-extension failure rather than blocking the parent install), and
honours lockfiles (`npm ci` when `package-lock.json` exists, `npm
install` otherwise).

### Dockerfile

Railway's Docker build was failing with `MODULE_NOT_FOUND` on
`/app/scripts/install-extensions.cjs` because the Dockerfile copied
`package.json` + lock and ran `npm ci` before `COPY . .`. Added an
explicit `COPY scripts ./scripts` immediately after the manifests so
the postinstall hook can find the script. The script is a verified
no-op when `extensions/*/package.json` is absent (which is the case in
the Docker build — Functions are deployed from the developer's
machine, not from this image).

### Flow extensions restructured

The previous setup put all three Flow extensions in a single
`extensions/flow/` dir with `schema = "src/*_schema.json"` pointing at
generic JSON Schema files. Shopify Flow expects:

- One extension per directory.
- `schema = "*.graphql"` containing GraphQL SDL types.
- Input/output fields declared in toml under `[settings] [[settings.fields]]`.
- No `api_version` (that's a Functions concept).
- Field keys must match `/^[a-zA-Z\s]*$/` (no underscores → camelCase).
- Trigger field types restricted to `boolean | email |
  single_line_text_field | url | number_decimal | schema_type_reference`.
  `number_integer` is action-only.

Restructured into three dirs (matches `shopify app generate extension
--type flow_*` scaffold output):

- `extensions/flow-force-inventory-sync/` — `flow_action` with one
  `bundleId` input, returns `FlowActionResult{success, message}` (the
  only one with a `schema.graphql`).
- `extensions/flow-bundle-published/` — `flow_trigger` emitting
  `bundleId / title / bundleType / slug`, all `single_line_text_field`.
- `extensions/flow-bundle-low-stock/` — `flow_trigger` emitting
  `bundleId / title / availableQuantity / threshold`. The two numeric
  fields are `number_decimal` (Shopify's only trigger numeric type).

Removed `extensions/flow/`. No code in `src/`, `tests/`, or `frontend/`
references the old or new handles. The action's `runtime_url` still
points at the existing `/api/v1/inventory/sync` route in
`src/routes/inventory.ts`.

### Vitest config

Widened `exclude` to `**/node_modules/**` so the per-extension
`node_modules/` trees don't leak third-party `*.test.ts` files
(`yaml-ast-parser` etc.) into the run.

## Acceptance criteria status

- [x] `npm run typecheck` passes.
- [x] `npx vitest run extensions/cart-transform extensions/checkout-validation` — 37/37 pass.
- [x] `npx shopify app function build` succeeds locally for both Functions.
- [x] Built wasm exports `run` (verified via
  `WebAssembly.Module.exports`).
- [x] Built wasm < 256 KB (17.9 KB / 2.8 KB).
- [x] All three Flow toml files parse with python tomllib.
- [x] All Flow field types match their respective allow-lists
  (`cJr` for actions, `uJr` for triggers).
- [x] `npx shopify app deploy` succeeds — `bundleforge-3` released.

## Notes / lessons

- The Shopify CLI's Zod chain for Flow extensions has at least seven
  separate refinements (`AUt`, `NUt`, `FUt`, `c0e`, plus per-field
  schemas `_qe`/`wqe` and the action/trigger-type allow-lists `cJr`/`uJr`).
  Iterating one error at a time was painful; mid-session I traced the
  whole chain in `node_modules/@shopify/cli/dist/index.js` to catch the
  trigger-only field-type rule before pushing.
- `_qe` is `.strict()` for `flow_action` non-reference fields. Allowed
  keys are exactly `type, description, key, name, required` — anything
  else (e.g. `default_value`, `validations`) would error. `wqe` (used
  for `flow_trigger`) is non-strict.
- Dynamic-linked Javy output (`-d`) is what the Shopify CLI produces
  internally. It looks "tiny" (~17 KB) because the QuickJS provider is
  imported, not embedded.

## Deferred follow-ups

- Marketing site Cloudflare Pages deployment (instructions in
  `marketing/README.md`).
- Email setup for `support@bundleforge.app`.
- Settings tab field labels + helpText i18n pass.
- Bundle Detail page tabs i18n.
- Verify Flow extensions actually appear in the merchant's Flow editor
  on the dev store (visual smoke test only — handled outside the CLI).
