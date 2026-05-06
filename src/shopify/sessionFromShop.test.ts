import { describe, it, expect, vi } from "vitest";

import {
  loadOfflineSessionFromShop,
  type SessionFromShopDeps,
} from "./sessionFromShop";

function makeDeps(
  row: { id: string; shopifyDomain: string; accessToken: string } | null,
  decryptFn: (s: string) => string = (s) => `decrypted:${s}`,
): SessionFromShopDeps {
  const findUnique = vi.fn().mockResolvedValue(row);
  return {
    client: {
      shop: { findUnique },
    } as unknown as SessionFromShopDeps["client"],
    decryptFn,
  };
}

describe("loadOfflineSessionFromShop (M-173d)", () => {
  it("returns null for unknown shop", async () => {
    const out = await loadOfflineSessionFromShop(
      "unknown.myshopify.com",
      makeDeps(null),
    );
    expect(out).toBeNull();
  });

  it("returns a Session with the decrypted accessToken", async () => {
    const out = await loadOfflineSessionFromShop(
      "test.myshopify.com",
      makeDeps({
        id: "shop-1",
        shopifyDomain: "test.myshopify.com",
        accessToken: "encrypted-token",
      }),
    );
    expect(out).not.toBeNull();
    expect(out!.shop).toBe("test.myshopify.com");
    expect(out!.accessToken).toBe("decrypted:encrypted-token");
    expect(out!.isOnline).toBe(false);
  });

  it("returns null when decryption produces an empty string", async () => {
    const out = await loadOfflineSessionFromShop(
      "test.myshopify.com",
      makeDeps(
        {
          id: "shop-1",
          shopifyDomain: "test.myshopify.com",
          accessToken: "encrypted-token",
        },
        () => "",
      ),
    );
    expect(out).toBeNull();
  });
});
