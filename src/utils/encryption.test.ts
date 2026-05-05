import { randomBytes } from "node:crypto";

import { describe, it, expect, beforeAll } from "vitest";

import { DecryptionError, EncryptionError, decrypt, encrypt } from "./encryption";

const KEY_A = "a".repeat(64);
const KEY_B = "b".repeat(64);

beforeAll(() => {
  // Provide a valid env so decrypt's default key path can resolve.
  process.env.SHOPIFY_API_KEY = "k";
  process.env.SHOPIFY_API_SECRET = "s";
  process.env.SHOPIFY_SCOPES = "read_products";
  process.env.SHOPIFY_APP_URL = "https://example.com";
  process.env.DATABASE_URL = "postgres://u:p@h:5432/db";
  process.env.REDIS_URL = "redis://h:6379";
  process.env.ENCRYPTION_KEY = KEY_A;
});

describe("encrypt/decrypt round-trip", () => {
  it("round-trips with default (env) key", () => {
    const ct = encrypt("hello world");
    expect(decrypt(ct)).toBe("hello world");
  });

  it("round-trips with explicit key", () => {
    const ct = encrypt("hello world", { key: KEY_B });
    expect(decrypt(ct, { key: KEY_B })).toBe("hello world");
  });

  it("round-trips empty string", () => {
    const ct = encrypt("", { key: KEY_A });
    expect(decrypt(ct, { key: KEY_A })).toBe("");
  });

  it("round-trips multibyte UTF-8", () => {
    const msg = "héllo 世界 🚀 — мир";
    const ct = encrypt(msg, { key: KEY_A });
    expect(decrypt(ct, { key: KEY_A })).toBe(msg);
  });

  it("produces different ciphertexts for the same plaintext (random IV)", () => {
    const a = encrypt("same", { key: KEY_A });
    const b = encrypt("same", { key: KEY_A });
    expect(a).not.toBe(b);
  });
});

describe("wire format", () => {
  it("matches the v1 regex", () => {
    const ct = encrypt("payload", { key: KEY_A });
    expect(ct).toMatch(/^v1:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+:[A-Za-z0-9_-]*$/);
  });
});

describe("tamper detection", () => {
  it("rejects mutated ciphertext", () => {
    const ct = encrypt("secret", { key: KEY_A });
    const parts = ct.split(":");
    const ctBytes = Buffer.from(parts[3], "base64url");
    ctBytes[0] = ctBytes[0] ^ 0xff;
    const tampered = `${parts[0]}:${parts[1]}:${parts[2]}:${ctBytes.toString("base64url")}`;
    expect(() => decrypt(tampered, { key: KEY_A })).toThrowError(DecryptionError);
  });

  it("rejects mutated IV", () => {
    const ct = encrypt("secret", { key: KEY_A });
    const parts = ct.split(":");
    const iv = Buffer.from(parts[1], "base64url");
    iv[0] = iv[0] ^ 0xff;
    const tampered = `${parts[0]}:${iv.toString("base64url")}:${parts[2]}:${parts[3]}`;
    expect(() => decrypt(tampered, { key: KEY_A })).toThrowError(DecryptionError);
  });

  it("rejects mutated auth tag", () => {
    const ct = encrypt("secret", { key: KEY_A });
    const parts = ct.split(":");
    const tag = Buffer.from(parts[2], "base64url");
    tag[0] = tag[0] ^ 0xff;
    const tampered = `${parts[0]}:${parts[1]}:${tag.toString("base64url")}:${parts[3]}`;
    expect(() => decrypt(tampered, { key: KEY_A })).toThrowError(DecryptionError);
  });

  it("rejects decryption with the wrong key", () => {
    const ct = encrypt("secret", { key: KEY_A });
    expect(() => decrypt(ct, { key: KEY_B })).toThrowError(DecryptionError);
  });
});

describe("payload format errors", () => {
  it("rejects payload with the wrong number of segments", () => {
    expect(() => decrypt("v1:only:two", { key: KEY_A })).toThrowError(DecryptionError);
    expect(() => decrypt("v1:a:b:c:d", { key: KEY_A })).toThrowError(DecryptionError);
  });

  it("rejects unsupported version", () => {
    const ct = encrypt("x", { key: KEY_A });
    const parts = ct.split(":");
    const v2 = `v2:${parts[1]}:${parts[2]}:${parts[3]}`;
    expect(() => decrypt(v2, { key: KEY_A })).toThrowError(/Unsupported encryption version/);
  });

  it("rejects malformed version tag", () => {
    const ct = encrypt("x", { key: KEY_A });
    const parts = ct.split(":");
    const bad = `vX:${parts[1]}:${parts[2]}:${parts[3]}`;
    expect(() => decrypt(bad, { key: KEY_A })).toThrowError(/Malformed version tag/);
  });

  it("rejects bad IV length", () => {
    const shortIv = randomBytes(8).toString("base64url");
    const tag = randomBytes(16).toString("base64url");
    const ct = randomBytes(16).toString("base64url");
    expect(() => decrypt(`v1:${shortIv}:${tag}:${ct}`, { key: KEY_A })).toThrowError(
      /Bad IV length/,
    );
  });

  it("rejects bad auth tag length", () => {
    const iv = randomBytes(12).toString("base64url");
    const shortTag = randomBytes(8).toString("base64url");
    const ct = randomBytes(16).toString("base64url");
    expect(() => decrypt(`v1:${iv}:${shortTag}:${ct}`, { key: KEY_A })).toThrowError(
      /Bad auth tag length/,
    );
  });
});

describe("key validation", () => {
  it("rejects encrypt with an invalid key (length)", () => {
    expect(() => encrypt("x", { key: "abc" })).toThrowError(EncryptionError);
  });

  it("rejects encrypt with an invalid key (non-hex)", () => {
    expect(() => encrypt("x", { key: "z".repeat(64) })).toThrowError(EncryptionError);
  });

  it("rejects decrypt with an invalid key", () => {
    const ct = encrypt("x", { key: KEY_A });
    expect(() => decrypt(ct, { key: "abc" })).toThrowError(DecryptionError);
  });
});

describe("non-string input", () => {
  it("rejects non-string plaintext", () => {
    // @ts-expect-error testing runtime guard
    expect(() => encrypt(123, { key: KEY_A })).toThrowError(EncryptionError);
  });

  it("rejects non-string payload", () => {
    // @ts-expect-error testing runtime guard
    expect(() => decrypt({ payload: "x" }, { key: KEY_A })).toThrowError(DecryptionError);
  });
});
