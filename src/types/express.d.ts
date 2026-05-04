/**
 * Augment Express's Request with the project-wide `id` field set by the
 * requestId middleware (M-007). Kept here so every middleware/route can
 * assume `req.id: string` without local casts.
 *
 * pino-http already declares `req.id: ReqId` (a string|number|object union).
 * We narrow the project usage to string by always assigning a string.
 */
import "express";

declare module "express-serve-static-core" {
  interface Request {
    id: string;
  }
}
