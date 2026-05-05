/**
 * Tiny money helpers for the pricing engine. Values are decimal strings
 * on the wire; internally we work in integer cents to avoid float drift.
 *
 * Rounding: half to even (banker's). Currency-agnostic two-decimal
 * representation; callers ensure currencies match.
 */
import type { MoneyAmount, PricingLineItem } from "./contract";

/** "12.5" -> 1250. Rounds half-to-even at the cent. */
export function toCents(amount: string): number {
  if (typeof amount !== "string" || !/^-?\d+(\.\d+)?$/.test(amount)) {
    throw new Error(`Invalid money amount: ${amount}`);
  }
  const negative = amount.startsWith("-");
  const abs = negative ? amount.slice(1) : amount;
  const [whole, fracRaw = ""] = abs.split(".");
  const frac2 = (fracRaw + "00").slice(0, 2);
  const frac3 = (fracRaw + "000").slice(0, 3);
  let cents = Number.parseInt(whole, 10) * 100 + Number.parseInt(frac2, 10);
  // Banker's rounding for the third digit.
  const tail = Number.parseInt(frac3.slice(2, 3) || "0", 10);
  const restNonZero = fracRaw.length > 3 && /[1-9]/.test(fracRaw.slice(3));
  if (tail > 5 || (tail === 5 && (restNonZero || cents % 2 === 1))) {
    cents += 1;
  }
  return negative ? -cents : cents;
}

export function fromCents(cents: number, currencyCode: string): MoneyAmount {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100);
  const frac = (abs % 100).toString().padStart(2, "0");
  return { amount: `${sign}${whole}.${frac}`, currencyCode };
}

export function sumLineItemsCents(items: PricingLineItem[]): {
  cents: number;
  currencyCode: string;
  totalQuantity: number;
} {
  if (items.length === 0) {
    return { cents: 0, currencyCode: "USD", totalQuantity: 0 };
  }
  const ccy = items[0].unitPrice.currencyCode;
  let cents = 0;
  let qty = 0;
  for (const item of items) {
    if (item.unitPrice.currencyCode !== ccy) {
      throw new Error(
        `Mixed currencies: ${ccy} vs ${item.unitPrice.currencyCode}`,
      );
    }
    cents += toCents(item.unitPrice.amount) * item.quantity;
    qty += item.quantity;
  }
  return { cents, currencyCode: ccy, totalQuantity: qty };
}

export const ZERO_USD: MoneyAmount = { amount: "0.00", currencyCode: "USD" };
