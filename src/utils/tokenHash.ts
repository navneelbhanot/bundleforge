/**
 * Token hashing helpers (M-168).
 *
 * Hash bearer tokens at rest so a database leak doesn't reveal
 * authentication material. Uses Node's built-in `scryptSync` —
 * no new dependency, suitable for short opaque tokens, and the
 * memory-hardness parameters slow down brute force attempts.
 *
 * Wire format: `v1:<salt-hex>:<hash-hex>`. The `v1:` prefix mirrors
 * the encryption util's versioning so a future move to argon2 / a
 * different KDF can be done with `v2:` without losing existing rows.
 *
 * NOT for passwords. Tokens here are 32-byte random strings —
 * already high-entropy, so we don't need argon2's interactive
 * tuning. scrypt is plenty.
 */
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const SCRYPT_KEYLEN = 32;
const SALT_LEN = 16;
// scrypt cost parameter — 2**14 = 16,384. Standard recommendation
// for non-interactive workloads. ~30ms on modern hardware.
const SCRYPT_N = 16384;
const SCRYPT_r = 8;
const SCRYPT_p = 1;
const PREFIX = "v1";

export function hashToken(token: string): string {
  const salt = randomBytes(SALT_LEN);
  const hash = scryptSync(token, salt, SCRYPT_KEYLEN, {
    N: SCRYPT_N,
    r: SCRYPT_r,
    p: SCRYPT_p,
  });
  return `${PREFIX}:${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function verifyToken(token: string, persisted: string): boolean {
  const parts = persisted.split(":");
  if (parts.length !== 3 || parts[0] !== PREFIX) return false;
  const salt = Buffer.from(parts[1], "hex");
  const expected = Buffer.from(parts[2], "hex");
  if (salt.length !== SALT_LEN || expected.length !== SCRYPT_KEYLEN) {
    return false;
  }
  const actual = scryptSync(token, salt, SCRYPT_KEYLEN, {
    N: SCRYPT_N,
    r: SCRYPT_r,
    p: SCRYPT_p,
  });
  // timingSafeEqual requires equal-length buffers — we already
  // checked, so this won't throw.
  return timingSafeEqual(actual, expected);
}

/** Convenience: random 32-byte token rendered as 64-char hex with a `bf_` prefix. */
export function generateToken(): string {
  return `bf_${randomBytes(32).toString("hex")}`;
}

/** First 11 chars including prefix — `bf_xxxxxxxx`. Used as the display prefix. */
export function tokenPrefix(token: string): string {
  return token.slice(0, 11);
}
