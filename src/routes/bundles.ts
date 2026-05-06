/**
 * /api/v1/bundles routes (M-053).
 *
 * Authentication is handled upstream (M-019 requireShopSession populates
 * req.shopId). Endpoints follow ARCHITECTURE.md §5.1.
 */
import { Router, type Request, type Response, type NextFunction } from "express";
import type { Session } from "@shopify/shopify-api";
import { z } from "zod";

import { BundleService } from "../services/bundles";
import { bundleActivityRepo } from "../services/bundles/activityRepo";
import {
  BUNDLE_TEMPLATES,
  findTemplate,
} from "../services/bundles/templates";
import { CreateBundleInput, PaginationParams } from "../types";
import {
  NotFoundError,
  UnauthorizedError,
} from "../middleware/errorHandler";
import { shopifyGraphql } from "../shopify/graphql";

const BulkBody = z
  .object({
    ids: z.array(z.string().min(1)).min(1).max(50),
  })
  .strict();

export interface BundleRouteDeps {
  service?: BundleService;
  /** Override for the activity-log read path. Tests inject a fake. */
  activityRepo?: typeof bundleActivityRepo;
  /**
   * Optional override for the publish-creates-Shopify-product hook.
   * Tests inject a fake; production uses the default that hits Shopify
   * Admin GraphQL via the request's session.
   */
  createShopifyProduct?: (
    session: Session,
    bundle: {
      id: string;
      title: string;
      slug: string;
      description: string | null;
      components: Array<{
        shopifyProductGid: string;
        shopifyVariantGid: string | null;
        quantity: number;
        sku: string | null;
      }>;
      pricingRules: Array<{
        type: string;
        value: string;
        minQuantity: number;
        maxQuantity: number | null;
        isStackable: boolean;
      }>;
      eligibility: Record<string, unknown>;
      inventoryRules: Record<string, unknown>;
    },
  ) => Promise<{ shopifyProductGid: string; shopifyProductId: bigint }>;
}

/**
 * Default productCreate mutation. Creates a Shopify product
 * representing the bundle: a single default variant priced at $0
 * (the Cart Transform Function applies the real bundle price), with
 * a metafield carrying the bundle id so other code (theme blocks,
 * cart transform, POS) can resolve back.
 */
const PRODUCT_CREATE_MUTATION = `#graphql
  mutation BundleforgeProductCreate($input: ProductInput!) {
    productCreate(input: $input) {
      product {
        id
        legacyResourceId
      }
      userErrors { field message }
    }
  }
`;

interface ProductCreateResponse {
  productCreate?: {
    product?: { id: string; legacyResourceId: string };
    userErrors?: Array<{ field?: string[]; message: string }>;
  };
}

const defaultCreateShopifyProduct: NonNullable<
  BundleRouteDeps["createShopifyProduct"]
> = async (session, bundle) => {
  // Components metafield is the source of truth the Cart Transform
  // Function reads at checkout — when this product appears in a cart,
  // the function expands the line into one line per component using
  // these GIDs and quantities. Schema version lets the function reject
  // metafields it doesn't understand.
  const componentsPayload = {
    schemaVersion: 1,
    bundleId: bundle.id,
    components: bundle.components.map((c) => ({
      productGid: c.shopifyProductGid,
      variantGid: c.shopifyVariantGid,
      quantity: c.quantity,
      sku: c.sku,
    })),
    pricingRules: bundle.pricingRules,
  };
  const data = await shopifyGraphql<ProductCreateResponse>(
    session,
    PRODUCT_CREATE_MUTATION,
    {
      input: {
        title: bundle.title,
        descriptionHtml: bundle.description ?? "",
        handle: bundle.slug,
        productType: "Bundle",
        vendor: "BundleForge",
        status: "ACTIVE",
        tags: ["bundleforge", `bundleforge-bundle-${bundle.id}`],
        metafields: [
          {
            namespace: "bundleforge",
            key: "bundle_id",
            value: bundle.id,
            type: "single_line_text_field",
          },
          {
            namespace: "bundleforge",
            key: "is_bundle",
            value: "true",
            type: "boolean",
          },
          {
            namespace: "bundleforge",
            key: "components",
            value: JSON.stringify(componentsPayload),
            type: "json",
          },
          // M-172b — eligibility blob the Cart Transform Function reads.
          {
            namespace: "bundleforge",
            key: "eligibility",
            value: JSON.stringify(bundle.eligibility ?? {}),
            type: "json",
          },
          // M-173b — per-bundle inventory rules the Cart Transform reads.
          {
            namespace: "bundleforge",
            key: "inventory_rules",
            value: JSON.stringify(bundle.inventoryRules ?? {}),
            type: "json",
          },
        ],
      },
    },
  );
  const userErrors = data.productCreate?.userErrors ?? [];
  if (userErrors.length > 0) {
    throw new Error(
      `productCreate userErrors: ${userErrors.map((e) => e.message).join("; ")}`,
    );
  }
  const product = data.productCreate?.product;
  if (!product?.id || !product?.legacyResourceId) {
    throw new Error("productCreate returned no product");
  }
  return {
    shopifyProductGid: product.id,
    shopifyProductId: BigInt(product.legacyResourceId),
  };
};

export function installBundleRoutes(deps: BundleRouteDeps = {}): Router {
  const router = Router();
  const service = deps.service ?? new BundleService();
  const activityRepo = deps.activityRepo ?? bundleActivityRepo;
  const createShopifyProduct =
    deps.createShopifyProduct ?? defaultCreateShopifyProduct;

  function shopIdOr401(req: Request): string {
    if (!req.shopId) throw new UnauthorizedError("No shop context");
    return req.shopId;
  }

  router.get("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const shopId = shopIdOr401(req);
      const params: PaginationParams = {
        page: Number(req.query.page) || undefined,
        limit: Number(req.query.limit) || undefined,
        sortBy: typeof req.query.sortBy === "string" ? req.query.sortBy : undefined,
        sortOrder:
          req.query.sortOrder === "asc" || req.query.sortOrder === "desc"
            ? req.query.sortOrder
            : undefined,
      };
      const filters = {
        status: typeof req.query.status === "string" ? req.query.status : undefined,
        type: typeof req.query.type === "string" ? req.query.type : undefined,
        search: typeof req.query.search === "string" ? req.query.search : undefined,
      };
      res.json(await service.list(shopId, params, filters));
    } catch (err) {
      next(err);
    }
  });

  router.post("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const shopId = shopIdOr401(req);
      res
        .status(201)
        .json(await service.create(shopId, req.body as CreateBundleInput));
    } catch (err) {
      next(err);
    }
  });

  // Bulk routes must be registered before the /:id/* matchers
  // because Express does first-match routing — otherwise
  // POST /bundles/bulk/publish would route to /:id/publish with
  // id="bulk" and 404 inside service.publish.
  interface BulkOutcome {
    succeeded: string[];
    failed: Array<{ id: string; reason: string }>;
  }

  function pickStatus(out: BulkOutcome): number {
    if (out.failed.length === 0) return 200;
    if (out.succeeded.length === 0) return 422;
    return 207;
  }

  router.post(
    "/bulk/publish",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const shopId = shopIdOr401(req);
        const body = BulkBody.parse(req.body);
        const session = (
          res.locals as { shopify?: { session?: Session } }
        ).shopify?.session;
        const opts = session
          ? {
              onCreateProduct: (
                bundle: Parameters<typeof createShopifyProduct>[1],
              ) => createShopifyProduct(session, bundle),
            }
          : {};
        const out: BulkOutcome = { succeeded: [], failed: [] };
        for (const id of body.ids) {
          try {
            await service.publish(shopId, id, opts);
            out.succeeded.push(id);
          } catch (err) {
            out.failed.push({ id, reason: (err as Error).message });
          }
        }
        res.status(pickStatus(out)).json(out);
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    "/bulk/archive",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const shopId = shopIdOr401(req);
        const body = BulkBody.parse(req.body);
        const out: BulkOutcome = { succeeded: [], failed: [] };
        for (const id of body.ids) {
          try {
            await service.archive(shopId, id);
            out.succeeded.push(id);
          } catch (err) {
            out.failed.push({ id, reason: (err as Error).message });
          }
        }
        res.status(pickStatus(out)).json(out);
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    "/bulk/delete",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const shopId = shopIdOr401(req);
        const body = BulkBody.parse(req.body);
        const out: BulkOutcome = { succeeded: [], failed: [] };
        for (const id of body.ids) {
          try {
            await service.softDelete(shopId, id);
            out.succeeded.push(id);
          } catch (err) {
            out.failed.push({ id, reason: (err as Error).message });
          }
        }
        res.status(pickStatus(out)).json(out);
      } catch (err) {
        next(err);
      }
    },
  );

  // Template routes — same /bulk-style ordering rule applies.
  // GET returns the read-only registry; POST instantiates a
  // template into a fresh draft via service.create.
  router.get(
    "/templates",
    (_req: Request, res: Response) => {
      res.json({ data: BUNDLE_TEMPLATES });
    },
  );

  router.post(
    "/templates/:id/instantiate",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const shopId = shopIdOr401(req);
        const template = findTemplate(req.params.id);
        if (!template) {
          throw new NotFoundError("Template");
        }
        const created = (await service.create(shopId, {
          title: template.defaultTitle,
          type: template.type,
          description: template.description,
          config: template.config,
          items: [],
          pricingRules: template.pricingRules,
        })) as { id: string };
        res.status(201).json(created);
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    "/:id/duplicate",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const shopId = shopIdOr401(req);
        res.status(201).json(await service.duplicate(shopId, req.params.id));
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    "/:id/publish",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const shopId = shopIdOr401(req);
        // Pull the Shopify session put on res.locals by
        // validateAuthenticatedSession (M-021). If absent, fall back
        // to the legacy status-flip-only behaviour rather than 500.
        const session = (
          res.locals as { shopify?: { session?: Session } }
        ).shopify?.session;
        const opts = session
          ? {
              onCreateProduct: (bundle: Parameters<typeof createShopifyProduct>[1]) =>
                createShopifyProduct(session, bundle),
            }
          : {};
        res.json(await service.publish(shopId, req.params.id, opts));
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    "/:id/archive",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const shopId = shopIdOr401(req);
        res.json(await service.archive(shopId, req.params.id));
      } catch (err) {
        next(err);
      }
    },
  );

  router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const shopId = shopIdOr401(req);
      res.json(await service.getById(shopId, req.params.id));
    } catch (err) {
      next(err);
    }
  });

  router.get(
    "/:id/activity",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const shopId = shopIdOr401(req);
        // Confirm the bundle is in this shop before exposing log rows.
        await service.getById(shopId, req.params.id);
        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.min(
          100,
          Math.max(1, Number(req.query.limit) || 20),
        );
        const { data, total } = await activityRepo.list(
          shopId,
          req.params.id,
          { page, limit },
        );
        res.json({
          data,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit) || 1,
            hasNext: page * limit < total,
            hasPrev: page > 1,
          },
        });
      } catch (err) {
        next(err);
      }
    },
  );

  router.put("/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const shopId = shopIdOr401(req);
      res.json(
        await service.update(shopId, req.params.id, req.body as Partial<CreateBundleInput>),
      );
    } catch (err) {
      next(err);
    }
  });

  router.delete(
    "/:id",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const shopId = shopIdOr401(req);
        await service.softDelete(shopId, req.params.id);
        res.status(204).send();
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}

/** Default singleton router used by the server. */
export const bundleRoutes = installBundleRoutes();
