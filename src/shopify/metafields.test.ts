import { describe, it, expect, vi } from "vitest";
import type { Session } from "@shopify/shopify-api";

import {
  writeShopMetafield,
  type WriteShopMetafieldDeps,
} from "./metafields";

const SESSION = { shop: "test.myshopify.com" } as unknown as Session;

function makeGraphql(
  shopId: string | null,
  setResponse: unknown,
): WriteShopMetafieldDeps["shopifyGraphqlImpl"] {
  return vi.fn(async (_session, query) => {
    if (query.includes("BundleforgeShopId")) {
      return shopId ? { shop: { id: shopId } } : { shop: null };
    }
    if (query.includes("metafieldsSet")) {
      return setResponse;
    }
    throw new Error(`unexpected query`);
  }) as unknown as WriteShopMetafieldDeps["shopifyGraphqlImpl"];
}

describe("writeShopMetafield (M-164b)", () => {
  it("happy path: returns the metafield id", async () => {
    const shopifyGraphqlImpl = makeGraphql(
      "gid://shopify/Shop/123",
      {
        metafieldsSet: {
          metafields: [
            {
              id: "gid://shopify/Metafield/999",
              namespace: "bundleforge",
              key: "cart_default_mode",
              value: "components_as_attributes",
              type: "single_line_text_field",
            },
          ],
          userErrors: [],
        },
      },
    );
    const out = await writeShopMetafield(
      SESSION,
      {
        namespace: "bundleforge",
        key: "cart_default_mode",
        value: "components_as_attributes",
        type: "single_line_text_field",
      },
      { shopifyGraphqlImpl },
    );
    expect(out.id).toBe("gid://shopify/Metafield/999");
  });

  it("throws when shop GID query returns null", async () => {
    const shopifyGraphqlImpl = makeGraphql(null, {
      metafieldsSet: { metafields: [], userErrors: [] },
    });
    await expect(
      writeShopMetafield(
        SESSION,
        {
          namespace: "bundleforge",
          key: "cart_default_mode",
          value: "x",
          type: "single_line_text_field",
        },
        { shopifyGraphqlImpl },
      ),
    ).rejects.toThrow(/shop GID/i);
  });

  it("throws on userErrors from metafieldsSet", async () => {
    const shopifyGraphqlImpl = makeGraphql(
      "gid://shopify/Shop/1",
      {
        metafieldsSet: {
          metafields: [],
          userErrors: [{ message: "type mismatch" }],
        },
      },
    );
    await expect(
      writeShopMetafield(
        SESSION,
        {
          namespace: "bundleforge",
          key: "cart_default_mode",
          value: "x",
          type: "single_line_text_field",
        },
        { shopifyGraphqlImpl },
      ),
    ).rejects.toThrow(/type mismatch/);
  });

  it("throws when metafieldsSet returns no metafield row", async () => {
    const shopifyGraphqlImpl = makeGraphql(
      "gid://shopify/Shop/1",
      {
        metafieldsSet: { metafields: [], userErrors: [] },
      },
    );
    await expect(
      writeShopMetafield(
        SESSION,
        {
          namespace: "bundleforge",
          key: "cart_default_mode",
          value: "x",
          type: "single_line_text_field",
        },
        { shopifyGraphqlImpl },
      ),
    ).rejects.toThrow(/returned no metafield/);
  });
});
