/**
 * GDPR customers/redact handler. BundleForge stores no customer PII, so
 * we ack via log.
 *
 * See docs/specs/M-029-customers-redact.md.
 */
import { logger } from "../../config/logger";
import type { WebhookHandler } from "../handlers";

const handlerLogger = logger.child({ module: "wh:customers/redact" });

interface RedactPayload {
  customer?: { id?: number | string; email?: string };
  shop_id?: number | string;
  orders_to_redact?: number[];
}

export const customersRedactHandler: WebhookHandler = async ({
  shopDomain,
  webhookId,
  payload,
}) => {
  const p = (payload ?? {}) as RedactPayload;
  handlerLogger.info(
    {
      shopDomain,
      webhookId,
      customerId: p.customer?.id,
      shopId: p.shop_id,
      ordersToRedact: p.orders_to_redact?.length ?? 0,
    },
    "GDPR customers/redact received; no PII stored, acknowledging",
  );
};
