/**
 * shop/update handler. Reconciles M-018's placeholder Shop fields with
 * the canonical values from Shopify.
 *
 * See docs/specs/M-027-shop-update.md.
 */
import { prisma } from "../../config/database";
import { logger } from "../../config/logger";
import type { WebhookHandler } from "../handlers";

const handlerLogger = logger.child({ module: "wh:shop/update" });

interface ShopPayload {
  name?: string;
  email?: string;
  currency?: string;
  iana_timezone?: string;
  plan_name?: string;
  primary_locale?: string;
}

export interface ShopUpdateClient {
  updateMany(args: {
    where: { shopifyDomain: string };
    data: Record<string, string>;
  }): Promise<{ count: number }>;
}

export function shopUpdateHandler(
  client: ShopUpdateClient = prisma.shop as unknown as ShopUpdateClient,
): WebhookHandler {
  return async ({ shopDomain, payload }) => {
    const p = (payload ?? {}) as ShopPayload;
    const data: Record<string, string> = {};
    if (typeof p.name === "string") data.name = p.name;
    if (typeof p.email === "string") data.email = p.email;
    if (typeof p.currency === "string") data.currency = p.currency;
    if (typeof p.iana_timezone === "string") data.timezone = p.iana_timezone;
    if (typeof p.plan_name === "string") data.shopifyPlan = p.plan_name;
    if (typeof p.primary_locale === "string") data.locale = p.primary_locale;

    if (Object.keys(data).length === 0) {
      handlerLogger.warn({ shopDomain }, "shop/update: no recognized fields in payload");
      return;
    }

    const result = await client.updateMany({
      where: { shopifyDomain: shopDomain },
      data,
    });
    handlerLogger.info(
      { shopDomain, fields: Object.keys(data), rowsUpdated: result.count },
      "Shop reconciled",
    );
  };
}
