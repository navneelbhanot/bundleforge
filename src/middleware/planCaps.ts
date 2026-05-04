/**
 * Plan-aware middleware:
 *   requirePlanFeature(name) — 403 if shop's plan doesn't include feature.
 *   enforceCap("maxBundles") — 403 when shop is at the cap.
 *
 * See docs/specs/M-036-plan-caps.md.
 */
import type { Request, Response, NextFunction, RequestHandler } from "express";

import { prisma } from "../config/database";
import {
  PLAN_CAPS,
  PlanName,
  planFeatures,
  planFor,
  PlanFeatures,
} from "../services/billing/plans";

import { ForbiddenError } from "./errors";

export interface SubscriptionLookup {
  findUnique(args: {
    where: { shopId: string };
    select: { planName: true; status: true };
  }): Promise<{ planName: string; status: string } | null>;
}

export type PlanResolver = (shopId: string) => Promise<PlanName>;

const defaultResolver: PlanResolver = async (shopId) => {
  const sub = await (
    prisma.billingSubscription as unknown as SubscriptionLookup
  ).findUnique({
    where: { shopId },
    select: { planName: true, status: true },
  });
  if (!sub) return "starter";
  if (sub.status !== "active") return "starter";
  return planFor(sub.planName);
};

export interface RequireFeatureOptions {
  resolver?: PlanResolver;
}

export function requirePlanFeature(
  feature: keyof PlanFeatures,
  opts: RequireFeatureOptions = {},
): RequestHandler {
  const resolver = opts.resolver ?? defaultResolver;
  return async function requirePlanFeatureMiddleware(
    req: Request,
    _res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.shopId) {
        throw new ForbiddenError("No shop context");
      }
      const plan = await resolver(req.shopId);
      const features = planFeatures(plan);
      if (!features[feature]) {
        throw new ForbiddenError(
          `Feature '${feature}' is not included in the '${plan}' plan`,
          { feature, plan, code: "feature_not_in_plan" },
        );
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

export interface BundleCounter {
  count(args: { where: { shopId: string; deletedAt: null } }): Promise<number>;
}

export interface EnforceCapOptions {
  resolver?: PlanResolver;
  counter?: BundleCounter;
}

export function enforceCap(
  cap: "maxBundles",
  opts: EnforceCapOptions = {},
): RequestHandler {
  const resolver = opts.resolver ?? defaultResolver;
  const counter =
    opts.counter ?? (prisma.bundle as unknown as BundleCounter);
  return async function enforceCapMiddleware(
    req: Request,
    _res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!req.shopId) {
        throw new ForbiddenError("No shop context");
      }
      const plan = await resolver(req.shopId);
      const limit = PLAN_CAPS[plan][cap];
      if (limit === null) {
        next();
        return;
      }
      const count = await counter.count({
        where: { shopId: req.shopId, deletedAt: null },
      });
      if (count >= limit) {
        throw new ForbiddenError(
          `Plan '${plan}' allows up to ${limit} bundles; you have ${count}`,
          { plan, cap, limit, current: count, code: "plan_cap_reached" },
        );
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
