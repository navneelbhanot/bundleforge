# Session 0069 — Bundle CSV import

- `src/services/bundles/csv.ts` — tiny RFC-4180 parser (quoted fields,
  doubled-quotes, CR/LF/CRLF). 7 unit tests.
- `src/services/bundles/import.ts` — `importBundlesFromCsv(shopId,
  csv, opts)` parses rows, decodes JSON-encoded `items`/`rules` cells,
  delegates to `BundleService.create`. Per-row error capture; batch never
  aborts on a single failure. `opts.dryRun` skips persistence. 4 tests.

288 tests pass.
