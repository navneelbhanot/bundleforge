# M-002 — Encryption Utility (AES-256-GCM)

> Spec written before implementation. Edit only as understanding evolves; log
> meaningful changes in the next session log.

---

## Goal

A small, correct, well-tested AES-256-GCM helper at `src/utils/encryption.ts`
that encrypts and decrypts UTF-8 strings using the key in
`env.ENCRYPTION_KEY`, with authenticated encryption, per-call random IVs, a
versioned payload format that supports future key rotation, and typed errors.

## Why

Two production code paths need authenticated symmetric encryption:

- `Shop.accessToken` — Shopify OAuth tokens, persisted at rest
  (ARCHITECTURE.md §6).
- `Integration.credentials` — third-party API keys for ShipStation, Klaviyo,
  Recharge, etc. (ARCHITECTURE.md §3.4).

Doing this once, correctly, prevents every later milestone from rolling its
own crypto. The existing stub (`src/utils/encryption.ts` from prior repo
state) is functional but uses a non-standard IV length, takes the key as a
parameter on every call (no env wiring), has no version prefix for
rotation, no input validation, and no tests. M-002 replaces it.

## Out of scope

- Asymmetric crypto, JWT, signing.
- Key Management Service (KMS) integration. The key lives in
  `env.ENCRYPTION_KEY` for now. KMS is a future ADR if needed.
- Actual key rotation execution. M-002 only reserves the on-disk format
  (`v1:…`) so rotation can be added later without re-encrypting all rows.
- Encrypting non-string payloads. JSON callers `JSON.stringify` first.
- Streaming or chunked encryption. Bundle credentials are kilobytes at
  worst.

## Design

### File layout

- `src/utils/encryption.ts` — public API + implementation.
- `src/utils/encryption.test.ts` — colocated unit tests.

### Public API

```ts
/** Wire format version. Bump when the format changes. */
export const ENCRYPTION_VERSION = 1;

/** Thrown when input cannot be encrypted (e.g. bad key). */
export class EncryptionError extends Error {}

/** Thrown when a payload cannot be decrypted (bad format, wrong key,
 *  tampering, or unsupported version). */
export class DecryptionError extends Error {}

/** Encrypt a UTF-8 string. Returns "v1:<iv_b64u>:<tag_b64u>:<ct_b64u>". */
export function encrypt(plaintext: string, opts?: { key?: string }): string;

/** Decrypt a payload produced by encrypt(). Throws DecryptionError on any
 *  format, key, or auth-tag failure. */
export function decrypt(payload: string, opts?: { key?: string }): string;
```

`opts.key` (64-hex string) overrides the env-sourced key. Tests use it to
exercise key mismatches without mutating `process.env`.

### Algorithm and parameters

- Algorithm: `aes-256-gcm` (authenticated encryption, the standard for
  this use case).
- Key: 32 raw bytes, decoded from a 64-hex string. Validated (length and
  hex) before use. Bad key throws `EncryptionError`.
- IV: 12 random bytes per call (NIST SP 800-38D recommended length for
  GCM). Generated with `crypto.randomBytes(12)`. Never reused.
- Auth tag: default 16 bytes from GCM. Verified on decrypt; tampered
  payloads throw `DecryptionError`.
- AAD: not used in v1. Reserved for future versions if we want to bind
  ciphertexts to a row (e.g. shop_id).

### Wire format

```
v<version>:<iv_b64url>:<tag_b64url>:<ciphertext_b64url>
```

- `<version>` is a positive integer literal. v1 is the only format today.
- Encoding is base64url *without padding* (URL-safe, fits in JSON, no need
  to escape). Node 16+ supports `'base64url'` as an encoding name on
  `Buffer.toString` and `Buffer.from`.
- Separator is `:`; none of the encoded segments contain `:`.

### Error handling

- `EncryptionError` for: invalid key, empty plaintext (caller bug — empty
  string is encryptable but is almost always a bug; we still allow it for
  flexibility, but key errors throw).
  - Concretely: only key validation throws on encrypt.
- `DecryptionError` for: malformed payload, unsupported version, bad
  base64url segments, wrong key (auth tag fails), tampered IV/tag/CT
  (auth tag fails). Underlying Node `crypto` errors are wrapped, never
  leaked.

### Key sourcing

- Default key comes from `env.ENCRYPTION_KEY` (validated by M-001 to be
  exactly 64 hex chars).
- Lazy resolution: do not read `env` at module-import time. Resolve when
  the function is called. This keeps tests that pass `opts.key` from
  triggering env validation.
- The function does *not* fall back to a hardcoded development key. Bad
  env config is a hard failure.

### Future rotation hooks (no behavior in M-002)

- The leading `v<N>:` prefix is the dispatch tag. When v2 ships, `decrypt`
  inspects the prefix and routes to the correct handler. Old payloads keep
  decrypting against the old key as long as that key is still configured
  (out of scope for M-002).
- `encrypt` always writes the current version; reading old payloads is
  what makes rotation possible.

## Acceptance criteria

- [ ] `npm run typecheck` passes.
- [ ] `npm run lint` passes (lint is still a no-op until M-012; that's OK).
- [ ] `npm test` passes.
- [ ] Specific tests pass:
  - [ ] Round-trip with default (env) key returns the original plaintext.
  - [ ] Round-trip with explicit key option returns the original plaintext.
  - [ ] Two encryptions of the same plaintext produce *different*
        ciphertexts (random IV per call).
  - [ ] Decrypting with the wrong key throws `DecryptionError`.
  - [ ] Mutating one byte of the ciphertext segment throws `DecryptionError`.
  - [ ] Mutating one byte of the IV segment throws `DecryptionError`.
  - [ ] Mutating one byte of the auth-tag segment throws `DecryptionError`.
  - [ ] A payload with the wrong number of segments throws
        `DecryptionError`.
  - [ ] A payload with an unsupported version prefix throws
        `DecryptionError`.
  - [ ] An invalid key (wrong length, non-hex) throws `EncryptionError` on
        encrypt and `DecryptionError` on decrypt.
  - [ ] Empty-string plaintext round-trips correctly.
  - [ ] Multibyte UTF-8 (e.g. `"héllo 世界 🚀"`) round-trips correctly.
  - [ ] Wire format matches the regex
        `/^v1:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+:[A-Za-z0-9_-]*$/`.

## Files touched

- `src/utils/encryption.ts` (rewritten).
- `src/utils/encryption.test.ts` (new).

## Open questions

- **Should we encrypt empty strings?** Decision: yes. Some callers might
  legitimately store empty optional secrets. Encrypting `""` is well-defined
  for GCM. Keeps the API minimal.
- **AAD binding to shop_id?** Decision: defer. Adding AAD now means every
  caller needs to pass context. Without AAD, the format is simpler. v2 can
  introduce optional AAD if the threat model requires.
- **Use of `node:crypto` vs `crypto`?** Decision: use `node:` prefix. It's
  the modern form, signals intent to readers, and is preferred by Node 18+.

## ADRs created or referenced

None. The decisions above are local to the encryption module and don't
warrant a cross-cutting ADR. If KMS or external HSM enters scope later,
that will need an ADR.
