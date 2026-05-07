/**
 * Bundler.app → MintBundle importer (M-129).
 *
 * Bundler exports CSV with one row per bundle. Items are pipe-separated
 * within a single column (Bundler's convention).
 *
 * Columns: title, type, items_pipe (e.g. "gid1|gid2|gid3"),
 * discount_type, discount_value.
 */
import type { CreateBundleInput } from "../../../types";
import { parseCsvWithHeaders } from "../csv";
import type { MigrationResult } from "./types";

const TYPE_MAP: Record<string, CreateBundleInput["type"]> = {
  classic: "fixed",
  mix_and_match: "mix_match",
  bxgy: "bxgy",
  volume: "volume",
};

const DISCOUNT_MAP: Record<string, CreateBundleInput["pricingRules"][number]["type"]> =
  {
    percent: "percentage",
    percentage: "percentage",
    flat: "flat_discount",
    fixed: "fixed",
  };

export function convertBundlerCsv(csv: string): MigrationResult {
  const rows = parseCsvWithHeaders(csv);
  const bundles: CreateBundleInput[] = [];
  const errors: MigrationResult["errors"] = [];
  rows.forEach((row, idx) => {
    try {
      const title = row.title?.trim() ?? "";
      if (!title) throw new Error("missing title");
      const type = TYPE_MAP[(row.type ?? "").toLowerCase()] ?? "fixed";
      const itemGids = (row.items_pipe ?? "")
        .split("|")
        .map((s) => s.trim())
        .filter(Boolean);
      const items = itemGids.map((gid) => ({
        shopifyProductGid: gid,
        title: gid,
        quantity: 1,
      }));
      const pricingRules: CreateBundleInput["pricingRules"] = [];
      const dt = (row.discount_type ?? "").toLowerCase();
      const dv = Number(row.discount_value);
      if (dt && Number.isFinite(dv) && dv > 0) {
        pricingRules.push({
          type: DISCOUNT_MAP[dt] ?? "fixed",
          value: dv,
        });
      }
      bundles.push({ title, type, items, pricingRules });
    } catch (e) {
      errors.push({
        index: idx,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  });
  return { bundles, errors };
}
