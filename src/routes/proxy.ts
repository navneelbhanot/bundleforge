/**
 * /api/proxy routes (M-085+).
 *
 * Reached via Shopify's App Proxy. The signature is verified by the
 * upstream `appProxyAuth` middleware. Routes here only need to honor
 * `req.shopifyShopDomain` to scope queries.
 */
import {
  Router,
  type Request,
  type Response,
  type NextFunction,
} from "express";

import { prisma } from "../config/database";
import { NotFoundError, UnauthorizedError } from "../middleware/errorHandler";
import {
  validateCart,
  type BundleSnapshot,
  type CartLine,
} from "../services/bundles/validateCart";

export interface BundleLookup {
  bundle: {
    findFirst(args: {
      where: {
        shop: { shopifyDomain: string };
        slug: string;
        status: "active";
        deletedAt: null;
      };
      select: {
        id: true;
        slug: true;
        title: true;
        type: true;
        description: true;
        config: true;
        displaySettings: true;
        items: { select: { shopifyProductGid: true; shopifyVariantGid: true; title: true; quantity: true; position: true; groupName: true; minQuantity: true; maxQuantity: true } };
      };
    }): Promise<unknown | null>;
  };
}

export interface ProxyDeps {
  source?: BundleLookup;
}

export function installProxyRoutes(deps: ProxyDeps = {}): Router {
  const router = Router();
  const source = deps.source ?? (prisma as unknown as BundleLookup);

  router.get(
    "/bundle/:slug",
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        if (!req.shopifyShopDomain) {
          throw new UnauthorizedError("No shop on request");
        }
        const bundle = await source.bundle.findFirst({
          where: {
            shop: { shopifyDomain: req.shopifyShopDomain },
            slug: req.params.slug,
            status: "active",
            deletedAt: null,
          },
          select: {
            id: true,
            slug: true,
            title: true,
            type: true,
            description: true,
            config: true,
            displaySettings: true,
            items: {
              select: {
                shopifyProductGid: true,
                shopifyVariantGid: true,
                title: true,
                quantity: true,
                position: true,
                groupName: true,
                minQuantity: true,
                maxQuantity: true,
              },
            },
          },
        });
        if (!bundle) throw new NotFoundError("Bundle");
        res.set("Cache-Control", "public, max-age=60");
        res.json(bundle);
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    "/validate-cart",
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        if (!req.shopifyShopDomain) {
          throw new UnauthorizedError("No shop on request");
        }
        const body = (req.body ?? {}) as {
          slug?: string;
          lines?: CartLine[];
        };
        if (!body.slug || !Array.isArray(body.lines)) {
          res.status(400).json({ error: { code: "validation_error", message: "slug and lines required" } });
          return;
        }
        const bundle = (await source.bundle.findFirst({
          where: {
            shop: { shopifyDomain: req.shopifyShopDomain },
            slug: body.slug,
            status: "active",
            deletedAt: null,
          },
          select: {
            id: true,
            slug: true,
            title: true,
            type: true,
            description: true,
            config: true,
            displaySettings: true,
            items: {
              select: {
                shopifyProductGid: true,
                shopifyVariantGid: true,
                title: true,
                quantity: true,
                position: true,
                groupName: true,
                minQuantity: true,
                maxQuantity: true,
              },
            },
          },
        })) as { type: string; config: Record<string, unknown> } | null;
        if (!bundle) throw new NotFoundError("Bundle");
        const snapshot: BundleSnapshot = {
          type: bundle.type,
          config: bundle.config,
        };
        const result = validateCart(snapshot, body.lines);
        res.json(result);
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}

export const proxyRoutes = installProxyRoutes();
