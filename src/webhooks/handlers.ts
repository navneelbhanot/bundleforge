/**
 * Webhook handler registry.
 *
 * Each Shopify topic is mapped to one async handler. The worker calls
 * dispatch(topic, input). Unknown topics are logged but do not throw,
 * so unsubscribed Shopify topics can't poison the queue.
 *
 * See docs/specs/M-026-app-uninstalled.md.
 */
import { logger } from "../config/logger";

const dispatchLogger = logger.child({ module: "webhook-handlers" });

export interface WebhookInput {
  shopDomain: string;
  payload: unknown;
  webhookId: string;
}

export type WebhookHandler = (input: WebhookInput) => Promise<void>;

const registry = new Map<string, WebhookHandler>();

export function registerHandler(topic: string, handler: WebhookHandler): void {
  registry.set(topic, handler);
}

export function getHandler(topic: string): WebhookHandler | undefined {
  return registry.get(topic);
}

export async function dispatch(topic: string, input: WebhookInput): Promise<void> {
  const handler = registry.get(topic);
  if (!handler) {
    dispatchLogger.warn({ topic, shop: input.shopDomain }, "No handler for topic");
    return;
  }
  await handler(input);
}

/** Test-only: clear all registrations. */
export function _resetHandlersForTesting(): void {
  registry.clear();
}
