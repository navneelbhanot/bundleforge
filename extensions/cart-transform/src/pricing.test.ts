/**
 * Cross-runtime parity test (ADR-0002 / M-084).
 *
 * Loops every fixture in tests/pricing/fixtures/ and asserts that
 * the Function-runtime port (`pricing.js`) and the Node engine
 * (`src/services/pricing/engine.ts`) produce byte-for-byte identical
 * PricingResult.
 */
import { describe, it, expect } from "vitest";

import { computeBundlePrice as fnEngine } from "./pricing.js";
import { computeBundlePrice as nodeEngine } from "../../../src/services/pricing/engine";
import { FIXTURES_DIR, loadFixtures } from "../../../tests/pricing/loadFixtures";

describe("Cart Transform Function — cross-runtime parity", () => {
  const fixtures = loadFixtures(FIXTURES_DIR);
  if (fixtures.length === 0) {
    it.skip("no fixtures present", () => {});
  }
  for (const f of fixtures) {
    it(`parity: ${f.name}`, () => {
      const node = nodeEngine(f.input);
      const fn = fnEngine(f.input);
      expect(fn).toEqual(node);
      expect(fn).toEqual(f.expected);
    });
  }
});
