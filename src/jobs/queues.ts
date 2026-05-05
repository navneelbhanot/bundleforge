/**
 * Named BullMQ queues used across the app. Defined in one module so workers
 * and producers share the same connection and queue identity.
 */
import { Queue } from "bullmq";

import { redis } from "../config/redis";

export const ORDER_QUEUE = "order-processing";
export const INVENTORY_QUEUE = "inventory-sync";
export const WEBHOOKS_QUEUE = "shopify-webhooks";

export const orderQueue = new Queue(ORDER_QUEUE, { connection: redis });
export const inventoryQueue = new Queue(INVENTORY_QUEUE, {
  connection: redis,
});
export const webhooksQueue = new Queue(WEBHOOKS_QUEUE, { connection: redis });
