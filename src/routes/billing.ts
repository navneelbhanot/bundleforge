/**
 * /api/v1/billing routes.
 *
 * GET    /                Current subscription + plan caps + features
 * GET    /plans           All plans
 * POST   /subscribe       Body: {plan, interval} -> {confirmationUrl}
 * POST   /cancel          -> {status}
 *
 * Mounted by src/server/index.ts under /api/v1/billing. Authenticated
 * via the upstream session/shop middleware (M-021/M-019).
 *
 * createSubscription/cancelSubscription are injected via
 * `installBillingRoutes(opts?)` so tests don't hit Shopify or Prisma.
 *
 * See docs/specs/M-037-billing-routes.md.
 */
import { Router, type Request, type Response, type NextFunction } from "express";
import type { Session } from "@shopify/shopify-api";
import { z } from "zod";

import { prisma } from "../config/database";
import {
  PLAN_CAPS,
  PLAN_FEATURES,
  PLAN_RATE_LIMITS,
  PLANS,
  type PlanName,
  planFor,
} from "../services/billing/plans";
import {
  createSubscription as defaultCreate,
  type CreateSubscriptionArgs,
} from "../services/billing/createSubscription";
import {
  cancelSubscription as defaultCancel,
  type CancelSubscriptionArgs,
} from "../services/billing/cancelSubscription";
import {
  isOverOrderCap,
  type OrderCapStatus,
} from "../services/billing/orderCap";
import { shopify } from "../shopify";
import { loadOfflineSessionFromShop } from "../shopify/sessionFromShop";

/**
 * 80% threshold for the "approaching cap" admin banner (M-201).
 * Lives at the API boundary so the M-200 storefront-side gate
 * stays a clean binary.
 */
const APPROACHING_CAP_THRESHOLD = 0.8;

const subscribeSchema = z.object({
  plan: z.enum(["growth", "pro", "enterprise"]),
  interval: z.enum(["monthly", "annual"]),
  returnUrl: z.string().url().optional(),
});

export interface BillingDeps {
  create?: (args: CreateSubscriptionArgs) => Promise<{
    confirmationUrl: string;
    chargeId: string;
  }>;
  cancel?: (args: CancelSubscriptionArgs) => Promise<{ status: string }>;
  loadSubscription?: (
    shopId: string,
  ) => Promise<{
    planName: string;
    status: string;
    shopifyChargeId: string;
    billingInterval: string;
    trialEndsAt: Date | null;
    activatedAt: Date | null;
    cancelledAt: Date | null;
  } | null>;
  /**
   * M-201: order-cap status injected so the GET / response can
   * carry an `orderCap` field for the dashboard banner without
   * tests needing to satisfy Prisma.
   */
  loadOrderCap?: (
    shop: { id: string; planName: string },
    now: Date,
  ) => Promise<OrderCapStatus>;
  /**
   * M-205: offline-session loader injected so /subscribe and
   * /cancel can swap the user-scoped online token for the shop-
   * wide offline token before calling Shopify Admin. Tests stub
   * to avoid touching Prisma.
   */
  loadOfflineSession?: (shopDomain: string) => Promise<Session | null>;
}

function getSession(res: Response): Session | undefined {
  return (res.locals as { shopify?: { session?: Session } }).shopify?.session;
}

export function installBillingRoutes(deps: BillingDeps = {}): Router {
  const router = Router();
  const create = deps.create ?? defaultCreate;
  const cancel = deps.cancel ?? defaultCancel;
  const loadSubscription =
    deps.loadSubscription ??
    (async (shopId) =>
      prisma.billingSubscription.findUnique({
        where: { shopId },
        select: {
          planName: true,
          status: true,
          shopifyChargeId: true,
          billingInterval: true,
          trialEndsAt: true,
          activatedAt: true,
          cancelledAt: true,
        },
      }));
  const loadOrderCap =
    deps.loadOrderCap ??
    ((shop, now) => isOverOrderCap(prisma, shop, now));
  /**
   * Default offline-session loader — prefers the SDK's canonical
   * `PrismaSessionStorage` (the `Session` table the SDK actively
   * manages on every install/reauth). Falls back to our
   * `Shop.accessToken`-based loader when the storage doesn't have
   * an offline session for this shop yet (e.g. shop installed via
   * an older code path that never wrote to PrismaSessionStorage).
   *
   * Why this order: the SDK rewrites session storage on every
   * OAuth callback, so it's always fresh. `Shop.accessToken` is
   * updated by our `afterAuth` hook — if that hook ever errors
   * silently or the rebrand changes the Partner Dashboard app
   * entry, `Shop.accessToken` can drift to a stale token while
   * the SDK's session storage stays current. The 400-empty-body
   * symptom on `appSubscriptionCreate` after the M-210 rebrand
   * was caused by exactly this drift.
   */
  const loadOffline =
    deps.loadOfflineSession ??
    (async (shopDomain: string) => {
      try {
        const storage = shopify.config.sessionStorage;
        if (storage) {
          const sessions = await storage.findSessionsByShop(shopDomain);
          const offline = sessions.find((s) => s.isOnline === false);
          if (offline && offline.accessToken) return offline;
        }
      } catch {
        // Storage failure — fall through to legacy loader.
      }
      return loadOfflineSessionFromShop(shopDomain);
    });

  router.get("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.shopId) {
        res.status(401).json({ error: { code: "unauthorized", message: "No shop context" } });
        return;
      }
      const sub = await loadSubscription(req.shopId);
      const plan = planFor(sub?.planName);
      // M-201: order-cap status for the dashboard "approaching cap"
      // banner. `approaching` is derived at the API boundary so the
      // M-200 storefront gate (`isOverOrderCap`) stays purely binary.
      const cap = await loadOrderCap(
        { id: req.shopId, planName: plan },
        new Date(),
      );
      const approaching =
        cap.cap !== null &&
        !cap.over &&
        cap.count / cap.cap >= APPROACHING_CAP_THRESHOLD;
      res.json({
        plan,
        caps: PLAN_CAPS[plan],
        features: PLAN_FEATURES[plan],
        rateLimit: PLAN_RATE_LIMITS[plan],
        subscription: sub,
        orderCap: {
          plan: cap.plan,
          cap: cap.cap,
          count: cap.count,
          over: cap.over,
          approaching,
        },
      });
    } catch (err) {
      next(err);
    }
  });

  router.get("/plans", (_req: Request, res: Response): void => {
    res.json(
      PLANS.map((name) => ({
        name,
        caps: PLAN_CAPS[name],
        features: PLAN_FEATURES[name],
        rateLimit: PLAN_RATE_LIMITS[name],
      })),
    );
  });

  router.post(
    "/subscribe",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.shopId) {
          res
            .status(401)
            .json({ error: { code: "unauthorized", message: "No shop context" } });
          return;
        }
        const onlineSession = getSession(res);
        if (!onlineSession) {
          res.status(401).json({
            error: { code: "unauthorized", message: "No Shopify session" },
          });
          return;
        }
        // appSubscriptionCreate is a shop-level mutation — Shopify
        // expects an OFFLINE access token (the long-lived shop-wide
        // one persisted at OAuth install). Embedded apps' online
        // session token is user-scoped and Shopify can reject the
        // mutation at the gateway with a 400 + empty body. Load the
        // offline session from the shop record before issuing the
        // mutation.
        const offlineSession = await loadOffline(onlineSession.shop);
        if (!offlineSession) {
          res.status(401).json({
            error: {
              code: "no_offline_session",
              message:
                "No offline session for this shop. Reinstall the app to refresh credentials.",
            },
          });
          return;
        }
        const parsed = subscribeSchema.parse(req.body);
        try {
          const result = await create({
            session: offlineSession,
            shopId: req.shopId,
            plan: parsed.plan as PlanName,
            interval: parsed.interval,
            returnUrl:
              parsed.returnUrl ?? `${req.protocol}://${req.get("host")}/`,
          });
          res.json(result);
        } catch (createErr) {
          // Surface Shopify-side reasons to the merchant instead of
          // letting them swallow into the generic 500. Anything we
          // recognise as a billing-config / wire-format problem maps
          // to 422 with a useful message; everything else still
          // bubbles to the unhandled-error path.
          const message =
            createErr instanceof Error ? createErr.message : String(createErr);
          if (
            message.includes("appSubscriptionCreate") ||
            message.includes("Shopify GraphQL") ||
            message.includes("Bad Request")
          ) {
            res.status(422).json({
              error: {
                code: "billing_create_failed",
                message,
              },
            });
            return;
          }
          throw createErr;
        }
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    "/cancel",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.shopId) {
          res
            .status(401)
            .json({ error: { code: "unauthorized", message: "No shop context" } });
          return;
        }
        const onlineSession = getSession(res);
        if (!onlineSession) {
          res.status(401).json({
            error: { code: "unauthorized", message: "No Shopify session" },
          });
          return;
        }
        // Same as /subscribe: cancel is a shop-level mutation and
        // wants the offline access token, not the user-scoped
        // online one (M-205).
        const offlineSession = await loadOffline(onlineSession.shop);
        if (!offlineSession) {
          res.status(401).json({
            error: {
              code: "no_offline_session",
              message:
                "No offline session for this shop. Reinstall the app to refresh credentials.",
            },
          });
          return;
        }
        const sub = await loadSubscription(req.shopId);
        if (!sub) {
          res.status(404).json({
            error: { code: "not_found", message: "No active subscription" },
          });
          return;
        }
        const result = await cancel({
          session: offlineSession,
          chargeId: sub.shopifyChargeId,
        });
        res.json(result);
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}

/** Default singleton router used by the server. */
export const billingRoutes = installBillingRoutes();
