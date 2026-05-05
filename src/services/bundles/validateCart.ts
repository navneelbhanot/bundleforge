/**
 * Pure cart validator (M-086 / Checkout Guardian).
 *
 * Given a bundle's type/config and the customer's selected items + qty,
 * assert structural validity. Returns `{valid, errors[]}` so the route
 * can pass it through to the storefront block.
 */
import type { BundleType } from "./validators";

export interface CartLine {
  shopifyProductGid: string;
  quantity: number;
  groupName?: string | null;
}

export interface BundleSnapshot {
  type: BundleType | string;
  config: Record<string, unknown>;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

interface MixMatchConfig {
  minItems?: number;
  maxItems?: number;
  allowDuplicates?: boolean;
}

interface BuildBoxStep {
  name: string;
  pickCount: number;
}

interface BuildBoxConfig extends MixMatchConfig {
  steps?: BuildBoxStep[];
}

interface MultipackConfig {
  packQuantity?: number;
}

function totalQuantity(lines: CartLine[]): number {
  return lines.reduce((s, l) => s + Math.max(0, l.quantity), 0);
}

function hasDuplicates(lines: CartLine[]): boolean {
  const seen = new Set<string>();
  for (const l of lines) {
    if (seen.has(l.shopifyProductGid)) return true;
    seen.add(l.shopifyProductGid);
  }
  return false;
}

export function validateCart(
  bundle: BundleSnapshot,
  lines: CartLine[],
): ValidationResult {
  const errors: string[] = [];

  if (lines.length === 0) {
    return { valid: false, errors: ["cart has no items"] };
  }

  switch (bundle.type) {
    case "mix_match": {
      const cfg = bundle.config as MixMatchConfig;
      const qty = totalQuantity(lines);
      if (cfg.minItems !== undefined && qty < cfg.minItems) {
        errors.push(`select at least ${cfg.minItems} items (have ${qty})`);
      }
      if (cfg.maxItems !== undefined && qty > cfg.maxItems) {
        errors.push(`select at most ${cfg.maxItems} items (have ${qty})`);
      }
      if (cfg.allowDuplicates === false && hasDuplicates(lines)) {
        errors.push("duplicates not allowed");
      }
      break;
    }
    case "build_box": {
      const cfg = bundle.config as BuildBoxConfig;
      const qty = totalQuantity(lines);
      if (cfg.minItems !== undefined && qty < cfg.minItems) {
        errors.push(`select at least ${cfg.minItems} items (have ${qty})`);
      }
      if (cfg.maxItems !== undefined && qty > cfg.maxItems) {
        errors.push(`select at most ${cfg.maxItems} items (have ${qty})`);
      }
      if (cfg.allowDuplicates === false && hasDuplicates(lines)) {
        errors.push("duplicates not allowed");
      }
      const steps = cfg.steps ?? [];
      for (const step of steps) {
        const inStep = lines.filter((l) => l.groupName === step.name);
        const pickQty = totalQuantity(inStep);
        if (pickQty !== step.pickCount) {
          errors.push(
            `step "${step.name}" requires ${step.pickCount} picks (have ${pickQty})`,
          );
        }
      }
      break;
    }
    case "multipack": {
      const cfg = bundle.config as MultipackConfig;
      const qty = totalQuantity(lines);
      if (cfg.packQuantity !== undefined && qty !== cfg.packQuantity) {
        errors.push(
          `multipack requires exactly ${cfg.packQuantity} units (have ${qty})`,
        );
      }
      break;
    }
    default:
      // fixed, bogo, bxgy, volume, gift, mystery, sample, subscription,
      // wholesale, custom — at-least-one-item check already passed above.
      break;
  }

  return { valid: errors.length === 0, errors };
}
