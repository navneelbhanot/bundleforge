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

const subscribeSchema = z.object({
  plan: z.enum(["growth", "pro", "enterprise"]),
  interval: z.enum(["monthly", "annual"]),
  returnUrl: z.string().url().optional(),
});

interface BillingDeps {
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

  router.get("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.shopId) {
        res.status(401).json({ error: { code: "unauthorized", message: "No shop context" } });
        return;
      }
      const sub = await loadSubscription(req.shopId);
      const plan = planFor(sub?.planName);
      res.json({
        plan,
        caps: PLAN_CAPS[plan],
        features: PLAN_FEATURES[plan],
        rateLimit: PLAN_RATE_LIMITS[plan],
        subscription: sub,
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
        const session = getSession(res);
        if (!session) {
          res.status(401).json({
            error: { code: "unauthorized", message: "No Shopify session" },
          });
          return;
        }
        const parsed = subscribeSchema.parse(req.body);
        const result = await create({
          session,
          shopId: req.shopId,
          plan: parsed.plan as PlanName,
          interval: parsed.interval,
          returnUrl:
            parsed.returnUrl ?? `${req.protocol}://${req.get("host")}/`,
        });
        res.json(result);
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
        const session = getSession(res);
        if (!session) {
          res.status(401).json({
            error: { code: "unauthorized", message: "No Shopify session" },
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
          session,
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
