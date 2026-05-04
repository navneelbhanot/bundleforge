/**
 * requireShopSession middleware.
 *
 * Loads the Shop row that owns the current request and attaches
 * req.shopId / req.shopDomain. Throws UnauthorizedError if the shop is
 * unknown or uninstalled.
 *
 * See docs/specs/M-019-session-middleware.md.
 */
import type { Request, Response, NextFunction, RequestHandler } from "express";

import { prisma } from "../config/database";
import { UnauthorizedError } from "./errors";

export interface ShopRow {
  id: string;
  shopifyDomain: string;
  uninstalledAt: Date | null;
}

export type LoadShop = (domain: string) => Promise<ShopRow | null>;

const defaultLoadShop: LoadShop = async (domain) => {
  return prisma.shop.findUnique({
    where: { shopifyDomain: domain },
    select: { id: true, shopifyDomain: true, uninstalledAt: true },
  });
};

interface ResLocalsWithSession {
  shopify?: { session?: { shop?: string } };
}

export function deriveDomain(req: Request, res: Response): string | null {
  const session = (res.locals as ResLocalsWithSession).shopify?.session;
  if (session?.shop) return session.shop;
  const header = req.header("x-shopify-shop-domain");
  if (header) return header;
  const query = (req.query.shop as string | undefined) ?? null;
  return query;
}

export function requireShopSession(opts: { loadShop?: LoadShop } = {}): RequestHandler {
  const loadShop = opts.loadShop ?? defaultLoadShop;
  return async function requireShopSessionMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const domain = deriveDomain(req, res);
      if (!domain) {
        throw new UnauthorizedError("Missing shop session");
      }
      const shop = await loadShop(domain);
      if (!shop) {
        throw new UnauthorizedError("Unknown shop");
      }
      if (shop.uninstalledAt !== null) {
        throw new UnauthorizedError("Shop is uninstalled");
      }
      req.shopId = shop.id;
      req.shopDomain = shop.shopifyDomain;
      next();
    } catch (err) {
      next(err);
    }
  };
}
