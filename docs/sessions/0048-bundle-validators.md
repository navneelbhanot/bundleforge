# Session 0048 — per-type bundle config validators

`src/services/bundles/validators.ts`: discriminated union over all 13
bundle types, each with its own Zod config schema (multipack requires
packQuantity, build_box has steps, mix_match enforces max≥min, etc.).
`validateBundleConfig(type, config)` is the public helper used by the
bundle service. 9 unit tests. 220 tests pass.
