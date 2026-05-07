# App Store submission checklist (M-154)

Run through this in order. Anything unchecked blocks submission.

## Listing

- [ ] App name finalised (`MintBundle — Reliable Product Bundles`)
- [ ] Tagline ≤80 chars (`docs/launch/app-listing.md`)
- [ ] Short description ≤120 chars
- [ ] Long description copyedited and ready
- [ ] 5 key benefits, each ≤140 chars
- [ ] Primary + secondary categories selected
- [ ] Integrations listed (ShipStation, Amazon, ReCharge, Bold,
      Klaviyo, Google Merchant, Flow)

## Assets

- [ ] App icon: 1200×1200 PNG, transparent background
- [ ] 6 screenshots @ 1600×900, captioned (`screenshots-spec.md`)
- [ ] 60-second demo video, captioned, ≤100 MB
      (`video-script.md`)
- [ ] Promotional banner if running a launch promo

## Legal

- [ ] Privacy policy live at `https://mintbundle.app/legal/privacy-policy`
- [ ] Terms of service live at `https://mintbundle.app/legal/terms-of-service`
- [ ] Cookie disclosure (we set none)
- [ ] EU representative listed (if not EU-based)

## Technical

- [ ] OAuth flow tested in 3 fresh dev stores
- [ ] Mandatory webhooks responding 200 in <5 s:
      `app/uninstalled`, `customers/data_request`, `customers/redact`,
      `shop/redact`
- [ ] App Proxy HMAC verification verified
- [ ] App Bridge v4 session-token flow verified
- [ ] Cart Transform Function deployed to dev and Plus dev stores
- [ ] Theme App Extension block tested on Dawn + 2 popular themes
- [ ] Locales: en/es/fr/de/it/pt all render
- [ ] `/health` returns 200 with `db: true, redis: true`
- [ ] Datadog dashboards imported, monitors armed (`docs/runbook-incidents.md`)
- [ ] Sentry release marker pushed for the submission build

## Performance

- [ ] Admin TTI <2s on 4G simulated network
- [ ] Storefront block ≤30 KB gzipped
- [ ] Storefront block does not block main thread >50 ms
- [ ] Cart Transform Function executes in <50 ms p95

## Billing

- [ ] All four plans tested end-to-end via Shopify's recurring charge API
- [ ] Trial → paid transition verified
- [ ] Cancel + downgrade verified
- [ ] Annual billing verified

## GDPR

- [ ] `/api/v1/gdpr/export` returns full dump w/ creds redacted
- [ ] `/api/v1/gdpr/delete-shop` cascades through FKs
- [ ] All 3 mandatory GDPR webhooks ack within 5 s

## Support

- [ ] support@mintbundle.app monitored
- [ ] Help docs live at `mintbundle.app/docs`
- [ ] In-app chat enabled for paid plans
- [ ] Status page live at `status.mintbundle.app`

## Final sign-off

- [ ] Engineering: tests pass, no open sev1 bugs
- [ ] Design: assets reviewed
- [ ] Legal: privacy + ToS reviewed
- [ ] Founder: submit
