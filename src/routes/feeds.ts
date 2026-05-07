/**
 * Public product-feed routes (M-122).
 *
 * Mounted under `/api/feeds` outside the App Bridge auth chain because
 * Google Shopping ingests these unauthenticated. Each shop's feed is
 * scoped by `?shop=<domain>` query.
 */
import {
  Router,
  type Request,
  type Response,
  type NextFunction,
} from "express";

import { prisma } from "../config/database";
import { ValidationError } from "../middleware/errorHandler";
import {
  buildGoogleMerchantFeed,
  type FeedBundle,
} from "../services/integrations/googleMerchant";

export interface FeedSource {
  shop: {
    findUnique(args: {
      where: { shopifyDomain: string };
      select: { id: true; name: true };
    }): Promise<{ id: string; name: string } | null>;
  };
  bundle: {
    findMany(args: {
      where: { shopId: string; status: "active"; deletedAt: null };
      select: {
        slug: true;
        title: true;
        description: true;
        imageUrl: true;
        pricingRules: { select: { type: true; value: true } };
      };
    }): Promise<
      Array<{
        slug: string;
        title: string;
        description: string | null;
        imageUrl: string | null;
        pricingRules: Array<{ type: string; value: { toString(): string } }>;
      }>
    >;
  };
}

export interface FeedDeps {
  source?: FeedSource;
}

export function installFeedRoutes(deps: FeedDeps = {}): Router {
  const router = Router();
  const source = deps.source ?? (prisma as unknown as FeedSource);

  router.get(
    "/google-merchant.xml",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const shopDomain = typeof req.query.shop === "string" ? req.query.shop : "";
        if (!shopDomain) throw new ValidationError("shop param required");
        const shop = await source.shop.findUnique({
          where: { shopifyDomain: shopDomain },
          select: { id: true, name: true },
        });
        if (!shop) {
          res.status(404).type("text/plain").send("Shop not found");
          return;
        }
        const rows = await source.bundle.findMany({
          where: { shopId: shop.id, status: "active", deletedAt: null },
          select: {
            slug: true,
            title: true,
            description: true,
            imageUrl: true,
            pricingRules: { select: { type: true, value: true } },
          },
        });
        const bundles: FeedBundle[] = rows.map((r) => ({
          slug: r.slug,
          title: r.title,
          description: r.description,
          imageUrl: r.imageUrl,
          // Without a "list price" on bundles yet, surface a stub price = 0.
          // The feed still validates; merchants can override via metafields
          // before Google ingests.
          priceUsd: 0,
          url: `https://${shopDomain}/apps/mintbundle/bundle/${r.slug}`,
        }));
        const xml = buildGoogleMerchantFeed(shop.name, bundles);
        res.set("Content-Type", "application/xml; charset=utf-8");
        res.set("Cache-Control", "public, max-age=300");
        res.send(xml);
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}

export const feedRoutes = installFeedRoutes();
