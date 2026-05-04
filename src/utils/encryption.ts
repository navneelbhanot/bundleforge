/**
 * AES-256-GCM authenticated encryption for short UTF-8 strings.
 *
 * Wire format (v1): "v1:<iv_b64url>:<tag_b64url>:<ct_b64url>"
 *  - iv:  12 random bytes (NIST SP 800-38D recommended GCM IV size)
 *  - tag: 16-byte GCM auth tag (default)
 *  - ct:  AES-256-GCM ciphertext
 *
 * The leading "v1:" reserves space for future key rotation: a v2 format can
 * be introduced later, and decrypt() can dispatch on the prefix.
 *
 * See docs/specs/M-002-encryption.md.
 */
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  type CipherGCM,
  type DecipherGCM,
} from "node:crypto";

import { env } from "../config/env";

export const ENCRYPTION_VERSION = 1;

const ALGORITHM = "aes-256-gcm";
const KEY_BYTES = 32; // AES-256
const IV_BYTES = 12;
const KEY_HEX_RE = /^[0-9a-fA-F]{64}$/;

export class EncryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EncryptionError";
  }
}

export class DecryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DecryptionError";
  }
}

interface CryptoOpts {
  /** 64-char hex string. Defaults to env.ENCRYPTION_KEY. */
  key?: string;
}

function resolveKey(opts: CryptoOpts | undefined, errorCtor: typeof EncryptionError): Buffer {
  const hex = opts?.key ?? env.ENCRYPTION_KEY;
  if (typeof hex !== "string" || !KEY_HEX_RE.test(hex)) {
    throw new errorCtor(
      "ENCRYPTION_KEY must be a 64-character hex string (32 bytes)",
    );
  }
  const buf = Buffer.from(hex, "hex");
  if (buf.length !== KEY_BYTES) {
    // Defense in depth; the regex above already enforces this.
    throw new errorCtor(`ENCRYPTION_KEY must decode to ${KEY_BYTES} bytes`);
  }
  return buf;
}

export function encrypt(plaintext: string, opts?: CryptoOpts): string {
  if (typeof plaintext !== "string") {
    throw new EncryptionError("plaintext must be a string");
  }
  const key = resolveKey(opts, EncryptionError);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv) as CipherGCM;
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v${ENCRYPTION_VERSION}:${iv.toString("base64url")}:${tag.toString("base64url")}:${ct.toString("base64url")}`;
}

export function decrypt(payload: string, opts?: CryptoOpts): string {
  if (typeof payload !== "string") {
    throw new DecryptionError("payload must be a string");
  }
  const parts = payload.split(":");
  if (parts.length !== 4) {
    throw new DecryptionError(
      `Malformed payload: expected 4 colon-separated segments, got ${parts.length}`,
    );
  }
  const [versionTag, ivB64, tagB64, ctB64] = parts;

  if (!/^v\d+$/.test(versionTag)) {
    throw new DecryptionError(`Malformed version tag: ${versionTag}`);
  }
  const version = Number.parseInt(versionTag.slice(1), 10);
  if (version !== ENCRYPTION_VERSION) {
    throw new DecryptionError(`Unsupported encryption version: v${version}`);
  }

  let iv: Buffer;
  let tag: Buffer;
  let ct: Buffer;
  try {
    iv = Buffer.from(ivB64, "base64url");
    tag = Buffer.from(tagB64, "base64url");
    ct = Buffer.from(ctB64, "base64url");
  } catch {
    throw new DecryptionError("Malformed payload: invalid base64url");
  }

  if (iv.length !== IV_BYTES) {
    throw new DecryptionError(`Bad IV length: ${iv.length}`);
  }
  if (tag.length !== 16) {
    throw new DecryptionError(`Bad auth tag length: ${tag.length}`);
  }

  const key = resolveKey(opts, DecryptionError);
  const decipher = createDecipheriv(ALGORITHM, key, iv) as DecipherGCM;
  decipher.setAuthTag(tag);
  try {
    const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
    return pt.toString("utf8");
  } catch {
    // Node throws a generic "Unsupported state or unable to authenticate data"
    // when the auth tag check fails. We do not leak the underlying message.
    throw new DecryptionError(
      "Decryption failed: payload was tampered with or wrong key",
    );
  }
}
