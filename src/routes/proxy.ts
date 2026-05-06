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
        // Optional shop join — proxy /bundle/:slug pulls
        // settings to merge displaySettings (M-171b).
        // validate-cart and storefront read paths skip it.
        shop?: { select: { settings: true } };
        // Optional eligibility + inventoryRules fields —
        // proxy /bundle/:slug requests them so the
        // storefront web component can decide visibility
        // (M-172c, M-173c). validate-cart skips.
        eligibility?: true;
        inventoryRules?: true;
      };
    }): Promise<unknown | null>;
  };
}

const DISPLAY_KEYS = [
  "layout",
  "colorPreset",
  "imagePreference",
  "addToCartCopy",
  "soldOutBehavior",
  "cssOverride",
] as const;

/**
 * Merge shop-level display defaults with per-bundle
 * overrides. Bundle wins per key; only the M-171 keys are
 * exposed (so future shop-level keys don't accidentally
 * leak to the storefront).
 */
export function resolveDisplaySettings(
  shopSettings: unknown,
  bundleSettings: unknown,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const shop =
    shopSettings && typeof shopSettings === "object" && !Array.isArray(shopSettings)
      ? (shopSettings as Record<string, unknown>)
      : {};
  const shopDisplay =
    shop.display && typeof shop.display === "object" && !Array.isArray(shop.display)
      ? (shop.display as Record<string, unknown>)
      : {};
  const bundle =
    bundleSettings &&
    typeof bundleSettings === "object" &&
    !Array.isArray(bundleSettings)
      ? (bundleSettings as Record<string, unknown>)
      : {};
  for (const k of DISPLAY_KEYS) {
    if (bundle[k] !== undefined && bundle[k] !== null) {
      out[k] = bundle[k];
    } else if (shopDisplay[k] !== undefined && shopDisplay[k] !== null) {
      out[k] = shopDisplay[k];
    }
  }
  return out;
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
        const bundle = (await source.bundle.findFirst({
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
            eligibility: true,
            inventoryRules: true,
            shop: { select: { settings: true } },
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
        })) as
          | (Record<string, unknown> & {
              displaySettings?: unknown;
              eligibility?: unknown;
              inventoryRules?: unknown;
              shop?: { settings?: unknown };
            })
          | null;
        if (!bundle) throw new NotFoundError("Bundle");
        // Resolve display overrides over shop defaults (M-171b).
        // Drop the `shop` join from the response — only used to
        // pull settings.
        const resolved = resolveDisplaySettings(
          bundle.shop?.settings,
          bundle.displaySettings,
        );
        const { shop: _shop, ...payload } = bundle;
        void _shop;
        res.set("Cache-Control", "public, max-age=60");
        // eligibility + inventoryRules already on `payload`
        // (passed through from the select). The web component
        // reads them for storefront-side enforcement
        // (M-172c, M-173c).
        res.json({ ...payload, displaySettings: resolved });
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
