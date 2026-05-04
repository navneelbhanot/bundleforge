/**
 * app/uninstalled handler. Marks the shop's row as uninstalled.
 *
 * See docs/specs/M-026-app-uninstalled.md.
 */
import { prisma } from "../../config/database";
import { logger } from "../../config/logger";
import type { WebhookHandler } from "../handlers";

const handlerLogger = logger.child({ module: "wh:app/uninstalled" });

export interface ShopUpdateClient {
  updateMany(args: {
    where: { shopifyDomain: string };
    data: { uninstalledAt: Date };
  }): Promise<{ count: number }>;
}

export function appUninstalledHandler(
  client: ShopUpdateClient = prisma.shop as unknown as ShopUpdateClient,
): WebhookHandler {
  return async ({ shopDomain }) => {
    const result = await client.updateMany({
      where: { shopifyDomain: shopDomain },
      data: { uninstalledAt: new Date() },
    });
    handlerLogger.info(
      { shopDomain, rowsUpdated: result.count },
      "Marked shop uninstalled",
    );
  };
}
