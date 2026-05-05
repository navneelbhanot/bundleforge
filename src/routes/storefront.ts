/**
 * /api/storefront/v1/* — public read-only API for headless storefronts.
 *
 * Hydrogen / Storefront-API-driven storefronts can't go through
 * Shopify's App Proxy (no Liquid context to sign with), so this route
 * is unauthenticated, CORS-open, and intentionally narrow:
 *
 *   GET /api/storefront/v1/bundles/:shop/:slug
 *     Returns the public bundle composition + display config for a
 *     PUBLISHED bundle on the given myshopify.com shop. 404 for
 *     non-existent / draft / archived bundles.
 *
 *   POST /api/storefront/v1/bundles/:shop/:slug/validate
 *     Validates a proposed cart composition (e.g. "is this 3-out-of-5
 *     mix-and-match selection valid?") without creating any state.
 *
 * Security model:
 *   - Active published bundles already have a Shopify product behind
 *     them on /products/<slug>, so their composition is effectively
 *     public anyway. This endpoint just exposes that composition in
 *     a Hydrogen-friendly JSON shape without forcing the storefront
 *     to walk metafields.
 *   - We never return access tokens, internal IDs, draft bundles, or
 *     archived bundles. The only writeable side effect is a per-shop
 *     IP rate limit (M-148) shared with the rest of /api.
 *   - CORS is open (`Access-Control-Allow-Origin: *`) so Hydrogen
 *     storefronts on any domain can hit this. The data being read is
 *     already public; opening CORS doesn't widen the blast radius.
 */
import {
  Router,
  type Request,
  type Response,
  type NextFunction,
} from "express";

import { prisma } from "../config/database";
import { NotFoundError } from "../middleware/errorHandler";
import {
  validateCart,
  type BundleSnapshot,
  type CartLine,
} from "../services/bundles/validateCart";
import type { BundleLookup } from "./proxy";

export interface StorefrontDeps {
  source?: BundleLookup;
}

function setStorefrontHeaders(res: Response): void {
  // Public-readable, cacheable for 60s. Hydrogen's framework caches on
  // top of this; matches the App Proxy route's TTL.
  res.set("Cache-Control", "public, max-age=60");
  // CORS: same logic as Shopify Storefront API — open to any origin.
  // We're returning published, public information only.
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");
}

const SHOP_DOMAIN_RE = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i;

export function installStorefrontRoutes(deps: StorefrontDeps = {}): Router {
  const router = Router();
  const source = deps.source ?? (prisma as unknown as BundleLookup);

  // Express 5's path-to-regexp dropped raw `*` — match any path under
  // this router via a regex instead.
  router.options(/.*/, (_req, res) => {
    setStorefrontHeaders(res);
    res.status(204).end();
  });

  router.get(
    "/bundles/:shop/:slug",
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const { shop, slug } = req.params;
        if (!SHOP_DOMAIN_RE.test(shop)) {
          res.status(400).json({
            error: { code: "validation_error", message: "shop must be a *.myshopify.com domain" },
          });
          return;
        }
        const bundle = await source.bundle.findFirst({
          where: {
            shop: { shopifyDomain: shop },
            slug,
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
        setStorefrontHeaders(res);
        res.json(bundle);
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    "/bundles/:shop/:slug/validate",
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const { shop, slug } = req.params;
        if (!SHOP_DOMAIN_RE.test(shop)) {
          res.status(400).json({
            error: { code: "validation_error", message: "shop must be a *.myshopify.com domain" },
          });
          return;
        }
        const body = (req.body ?? {}) as { lines?: CartLine[] };
        if (!Array.isArray(body.lines)) {
          res.status(400).json({
            error: { code: "validation_error", message: "lines required" },
          });
          return;
        }
        const bundle = (await source.bundle.findFirst({
          where: {
            shop: { shopifyDomain: shop },
            slug,
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
        setStorefrontHeaders(res);
        res.json(result);
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}

export const storefrontRoutes = installStorefrontRoutes();
