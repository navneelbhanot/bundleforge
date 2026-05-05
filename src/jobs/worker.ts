/**
 * BullMQ worker process. Run via `npm run worker`.
 *
 * Job handlers remain stubs through M-077+; this file only wires Worker
 * lifecycle and named-queue dispatch.
 */
import { Worker, type Job } from "bullmq";

import { logger } from "../config/logger";
import { redis } from "../config/redis";
import { captureException } from "../config/sentry";
import { INVENTORY_QUEUE, ORDER_QUEUE } from "./queues";

const workerLogger = logger.child({ module: "worker" });

const orderWorker = new Worker(
  ORDER_QUEUE,
  async (job: Job) => {
    workerLogger.info({ jobId: job.id, name: job.name }, "Processing order job");
    switch (job.name) {
      case "process-bundle-order":
        // TODO(M-077): SKU breakdown, inventory adjust, 3PL forwarding
        break;
      case "cancel-bundle-order":
        // TODO(M-079): Reverse inventory adjustments
        break;
    }
  },
  { connection: redis, concurrency: 5 },
);

const inventoryWorker = new Worker(
  INVENTORY_QUEUE,
  async (job: Job) => {
    workerLogger.info({ jobId: job.id, name: job.name }, "Processing inventory job");
    switch (job.name) {
      case "sync-bundle-inventory":
        // TODO(M-070): Atomic inventory recalculation
        break;
      case "safety-lock-review":
        // TODO(M-074): Queue for merchant approval
        break;
    }
  },
  { connection: redis, concurrency: 3 },
);

// M-142: every worker logs `{ err }` AND captures to Sentry; HTTP-only
// capture in errorHandler doesn't see queue failures.
orderWorker.on("failed", (job, err) => {
  workerLogger.error({ err, jobId: job?.id }, "Order job failed");
  captureException(err, { queue: ORDER_QUEUE, jobId: job?.id });
});
inventoryWorker.on("failed", (job, err) => {
  workerLogger.error({ err, jobId: job?.id }, "Inventory job failed");
  captureException(err, { queue: INVENTORY_QUEUE, jobId: job?.id });
});

workerLogger.info("BullMQ workers started");
