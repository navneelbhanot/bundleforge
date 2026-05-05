/**
 * Integration adapter registry (M-116).
 *
 * Each external system registers an adapter. `dispatchOrder(shopId,
 * order)` walks the shop's enabled integrations and calls each
 * adapter's `pushOrder` (if defined). Errors are collected per-adapter
 * so one broken integration can't take down the rest.
 */
import { prisma } from "../../config/database";
import { logger } from "../../config/logger";
import { decrypt } from "../../utils/encryption";

import { amazonAdapter } from "./amazon";
import { boldAdapter } from "./bold";
import { rechargeAdapter } from "./recharge";
import { shipstationAdapter } from "./shipstation";
import type {
  BundleOrderEvent,
  IntegrationAdapter,
  IntegrationType,
} from "./types";

const dispatchLogger = logger.child({ module: "integrations" });

const registry = new Map<IntegrationType, IntegrationAdapter>();

export function registerAdapter(adapter: IntegrationAdapter): void {
  registry.set(adapter.type, adapter);
}

export function getAdapter(type: IntegrationType): IntegrationAdapter | undefined {
  return registry.get(type);
}

// Built-in adapters land at registration time.
registerAdapter(shipstationAdapter);
registerAdapter(amazonAdapter);
registerAdapter(rechargeAdapter);
registerAdapter(boldAdapter);

export interface IntegrationRow {
  id: string;
  type: string;
  status: string;
  /** AES-256 encrypted JSON string. */
  credentials: string;
}

export interface ShopIntegrationsLoader {
  list(shopId: string): Promise<IntegrationRow[]>;
}

export const defaultLoader: ShopIntegrationsLoader = {
  async list(shopId: string) {
    return prisma.integration.findMany({
      where: { shopId, status: "active" },
      select: { id: true, type: true, status: true, credentials: true },
    }) as unknown as Promise<IntegrationRow[]>;
  },
};

export async function dispatchOrder(
  shopId: string,
  order: BundleOrderEvent,
  loader: ShopIntegrationsLoader = defaultLoader,
): Promise<{ pushed: number; errors: Array<{ type: string; message: string }> }> {
  const rows = await loader.list(shopId);
  const errors: Array<{ type: string; message: string }> = [];
  let pushed = 0;
  for (const row of rows) {
    const adapter = registry.get(row.type as IntegrationType);
    if (!adapter || !adapter.pushOrder) continue;
    try {
      // credentials column on the integration row is an encrypted JSON
      // string written by the integration setup flow. We decrypt then
      // parse before handing to the adapter.
      const credsJson =
        typeof row.credentials === "string" && row.credentials.startsWith("v1:")
          ? decrypt(row.credentials)
          : (row.credentials as unknown as string);
      const creds =
        typeof credsJson === "string" ? JSON.parse(credsJson) : credsJson;
      await adapter.pushOrder({ creds, order });
      pushed += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push({ type: row.type, message });
      dispatchLogger.error(
        { err, integrationId: row.id, type: row.type, shopId },
        "Integration pushOrder failed",
      );
    }
  }
  return { pushed, errors };
}
