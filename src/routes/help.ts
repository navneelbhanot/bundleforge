/**
 * /api/v1/help routes (M-181).
 *
 * Serves the markdown library that lives in `docs/help/*.md`
 * to the in-app HelpDrawer. Articles are read once at startup
 * (or on first request) and cached in memory.
 *
 * Path traversal protection: `id` is restricted to
 * `[a-z0-9-]+` so the regex itself rules out `..` segments
 * before any filesystem access happens.
 */
import { Router, type Request, type Response, type NextFunction } from "express";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

import { NotFoundError } from "../middleware/errorHandler";

const ID_RE = /^[a-z0-9-]+$/i;

const CATEGORY_MAP: Record<string, string> = {
  "getting-started": "Getting started",
  "bundle-types": "Bundles",
  pricing: "Bundles",
  inventory: "Operations",
  storefront: "Operations",
  troubleshooting: "Troubleshooting",
  faq: "Reference",
  "why-bundleforge": "Reference",
  README: "Reference",
};

export interface HelpArticle {
  id: string;
  title: string;
  category: string;
  body: string;
}

export interface HelpDeps {
  /** Override the help directory for tests. */
  helpDir?: string;
}

function resolveHelpDir(override?: string): string {
  if (override) return resolve(override);
  // From `src/routes/help.ts`, the repo root is two `..` up.
  // In production (compiled via tsx) the file resolves the
  // same way because tsx preserves the source layout.
  return resolve(__dirname, "..", "..", "docs", "help");
}

function extractTitle(body: string, fallback: string): string {
  for (const line of body.split("\n")) {
    const m = /^#\s+(.+)$/.exec(line.trim());
    if (m) return m[1].trim();
  }
  return fallback;
}

export function loadArticles(dir: string): HelpArticle[] {
  let files: string[];
  try {
    files = readdirSync(dir);
  } catch {
    return [];
  }
  const out: HelpArticle[] = [];
  for (const file of files) {
    if (!file.endsWith(".md")) continue;
    const id = file.replace(/\.md$/, "");
    if (!ID_RE.test(id)) continue;
    let body: string;
    try {
      body = readFileSync(join(dir, file), "utf8");
    } catch {
      continue;
    }
    out.push({
      id,
      title: extractTitle(body, id),
      category: CATEGORY_MAP[id] ?? "Reference",
      body,
    });
  }
  // Sort by category then title for stable list order.
  out.sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    return a.title.localeCompare(b.title);
  });
  return out;
}

export function installHelpRoutes(deps: HelpDeps = {}): Router {
  const router = Router();
  const helpDir = resolveHelpDir(deps.helpDir);
  let cache: HelpArticle[] | null = null;

  function articles(): HelpArticle[] {
    if (cache) return cache;
    cache = loadArticles(helpDir);
    return cache;
  }

  router.get(
    "/articles",
    (_req: Request, res: Response) => {
      const list = articles().map((a) => ({
        id: a.id,
        title: a.title,
        category: a.category,
      }));
      res.json({ data: list });
    },
  );

  router.get(
    "/articles/:id",
    (req: Request, res: Response, next: NextFunction) => {
      try {
        const id = req.params.id;
        if (!ID_RE.test(id)) {
          // Reject anything outside [a-z0-9-] before touching disk.
          throw new NotFoundError("Article");
        }
        const article = articles().find((a) => a.id === id);
        if (!article) {
          throw new NotFoundError("Article");
        }
        res.json(article);
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}

export const helpRoutes = installHelpRoutes();
