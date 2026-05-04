# M-027 — Webhook handler: shop/update

## Goal

Map the Shopify `shop/update` payload onto the Shop row, reconciling
fields placeholder'd at install (M-018): name, email, currency,
timezone, plan, locale.

## Acceptance criteria

- [ ] `shopUpdateHandler(client?)` factory.
- [ ] Maps payload `name`, `email`, `currency`, `iana_timezone`,
      `plan_name`, `primary_locale` → Shop columns.
- [ ] Ignores unknown fields silently; only writes the allowlist.
- [ ] Tests with vi.fn() mock; assert exact call args.

## Files touched

- `src/webhooks/handlers/shopUpdate.ts`
- `src/webhooks/handlers/shopUpdate.test.ts`
- `src/jobs/webhooksWorker.ts` (register)
