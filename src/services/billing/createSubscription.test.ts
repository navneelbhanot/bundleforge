import { describe, it, expect, vi } from "vitest";
import type { Session } from "@shopify/shopify-api";

import { createSubscription } from "./createSubscription";

const session = { shop: "demo.myshopify.com" } as unknown as Session;

interface FakeUpsertArgs {
  where: { shopId: string };
  update: Record<string, unknown>;
  create: Record<string, unknown>;
}

function fakeGraphql(response: unknown): typeof import("../../shopify/graphql").shopifyGraphql {
  return (async () => response) as unknown as typeof import("../../shopify/graphql").shopifyGraphql;
}

interface CapturedCall {
  variables: Record<string, unknown>;
}

function capturingGraphql(
  response: unknown,
  captured: CapturedCall,
): typeof import("../../shopify/graphql").shopifyGraphql {
  return (async (_session, _query, variables) => {
    captured.variables = variables ?? {};
    return response;
  }) as unknown as typeof import("../../shopify/graphql").shopifyGraphql;
}

describe("createSubscription", () => {
  it("issues mutation and persists pending subscription with monthly interval", async () => {
    const upsert = vi.fn().mockResolvedValue({});
    const result = await createSubscription({
      session,
      shopId: "shop-uuid",
      plan: "growth",
      interval: "monthly",
      returnUrl: "https://app.example.com/billing/return",
      graphql: fakeGraphql({
        appSubscriptionCreate: {
          appSubscription: { id: "gid://shopify/AppSubscription/1", status: "PENDING" },
          confirmationUrl: "https://shopify.com/auth",
          userErrors: [],
        },
      }),
      client: { upsert },
    });
    expect(result.confirmationUrl).toBe("https://shopify.com/auth");
    expect(result.chargeId).toBe("gid://shopify/AppSubscription/1");
    expect(upsert).toHaveBeenCalledTimes(1);
    const call = upsert.mock.calls[0][0] as FakeUpsertArgs;
    expect(call.where.shopId).toBe("shop-uuid");
    expect(call.create.planName).toBe("growth");
    expect(call.create.billingInterval).toBe("monthly");
    expect(call.create.status).toBe("pending");
    expect(call.create.price).toBe(12); // growth monthly
  });

  it("serializes price.amount as a string Decimal (Shopify rejects numbers with HTTP 400)", async () => {
    // Regression: Shopify's MoneyInput.amount is a Decimal scalar
    // and must be sent as "12.00" / "115.00" / etc. — not 12 / 115.
    // Sending a JSON number triggers HTTP 400 with an empty body
    // at Shopify's GraphQL endpoint.
    const captured: CapturedCall = { variables: {} };
    await createSubscription({
      session,
      shopId: "shop-uuid",
      plan: "growth",
      interval: "monthly",
      returnUrl: "https://app.example.com/billing/return",
      graphql: capturingGraphql(
        {
          appSubscriptionCreate: {
            appSubscription: { id: "gid://A/1", status: "PENDING" },
            confirmationUrl: "https://x",
            userErrors: [],
          },
        },
        captured,
      ),
      client: { upsert: vi.fn().mockResolvedValue({}) },
    });
    const lineItems = captured.variables.lineItems as Array<{
      plan: {
        appRecurringPricingDetails: {
          price: { amount: unknown; currencyCode: string };
        };
      };
    }>;
    const price = lineItems[0].plan.appRecurringPricingDetails.price;
    expect(typeof price.amount).toBe("string");
    expect(price.amount).toBe("12.00");
    expect(price.currencyCode).toBe("USD");
  });

  it("uses annual price for annual interval", async () => {
    const upsert = vi.fn().mockResolvedValue({});
    await createSubscription({
      session,
      shopId: "s",
      plan: "pro",
      interval: "annual",
      returnUrl: "https://x.com/r",
      graphql: fakeGraphql({
        appSubscriptionCreate: {
          appSubscription: { id: "gid://A/1", status: "PENDING" },
          confirmationUrl: "https://x",
          userErrors: [],
        },
      }),
      client: { upsert },
    });
    const call = upsert.mock.calls[0][0] as FakeUpsertArgs;
    // Pro annual = round(35*12*0.8) = 336
    expect(call.create.price).toBe(336);
    expect(call.create.billingInterval).toBe("annual");
  });

  it("throws on userErrors", async () => {
    await expect(
      createSubscription({
        session,
        shopId: "s",
        plan: "growth",
        interval: "monthly",
        returnUrl: "https://x.com/r",
        graphql: fakeGraphql({
          appSubscriptionCreate: {
            appSubscription: null,
            confirmationUrl: null,
            userErrors: [{ field: ["lineItems"], message: "Missing line item" }],
          },
        }),
        client: { upsert: vi.fn() },
      }),
    ).rejects.toThrow(/Missing line item/);
  });

  it("rejects starter plan (free)", async () => {
    await expect(
      createSubscription({
        session,
        shopId: "s",
        plan: "starter",
        interval: "monthly",
        returnUrl: "https://x.com/r",
        graphql: fakeGraphql({}),
        client: { upsert: vi.fn() },
      }),
    ).rejects.toThrow(/starter is free/);
  });
});
