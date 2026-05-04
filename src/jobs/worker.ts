import { Worker, Queue } from "bullmq";
import { redis } from "../config/redis";
import { logger } from "../config/logger";

export const orderQueue = new Queue("order-processing", { connection: redis as any });
export const inventoryQueue = new Queue("inventory-sync", { connection: redis as any });

const orderWorker = new Worker("order-processing", async (job) => {
  logger.info(`Processing order job ${job.id}: ${job.name}`);
  switch (job.name) {
    case "process-bundle-order":
      // TODO: SKU breakdown, inventory adjust, 3PL forwarding
      break;
    case "cancel-bundle-order":
      // TODO: Reverse inventory adjustments
      break;
  }
}, { connection: redis as any, concurrency: 5 });

const inventoryWorker = new Worker("inventory-sync", async (job) => {
  logger.info(`Processing inventory job ${job.id}: ${job.name}`);
  switch (job.name) {
    case "sync-bundle-inventory":
      // TODO: Atomic inventory recalculation
      break;
    case "safety-lock-review":
      // TODO: Queue for merchant approval
      break;
  }
}, { connection: redis as any, concurrency: 3 });

orderWorker.on("failed", (job, err) => logger.error(`Order job ${job?.id} failed:`, err));
inventoryWorker.on("failed", (job, err) => logger.error(`Inventory job ${job?.id} failed:`, err));
logger.info("BullMQ workers started");
