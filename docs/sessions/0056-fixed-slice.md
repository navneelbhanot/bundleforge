# Session 0056 — fixed bundle vertical slice

`tests/slices/fixed.test.ts` exercises BundleService.create →
computeBundlePrice → BundleService.publish → softDelete with vi.mocked
repo. Pure pricing slice for the `fixed` rule. Real cart/checkout
layers wire later (M-082+).
