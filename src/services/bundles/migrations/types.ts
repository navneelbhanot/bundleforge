/**
 * Shared types for competitor migrations (M-127..M-130).
 *
 * Each converter returns `CreateBundleInput[]` so the bundle service
 * can persist them with a normal create() call.
 */
import type { CreateBundleInput } from "../../../types";

export interface MigrationResult {
  bundles: CreateBundleInput[];
  errors: Array<{ index: number; message: string }>;
}
