# M-150..M-155 — Launch readiness

Final batch. Everything required to ship to the Shopify App Store.

## M-150 Privacy policy + ToS templates

- `legal/privacy-policy.md` — what data we collect (none from end-shoppers
  beyond order metadata), how merchants can request export/deletion,
  retention, sub-processors.
- `legal/terms-of-service.md` — service description, billing, SLA,
  acceptable use, liability.
- Both files are templates with `{{merchant_name}}` placeholders so a
  legal review can fill in the operating entity.

## M-151 Demo store seed data

- Extend `prisma/seed.ts` with a fully-populated demo merchant: 8 bundles
  spanning every type (fixed, mix_match, bogo, bxgy, volume, build_box,
  multipack, subscription), realistic pricing rules, a few orders, and
  audit-log history.
- `scripts/demo-reset.sh` — wipes + reseeds the demo store. Documented
  in README.

## M-152 Beta merchant onboarding

- `docs/onboarding-beta.md` — pre-flight checklist, OAuth walkthrough,
  initial bundle setup, theme block install, common-issue guide.
- `frontend/src/components/OnboardingWizard.tsx` already exists; this
  milestone wires the "skip to demo data" button so a beta merchant
  sees a populated app within 30 seconds.

## M-153 App Store screenshots + video script

- `docs/launch/screenshots-spec.md` — 6 screenshots: dashboard, bundle
  detail, theme storefront block, analytics, A/B tests, mobile.
- `docs/launch/video-script.md` — 60-second walkthrough script with
  scene-by-scene timing, voiceover, on-screen captions.

## M-154 App Store submission package

- `docs/launch/app-listing.md` — listing copy: tagline, short
  description, long description, key benefits, integration list,
  pricing tiers, support URLs.
- `docs/launch/submission-checklist.md` — final pre-submit verification.

## M-155 Public launch checklist

- `docs/launch/launch-checklist.md` — D-7 through D+1 timeline:
  infrastructure, monitoring, on-call, marketing assets, support
  capacity.

## Files

- `legal/privacy-policy.md`, `legal/terms-of-service.md`
- `prisma/seed.ts` (extended)
- `scripts/demo-reset.sh`
- `docs/onboarding-beta.md`
- `docs/launch/{screenshots-spec,video-script,app-listing,submission-checklist,launch-checklist}.md`
