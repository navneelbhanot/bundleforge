import { describe, it, expect } from "vitest";

import { PRICING_CONTRACT_VERSION } from "../../src/services/pricing/contract";
import { loadFixtures, FIXTURES_DIR } from "./loadFixtures";

describe("pricing contract", () => {
  it("locks PRICING_CONTRACT_VERSION at 1", () => {
    expect(PRICING_CONTRACT_VERSION).toBe(1);
  });
});

describe("loadFixtures", () => {
  it("returns an array (possibly empty) for the fixtures dir", () => {
    const fixtures = loadFixtures(FIXTURES_DIR);
    expect(Array.isArray(fixtures)).toBe(true);
    // Each fixture's structure is validated by loadFixtures itself.
    for (const f of fixtures) {
      expect(f.name).toBeTruthy();
      expect(f.input).toBeTruthy();
      expect(f.expected).toBeTruthy();
    }
  });
});
