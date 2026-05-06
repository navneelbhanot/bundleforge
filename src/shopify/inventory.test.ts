import { describe, it, expect, vi } from "vitest";
import type { Session } from "@shopify/shopify-api";

import {
  computePaused,
  getVariantInventory,
  type GetVariantInventoryDeps,
} from "./inventory";

const SESSION = { shop: "test.myshopify.com" } as unknown as Session;

describe("computePaused (M-173d)", () => {
  const inv = (rows: Array<[string, number]>): Map<string, number> =>
    new Map(rows);

  it("returns false when threshold is 0 or absent", () => {
    expect(
      computePaused(
        null,
        [{ shopifyVariantGid: "v1" }],
        inv([["v1", 0]]),
      ),
    ).toBe(false);
    expect(
      computePaused(
        { pauseWhenComponentBelow: 0 },
        [{ shopifyVariantGid: "v1" }],
        inv([["v1", 0]]),
      ),
    ).toBe(false);
  });

  it("returns false when all components are at or above threshold", () => {
    expect(
      computePaused(
        { pauseWhenComponentBelow: 3 },
        [
          { shopifyVariantGid: "v1" },
          { shopifyVariantGid: "v2" },
        ],
        inv([
          ["v1", 5],
          ["v2", 3],
        ]),
      ),
    ).toBe(false);
  });

  it("returns true when one component is below the threshold", () => {
    expect(
      computePaused(
        { pauseWhenComponentBelow: 3 },
        [
          { shopifyVariantGid: "v1" },
          { shopifyVariantGid: "v2" },
        ],
        inv([
          ["v1", 100],
          ["v2", 2],
        ]),
      ),
    ).toBe(true);
  });

  it("treats missing variants as Infinity (fail-open)", () => {
    expect(
      computePaused(
        { pauseWhenComponentBelow: 3 },
        [{ shopifyVariantGid: "v-missing" }],
        new Map(),
      ),
    ).toBe(false);
  });

  it("skips components without a shopifyVariantGid", () => {
    expect(
      computePaused(
        { pauseWhenComponentBelow: 3 },
        [
          { shopifyVariantGid: null },
          { shopifyVariantGid: "v1" },
        ],
        inv([["v1", 100]]),
      ),
    ).toBe(false);
  });
});

describe("getVariantInventory (M-173d)", () => {
  it("returns a Map keyed by GID with inventoryQuantity values", async () => {
    const shopifyGraphqlImpl: GetVariantInventoryDeps["shopifyGraphqlImpl"] =
      vi.fn().mockResolvedValue({
        nodes: [
          { id: "gid://shopify/ProductVariant/A", inventoryQuantity: 10 },
          { id: "gid://shopify/ProductVariant/B", inventoryQuantity: 0 },
        ],
      }) as unknown as GetVariantInventoryDeps["shopifyGraphqlImpl"];
    const out = await getVariantInventory(
      SESSION,
      [
        "gid://shopify/ProductVariant/A",
        "gid://shopify/ProductVariant/B",
      ],
      { shopifyGraphqlImpl },
    );
    expect(out.size).toBe(2);
    expect(out.get("gid://shopify/ProductVariant/A")).toBe(10);
    expect(out.get("gid://shopify/ProductVariant/B")).toBe(0);
  });

  it("treats null inventoryQuantity (untracked) as Infinity", async () => {
    const shopifyGraphqlImpl: GetVariantInventoryDeps["shopifyGraphqlImpl"] =
      vi.fn().mockResolvedValue({
        nodes: [
          { id: "gid://shopify/ProductVariant/A", inventoryQuantity: null },
        ],
      }) as unknown as GetVariantInventoryDeps["shopifyGraphqlImpl"];
    const out = await getVariantInventory(
      SESSION,
      ["gid://shopify/ProductVariant/A"],
      { shopifyGraphqlImpl },
    );
    expect(out.get("gid://shopify/ProductVariant/A")).toBe(
      Number.POSITIVE_INFINITY,
    );
  });

  it("returns empty map for empty input without hitting GraphQL", async () => {
    const shopifyGraphqlImpl = vi.fn();
    const out = await getVariantInventory(SESSION, [], {
      shopifyGraphqlImpl: shopifyGraphqlImpl as unknown as GetVariantInventoryDeps["shopifyGraphqlImpl"],
    });
    expect(out.size).toBe(0);
    expect(shopifyGraphqlImpl).not.toHaveBeenCalled();
  });

  it("ignores non-variant nodes in the response", async () => {
    const shopifyGraphqlImpl: GetVariantInventoryDeps["shopifyGraphqlImpl"] =
      vi.fn().mockResolvedValue({
        nodes: [
          null,
          { id: "gid://shopify/ProductVariant/A", inventoryQuantity: 5 },
          { foo: "bar" }, // missing id — skipped
        ],
      }) as unknown as GetVariantInventoryDeps["shopifyGraphqlImpl"];
    const out = await getVariantInventory(
      SESSION,
      ["gid://shopify/ProductVariant/A"],
      { shopifyGraphqlImpl },
    );
    expect(out.size).toBe(1);
  });
});
