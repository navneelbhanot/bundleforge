/**
 * /api/v1/api-tokens routes (M-168).
 *
 * Per-shop bearer tokens for headless storefronts and agency
 * tooling. Plaintext is returned exactly once at creation; the
 * hashed form is what we persist (scrypt via tokenHash util).
 *
 * GET     /        — list this shop's tokens (no hashes, no plaintext).
 * POST    /        — create + return plaintext exactly once.
 * DELETE  /:id     — soft-revoke (sets revoked_at). Doesn't hard-delete
 *                    so audit history survives.
 */
import {
  Router,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import { z } from "zod";

import { prisma } from "../config/database";
import {
  NotFoundError,
  UnauthorizedError,
} from "../middleware/errorHandler";
import { generateToken, hashToken, tokenPrefix } from "../utils/tokenHash";

interface ApiTokenRow {
  id: string;
  shopId: string;
  label: string;
  prefix: string;
  hashedToken: string;
  lastUsedAt: Date | null;
  createdAt: Date;
  revokedAt: Date | null;
}

export interface ApiTokensClient {
  apiToken: {
    findMany(args: {
      where: { shopId: string };
      orderBy?: { createdAt: "asc" | "desc" };
    }): Promise<ApiTokenRow[]>;
    findFirst(args: {
      where: { id: string; shopId: string };
    }): Promise<ApiTokenRow | null>;
    create(args: {
      data: {
        shopId: string;
        label: string;
        prefix: string;
        hashedToken: string;
      };
    }): Promise<ApiTokenRow>;
    update(args: {
      where: { id: string };
      data: { revokedAt?: Date | null };
    }): Promise<ApiTokenRow>;
  };
}

export interface ApiTokensDeps {
  client?: ApiTokensClient;
  generateToken?: () => string;
  hashToken?: (token: string) => string;
}

const CreateBody = z
  .object({
    label: z.string().min(1).max(120),
  })
  .strict();

interface ApiTokenViewModel {
  id: string;
  label: string;
  prefix: string;
  lastUsedAt: string | null;
  createdAt: string;
  revokedAt: string | null;
}

function toViewModel(row: ApiTokenRow): ApiTokenViewModel {
  return {
    id: row.id,
    label: row.label,
    prefix: row.prefix,
    lastUsedAt: row.lastUsedAt ? row.lastUsedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    revokedAt: row.revokedAt ? row.revokedAt.toISOString() : null,
  };
}

export function installApiTokensRoutes(deps: ApiTokensDeps = {}): Router {
  const router = Router();
  const client = deps.client ?? (prisma as unknown as ApiTokensClient);
  const gen = deps.generateToken ?? generateToken;
  const hash = deps.hashToken ?? hashToken;

  function shopIdOr401(req: Request): string {
    if (!req.shopId) throw new UnauthorizedError("No shop context");
    return req.shopId;
  }

  router.get("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const shopId = shopIdOr401(req);
      const rows = await client.apiToken.findMany({
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
      const plaintext = gen();
      const hashed = hash(plaintext);
      const row = await client.apiToken.create({
        data: {
          shopId,
          label: body.label,
          prefix: tokenPrefix(plaintext),
          hashedToken: hashed,
        },
      });
      res.status(201).json({
        ...toViewModel(row),
        plaintext, // shown exactly once
      });
    } catch (err) {
      next(err);
    }
  });

  router.delete(
    "/:id",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const shopId = shopIdOr401(req);
        const existing = await client.apiToken.findFirst({
          where: { id: req.params.id, shopId },
        });
        if (!existing) throw new NotFoundError("ApiToken");
        if (existing.revokedAt) {
          // Already revoked — idempotent success.
          res.status(204).send();
          return;
        }
        await client.apiToken.update({
          where: { id: existing.id },
          data: { revokedAt: new Date() },
        });
        res.status(204).send();
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}

export const apiTokensRoutes = installApiTokensRoutes();
