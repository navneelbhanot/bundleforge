# M-030 — GDPR webhook: shop/redact

## Goal

When Shopify fires `shop/redact` (48h after uninstall), permanently
delete the shop's data. FK CASCADE on the schema removes everything
attached to the Shop row.

## ADR-0003 amendment

The original audit-log immutability triggers blocked BOTH UPDATE and
DELETE. This blocks GDPR-mandatory cascade deletion. Per the spirit of
ADR-0003 (defense against silent inventory mutation), the integrity
threat is *mutation* of historical records, not *removal* during a
required redaction. We narrow the protection to UPDATE only and add a
new migration that drops the DELETE trigger. ADR-0003a captures this.

## Design

```ts
export function shopRedactHandler(client?): WebhookHandler;
```

`deleteMany` on `Shop` by `shopifyDomain`. Cascade handles everything.

Migration `20260504_audit_log_relax_delete` drops the DELETE trigger.

## Acceptance

- [ ] Migration drops the DELETE trigger (UPDATE trigger remains).
- [ ] Handler deletes Shop by domain.
- [ ] Tests use vi.fn() prisma; assert deleteMany called with correct
      where.
- [ ] ADR-0003a written and referenced from ADR-0003.

## Files

- `prisma/migrations/20260504_audit_log_relax_delete/migration.sql`
- `src/webhooks/handlers/shopRedact.ts`
- `src/webhooks/handlers/shopRedact.test.ts`
- `src/jobs/webhooksWorker.ts` (register)
- `docs/decisions/0003a-audit-log-allow-cascade-delete.md`
