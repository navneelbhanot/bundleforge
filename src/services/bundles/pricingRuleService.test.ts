import { describe, it, expect, vi } from "vitest";

import {
  PricingRuleService,
  type PricingRuleRepo,
} from "./pricingRuleService";
import { NotFoundError, ValidationError } from "../../middleware/errors";

function fakeRepo(parentExists = true): PricingRuleRepo {
  return {
    bundle: {
      findFirst: vi.fn().mockResolvedValue(parentExists ? { id: "b-1" } : null),
    },
    pricingRule: {
      create: vi.fn().mockResolvedValue({ id: "r-new" }),
      findUnique: vi.fn().mockResolvedValue({ id: "r-1", bundleId: "b-1" }),
      update: vi.fn().mockResolvedValue({ id: "r-1" }),
      delete: vi.fn().mockResolvedValue({ id: "r-1" }),
    },
  };
}

describe("PricingRuleService.add", () => {
  it("rejects unknown type", async () => {
    const svc = new PricingRuleService(fakeRepo());
    await expect(
      svc.add("shop", "b-1", {
        type: "invalid" as unknown as "fixed",
        value: 1,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("404 when bundle not in this shop", async () => {
    const svc = new PricingRuleService(fakeRepo(false));
    await expect(
      svc.add("shop", "b-1", { type: "fixed", value: 5 }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("creates with defaults applied", async () => {
    const repo = fakeRepo();
    const svc = new PricingRuleService(repo);
    await svc.add("shop", "b-1", { type: "fixed", value: 5 });
    const args = (repo.pricingRule.create as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(args.data.priority).toBe(0);
    expect(args.data.isStackable).toBe(false);
  });
});

describe("PricingRuleService.update / remove", () => {
  it("update verifies tenant", async () => {
    const repo = fakeRepo(false);
    const svc = new PricingRuleService(repo);
    await expect(
      svc.update("shop", "r-1", { value: 10 }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("remove deletes when authorized", async () => {
    const repo = fakeRepo();
    const svc = new PricingRuleService(repo);
    await svc.remove("shop", "r-1");
    expect(repo.pricingRule.delete).toHaveBeenCalledWith({
      where: { id: "r-1" },
    });
  });
});
