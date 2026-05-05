/**
 * Bundle CSV import (M-069).
 *
 * Format: one row per bundle. `items` and `rules` are JSON-encoded
 * arrays inside their CSV cells. Errors are captured per-row; the
 * batch never aborts on a single failure.
 *
 * See docs/specs/M-069-bundle-import.md.
 */
import { CreateBundleInput } from "../../types";
import { parseCsvWithHeaders, type CsvRecord } from "./csv";
import { BundleService } from "./index";

export interface ImportRowError {
  row: number; // 1-indexed (header is row 0)
  message: string;
}

export interface ImportResult {
  imported: number;
  errors: ImportRowError[];
}

export interface ImportOptions {
  dryRun?: boolean;
  service?: BundleService;
}

const REQUIRED_COLUMNS = ["title", "type"];

function parseJsonField<T>(label: string, raw: string, fallback: T): T {
  if (!raw || !raw.trim()) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch (e) {
    throw new Error(
      `${label} is not valid JSON: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
}

function recordToInput(rec: CsvRecord): CreateBundleInput {
  for (const col of REQUIRED_COLUMNS) {
    if (!rec[col]) throw new Error(`missing required column: ${col}`);
  }
  return {
    title: rec.title,
    type: rec.type as CreateBundleInput["type"],
    description: rec.description || undefined,
    items: parseJsonField("items", rec.items ?? "", []),
    pricingRules: parseJsonField("rules", rec.rules ?? "", []),
    config: parseJsonField("config", rec.config ?? "", {}),
  };
}

export async function importBundlesFromCsv(
  shopId: string,
  csv: string,
  opts: ImportOptions = {},
): Promise<ImportResult> {
  const records = parseCsvWithHeaders(csv);
  const service = opts.service ?? new BundleService();
  const errors: ImportRowError[] = [];
  let imported = 0;

  for (let i = 0; i < records.length; i++) {
    const rowNumber = i + 1; // header is 0
    try {
      const input = recordToInput(records[i]);
      if (opts.dryRun) {
        // Dry-run: validate via service.create's own checks, but never persist.
        // We don't have a separate validate method, so we re-implement the
        // type/title checks here.
        if (!input.title) throw new Error("title required");
        if (!input.type) throw new Error("type required");
        // Type check is exercised by service.create when not dry-run.
      } else {
        await service.create(shopId, input);
      }
      imported += 1;
    } catch (err) {
      errors.push({
        row: rowNumber,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { imported, errors };
}
