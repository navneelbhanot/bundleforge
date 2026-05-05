import { describe, it, expect, vi } from "vitest";

import { persistShop, type SessionLike } from "./install";

const KEY = "a".repeat(64);

describe("persistShop", () => {
  it("encrypts the access token before write", async () => {
    const upsert = vi.fn().mockResolvedValue({ id: "shop-id" });
    const client = { upsert };
    const session: SessionLike = {
      shop: "demo.myshopify.com",
      accessToken: "raw-token",
    };
    const fakeEncrypt = (s: string): string => `v1:fake:${s}`;
    await persistShop(session, client, fakeEncrypt);
    expect(upsert).toHaveBeenCalledTimes(1);
    const call = upsert.mock.calls[0][0];
    expect(call.create.accessToken).toBe("v1:fake:raw-token");
    expect(call.update.accessToken).toBe("v1:fake:raw-token");
    expect(call.where.shopifyDomain).toBe("demo.myshopify.com");
  });

  it("clears uninstalledAt on update path", async () => {
    const upsert = vi.fn().mockResolvedValue({ id: "id" });
    await persistShop(
      { shop: "demo.myshopify.com", accessToken: "t" },
      { upsert },
      () => "ct",
    );
    expect(upsert.mock.calls[0][0].update.uninstalledAt).toBe(null);
  });

  it("populates required Shop fields with placeholders for M-027 reconciliation", async () => {
    const upsert = vi.fn().mockResolvedValue({ id: "id" });
    await persistShop(
      { shop: "demo.myshopify.com", accessToken: "t" },
      { upsert },
      () => "ct",
    );
    const create = upsert.mock.calls[0][0].create;
    expect(create.shopifyDomain).toBe("demo.myshopify.com");
    expect(create.shopifyGid).toContain("demo.myshopify.com");
    expect(create.name).toBe("demo.myshopify.com");
    expect(create.email).toBe("");
  });

  it("throws when session.shop is missing", async () => {
    await expect(
      persistShop(
        { shop: "", accessToken: "t" },
        { upsert: vi.fn() },
        () => "ct",
      ),
    ).rejects.toThrow(/session\.shop/);
  });

  it("throws when session.accessToken is missing", async () => {
    await expect(
      persistShop(
        { shop: "demo.myshopify.com" },
        { upsert: vi.fn() },
        () => "ct",
      ),
    ).rejects.toThrow(/accessToken/);
  });

  it("uses real encrypt when no encryptFn provided", async () => {
    process.env.ENCRYPTION_KEY = KEY;
    const upsert = vi.fn().mockResolvedValue({ id: "id" });
    await persistShop(
      { shop: "demo.myshopify.com", accessToken: "raw" },
      { upsert },
    );
    const ct = upsert.mock.calls[0][0].create.accessToken;
    expect(ct).toMatch(/^v1:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+:[A-Za-z0-9_-]*$/);
  });
});
