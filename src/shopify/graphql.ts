/**
 * Thin GraphQL Admin API wrapper.
 *
 * Wraps the SDK's GraphQL client with one retry on THROTTLED errors and
 * Pino logging. Domain services should import this, not the SDK directly,
 * so retry/observability is uniform.
 *
 * See docs/specs/M-022-graphql-client.md.
 */
import type { Session } from "@shopify/shopify-api";

import { logger } from "../config/logger";
import { shopify } from "./index";

const gqlLogger = logger.child({ module: "shopify-graphql" });

export interface GraphqlResponse<T> {
  data?: T;
  errors?: Array<{ message: string; extensions?: { code?: string } }>;
}

export interface GraphqlClientLike {
  request<T>(args: {
    data: { query: string; variables?: Record<string, unknown> };
  }): Promise<GraphqlResponse<T>>;
}

export interface GraphqlOptions {
  /** Override the SDK client. Tests pass in a fake. */
  clientFactory?: (session: Session) => GraphqlClientLike;
  /** Override the retry sleep (ms). Tests pass 0 to skip. */
  sleepMs?: number;
}

function isThrottled(resp: GraphqlResponse<unknown>): boolean {
  return Boolean(
    resp.errors?.some(
      (e) => e.extensions?.code === "THROTTLED" || /throttled/i.test(e.message),
    ),
  );
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export async function shopifyGraphql<T>(
  session: Session,
  query: string,
  variables?: Record<string, unknown>,
  opts: GraphqlOptions = {},
): Promise<T> {
  const factory: (s: Session) => GraphqlClientLike =
    opts.clientFactory ??
    ((s) =>
      new shopify.api.clients.Graphql({ session: s }) as unknown as GraphqlClientLike);
  const client = factory(session);
  const sleepMs = opts.sleepMs ?? 1000;

  const attempt = async (): Promise<GraphqlResponse<T>> =>
    client.request<T>({ data: { query, variables } });

  let resp = await attempt();
  if (isThrottled(resp)) {
    gqlLogger.warn({ shop: session.shop }, "GraphQL throttled; retrying once");
    await sleep(sleepMs);
    resp = await attempt();
  }
  if (resp.errors && resp.errors.length > 0) {
    const message = resp.errors.map((e) => e.message).join("; ");
    gqlLogger.error({ shop: session.shop, message }, "GraphQL request failed");
    throw new Error(`Shopify GraphQL: ${message}`);
  }
  if (resp.data === undefined) {
    throw new Error("Shopify GraphQL returned no data");
  }
  return resp.data;
}
