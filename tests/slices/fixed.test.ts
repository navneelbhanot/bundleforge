/**
 * Vertical slice — fixed bundle (M-056).
 *
 * Tests the layers that exist today:
 *   service.create + service.publish + service.softDelete
 *   computeBundlePrice via buildPricingInput()
 *
 * Real cart/checkout/order layers wire in M-082+.
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("../../src/services/bundles/repository", () => {
  return {
    bundleRepo: {
      list: vi.fn(),
      findById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      softDelete: vi.fn(),
    },
  };
});

import { BundleService } from "../../src/services/bundles";
import { computeBundlePrice } from "../../src/services/pricing/engine";
import { bundleRepo } from "../../src/services/bundles/repository";
import { buildPricingInput } from "./buildPricingInput";

const repo = bundleRepo as unknown as Record<string, ReturnType<typeof vi.fn>>;

describe("vertical slice — fixed bundle", () => {
  it("creates → publishes → prices → soft-deletes", async () => {
    const created = {
      id: "b-fixed-1",
      title: "Summer Starter",
      type: "fixed",
      slug: "summer-starter",
      shopId: "shop",
      status: "draft",
      items: [
        { id: "li-1", shopifyProductGid: "gid://Product/1", quantity: 2 },
      ],
      pricingRules: [{ id: "r-1", type: "fixed" }],
    };
    repo.create.mockResolvedValueOnce(created);
    repo.findById.mockResolvedValue(created);
    repo.update.mockResolvedValueOnce({ ...created, status: "active" });
    repo.softDelete.mockResolvedValueOnce({ ...created, status: "deleted" });

    const svc = new BundleService();
    const c = (await svc.create("shop", {
      title: "Summer Starter",
      type: "fixed",
      items: [
        {
          shopifyProductGid: "gid://Product/1",
          title: "Item",
          quantity: 2,
        },
      ],
      pricingRules: [{ type: "fixed", value: 5 }],
    })) as { id: string; type: string };
    expect(c.type).toBe("fixed");

    // Pricing
    const input = buildPricingInput({
      bundleId: c.id,
      currency: "USD",
      items: [{ id: "li-1", shopifyProductGid: "gid://Product/1", quantity: 2, unitPrice: "10.00" }],
      rules: [{ id: "r-1", type: "fixed", value: "5.00", priority: 0, stackable: false }],
    });
    const result = computeBundlePrice(input);
    expect(result.subtotal.amount).toBe("20.00");
    expect(result.totalDiscount.amount).toBe("5.00");
    expect(result.total.amount).toBe("15.00");

    // Publish
    const p = (await svc.publish("shop", c.id)) as { status: string };
    expect(p.status).toBe("active");

    // Soft delete
    await svc.softDelete("shop", c.id);
    expect(repo.softDelete).toHaveBeenCalledWith("b-fixed-1");
  });
});
