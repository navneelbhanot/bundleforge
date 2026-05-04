/**
 * Prisma client singleton + lifecycle helpers.
 *
 * - One PrismaClient per process (avoid pool exhaustion).
 * - Pino-backed logging for query / error / warn events.
 * - Slow-query warning above SLOW_QUERY_MS_THRESHOLD.
 *
 * See docs/specs/M-004-prisma-client.md.
 */
import { PrismaClient, type Prisma } from "../generated/prisma";

import { logger } from "./logger";

export const SLOW_QUERY_MS_THRESHOLD = 500;

const dbLogger = logger.child({ module: "db" });

/**
 * Pure: decides whether a query event should be logged as slow. Extracted
 * for testability without a live Prisma client.
 */
export function shouldLogSlowQuery(durationMs: number): boolean {
  return durationMs > SLOW_QUERY_MS_THRESHOLD;
}

export const prisma = new PrismaClient({
  log: [
    { level: "query", emit: "event" },
    { level: "error", emit: "event" },
    { level: "warn", emit: "event" },
  ],
});

prisma.$on("query", (e: Prisma.QueryEvent) => {
  if (shouldLogSlowQuery(e.duration)) {
    dbLogger.warn({ ms: e.duration, sql: e.query }, "Slow query");
  }
});

prisma.$on("error", (e: Prisma.LogEvent) => {
  dbLogger.error({ target: e.target }, e.message);
});

prisma.$on("warn", (e: Prisma.LogEvent) => {
  dbLogger.warn({ target: e.target }, e.message);
});

export async function connectDatabase(): Promise<void> {
  await prisma.$connect();
  dbLogger.info("Database connected");
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
  dbLogger.info("Database disconnected");
}
