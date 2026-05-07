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
import { logger } from "../config/logger";
import { NotFoundError, UnauthorizedError } from "../middleware/errorHandler";
import {
  isOverOrderCap,
  type OrderCapStatus,
} from "../services/billing/orderCap";
import {
  validateCart,
  type BundleSnapshot,
  type CartLine,
} from "../services/bundles/validateCart";
import {
  computePaused,
  getVariantInventory,
} from "../shopify/inventory";
import { loadOfflineSessionFromShop } from "../shopify/sessionFromShop";

const proxyLog = logger.child({ module: "proxy" });

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
  /**
   * Storefront pause check (M-173d). Producer accepts the
   * shop domain + the bundle's inventoryRules + items and
   * returns `paused: boolean`. DI seam so tests can stub
   * without hitting Shopify; production wires the default
   * implementation that loads an offline session and
   * fetches per-variant inventory.
   */
  computePaused?: (input: {
    shopDomain: string;
    inventoryRules: unknown;
    items: Array<{ shopifyVariantGid: string | null }>;
  }) => Promise<boolean>;
  /**
   * Plan order-cap check (M-200). Used by `/validate-cart` to
   * gate Starter shops that have hit `maxOrdersPerMonth`. The
   * default wiring resolves the shop by `shopifyDomain`, then
   * delegates to `services/billing/orderCap.isOverOrderCap`.
   * Tests stub this to avoid touching Prisma.
   */
  orderCap?: (shopDomain: string, now: Date) => Promise<OrderCapStatus | null>;
}

async function defaultComputePaused(input: {
  shopDomain: string;
  inventoryRules: unknown;
  items: Array<{ shopifyVariantGid: string | null }>;
}): Promise<boolean> {
  const rules =
    input.inventoryRules &&
    typeof input.inventoryRules === "object" &&
    !Array.isArray(input.inventoryRules)
      ? (input.inventoryRules as { pauseWhenComponentBelow?: number | null })
      : null;
  const threshold =
    rules && typeof rules.pauseWhenComponentBelow === "number"
      ? rules.pauseWhenComponentBelow
      : 0;
  if (threshold <= 0) return false;

  const variantGids = input.items
    .map((it) => it.shopifyVariantGid)
    .filter((g): g is string => typeof g === "string" && g.length > 0);
  if (variantGids.length === 0) return false;

  try {
    const session = await loadOfflineSessionFromShop(input.shopDomain);
    if (!session) {
      proxyLog.warn(
        { shopDomain: input.shopDomain },
        "no offline session for shop; pause check fails-open",
      );
      return false;
    }
    const inventory = await getVariantInventory(session, variantGids);
    return computePaused(rules, input.items, inventory);
  } catch (err) {
    proxyLog.warn(
      { err, shopDomain: input.shopDomain },
      "pause check failed; falling back to paused=false",
    );
    return false;
  }
}

async function defaultOrderCap(
  shopDomain: string,
  now: Date,
): Promise<OrderCapStatus | null> {
  const shop = await prisma.shop.findUnique({
    where: { shopifyDomain: shopDomain },
    select: { id: true, planName: true },
  });
  if (!shop) return null;
  return isOverOrderCap(prisma, shop, now);
}

export function installProxyRoutes(deps: ProxyDeps = {}): Router {
  const router = Router();
  const source = deps.source ?? (prisma as unknown as BundleLookup);
  const computePausedImpl = deps.computePaused ?? defaultComputePaused;
  const orderCapImpl = deps.orderCap ?? defaultOrderCap;

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
        // M-173d: compute paused if pauseWhenComponentBelow > 0.
        // Defaults to false on any error (fail-open).
        const items = Array.isArray(
          (payload as { items?: unknown }).items,
        )
          ? ((payload as { items: Array<{ shopifyVariantGid: string | null }> }).items)
          : [];
        const paused = await computePausedImpl({
          shopDomain: req.shopifyShopDomain,
          inventoryRules: payload.inventoryRules,
          items,
        });
        res.set("Cache-Control", "public, max-age=60");
        // eligibility + inventoryRules already on `payload`
        // (passed through from the select). The web component
        // reads them for storefront-side enforcement
        // (M-172c, M-173c). `paused` is M-173d.
        res.json({ ...payload, displaySettings: resolved, paused });
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
        // Plan order-cap gate (M-200). Rejects Starter shops that
        // hit maxOrdersPerMonth before we even look up the bundle —
        // saves a DB hit on the hot path and lets the storefront
        // block render a clear "limit reached" message.
        const cap = await orderCapImpl(req.shopifyShopDomain, new Date());
        if (cap?.over) {
          proxyLog.info(
            {
              shopDomain: req.shopifyShopDomain,
              plan: cap.plan,
              count: cap.count,
              cap: cap.cap,
            },
            "validate-cart rejected: monthly bundle order cap reached",
          );
          res.json({
            valid: false,
            errors: [
              "This shop has reached its monthly bundle order limit. Upgrade to Growth for unlimited orders.",
            ],
            code: "order_cap_reached",
          });
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
