/**
 * Analytics repository — narrow Prisma surface used by analytics
 * routes (M-109+). All queries scoped by shopId.
 */
import type { Prisma } from "../../generated/prisma";
import { prisma } from "../../config/database";

export interface IngestEvent {
  bundleId: string;
  eventType: "view" | "add_to_cart" | "checkout_start" | "purchase" | "remove";
  sessionId?: string;
  customerId?: string;
  revenue?: number;
  currency?: string;
  deviceType?: string;
  sourcePage?: string;
  abVariant?: string;
  metadata?: Record<string, unknown>;
}

export const analyticsRepo = {
  async ingest(shopId: string, events: IngestEvent[]) {
    if (events.length === 0) return { count: 0 };
    return prisma.analyticsEvent.createMany({
      data: events.map((e) => ({
        shopId,
        bundleId: e.bundleId,
        eventType: e.eventType,
        sessionId: e.sessionId,
        customerId: e.customerId,
        revenue: e.revenue ?? 0,
        currency: e.currency,
        deviceType: e.deviceType,
        sourcePage: e.sourcePage,
        abVariant: e.abVariant,
        metadata: (e.metadata ?? {}) as Prisma.InputJsonValue,
      })),
      skipDuplicates: false,
    });
  },

  async overview(shopId: string) {
    const [revenue, orders, byBundle] = await Promise.all([
      prisma.analyticsEvent.aggregate({
        where: { shopId, eventType: "purchase" },
        _sum: { revenue: true },
      }),
      prisma.analyticsEvent.count({
        where: { shopId, eventType: "purchase" },
      }),
      prisma.analyticsEvent.groupBy({
        by: ["bundleId"],
        where: { shopId, eventType: "purchase" },
        _sum: { revenue: true },
        _count: { _all: true },
        orderBy: { _sum: { revenue: "desc" } },
        take: 10,
      }),
    ]);
    return { revenue, orders, byBundle };
  },

  async byBundle(shopId: string, bundleId: string) {
    const groups = await prisma.analyticsEvent.groupBy({
      by: ["eventType"],
      where: { shopId, bundleId },
      _count: { _all: true },
      _sum: { revenue: true },
    });
    return groups;
  },
};
