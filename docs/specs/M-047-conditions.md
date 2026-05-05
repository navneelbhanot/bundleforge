# M-047 — condition evaluator: tags, geo, dates

Implemented in the engine landed in M-040. M-047 expands tests to cover
each condition independently.

## Rules

- `customerTags`: OR-match (any matching tag passes), case-insensitive.
- `countries`: OR-match on uppercase ISO codes.
- `startsAt` / `endsAt`: ISO timestamps; rule must be within the window
  using `context.now`.

## Acceptance

- [x] Tests for date inside window, after `endsAt`, customer-tag match
      (case-insensitive), country match (case-insensitive), missing tag
      while required → skipped.
