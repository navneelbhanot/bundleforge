/**
 * Webhook dispatcher.
 *
 * POST /api/webhooks goes through HMAC verification (M-024) then enqueues
 * to the webhooks queue. Workers (M-026+) consume.
 *
 * See docs/specs/M-025-webhook-dispatcher.md.
 */
import { type Express, type Request, type Response, type NextFunction } from "express";
import type { Queue } from "bullmq";

import { logger } from "../config/logger";
import { shopifyWebhookHmac } from "../middleware/shopifyWebhook";
import { webhooksQueue as defaultQueue } from "../jobs/queues";

const dispatchLogger = logger.child({ module: "webhook-dispatcher" });

export interface WebhookJobData {
  topic: string;
  shopDomain: string;
  webhookId: string;
  payload: unknown;
}

export interface MountWebhooksOptions {
  /** DI for tests. */
  queue?: Pick<Queue<WebhookJobData>, "add">;
  /** Override the HMAC shared secret (tests). */
  secret?: string;
}

export function mountWebhooks(app: Express, opts: MountWebhooksOptions = {}): void {
  const queue =
    opts.queue ?? (defaultQueue as unknown as Pick<Queue<WebhookJobData>, "add">);

  app.post(
    "/api/webhooks",
    ...shopifyWebhookHmac({ secret: opts.secret }),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const topic = req.shopifyTopic ?? "unknown";
        const shopDomain = req.shopifyShopDomain ?? "unknown";
        const webhookId = req.shopifyWebhookId ?? "";

        const data: WebhookJobData = {
          topic,
          shopDomain,
          webhookId,
          payload: req.body,
        };

        await queue.add(topic, data, {
          jobId: webhookId || undefined,
          removeOnComplete: 10_000,
          removeOnFail: 10_000,
        });

        dispatchLogger.info({ topic, shopDomain, webhookId }, "Webhook enqueued");
        res.status(200).json({ ok: true });
      } catch (err) {
        next(err);
      }
    },
  );
}
