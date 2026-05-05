/**
 * Post-OAuth persistence: turns a Shopify session into a Shop row.
 *
 * persistShop is a pure function — it accepts a session-like object and a
 * Prisma-like client so tests can inject fakes. The wired-up middleware
 * lives at the bottom of this file.
 *
 * See docs/specs/M-018-oauth-callback.md.
 */
import type { Request, Response, NextFunction } from "express";

import { prisma } from "../config/database";
import { logger } from "../config/logger";
import { encrypt } from "../utils/encryption";

const installLogger = logger.child({ module: "install" });

export interface SessionLike {
  shop: string;
  accessToken?: string | null;
  scope?: string;
}

export interface ShopUpsertInput {
  shopifyDomain: string;
  shopifyGid: string;
  accessToken: string; // encrypted
  name: string;
  email: string;
}

export interface PrismaShopClient {
  upsert(args: {
    where: { shopifyDomain: string };
    update: Partial<ShopUpsertInput> & { uninstalledAt: null };
    create: ShopUpsertInput;
  }): Promise<{ id: string }>;
}

export async function persistShop(
  session: SessionLike,
  client: PrismaShopClient = prisma.shop as unknown as PrismaShopClient,
  encryptFn: (s: string) => string = encrypt,
): Promise<{ id: string }> {
  if (!session.shop) {
    throw new Error("persistShop: session.shop is required");
  }
  if (!session.accessToken) {
    throw new Error("persistShop: session.accessToken is required");
  }
  const cipher = encryptFn(session.accessToken);
  const create: ShopUpsertInput = {
    shopifyDomain: session.shop,
    shopifyGid: `gid://shopify/Shop/${session.shop}`, // placeholder; M-027 reconciles
    accessToken: cipher,
    name: session.shop,
    email: "",
  };
  return client.upsert({
    where: { shopifyDomain: session.shop },
    create,
    update: {
      accessToken: cipher,
      uninstalledAt: null,
    },
  });
}

/** Express middleware to plug into the OAuth callback chain. */
export function afterAuth() {
  return async function afterAuthMiddleware(
    _req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const session = (res.locals as { shopify?: { session?: SessionLike } })
        .shopify?.session;
      if (!session) {
        installLogger.warn("afterAuth: no session in res.locals");
        next();
        return;
      }
      const row = await persistShop(session);
      installLogger.info({ shopifyDomain: session.shop, id: row.id }, "Shop persisted");
      next();
    } catch (err) {
      next(err);
    }
  };
}
