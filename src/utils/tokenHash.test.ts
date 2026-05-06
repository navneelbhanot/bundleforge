import { describe, it, expect } from "vitest";

import {
  generateToken,
  hashToken,
  tokenPrefix,
  verifyToken,
} from "./tokenHash";

describe("tokenHash", () => {
  it("generates a versioned hash and verifies the same plaintext", () => {
    const token = "bf_secrettokenforTest";
    const persisted = hashToken(token);
    expect(persisted.startsWith("v1:")).toBe(true);
    expect(verifyToken(token, persisted)).toBe(true);
  });

  it("rejects a wrong plaintext", () => {
    const persisted = hashToken("bf_real");
    expect(verifyToken("bf_wrong", persisted)).toBe(false);
  });

  it("uses a unique salt per call so the same token produces different hashes", () => {
    const a = hashToken("bf_same");
    const b = hashToken("bf_same");
    expect(a).not.toEqual(b);
    expect(verifyToken("bf_same", a)).toBe(true);
    expect(verifyToken("bf_same", b)).toBe(true);
  });

  it("returns false on malformed persisted strings", () => {
    expect(verifyToken("anything", "")).toBe(false);
    expect(verifyToken("anything", "v1:bad")).toBe(false);
    expect(verifyToken("anything", "v2:abc:def")).toBe(false);
  });

  it("generateToken returns a bf_-prefixed 64-hex-char token", () => {
    const t = generateToken();
    expect(t).toMatch(/^bf_[a-f0-9]{64}$/);
  });

  it("tokenPrefix returns first 11 chars", () => {
    expect(tokenPrefix("bf_abcdefgh1234567890")).toBe("bf_abcdefgh");
  });
});
