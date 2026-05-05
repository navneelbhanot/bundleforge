import { describe, it, expect, vi } from "vitest";

import { BundleItemService, type BundleItemRepo } from "./itemService";
import { NotFoundError, ValidationError, ConflictError } from "../../middleware/errors";

function fakeRepo(
  overrides: Partial<{
    parentExists: boolean;
    itemBundleId: string | null;
  }> = {},
): BundleItemRepo {
  const parentExists = overrides.parentExists ?? true;
  const itemBundleId = overrides.itemBundleId ?? "b-1";
  return {
    bundle: {
      findFirst: vi.fn().mockResolvedValue(parentExists ? { id: "b-1" } : null),
    },
    bundleItem: {
      create: vi.fn().mockResolvedValue({ id: "i-new" }),
      findUnique: vi
        .fn()
        .mockResolvedValue(itemBundleId ? { id: "i-1", bundleId: itemBundleId } : null),
      update: vi.fn().mockResolvedValue({ id: "i-1" }),
      delete: vi.fn().mockResolvedValue({ id: "i-1" }),
    },
    $transaction: async (fn) => {
      const tx = {
        bundleItem: { update: vi.fn().mockResolvedValue({ id: "x" }) },
      } as unknown as Parameters<typeof fn>[0];
      return fn(tx);
    },
  } as BundleItemRepo;
}

describe("BundleItemService.add", () => {
  it("requires shopifyProductGid", async () => {
    const svc = new BundleItemService(fakeRepo());
    await expect(
      svc.add("shop", "b-1", { shopifyProductGid: "", title: "x" }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("404 when bundle is not in this shop", async () => {
    const svc = new BundleItemService(fakeRepo({ parentExists: false }));
    await expect(
      svc.add("shop", "b-1", {
        shopifyProductGid: "gid://Product/1",
        title: "p",
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("creates with defaults", async () => {
    const repo = fakeRepo();
    const svc = new BundleItemService(repo);
    const r = await svc.add("shop", "b-1", {
      shopifyProductGid: "gid://Product/1",
      title: "p",
    });
    expect(r.id).toBe("i-new");
  });
});

describe("BundleItemService.update / remove", () => {
  it("update verifies tenant", async () => {
    const repo = fakeRepo({ parentExists: false });
    const svc = new BundleItemService(repo);
    await expect(svc.update("shop", "i-1", { quantity: 2 })).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("remove deletes when authorized", async () => {
    const repo = fakeRepo();
    const svc = new BundleItemService(repo);
    await svc.remove("shop", "i-1");
    expect(repo.bundleItem.delete).toHaveBeenCalledWith({ where: { id: "i-1" } });
  });
});

describe("BundleItemService.reorder", () => {
  it("rejects empty list", async () => {
    const svc = new BundleItemService(fakeRepo());
    await expect(svc.reorder("shop", "b-1", [])).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it("rejects duplicate ids", async () => {
    const svc = new BundleItemService(fakeRepo());
    await expect(
      svc.reorder("shop", "b-1", ["i-1", "i-1"]),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("issues a transactional position update", async () => {
    const repo = fakeRepo();
    const svc = new BundleItemService(repo);
    await svc.reorder("shop", "b-1", ["i-1", "i-2", "i-3"]);
    expect(repo.bundle.findFirst).toHaveBeenCalled();
  });
});
