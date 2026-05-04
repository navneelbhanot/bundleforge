import { PrismaClient } from "../generated/prisma";
import { logger } from "./logger";

export const prisma = new PrismaClient({
  log: [
    { level: "query", emit: "event" },
    { level: "error", emit: "stdout" },
    { level: "warn", emit: "stdout" },
  ],
});

prisma.$on("query", (e: any) => {
  if (e.duration > 500) {
    logger.warn(`Slow query (${e.duration}ms): ${e.query}`);
  }
});

export async function connectDatabase() {
  try {
    await prisma.$connect();
    logger.info("Database connected successfully");
  } catch (error) {
    logger.error("Failed to connect to database:", error);
    process.exit(1);
  }
}

export async function disconnectDatabase() {
  await prisma.$disconnect();
  logger.info("Database disconnected");
}
