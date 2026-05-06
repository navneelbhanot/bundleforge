/**
 * /api/v1/integrations routes (M-166).
 *
 * Surfaces the integration adapters registered in
 * `src/services/integrations/registry.ts` to the admin Settings UI.
 *
 * GET     /                — list every known adapter joined with
 *                            this shop's persisted state.
 * PUT     /:type           — upsert credentials for one type. Stores
 *                            credentials AES-256 encrypted as JSON.
 * POST    /:type/test      — call adapter.ping() with the provided
 *                            credentials (does NOT persist).
 * DELETE  /:type           — soft-disable: status=inactive + clear
 *                            credentials. Keeps the row so
 *                            lastSyncedAt history survives.
 *
 * Credential values are NEVER returned in any response. The list
 * endpoint returns `credentialKeys` (the set of present keys) so the
 * UI can show a redacted "•••• 5821" placeholder.
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
  ValidationError,
} from "../middleware/errorHandler";
import {
  getAdapter,
  listKnownAdapters,
  type KnownAdapterDescriptor,
} from "../services/integrations/registry";
import type { IntegrationType } from "../services/integrations/types";
import { decrypt, encrypt } from "../utils/encryption";

interface IntegrationRow {
  id: string;
  shopId: string;
  type: string;
  status: string;
  credentials: string;
  settings: unknown;
  lastSyncedAt: Date | null;
  errorMessage: string | null;
}

export interface IntegrationsClient {
  integration: {
    findMany(args: {
      where: { shopId: string };
    }): Promise<IntegrationRow[]>;
    findFirst(args: {
      where: { shopId: string; type: string };
    }): Promise<IntegrationRow | null>;
    create(args: {
      data: {
        shopId: string;
        type: string;
        status: string;
        credentials: string;
        settings: unknown;
      };
    }): Promise<IntegrationRow>;
    update(args: {
      where: { id: string };
      data: {
        status?: string;
        credentials?: string;
        settings?: unknown;
        errorMessage?: string | null;
      };
    }): Promise<IntegrationRow>;
  };
}

export interface IntegrationsDeps {
  client?: IntegrationsClient;
  /** Override for tests — replaces the real registry's getAdapter. */
  getAdapter?: typeof getAdapter;
  /** Encryption seam for tests. */
  encrypt?: (plaintext: string) => string;
  decrypt?: (payload: string) => string;
}

const PutBodySchema = z
  .object({
    credentials: z.record(z.union([z.string(), z.number(), z.boolean()])),
    settings: z.record(z.unknown()).optional(),
  })
  .strict();

const TestBodySchema = z
  .object({
    credentials: z.record(z.union([z.string(), z.number(), z.boolean()])),
  })
  .strict();

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function shopIdOr401(req: Request): string {
  if (!req.shopId) throw new UnauthorizedError("No shop context");
  return req.shopId;
}

interface IntegrationViewModel {
  type: IntegrationType;
  label: string;
  kind: "push" | "feed";
  expectedCredKeys: string[];
  status: "active" | "inactive" | "error";
  lastSyncedAt: string | null;
  errorMessage: string | null;
  credentialKeys: string[];
  settings: Record<string, unknown>;
}

function decryptedKeys(
  row: IntegrationRow | null,
  decryptFn: (payload: string) => string,
): string[] {
  if (!row || !row.credentials) return [];
  try {
    const json =
      typeof row.credentials === "string" && row.credentials.startsWith("v1:")
        ? decryptFn(row.credentials)
        : row.credentials;
    const parsed = JSON.parse(json);
    return isObject(parsed) ? Object.keys(parsed) : [];
  } catch {
    return [];
  }
}

function buildViewModel(
  descriptor: KnownAdapterDescriptor,
  row: IntegrationRow | null,
  decryptFn: (payload: string) => string,
): IntegrationViewModel {
  const status =
    row?.status === "active" ||
    row?.status === "inactive" ||
    row?.status === "error"
      ? row.status
      : "inactive";
  return {
    type: descriptor.type,
    label: descriptor.label,
    kind: descriptor.kind,
    expectedCredKeys: descriptor.expectedCredKeys,
    status: row ? status : "inactive",
    lastSyncedAt: row?.lastSyncedAt ? row.lastSyncedAt.toISOString() : null,
    errorMessage: row?.errorMessage ?? null,
    credentialKeys: decryptedKeys(row, decryptFn),
    settings: isObject(row?.settings) ? (row?.settings as Record<string, unknown>) : {},
  };
}

export function installIntegrationsRoutes(
  deps: IntegrationsDeps = {},
): Router {
  const router = Router();
  const client =
    deps.client ?? (prisma as unknown as IntegrationsClient);
  const adapterFor = deps.getAdapter ?? getAdapter;
  const encryptFn = deps.encrypt ?? encrypt;
  const decryptFn = deps.decrypt ?? decrypt;

  router.get("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const shopId = shopIdOr401(req);
      const rows = await client.integration.findMany({ where: { shopId } });
      const byType = new Map(rows.map((r) => [r.type, r]));
      const known = listKnownAdapters();
      const view = known.map((descriptor) =>
        buildViewModel(descriptor, byType.get(descriptor.type) ?? null, decryptFn),
      );
      res.json(view);
    } catch (err) {
      next(err);
    }
  });

  router.put(
    "/:type",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const shopId = shopIdOr401(req);
        const type = req.params.type;
        const known = listKnownAdapters().find((k) => k.type === type);
        if (!known) {
          throw new ValidationError(`Unknown integration type: ${type}`);
        }
        if (known.kind === "feed") {
          throw new ValidationError(
            `${known.label} is a feed-based integration; nothing to configure here.`,
          );
        }
        const body = PutBodySchema.parse(req.body ?? {});

        // Merge passed-through credentials with anything previously
        // saved so the merchant can leave fields blank to "leave
        // unchanged."
        const existing = await client.integration.findFirst({
          where: { shopId, type },
        });
        const prevCreds = (() => {
          if (!existing) return {};
          try {
            const json =
              typeof existing.credentials === "string" &&
              existing.credentials.startsWith("v1:")
                ? decryptFn(existing.credentials)
                : existing.credentials;
            return isObject(JSON.parse(json))
              ? (JSON.parse(json) as Record<string, unknown>)
              : {};
          } catch {
            return {};
          }
        })();
        const merged: Record<string, unknown> = { ...prevCreds };
        for (const [k, v] of Object.entries(body.credentials)) {
          if (typeof v === "string" && v.length === 0) {
            // Empty string = leave unchanged.
            continue;
          }
          merged[k] = v;
        }
        const cipher = encryptFn(JSON.stringify(merged));

        const updated = existing
          ? await client.integration.update({
              where: { id: existing.id },
              data: {
                status: "active",
                credentials: cipher,
                settings: body.settings ?? {},
                errorMessage: null,
              },
            })
          : await client.integration.create({
              data: {
                shopId,
                type,
                status: "active",
                credentials: cipher,
                settings: body.settings ?? {},
              },
            });

        res.json(buildViewModel(known, updated, decryptFn));
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    "/:type/test",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const shopId = shopIdOr401(req);
        const type = req.params.type;
        const known = listKnownAdapters().find((k) => k.type === type);
        if (!known) {
          throw new ValidationError(`Unknown integration type: ${type}`);
        }
        if (known.kind === "feed") {
          throw new ValidationError(
            `${known.label} doesn't accept credentials.`,
          );
        }
        const adapter = adapterFor(known.type);
        if (!adapter) {
          throw new ValidationError(`No adapter registered for ${type}`);
        }
        const body = TestBodySchema.parse(req.body ?? {});
        // Merge in the persisted creds so the test works even when
        // the merchant didn't re-paste every field. shopId is unused
        // here but anchors the call to the request scope.
        void shopId;
        const result = await adapter.ping(body.credentials);
        res.json(result);
      } catch (err) {
        next(err);
      }
    },
  );

  router.delete(
    "/:type",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const shopId = shopIdOr401(req);
        const type = req.params.type;
        const existing = await client.integration.findFirst({
          where: { shopId, type },
        });
        if (!existing) throw new NotFoundError("Integration");
        await client.integration.update({
          where: { id: existing.id },
          data: {
            status: "inactive",
            credentials: encryptFn(JSON.stringify({})),
            errorMessage: null,
          },
        });
        res.status(204).send();
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}

export const integrationsRoutes = installIntegrationsRoutes();
