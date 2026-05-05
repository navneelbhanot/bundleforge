/**
 * Structured logger built on Pino.
 *
 * - JSON in production / test, pretty in development.
 * - Level controlled by env.LOG_LEVEL.
 * - Always tagged with service + version.
 *
 * Use `logger.child({ module: "bundles" })` to scope context to a module.
 *
 * See docs/specs/M-003-logger.md.
 */
import pino, { type Logger as PinoLogger } from "pino";

import { env } from "./env";

export type Logger = PinoLogger;

function buildLogger(): Logger {
  const options: pino.LoggerOptions = {
    level: env.LOG_LEVEL,
    base: { service: "bundleforge", version: env.APP_VERSION },
    timestamp: pino.stdTimeFunctions.isoTime,
  };
  if (env.NODE_ENV === "development") {
    return pino({
      ...options,
      transport: {
        target: "pino-pretty",
        options: { colorize: true, translateTime: "SYS:standard" },
      },
    });
  }
  return pino(options);
}

export const logger: Logger = buildLogger();
