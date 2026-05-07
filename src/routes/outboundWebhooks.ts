/**
 * /api/v1/outbound-webhooks routes (M-168).
 *
 * Per-shop subscriptions to events fired by MintBundle. The
 * worker that emits the actual HTTP POSTs lives in M-168b — this
 * route ships the configuration surface and the secret rotation
 * model.
 *
 * GET    /        — list (never returns the plaintext HMAC secret).
 * POST   /        — create + return plaintext secret exactly once.
 * PUT    /:id     — update url / events / disabledAt.
 * DELETE /:id     — hard delete.
 */
import {
  Router,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { randomBytes } from "node:crypto";
import { z } from "zod";

import { prisma } from "../config/database";
import {
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from "../middleware/errorHandler";
import { decrypt, encrypt } from "../utils/encryption";

const ALLOWED_EVENTS = [
  "bundle.published",
  "bundle.archived",
  "bundle.low_stock",
  "order.dispatched",
] as const;

interface OutboundWebhookRow {
  id: string;
  shopId: string;
  url: string;
  events: string[];
  hmacSecret: string;
  lastFiredAt: Date | null;
  failCount: number;
  createdAt: Date;
  disabledAt: Date | null;
}

export interface OutboundWebhooksClient {
  outboundWebhook: {
    findMany(args: {
      where: { shopId: string };
      orderBy?: { createdAt: "asc" | "desc" };
    }): Promise<OutboundWebhookRow[]>;
    findFirst(args: {
      where: { id: string; shopId: string };
    }): Promise<OutboundWebhookRow | null>;
    create(args: {
      data: {
        shopId: string;
        url: string;
        events: string[];
        hmacSecret: string;
      };
    }): Promise<OutboundWebhookRow>;
    update(args: {
      where: { id: string };
      data: {
        url?: string;
        events?: string[];
        disabledAt?: Date | null;
      };
    }): Promise<OutboundWebhookRow>;
    delete(args: { where: { id: string } }): Promise<OutboundWebhookRow>;
  };
}

export interface OutboundWebhooksDeps {
  client?: OutboundWebhooksClient;
  generateSecret?: () => string;
  encrypt?: (s: string) => string;
  decrypt?: (s: string) => string;
}

const EventSchema = z.enum(ALLOWED_EVENTS);

const CreateBody = z
  .object({
    url: z.string().url().refine((u) => /^https?:\/\//.test(u), {
      message: "url must use http(s)",
    }),
    events: z.array(EventSchema).min(1).max(ALLOWED_EVENTS.length),
  })
  .strict();

const UpdateBody = z
  .object({
    url: z
      .string()
      .url()
      .refine((u) => /^https?:\/\//.test(u), { message: "url must use http(s)" })
      .optional(),
    events: z.array(EventSchema).min(1).max(ALLOWED_EVENTS.length).optional(),
    enabled: z.boolean().optional(),
  })
  .strict();

interface OutboundWebhookViewModel {
  id: string;
  url: string;
  events: string[];
  lastFiredAt: string | null;
  failCount: number;
  createdAt: string;
  disabledAt: string | null;
  hasSecret: boolean;
}

function toViewModel(row: OutboundWebhookRow): OutboundWebhookViewModel {
  return {
    id: row.id,
    url: row.url,
    events: row.events,
    lastFiredAt: row.lastFiredAt ? row.lastFiredAt.toISOString() : null,
    failCount: row.failCount,
    createdAt: row.createdAt.toISOString(),
    disabledAt: row.disabledAt ? row.disabledAt.toISOString() : null,
    hasSecret: row.hmacSecret.length > 0,
  };
}

export function installOutboundWebhooksRoutes(
  deps: OutboundWebhooksDeps = {},
): Router {
  const router = Router();
  const client = deps.client ?? (prisma as unknown as OutboundWebhooksClient);
  const gen =
    deps.generateSecret ?? (() => randomBytes(32).toString("hex"));
  const encryptFn = deps.encrypt ?? encrypt;
  // decrypt is part of the public deps interface so M-168b can
  // verify round-trip; today's routes don't need to read the
  // plaintext (it's only written once at create + decrypted by
  // the worker that fires outbound POSTs).
  void (deps.decrypt ?? decrypt);

  function shopIdOr401(req: Request): string {
    if (!req.shopId) throw new UnauthorizedError("No shop context");
    return req.shopId;
  }

  router.get("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const shopId = shopIdOr401(req);
      const rows = await client.outboundWebhook.findMany({
        where: { shopId },
        orderBy: { createdAt: "desc" },
      });
      res.json(rows.map(toViewModel));
    } catch (err) {
      next(err);
    }
  });

  router.post("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const shopId = shopIdOr401(req);
      const body = CreateBody.parse(req.body ?? {});
      const secretPlain = gen();
      const cipher = encryptFn(secretPlain);
      const row = await client.outboundWebhook.create({
        data: {
          shopId,
          url: body.url,
          events: body.events,
          hmacSecret: cipher,
        },
      });
      res.status(201).json({
        ...toViewModel(row),
        secretPlaintext: secretPlain, // shown exactly once
      });
    } catch (err) {
      next(err);
    }
  });

  router.put(
    "/:id",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const shopId = shopIdOr401(req);
        const body = UpdateBody.parse(req.body ?? {});
        const existing = await client.outboundWebhook.findFirst({
          where: { id: req.params.id, shopId },
        });
        if (!existing) throw new NotFoundError("OutboundWebhook");
        const data: {
          url?: string;
          events?: string[];
          disabledAt?: Date | null;
        } = {};
        if (body.url !== undefined) data.url = body.url;
        if (body.events !== undefined) data.events = body.events;
        if (body.enabled !== undefined) {
          data.disabledAt = body.enabled ? null : new Date();
        }
        if (Object.keys(data).length === 0) {
          throw new ValidationError("No editable fields supplied");
        }
        const updated = await client.outboundWebhook.update({
          where: { id: existing.id },
          data,
        });
        res.json(toViewModel(updated));
      } catch (err) {
        next(err);
      }
    },
  );

  router.delete(
    "/:id",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const shopId = shopIdOr401(req);
        const existing = await client.outboundWebhook.findFirst({
          where: { id: req.params.id, shopId },
        });
        if (!existing) throw new NotFoundError("OutboundWebhook");
        await client.outboundWebhook.delete({ where: { id: existing.id } });
        res.status(204).send();
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}

export const outboundWebhooksRoutes = installOutboundWebhooksRoutes();
