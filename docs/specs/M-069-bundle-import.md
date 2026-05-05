# M-069 — Bundle CSV import + dry-run

## Goal

`BundleService.bulkImport(shopId, csv, opts)`: parse a CSV body, validate
each row, optionally dry-run (no DB writes) or commit (one create per
row). Results aggregate `imported`, `errors[]`.

## CSV format

One row per bundle. Items and rules are JSON-encoded inside their
columns to preserve nested structure within a CSV cell.

```
title,type,description,items,rules
"Summer Box","fixed","desc","[{""shopifyProductGid"":""gid://..."",""title"":""X"",""quantity"":1}]","[{""type"":""percentage"",""value"":15}]"
```

Quotes inside fields are doubled per RFC 4180.

## Out of scope

- File upload at the route level (M-053 doesn't expose `/import` yet;
  added when needed by user import flows).
- Streaming for large files. M-069 reads the whole CSV into memory;
  acceptable for typical merchant import sizes.

## Acceptance

- [ ] Tiny RFC-4180 parser at `src/services/bundles/csv.ts` supports
      quoted fields, doubled-quotes, and CRLF.
- [ ] `BundleService.bulkImport` validates each row, defers to
      `BundleService.create`, captures per-row errors without aborting
      the batch.
- [ ] `opts.dryRun = true` validates only.
- [ ] Tests: happy path (2 rows), one bad row + one good row in dry-run
      and commit modes, malformed JSON column, malformed CSV.

## Files

- `src/services/bundles/csv.ts`
- `src/services/bundles/csv.test.ts`
- `src/services/bundles/import.ts`
- `src/services/bundles/import.test.ts`
- Update `BundleService.bulkImport` (replaces stub).
