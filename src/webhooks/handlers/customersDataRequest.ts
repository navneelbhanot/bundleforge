/**
 * GDPR customers/data_request handler. MintBundle stores no customer
 * PII, so we acknowledge by logging and returning.
 *
 * See docs/specs/M-028-customers-data-request.md.
 */
import { logger } from "../../config/logger";
import type { WebhookHandler } from "../handlers";

const handlerLogger = logger.child({ module: "wh:customers/data_request" });

interface DataRequestPayload {
  customer?: { id?: number | string };
  shop_id?: number | string;
  orders_requested?: number[];
}

export const customersDataRequestHandler: WebhookHandler = async ({
  shopDomain,
  webhookId,
  payload,
}) => {
  const p = (payload ?? {}) as DataRequestPayload;
  handlerLogger.info(
    {
      shopDomain,
      webhookId,
      customerId: p.customer?.id,
      shopId: p.shop_id,
      ordersRequested: p.orders_requested?.length ?? 0,
    },
    "GDPR customers/data_request received; no PII stored, acknowledging",
  );
};
