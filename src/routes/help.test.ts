import express, { type Express } from "express";
import { describe, it, expect } from "vitest";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";

import { errorHandler, requestId } from "../middleware/errorHandler";
import { installHelpRoutes } from "./help";

function buildApp(helpDir: string): Express {
  const app = express();
  app.use(requestId);
  app.use(express.json());
  app.use("/help", installHelpRoutes({ helpDir }));
  app.use(errorHandler);
  return app;
}

function makeDir(): string {
  const d = mkdtempSync(join(tmpdir(), "mintbundle-help-"));
  return d;
}

describe("/help/articles (M-181)", () => {
  it("GET /articles returns the list with non-empty titles", async () => {
    const dir = makeDir();
    writeFileSync(
      join(dir, "getting-started.md"),
      "# Getting started\n\nHello.\n",
    );
    writeFileSync(join(dir, "faq.md"), "# FAQ\n\nQ&A.\n");
    const res = await request(buildApp(dir)).get("/help/articles");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(2);
    const titles = res.body.data.map(
      (a: { title: string }) => a.title,
    );
    expect(titles).toContain("Getting started");
    expect(titles).toContain("FAQ");
  });

  it("GET /articles/:id returns the markdown body", async () => {
    const dir = makeDir();
    writeFileSync(
      join(dir, "pricing.md"),
      "# Pricing\n\nLine 1.\nLine 2.\n",
    );
    const res = await request(buildApp(dir)).get(
      "/help/articles/pricing",
    );
    expect(res.status).toBe(200);
    expect(res.body.id).toBe("pricing");
    expect(res.body.title).toBe("Pricing");
    expect(res.body.body).toContain("Line 1.");
    expect(res.body.body).toContain("Line 2.");
  });

  it("GET /articles/does-not-exist → 404", async () => {
    const dir = makeDir();
    writeFileSync(join(dir, "real.md"), "# Real\n");
    const res = await request(buildApp(dir)).get(
      "/help/articles/does-not-exist",
    );
    expect(res.status).toBe(404);
  });

  it("rejects path-traversal attempts via the id param", async () => {
    const dir = makeDir();
    // Create a sibling directory the attacker would try to reach.
    const sibling = `${dir}-sibling`;
    mkdirSync(sibling, { recursive: true });
    writeFileSync(join(sibling, "secret.md"), "# Secret\n");

    // Anything outside [a-z0-9-] is rejected before the
    // filesystem is touched. Test the regex-rejected cases
    // (without URL-encoding, since express normalizes the URL
    // before it reaches the router).
    const badIds = [
      "etc%2Fpasswd",       // literal % in id — fails regex
      "...",                // dots fail regex
      "name with space",    // space → fails after express parses
      "Mixed_case",         // underscore — fails regex
    ];
    for (const id of badIds) {
      const res = await request(buildApp(dir)).get(
        `/help/articles/${id}`,
      );
      expect(res.status).toBe(404);
    }
  });

  it("uses the static category map (getting-started → 'Getting started')", async () => {
    const dir = makeDir();
    writeFileSync(
      join(dir, "getting-started.md"),
      "# Getting started\n",
    );
    const res = await request(buildApp(dir)).get("/help/articles");
    expect(res.status).toBe(200);
    expect(res.body.data[0].category).toBe("Getting started");
  });
});
