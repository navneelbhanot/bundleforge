/**
 * Pricing fixture loader. Each fixture is a JSON file:
 *   { name, input, expected }
 * Both the Node engine and the Cart Transform Function consume the
 * same set; that's the central guarantee of ADR-0002.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { PricingInput, PricingResult } from "../../src/services/pricing/contract";

export interface PricingFixture {
  name: string;
  input: PricingInput;
  expected: PricingResult;
}

export function loadFixtures(dir: string): PricingFixture[] {
  const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
  return files.map((file) => {
    const text = readFileSync(join(dir, file), "utf8");
    const parsed = JSON.parse(text) as PricingFixture;
    if (!parsed.name || !parsed.input || !parsed.expected) {
      throw new Error(`Fixture ${file} is missing name/input/expected`);
    }
    return parsed;
  });
}

export const FIXTURES_DIR = join(__dirname, "fixtures");
