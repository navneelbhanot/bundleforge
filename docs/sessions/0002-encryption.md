# Session 0002 — Encryption Utility (AES-256-GCM)

- **Date:** 2026-05-04
- **Milestone(s):** M-002
- **Branch:** claude/review-product-plan-jfMlf

## What was done

- Wrote `docs/specs/M-002-encryption.md`.
- Rewrote `src/utils/encryption.ts`:
  - `aes-256-gcm` with 12-byte IV (NIST GCM standard) and 16-byte tag.
  - Wire format `v1:<iv_b64url>:<tag_b64url>:<ct_b64url>` so future key
    rotation can introduce v2 without re-encrypting.
  - Default key resolved lazily from `env.ENCRYPTION_KEY`; tests pass an
    explicit `opts.key` to avoid mutating `process.env`.
  - Typed `EncryptionError` / `DecryptionError`. Underlying `crypto`
    failures are wrapped, not leaked.
- Added `src/utils/encryption.test.ts` with 20 cases: round-trip with env
  key, explicit key, empty string, multibyte UTF-8; randomized-IV non-
  determinism; wire-format regex; tamper detection on CT/IV/tag; wrong-key
  rejection; segment-count and version-tag malformations; bad IV/tag
  lengths; key validation on encrypt and decrypt; runtime guards for
  non-string input.

## Acceptance criteria

All checked items from `docs/specs/M-002-encryption.md` pass:

- [x] Typecheck, lint (no-op), test all green.
- [x] 12 of the 20 test cases listed in the spec; the remaining 8 cover
      additional edge cases (segment counts, version tag form, IV/tag
      length, runtime type guards) discovered while writing tests.

## Verified by hand

- `npm run typecheck && npm test`: 39 tests pass total (19 env + 20 enc).

## Deferred

None new. Carry-overs from M-001 still apply.

## Surprises and learnings

- The pre-existing stub used 16-byte IVs, which is non-standard for GCM
  (NIST recommends 12). Switched to 12 bytes; this is incompatible with
  any data the old stub had encrypted, but no production data exists
  yet, so this is free.
- Node's `crypto.Decipher` throws a generic message on tag mismatch.
  Wrapped to avoid leaking implementation details to callers.

## Handoff

Next session starts at **M-003 — Logger config (pino) + structured logging**.
Replace the existing `src/config/logger.ts` (which uses Winston) with a
Pino-based structured logger. Per ARCHITECTURE.md §1, Pino is the chosen
logging library. The Winston dep can stay for now and be removed in a
later cleanup; the import surface needs to remain `import { logger }`.
