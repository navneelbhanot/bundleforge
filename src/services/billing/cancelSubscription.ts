/**
 * Cancel a Shopify recurring app charge and reflect the cancellation
 * locally.
 *
 * See docs/specs/M-034-cancel-and-change.md.
 */
import type { Session } from "@shopify/shopify-api";

import { logger } from "../../config/logger";
import { prisma } from "../../config/database";
import { shopifyGraphql as defaultShopifyGraphql } from "../../shopify/graphql";

const billingLogger = logger.child({ module: "billing" });

const APP_SUBSCRIPTION_CANCEL = /* GraphQL */ `
  mutation AppSubscriptionCancel($id: ID!) {
    appSubscriptionCancel(id: $id) {
      appSubscription { id status }
      userErrors { field message }
    }
  }
`;

interface CancelResponse {
  appSubscriptionCancel: {
    appSubscription: { id: string; status: string } | null;
    userErrors: Array<{ field: string[]; message: string }>;
  };
}

export interface CancelClient {
  updateMany(args: {
    where: { shopifyChargeId: string };
    data: { status: string; cancelledAt: Date };
  }): Promise<{ count: number }>;
}

export interface CancelSubscriptionArgs {
  session: Session;
  chargeId: string;
  graphql?: typeof defaultShopifyGraphql;
  client?: CancelClient;
}

export async function cancelSubscription(
  args: CancelSubscriptionArgs,
): Promise<{ status: string }> {
  const graphql = args.graphql ?? defaultShopifyGraphql;
  const client =
    args.client ??
    (prisma.billingSubscription as unknown as CancelClient);

  const result = await graphql<CancelResponse>(
    args.session,
    APP_SUBSCRIPTION_CANCEL,
    { id: args.chargeId },
  );
  const ret = result.appSubscriptionCancel;
  if (ret.userErrors && ret.userErrors.length > 0) {
    throw new Error(
      `appSubscriptionCancel: ${ret.userErrors.map((e) => e.message).join("; ")}`,
    );
  }

  await client.updateMany({
    where: { shopifyChargeId: args.chargeId },
    data: { status: "cancelled", cancelledAt: new Date() },
  });

  billingLogger.info(
    { chargeId: args.chargeId, status: ret.appSubscription?.status },
    "Subscription cancelled",
  );

  return { status: ret.appSubscription?.status ?? "cancelled" };
}
