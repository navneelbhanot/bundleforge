import { describe, it, expect, vi } from "vitest";
import { createHmac } from "node:crypto";

import {
  processOutboundWebhookJob,
  type ProcessDeps,
  type WebhookRow,
} from "./outboundWebhooks";

function makeDeps(
  row: WebhookRow | null,
  fetchImpl: ReturnType<typeof vi.fn>,
  decryptFn = (_: string) => "secret-plain",
): ProcessDeps & {
  findUnique: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  fetchImpl: typeof fetchImpl;
} {
  const findUnique = vi.fn().mockResolvedValue(row);
  const update = vi.fn().mockResolvedValue(undefined);
  return {
    client: {
      outboundWebhook: { findUnique, update },
    } as unknown as ProcessDeps["client"],
    decryptFn,
    fetchFn: fetchImpl as unknown as typeof fetch,
    findUnique,
    update,
    fetchImpl,
  };
}

const ROW: WebhookRow = {
  id: "w-1",
  url: "https://merchant.example/hook",
  hmacSecret: "encrypted",
  failCount: 0,
  disabledAt: null,
};

function okResponse(status = 200): Response {
  return new Response("", { status });
}

describe("processOutboundWebhookJob (M-168b)", () => {
  it("computes HMAC-SHA256 of the body using the decrypted secret", async () => {
    const captured: { body?: BodyInit | null; headers?: Record<string, string> } = {};
    const fetchImpl = vi.fn(async (_url, init?: RequestInit) => {
      captured.body = init?.body ?? null;
      captured.headers = (init?.headers ?? {}) as Record<string, string>;
      return okResponse();
    });
    const deps = makeDeps(ROW, fetchImpl);
    await processOutboundWebhookJob(
      {
        webhookId: "w-1",
        event: "bundle.published",
        payload: { id: "b-1", title: "X" },
      },
      deps,
    );
    const body = String(captured.body);
    const expected = createHmac("sha256", "secret-plain")
      .update(body)
      .digest("hex");
    expect(captured.headers!["X-BundleForge-Signature"]).toBe(`sha256=${expected}`);
  });

  it("on 200 success: increments lastFiredAt + resets failCount", async () => {
    const deps = makeDeps(ROW, vi.fn().mockResolvedValue(okResponse()));
    await processOutboundWebhookJob(
      { webhookId: "w-1", event: "bundle.published", payload: {} },
      deps,
    );
    const updateArgs = deps.update.mock.calls[0][0];
    expect(updateArgs.data.failCount).toBe(0);
    expect(updateArgs.data.lastFiredAt).toBeInstanceOf(Date);
  });

  it("on 500: throws (BullMQ retries) and increments failCount", async () => {
    const deps = makeDeps(ROW, vi.fn().mockResolvedValue(okResponse(500)));
    await expect(
      processOutboundWebhookJob(
        { webhookId: "w-1", event: "bundle.published", payload: {} },
        deps,
      ),
    ).rejects.toThrow();
    const updateArgs = deps.update.mock.calls[0][0];
    expect(updateArgs.data.failCount).toBe(1);
  });

  it("on 400: returns without throwing, increments failCount", async () => {
    const deps = makeDeps(ROW, vi.fn().mockResolvedValue(okResponse(400)));
    const result = await processOutboundWebhookJob(
      { webhookId: "w-1", event: "bundle.published", payload: {} },
      deps,
    );
    expect(result.status).toBe(400);
    expect(deps.update.mock.calls[0][0].data.failCount).toBe(1);
  });

  it("auto-disables after 10 consecutive failures", async () => {
    const row: WebhookRow = { ...ROW, failCount: 9 };
    const deps = makeDeps(row, vi.fn().mockResolvedValue(okResponse(500)));
    await expect(
      processOutboundWebhookJob(
        { webhookId: "w-1", event: "bundle.published", payload: {} },
        deps,
      ),
    ).rejects.toThrow();
    const updateArgs = deps.update.mock.calls[0][0];
    expect(updateArgs.data.failCount).toBe(10);
    expect(updateArgs.data.disabledAt).toBeInstanceOf(Date);
  });

  it("missing webhook row → returns 410, no update", async () => {
    const deps = makeDeps(null, vi.fn());
    const result = await processOutboundWebhookJob(
      { webhookId: "missing", event: "bundle.published", payload: {} },
      deps,
    );
    expect(result.status).toBe(410);
    expect(deps.update).not.toHaveBeenCalled();
  });

  it("disabled webhook → returns 410, no fetch, no update", async () => {
    const deps = makeDeps(
      { ...ROW, disabledAt: new Date() },
      vi.fn(),
    );
    const result = await processOutboundWebhookJob(
      { webhookId: "w-1", event: "bundle.published", payload: {} },
      deps,
    );
    expect(result.status).toBe(410);
    expect(deps.fetchImpl).not.toHaveBeenCalled();
    expect(deps.update).not.toHaveBeenCalled();
  });

  it("network error: bumps failCount and rethrows", async () => {
    const deps = makeDeps(ROW, vi.fn().mockRejectedValue(new Error("ECONNRESET")));
    await expect(
      processOutboundWebhookJob(
        { webhookId: "w-1", event: "bundle.published", payload: {} },
        deps,
      ),
    ).rejects.toThrow(/ECONNRESET/);
    expect(deps.update.mock.calls[0][0].data.failCount).toBe(1);
  });
});
