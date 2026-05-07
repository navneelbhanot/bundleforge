# Session 0210 — Rebrand BundleForge → MintBundle (M-210)

- **Date:** 2026-05-07
- **Milestone(s):** M-208, M-209, M-210
- **Branch:** claude/objective-sinoussi-77ae86
- **Commit(s):** (this session, plus M-208 self-healing auth + M-209
  webhook body parser fix earlier in the day)

---

## Context

Today's session was a long debugging chain across billing,
authentication, and webhook plumbing. Three real bugs landed
(M-208, M-209) plus a strategic pivot (M-210) — the rebrand.

## What was done

### M-208: Self-healing auth (earlier in session)

`src/middleware/recoverableAuth.ts` — catches HttpResponseError
401/403 from Shopify SDK's `validateAuthenticatedSession`
middleware, sends App Bridge re-authorize header, and lets the
embedded admin recover from revoked-token states without
returning 500. 6 unit tests pin the contract.

### M-209: Webhook body parser fix (earlier in session)

`src/server/index.ts` — the global `app.use(express.json())`
was consuming the request body for ALL routes including
`/api/webhooks`, leaving the HMAC verifier reading an empty
Buffer. Result: every webhook 401'd, including
`app/uninstalled`, leaving stale tokens in our DB across
install/uninstall cycles → cascading 403s on every admin
request. Fix is a path-aware skip:

    app.use((req, _res, next) => {
      if (req.path === "/api/webhooks") return next();
      return express.json({ limit: "10mb" })(req, _res, next);
    });

This single fix explains every billing/auth failure today —
the entire afternoon was chasing symptoms downstream of broken
webhook delivery. Regression test in
`tests/integration/webhook-json-parser.test.ts` mimics the
production middleware order.

### M-210: Rebrand to MintBundle (this commit)

Trigger: JRL Software launched a Shopify app named "BundleForge"
on 2026-05-01 in the same product-bundling category. URL slug
on Shopify is `bundleforge-1` — confirms `bundleforge` is
locked in their App Store namespace. Submitting under that name
guarantees rejection per Shopify's "confusingly similar" rule.

Naming search ruled out: PackForge (.com taken via Vercel,
.app via Afternic), Bundlecraft (Shopify slug taken by Fabian
Eppinger 2026-05-05), Stackr (.com + .app both taken),
Bundlemint / Bundlebar (.com taken by domainers). Three names
cleared all three checks (Shopify slug + .com + .app):
ForgeBundle, MintBundle, Bundley.

Picked **MintBundle** for: zero collision risk with JRL's
BundleForge (so Shopify review approves first time), modern
SaaS register, "freshness" connotation aligns with bundle
commerce positioning. ADR `docs/decisions/0006-rebrand-mintbundle.md`
documents the decision tree.

### Codebase pass

- 175+ files mechanically renamed via `sed`. Replacements:
  - `BundleForge` → `MintBundle`
  - `Bundleforge` → `MintBundle` (caught the leading-cap-only
    variant on a second pass)
  - `bundleforge` → `mintbundle`
  - `BUNDLEFORGE` → `MINTBUNDLE`
- File renames:
  - `docs/help/why-bundleforge.md` → `why-mintbundle.md`
  - `extensions/theme-extension/assets/bundleforge.css` →
    `mintbundle.css`
  - `extensions/theme-extension/assets/bundleforge-bundle.js` →
    `mintbundle-bundle.js`
- Excluded from rename: `docs/sessions/` (append-only per
  CLAUDE.md), `node_modules`, `dist`, `package-lock.json`.
- Verified zero `Bundleforge|BundleForge|bundleforge|BUNDLEFORGE`
  matches across the codebase post-pass.
- `package.json`'s `name` field changed `bundleforge` → `mintbundle`.

### User-action handoff

`docs/ops/rebrand-handoff.md` — step-by-step playbook for the
12 user-side actions: register domains, Cloudflare DNS, new
Partner Dashboard app, Railway env swap, Resend domain swap,
Workspace alias, `npx shopify app deploy` under new client_id,
Cloudflare Pages domain swap, App Store submission, optional
GitHub repo rename, optional sale of `bundleforge.app` to JRL
Software for partial recovery of the ₹15k spend.

## Acceptance criteria status

- [x] `npm run typecheck` clean (logs `mintbundle@0.1.0
      typecheck` — package name flipped correctly).
- [x] `npm run test` — 902 pass / 13 skipped / 915 total. Same as
      pre-rebrand counts; no test broke.
- [x] `npm run lint` — same 2 pre-existing errors (NavMenu.tsx,
      CustomersTab.tsx), 2 in `marketing/build-legal.cjs` from
      another commit. No new errors.
- [x] Final scan for `BundleForge|bundleforge` across all source
      types: 0 matches.
- [x] Domain availability verified: `mintbundle.app`,
      `mintbundle.com`, `apps.shopify.com/mintbundle` all
      unregistered as of 2026-05-07.

## Notes

- The brand-DNA change ("Forge" metaphor → "Mint" / freshness)
  is documented in the ADR. Marketing tone, color palette, and
  design system don't need to change — those were a brand veneer,
  not load-bearing strategy.
- Domain references already updated in code to `mintbundle.app`
  even though the user hasn't registered it yet. When they
  register and point Cloudflare DNS, the deploy auto-resolves.
  If for any reason `mintbundle.app` is no longer available
  tomorrow, the rebrand pass would need a second find-and-replace
  to a different domain — small risk worth taking to avoid a
  second pass.
- `shopify.app.toml`'s `client_id` field still has the old
  BundleForge UUID (`59b24b4db1e954a95e3f82df96e713bb`). User
  must update it post-Partner-Dashboard-creation per step 4 of
  the handoff doc. Documented intentionally — the new app's
  client_id is generated by Partner Dashboard, not by us.

## Deferred follow-ups

- App Store submission (after user-side steps 1–10).
- Sell `bundleforge.app` to JRL Software (async, weeks-scale).
- Trial-warning email + cron (M-203 — was always next; still
  on the post-rebrand backlog).
- One-click downgrade flow.
- Switch-interval flow on the same plan (monthly ↔ annual).
- Shopify Functions / Theme Extension redeploy under new
  client_id — handoff step 9.
