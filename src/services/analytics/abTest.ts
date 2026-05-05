/**
 * A/B test service (M-113) + two-proportion z-test (M-115).
 *
 * `assign(sessionId, trafficSplit)` returns "A" or "B" deterministically:
 * a stable hash of sessionId modulo 1 is compared to trafficSplit.
 * A session always sees the same variant.
 */
import { createHash } from "node:crypto";

export type AbVariant = "A" | "B";

export interface AssignmentInput {
  sessionId: string;
  /** Probability of variant B (0..1). Default 0.5. */
  trafficSplit?: number;
}

/** Returns a stable [0, 1) value for the given session id. */
export function hashFraction(sessionId: string): number {
  if (!sessionId) return 0;
  const h = createHash("sha256").update(sessionId).digest();
  // Use first 6 bytes to stay below Number.MAX_SAFE_INTEGER.
  let n = 0;
  for (let i = 0; i < 6; i++) n = n * 256 + h[i];
  return n / 0x1_00_00_00_00_00_00; // 2^48
}

export function assign(input: AssignmentInput): AbVariant {
  const split = input.trafficSplit ?? 0.5;
  const f = hashFraction(input.sessionId);
  return f < split ? "B" : "A";
}

/**
 * Two-proportion z-test (M-115).
 *
 * @param a {conversions, exposures} for variant A.
 * @param b {conversions, exposures} for variant B.
 * @returns {p, z, significant, winner|null}
 *   p — two-sided p-value (approximate normal-distribution).
 *   significant — p < 0.05.
 *   winner — "A", "B", or null when not significant.
 */
export interface VariantStats {
  conversions: number;
  exposures: number;
}

export interface SignificanceResult {
  p: number;
  z: number;
  significant: boolean;
  winner: AbVariant | null;
  rateA: number;
  rateB: number;
}

function normalCdf(z: number): number {
  // Abramowitz & Stegun 26.2.17. Accurate to ~7e-8.
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d =
    0.3989422804014327 * Math.exp((-z * z) / 2);
  const prob =
    d *
    t *
    (0.31938153 +
      t *
        (-0.356563782 +
          t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return z > 0 ? 1 - prob : prob;
}

export function significance(
  a: VariantStats,
  b: VariantStats,
): SignificanceResult {
  const rateA = a.exposures > 0 ? a.conversions / a.exposures : 0;
  const rateB = b.exposures > 0 ? b.conversions / b.exposures : 0;
  if (a.exposures === 0 || b.exposures === 0) {
    return { p: 1, z: 0, significant: false, winner: null, rateA, rateB };
  }
  const pPool =
    (a.conversions + b.conversions) / (a.exposures + b.exposures);
  const denom = Math.sqrt(
    pPool * (1 - pPool) * (1 / a.exposures + 1 / b.exposures),
  );
  if (denom === 0) {
    return {
      p: 1,
      z: 0,
      significant: false,
      winner: null,
      rateA,
      rateB,
    };
  }
  const z = (rateB - rateA) / denom;
  const p = 2 * (1 - normalCdf(Math.abs(z)));
  const significant = p < 0.05;
  const winner = significant ? (rateB > rateA ? "B" : "A") : null;
  return { p, z, significant, winner, rateA, rateB };
}
