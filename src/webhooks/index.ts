import { Express } from "express";
import { logger } from "../config/logger";

export function registerWebhooks(app: Express, shopify: any) {
  logger.info("Registering Shopify webhooks...");
  // TODO: orders/create, orders/updated, orders/cancelled
  // products/update, products/delete, inventory_levels/update
  // app/uninstalled, shop/update
  // GDPR: customers/data_request, customers/redact, shop/redact
}
