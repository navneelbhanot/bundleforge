/**
 * GDPR shop/redact handler. Hard-deletes the shop and (via FK CASCADE)
 * all rows owned by it.
 *
 * Audit-log DELETE protection is dropped in migration
 * 20260504_audit_log_relax_delete (ADR-0003a). UPDATE protection remains.
 *
 * See docs/specs/M-030-shop-redact.md.
 */
import { prisma } from "../../config/database";
import { logger } from "../../config/logger";
import type { WebhookHandler } from "../handlers";

const handlerLogger = logger.child({ module: "wh:shop/redact" });

export interface ShopDeleteClient {
  deleteMany(args: {
    where: { shopifyDomain: string };
  }): Promise<{ count: number }>;
}

export function shopRedactHandler(
  client: ShopDeleteClient = prisma.shop as unknown as ShopDeleteClient,
): WebhookHandler {
  return async ({ shopDomain, webhookId }) => {
    const result = await client.deleteMany({
      where: { shopifyDomain: shopDomain },
    });
    handlerLogger.warn(
      { shopDomain, webhookId, rowsDeleted: result.count },
      "GDPR shop/redact — shop and cascade rows deleted",
    );
  };
}
