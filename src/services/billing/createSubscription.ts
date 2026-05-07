/**
 * Issue Shopify appSubscriptionCreate, persist the charge to
 * BillingSubscription, return the confirmation URL the merchant must visit.
 *
 * See docs/specs/M-032-app-subscription-create.md.
 */
import type { Session } from "@shopify/shopify-api";

import { env } from "../../config/env";
import { logger } from "../../config/logger";
import { prisma } from "../../config/database";
import {
  shopifyGraphql as defaultShopifyGraphql,
} from "../../shopify/graphql";

import {
  PLAN_CAPS,
  type PlanName,
  annualUsd,
} from "./plans";

const billingLogger = logger.child({ module: "billing" });

const APP_SUBSCRIPTION_CREATE = /* GraphQL */ `
  mutation AppSubscriptionCreate(
    $name: String!
    $returnUrl: URL!
    $trialDays: Int
    $test: Boolean
    $lineItems: [AppSubscriptionLineItemInput!]!
  ) {
    appSubscriptionCreate(
      name: $name
      returnUrl: $returnUrl
      trialDays: $trialDays
      test: $test
      lineItems: $lineItems
    ) {
      appSubscription { id status }
      confirmationUrl
      userErrors { field message }
    }
  }
`;

interface SubscriptionCreateResponse {
  appSubscriptionCreate: {
    appSubscription: { id: string; status: string } | null;
    confirmationUrl: string | null;
    userErrors: Array<{ field: string[]; message: string }>;
  };
}

export interface PrismaSubscriptionClient {
  upsert(args: {
    where: { shopId: string };
    update: Record<string, unknown>;
    create: Record<string, unknown>;
  }): Promise<unknown>;
}

export interface CreateSubscriptionArgs {
  session: Session;
  shopId: string;
  plan: PlanName;
  interval: "monthly" | "annual";
  returnUrl: string;
  test?: boolean;
  graphql?: typeof defaultShopifyGraphql;
  client?: PrismaSubscriptionClient;
}

export async function createSubscription(
  args: CreateSubscriptionArgs,
): Promise<{ confirmationUrl: string; chargeId: string }> {
  const graphql = args.graphql ?? defaultShopifyGraphql;
  const client =
    args.client ??
    (prisma.billingSubscription as unknown as PrismaSubscriptionClient);

  const caps = PLAN_CAPS[args.plan];
  if (args.plan === "starter") {
    throw new Error("createSubscription: starter is free; do not call billing");
  }

  // Test-mode resolution (M-206):
  //   1. Explicit `args.test` always wins (test override).
  //   2. Else `BILLING_TEST_MODE` env flag wins (ops override —
  //      lets us flip without a code change).
  //   3. Else default to TRUE on dev stores (shop domains
  //      detected via Shopify's session.shop pattern; for now
  //      we just check the env, since we can't query shop.plan
  //      from inside this hot path without another round-trip).
  //   4. Else fall back to `NODE_ENV !== production` like before.
  //
  // Why: appSubscriptionCreate against a dev store with
  // `test: false` triggers HTTP 400 + empty body at Shopify's
  // gateway, regardless of online/offline session or Decimal
  // formatting. Dev stores must always run as test charges.
  const envTestFlag = process.env.BILLING_TEST_MODE;
  const isTest =
    args.test ??
    (envTestFlag === "true"
      ? true
      : envTestFlag === "false"
        ? false
        : env.NODE_ENV !== "production");
  const amountNumber =
    args.interval === "annual" ? annualUsd(args.plan) : caps.monthlyPriceUsd;
  // Shopify's MoneyInput.amount is a Decimal scalar — it must be
  // serialized as a STRING (e.g. "12.00"), not a JSON number.
  // Sending a number triggers a 400 Bad Request with an empty body
  // at the GraphQL layer (no userErrors, just a wire-level reject).
  const amount = amountNumber.toFixed(2);

  const variables = {
    name: `BundleForge ${args.plan} (${args.interval})`,
    returnUrl: args.returnUrl,
    trialDays: caps.trialDays,
    test: isTest,
    lineItems: [
      {
        plan: {
          appRecurringPricingDetails: {
            price: { amount, currencyCode: "USD" },
            interval: args.interval === "annual" ? "ANNUAL" : "EVERY_30_DAYS",
          },
        },
      },
    ],
  };

  // M-206: log the variables we're about to send so the next 400
  // failure surfaces the exact payload in Railway logs (mask the
  // session shop, never log access tokens).
  billingLogger.info(
    {
      shop: args.session.shop,
      plan: args.plan,
      interval: args.interval,
      isTest,
      amount,
      trialDays: caps.trialDays,
    },
    "Calling appSubscriptionCreate",
  );

  const result = await graphql<SubscriptionCreateResponse>(
    args.session,
    APP_SUBSCRIPTION_CREATE,
    variables,
  );

  const ret = result.appSubscriptionCreate;
  if (ret.userErrors && ret.userErrors.length > 0) {
    const message = ret.userErrors.map((e) => e.message).join("; ");
    throw new Error(`appSubscriptionCreate failed: ${message}`);
  }
  if (!ret.appSubscription || !ret.confirmationUrl) {
    throw new Error("appSubscriptionCreate returned no subscription");
  }

  const chargeId = ret.appSubscription.id;
  const trialEndsAt =
    caps.trialDays > 0
      ? new Date(Date.now() + caps.trialDays * 24 * 60 * 60 * 1000)
      : null;

  await client.upsert({
    where: { shopId: args.shopId },
    create: {
      shopId: args.shopId,
      shopifyChargeId: chargeId,
      planName: args.plan,
      price: amountNumber,
      billingInterval: args.interval,
      status: "pending",
      trialDays: caps.trialDays,
      trialEndsAt,
    },
    update: {
      shopifyChargeId: chargeId,
      planName: args.plan,
      price: amountNumber,
      billingInterval: args.interval,
      status: "pending",
      trialDays: caps.trialDays,
      trialEndsAt,
      cancelledAt: null,
    },
  });

  billingLogger.info(
    { shopId: args.shopId, plan: args.plan, interval: args.interval, chargeId },
    "Subscription pending merchant approval",
  );

  return { confirmationUrl: ret.confirmationUrl, chargeId };
}
