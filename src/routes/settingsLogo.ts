/**
 * /api/v1/settings/logo — Shopify Files upload route (M-167b).
 *
 * Three-step flow:
 *  1. stagedUploadsCreate → presigned PUT URL + parameters
 *  2. PUT the file bytes to the staged target
 *  3. fileCreate → persisted file in Shopify's CDN
 *
 * Then poll fileStatus until READY (or fall back to the
 * preview URL after 5s). Returns the CDN URL for the
 * caller to write into settings.general.logoUrl.
 *
 * Body: { filename, mimeType, dataBase64 } — base64 keeps
 * the server free of multer/busboy. Logos are small (cap
 * 2 MiB).
 */
import {
  Router,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import type { Session } from "@shopify/shopify-api";
import { z } from "zod";

import { logger } from "../config/logger";
import {
  UnauthorizedError,
  ValidationError,
} from "../middleware/errorHandler";
import { shopifyGraphql } from "../shopify/graphql";

const log = logger.child({ module: "settings-logo" });

const ALLOWED_MIMES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
]);
const MAX_BYTES = 2 * 1024 * 1024;

const LogoBody = z
  .object({
    filename: z.string().min(1).max(200),
    mimeType: z.string().min(1).max(80),
    dataBase64: z.string().min(1),
  })
  .strict();

const STAGED_UPLOADS_CREATE = `#graphql
  mutation MintBundleStagedUpload($input: [StagedUploadInput!]!) {
    stagedUploadsCreate(input: $input) {
      stagedTargets {
        url
        resourceUrl
        parameters { name value }
      }
      userErrors { field message }
    }
  }
`;

const FILE_CREATE = `#graphql
  mutation MintBundleFileCreate($files: [FileCreateInput!]!) {
    fileCreate(files: $files) {
      files {
        id
        fileStatus
        ... on MediaImage {
          image { url }
          preview { image { url } }
        }
      }
      userErrors { field message }
    }
  }
`;

const FILE_QUERY = `#graphql
  query MintBundleFile($id: ID!) {
    node(id: $id) {
      ... on MediaImage {
        id
        fileStatus
        image { url }
        preview { image { url } }
      }
    }
  }
`;

interface StagedTarget {
  url: string;
  resourceUrl: string;
  parameters: Array<{ name: string; value: string }>;
}

interface StagedUploadsResponse {
  stagedUploadsCreate?: {
    stagedTargets?: StagedTarget[];
    userErrors?: Array<{ field?: string[]; message: string }>;
  };
}

interface FileCreateResponse {
  fileCreate?: {
    files?: Array<{
      id: string;
      fileStatus: "UPLOADED" | "PROCESSING" | "READY" | "FAILED";
      image?: { url: string } | null;
      preview?: { image?: { url: string } | null } | null;
    }>;
    userErrors?: Array<{ field?: string[]; message: string }>;
  };
}

interface FileNodeResponse {
  node?: {
    id: string;
    fileStatus: "UPLOADED" | "PROCESSING" | "READY" | "FAILED";
    image?: { url: string } | null;
    preview?: { image?: { url: string } | null } | null;
  } | null;
}

export interface SettingsLogoDeps {
  /** DI seam for the Shopify GraphQL caller. */
  shopifyGraphqlImpl?: typeof shopifyGraphql;
  /** DI seam for the staged-upload PUT. Tests stub. */
  uploadFn?: (
    target: StagedTarget,
    body: Buffer,
    contentType: string,
  ) => Promise<void>;
  /** Override the polling sleep (ms); tests pass 0. */
  pollSleepMs?: number;
  /** Override max attempts. */
  maxPollAttempts?: number;
}

async function defaultUploadFn(
  target: StagedTarget,
  body: Buffer,
  contentType: string,
): Promise<void> {
  // Shopify's staged target uses a PUT or POST depending on
  // configuration. With httpMethod: PUT in stagedUploadsCreate,
  // we PUT the bytes to `url` with the supplied parameters as
  // headers.
  const headers: Record<string, string> = {
    "Content-Type": contentType,
    "Content-Length": String(body.byteLength),
  };
  for (const p of target.parameters) {
    headers[p.name] = p.value;
  }
  const res = await fetch(target.url, {
    method: "PUT",
    body: new Uint8Array(body),
    headers,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`staged upload PUT failed: ${res.status} ${text}`);
  }
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export function installSettingsLogoRoutes(
  deps: SettingsLogoDeps = {},
): Router {
  const router = Router();
  const graphql = deps.shopifyGraphqlImpl ?? shopifyGraphql;
  const upload = deps.uploadFn ?? defaultUploadFn;
  const pollSleepMs = deps.pollSleepMs ?? 1000;
  const maxAttempts = deps.maxPollAttempts ?? 5;

  router.post(
    "/logo",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.shopId) {
          throw new UnauthorizedError("No shop context");
        }
        const session = (
          res.locals as { shopify?: { session?: Session } }
        ).shopify?.session;
        if (!session) {
          throw new UnauthorizedError("No Shopify session");
        }
        const body = LogoBody.parse(req.body);
        if (!ALLOWED_MIMES.has(body.mimeType)) {
          throw new ValidationError(
            `Unsupported mimeType. Allowed: ${[...ALLOWED_MIMES].join(", ")}`,
          );
        }
        const buf = Buffer.from(body.dataBase64, "base64");
        if (buf.byteLength === 0) {
          throw new ValidationError("dataBase64 decoded to 0 bytes");
        }
        if (buf.byteLength > MAX_BYTES) {
          throw new ValidationError(
            `File too large. Max ${MAX_BYTES} bytes; got ${buf.byteLength}.`,
          );
        }

        // Step 1: stagedUploadsCreate.
        const staged = await graphql<StagedUploadsResponse>(session, STAGED_UPLOADS_CREATE, {
          input: [
            {
              filename: body.filename,
              mimeType: body.mimeType,
              resource: "IMAGE",
              fileSize: String(buf.byteLength),
              httpMethod: "PUT",
            },
          ],
        });
        const target = staged.stagedUploadsCreate?.stagedTargets?.[0];
        if (!target) {
          const errs = staged.stagedUploadsCreate?.userErrors ?? [];
          throw new Error(
            `stagedUploadsCreate failed: ${errs.map((e) => e.message).join(", ") || "no staged target"}`,
          );
        }

        // Step 2: PUT to staged URL.
        await upload(target, buf, body.mimeType);

        // Step 3: fileCreate.
        const created = await graphql<FileCreateResponse>(session, FILE_CREATE, {
          files: [
            {
              originalSource: target.resourceUrl,
              contentType: "IMAGE",
              alt: body.filename,
            },
          ],
        });
        const file = created.fileCreate?.files?.[0];
        if (!file?.id) {
          const errs = created.fileCreate?.userErrors ?? [];
          throw new Error(
            `fileCreate failed: ${errs.map((e) => e.message).join(", ") || "no file"}`,
          );
        }

        // Poll until READY (or fall back to preview).
        let url: string | undefined =
          file.fileStatus === "READY" ? file.image?.url : undefined;
        let lastNode: FileNodeResponse["node"] | null | undefined = file;
        for (let i = 0; !url && i < maxAttempts; i += 1) {
          await sleep(pollSleepMs);
          const polled = await graphql<FileNodeResponse>(session, FILE_QUERY, {
            id: file.id,
          });
          lastNode = polled.node;
          if (polled.node?.fileStatus === "READY") {
            url = polled.node.image?.url ?? undefined;
            break;
          }
          if (polled.node?.fileStatus === "FAILED") {
            throw new Error("fileCreate ended in FAILED status");
          }
        }
        if (!url) {
          // Fall back to the preview URL — Shopify resizes async
          // but the preview is usually available immediately.
          url = lastNode?.preview?.image?.url ?? undefined;
        }
        if (!url) {
          log.warn(
            { fileId: file.id, shopId: req.shopId },
            "Logo upload timed out without a usable URL",
          );
          res.status(504).json({
            error: "Logo file is still processing. Try again in a moment.",
          });
          return;
        }
        res.json({ url, fileId: file.id });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}

export const settingsLogoRoutes = installSettingsLogoRoutes();
