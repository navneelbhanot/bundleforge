/**
 * Outbound webhooks worker (M-168b).
 *
 * Consumes the outbound-webhooks BullMQ queue. For each
 * job:
 *  1. Loads the webhook row + decrypts its hmacSecret.
 *  2. Builds the canonical body (JSON.stringify(payload)).
 *  3. Computes HMAC-SHA256(body, secret) and POSTs to the
 *     webhook URL with the signature in
 *     `X-MintBundle-Signature: sha256=<hex>`.
 *  4. On 5xx / network error → throws so BullMQ retries.
 *  5. On 4xx → logs and returns; merchant misconfiguration
 *     won't fix itself with retries.
 *  6. Increments failCount on persistent failure;
 *     auto-disables the webhook after 10 consecutive
 *     failures.
 *
 * The pure `processOutboundWebhookJob` function is the
 * unit-testable seam — the worker factory just wires it
 * up to BullMQ.
 */
import { createHmac } from "node:crypto";
import { Worker, type Job } from "bullmq";

import { prisma } from "../../config/database";
import { logger } from "../../config/logger";
import { decrypt } from "../../utils/encryption";
import { redis } from "../../config/redis";
import { OUTBOUND_WEBHOOKS_QUEUE } from "../queues";

const log = logger.child({ module: "outbound-webhooks-worker" });

const FAIL_DISABLE_THRESHOLD = 10;

export interface OutboundJobData {
  webhookId: string;
  event: string;
  payload: Record<string, unknown>;
}

export interface WebhookRow {
  id: string;
  url: string;
  hmacSecret: string;
  failCount: number;
  disabledAt: Date | null;
}

export interface ProcessDeps {
  client?: {
    outboundWebhook: {
      findUnique(args: {
        where: { id: string };
      }): Promise<WebhookRow | null>;
      update(args: {
        where: { id: string };
        data: {
          lastFiredAt?: Date;
          failCount?: number;
          disabledAt?: Date | null;
        };
      }): Promise<unknown>;
    };
  };
  decryptFn?: (s: string) => string;
  /** DI seam for fetch. Tests stub. */
  fetchFn?: typeof fetch;
}

export interface ProcessResult {
  status: number;
  retried: boolean;
}

function signBody(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

export async function processOutboundWebhookJob(
  data: OutboundJobData,
  deps: ProcessDeps = {},
): Promise<ProcessResult> {
  const client =
    deps.client ?? (prisma as unknown as Required<ProcessDeps>["client"]);
  const dec = deps.decryptFn ?? decrypt;
  const fetchImpl = deps.fetchFn ?? fetch;

  const row = await client.outboundWebhook.findUnique({
    where: { id: data.webhookId },
  });
  if (!row) {
    log.warn({ webhookId: data.webhookId }, "Webhook row missing; dropping job");
    return { status: 410, retried: false };
  }
  if (row.disabledAt) {
    log.info({ webhookId: row.id }, "Webhook disabled; skipping");
    return { status: 410, retried: false };
  }

  const secret = dec(row.hmacSecret);
  const body = JSON.stringify({
    event: data.event,
    deliveredAt: new Date().toISOString(),
    payload: data.payload,
  });
  const signature = signBody(body, secret);

  let response: Response;
  try {
    response = await fetchImpl(row.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-MintBundle-Event": data.event,
        "X-MintBundle-Signature": `sha256=${signature}`,
      },
      body,
    });
  } catch (err) {
    // Network error — bump failCount, throw so BullMQ retries.
    await recordFailure(client, row);
    throw err;
  }

  if (response.status >= 500) {
    await recordFailure(client, row);
    // Throwing tells BullMQ to retry per the queue's backoff policy.
    throw new Error(
      `outbound webhook ${row.id} got ${response.status}`,
    );
  }
  if (response.status >= 400) {
    // 4xx is a misconfiguration; record fail but don't retry.
    await recordFailure(client, row);
    log.warn(
      { webhookId: row.id, status: response.status },
      "Webhook 4xx; not retrying",
    );
    return { status: response.status, retried: false };
  }

  // 2xx / 3xx — success.
  await client.outboundWebhook.update({
    where: { id: row.id },
    data: {
      lastFiredAt: new Date(),
      failCount: 0,
    },
  });
  return { status: response.status, retried: false };
}

async function recordFailure(
  client: Required<ProcessDeps>["client"],
  row: WebhookRow,
): Promise<void> {
  const next = row.failCount + 1;
  const disabledAt = next >= FAIL_DISABLE_THRESHOLD ? new Date() : null;
  await client.outboundWebhook.update({
    where: { id: row.id },
    data: {
      lastFiredAt: new Date(),
      failCount: next,
      ...(disabledAt && { disabledAt }),
    },
  });
  if (disabledAt) {
    log.warn(
      { webhookId: row.id },
      `Webhook auto-disabled after ${FAIL_DISABLE_THRESHOLD} consecutive failures`,
    );
  }
}

export function startOutboundWebhookWorker(): Worker<OutboundJobData> {
  const worker = new Worker<OutboundJobData>(
    OUTBOUND_WEBHOOKS_QUEUE,
    async (job: Job<OutboundJobData>) => {
      return processOutboundWebhookJob(job.data);
    },
    { connection: redis },
  );
  worker.on("failed", (job, err) => {
    log.warn(
      { jobId: job?.id, err: err.message, attempt: job?.attemptsMade },
      "outbound webhook job failed",
    );
  });
  return worker;
}
