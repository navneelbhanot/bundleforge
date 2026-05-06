import { describe, it, expect, vi } from "vitest";

import {
  dispatchOutboundEvent,
  type DispatcherDeps,
} from "./dispatcher";

function makeDeps(rows: Array<{ id: string; events: string[] }> = []): DispatcherDeps & {
  enqueue: ReturnType<typeof vi.fn>;
  findMany: ReturnType<typeof vi.fn>;
} {
  const findMany = vi.fn().mockResolvedValue(rows);
  const enqueue = vi.fn().mockResolvedValue(undefined);
  return {
    client: {
      outboundWebhook: { findMany },
    } as unknown as DispatcherDeps["client"],
    enqueue,
    findMany,
  };
}

describe("dispatchOutboundEvent (M-168b)", () => {
  it("enqueues one job per matching webhook", async () => {
    const deps = makeDeps([
      { id: "w-1", events: ["bundle.published"] },
      { id: "w-2", events: ["bundle.published", "bundle.archived"] },
    ]);
    await dispatchOutboundEvent(
      {
        shopId: "shop-1",
        event: "bundle.published",
        payload: { id: "b-1", title: "X" },
      },
      deps,
    );
    expect(deps.enqueue).toHaveBeenCalledTimes(2);
    expect(deps.enqueue.mock.calls[0][1].webhookId).toBe("w-1");
    expect(deps.enqueue.mock.calls[1][1].webhookId).toBe("w-2");
    expect(deps.enqueue.mock.calls[0][1].event).toBe("bundle.published");
  });

  it("scopes findMany to enabled webhooks subscribed to the event", async () => {
    const deps = makeDeps([]);
    await dispatchOutboundEvent(
      {
        shopId: "shop-2",
        event: "bundle.archived",
        payload: {},
      },
      deps,
    );
    expect(deps.findMany).toHaveBeenCalledWith({
      where: {
        shopId: "shop-2",
        disabledAt: null,
        events: { has: "bundle.archived" },
      },
      select: { id: true, events: true },
    });
  });

  it("swallows DB errors", async () => {
    const findMany = vi.fn().mockRejectedValue(new Error("db down"));
    const enqueue = vi.fn();
    const deps: DispatcherDeps = {
      client: {
        outboundWebhook: { findMany },
      } as unknown as DispatcherDeps["client"],
      enqueue,
    };
    await expect(
      dispatchOutboundEvent(
        {
          shopId: "shop-3",
          event: "order.dispatched",
          payload: {},
        },
        deps,
      ),
    ).resolves.toBeUndefined();
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("swallows per-row enqueue errors and continues with siblings", async () => {
    const deps = makeDeps([
      { id: "w-fail", events: ["bundle.published"] },
      { id: "w-ok", events: ["bundle.published"] },
    ]);
    deps.enqueue
      .mockRejectedValueOnce(new Error("queue full"))
      .mockResolvedValueOnce(undefined);
    await dispatchOutboundEvent(
      {
        shopId: "shop-4",
        event: "bundle.published",
        payload: {},
      },
      deps,
    );
    expect(deps.enqueue).toHaveBeenCalledTimes(2);
  });
});
