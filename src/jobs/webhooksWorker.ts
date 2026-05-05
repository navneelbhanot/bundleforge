/**
 * BullMQ worker for the shopify-webhooks queue. Dispatches by topic to
 * the handler registry.
 *
 * Run alongside src/jobs/worker.ts via `npm run worker:webhooks` (added
 * later) or as part of `npm run worker` if a single process is preferred.
 */
import { Worker, type Job } from "bullmq";

import { logger } from "../config/logger";
import { redis } from "../config/redis";
import { dispatch, registerHandler } from "../webhooks/handlers";
import { appUninstalledHandler } from "../webhooks/handlers/appUninstalled";
import { customersDataRequestHandler } from "../webhooks/handlers/customersDataRequest";
import { customersRedactHandler } from "../webhooks/handlers/customersRedact";
import { ordersCancelledHandler } from "../webhooks/handlers/ordersCancelled";
import { ordersCreateHandler } from "../webhooks/handlers/ordersCreate";
import { ordersUpdatedHandler } from "../webhooks/handlers/ordersUpdated";
import { shopRedactHandler } from "../webhooks/handlers/shopRedact";
import { shopUpdateHandler } from "../webhooks/handlers/shopUpdate";
import { subscriptionUpdateHandler } from "../webhooks/handlers/subscriptionUpdate";
import type { WebhookJobData } from "../webhooks";
import { WEBHOOKS_QUEUE } from "./queues";

const workerLogger = logger.child({ module: "webhooks-worker" });

// Register handlers as they land.
registerHandler("app/uninstalled", appUninstalledHandler());
registerHandler("shop/update", shopUpdateHandler());
registerHandler("customers/data_request", customersDataRequestHandler);
registerHandler("customers/redact", customersRedactHandler);
registerHandler("shop/redact", shopRedactHandler());
registerHandler("app_subscriptions/update", subscriptionUpdateHandler());
registerHandler("orders/create", ordersCreateHandler());
registerHandler("orders/cancelled", ordersCancelledHandler());
registerHandler("orders/updated", ordersUpdatedHandler());

export const webhooksWorker = new Worker<WebhookJobData>(
  WEBHOOKS_QUEUE,
  async (job: Job<WebhookJobData>) => {
    const { topic, shopDomain, webhookId, payload } = job.data;
    workerLogger.info({ topic, shopDomain, webhookId }, "Handling webhook");
    await dispatch(topic, { shopDomain, webhookId, payload });
  },
  { connection: redis, concurrency: 10 },
);

webhooksWorker.on("failed", (job, err) =>
  workerLogger.error({ err, jobId: job?.id, topic: job?.name }, "Webhook job failed"),
);

workerLogger.info("Webhooks worker started");
