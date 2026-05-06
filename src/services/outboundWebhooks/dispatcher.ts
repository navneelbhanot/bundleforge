/**
 * Outbound webhook dispatcher (M-168b).
 *
 * Producer side of the outbound-webhooks queue. Looks up
 * enabled webhooks subscribed to a given event and enqueues
 * one BullMQ job per webhook. Best-effort: queue / DB errors
 * are logged but never bubble up to the caller (matches the
 * M-174 activity-log writer pattern).
 */
import { logger } from "../../config/logger";
import { prisma } from "../../config/database";
import { outboundWebhooksQueue } from "../../jobs/queues";

const log = logger.child({ module: "outbound-webhooks-dispatcher" });

export type OutboundEvent =
  | "bundle.published"
  | "bundle.archived"
  | "bundle.low_stock"
  | "order.dispatched";

export interface DispatchInput {
  shopId: string;
  event: OutboundEvent;
  payload: Record<string, unknown>;
}

export interface OutboundWebhookRowSlim {
  id: string;
  events: string[];
}

export interface DispatcherDeps {
  /** DI seam for the prisma client. */
  client?: {
    outboundWebhook: {
      findMany(args: {
        where: {
          shopId: string;
          disabledAt: null;
          events: { has: string };
        };
        select: { id: true; events: true };
      }): Promise<OutboundWebhookRowSlim[]>;
    };
  };
  /** DI seam for the queue.add call. */
  enqueue?: (
    name: string,
    data: { webhookId: string; event: OutboundEvent; payload: Record<string, unknown> },
  ) => Promise<unknown>;
}

export async function dispatchOutboundEvent(
  input: DispatchInput,
  deps: DispatcherDeps = {},
): Promise<void> {
  const client =
    deps.client ?? (prisma as unknown as Required<DispatcherDeps>["client"]);
  const enqueue =
    deps.enqueue ??
    ((name, data) =>
      outboundWebhooksQueue.add(name, data, {
        attempts: 5,
        backoff: { type: "exponential", delay: 5_000 },
        removeOnComplete: 1000,
        removeOnFail: 5000,
      }));
  try {
    const rows = await client.outboundWebhook.findMany({
      where: {
        shopId: input.shopId,
        disabledAt: null,
        events: { has: input.event },
      },
      select: { id: true, events: true },
    });
    for (const row of rows) {
      try {
        await enqueue(input.event, {
          webhookId: row.id,
          event: input.event,
          payload: input.payload,
        });
      } catch (err) {
        log.warn(
          {
            err,
            webhookId: row.id,
            event: input.event,
          },
          "Failed to enqueue outbound webhook job",
        );
      }
    }
  } catch (err) {
    log.warn(
      { err, shopId: input.shopId, event: input.event },
      "dispatchOutboundEvent failed; swallowing",
    );
  }
}
