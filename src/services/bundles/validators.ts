/**
 * Per-type bundle config validators.
 *
 * Each bundle type has its own config Zod schema; `bundleConfigSchema`
 * is a discriminated union keyed on `type`. Used by the bundle service
 * (M-049) at create/update time and by routes (M-053) to validate
 * incoming JSON.
 *
 * See docs/specs/M-048-bundle-validators.md.
 */
import { z } from "zod";

export const BUNDLE_TYPES = [
  "fixed",
  "mix_match",
  "bogo",
  "bxgy",
  "volume",
  "build_box",
  "multipack",
  "gift",
  "mystery",
  "sample",
  "subscription",
  "wholesale",
  "custom",
] as const;

export type BundleType = (typeof BUNDLE_TYPES)[number];

const positiveInt = z.coerce.number().int().positive();
const nonNegInt = z.coerce.number().int().nonnegative();

// --- Per-type config schemas ---

const fixedConfig = z.object({}).passthrough();

const mixMatchConfig = z
  .object({
    minItems: nonNegInt,
    maxItems: positiveInt,
    allowDuplicates: z.boolean().default(false),
  })
  .refine((v) => v.maxItems >= v.minItems, {
    message: "maxItems must be >= minItems",
    path: ["maxItems"],
  });

const bogoConfig = z.object({}).passthrough();
const bxgyConfig = z.object({}).passthrough();
const volumeConfig = z.object({}).passthrough();

const buildBoxStep = z.object({
  name: z.string().min(1),
  pickCount: positiveInt,
});

const buildBoxConfig = z
  .object({
    minItems: nonNegInt,
    maxItems: positiveInt,
    allowDuplicates: z.boolean().default(false),
    steps: z.array(buildBoxStep).default([]),
  })
  .refine((v) => v.maxItems >= v.minItems, {
    message: "maxItems must be >= minItems",
    path: ["maxItems"],
  });

const multipackConfig = z.object({ packQuantity: positiveInt });

const giftConfig = z.object({}).passthrough();
const mysteryConfig = z.object({}).passthrough();
const sampleConfig = z.object({}).passthrough();
const subscriptionConfig = z.object({}).passthrough();
const wholesaleConfig = z
  .object({ minWholesaleQuantity: positiveInt.optional() })
  .passthrough();
const customConfig = z.object({}).passthrough();

// --- Per-type "envelope" with type tag ---

const bundleEnvelopes = {
  fixed: z.object({ type: z.literal("fixed"), config: fixedConfig }),
  mix_match: z.object({ type: z.literal("mix_match"), config: mixMatchConfig }),
  bogo: z.object({ type: z.literal("bogo"), config: bogoConfig }),
  bxgy: z.object({ type: z.literal("bxgy"), config: bxgyConfig }),
  volume: z.object({ type: z.literal("volume"), config: volumeConfig }),
  build_box: z.object({ type: z.literal("build_box"), config: buildBoxConfig }),
  multipack: z.object({ type: z.literal("multipack"), config: multipackConfig }),
  gift: z.object({ type: z.literal("gift"), config: giftConfig }),
  mystery: z.object({ type: z.literal("mystery"), config: mysteryConfig }),
  sample: z.object({ type: z.literal("sample"), config: sampleConfig }),
  subscription: z.object({
    type: z.literal("subscription"),
    config: subscriptionConfig,
  }),
  wholesale: z.object({ type: z.literal("wholesale"), config: wholesaleConfig }),
  custom: z.object({ type: z.literal("custom"), config: customConfig }),
} as const;

/** Discriminated union: validates `{type, config}` together. */
export const bundleConfigSchema = z.discriminatedUnion("type", [
  bundleEnvelopes.fixed,
  bundleEnvelopes.mix_match,
  bundleEnvelopes.bogo,
  bundleEnvelopes.bxgy,
  bundleEnvelopes.volume,
  bundleEnvelopes.build_box,
  bundleEnvelopes.multipack,
  bundleEnvelopes.gift,
  bundleEnvelopes.mystery,
  bundleEnvelopes.sample,
  bundleEnvelopes.subscription,
  bundleEnvelopes.wholesale,
  bundleEnvelopes.custom,
]);

/** Returns the validated config for a given type, or throws ZodError. */
export function validateBundleConfig(
  type: BundleType,
  config: unknown,
): unknown {
  return bundleConfigSchema.parse({ type, config }).config;
}
