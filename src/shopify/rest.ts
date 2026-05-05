/**
 * REST Admin API wrapper. Companion to src/shopify/graphql.ts (M-022).
 * Used only for endpoints without a GraphQL equivalent.
 *
 * See docs/specs/M-023-rest-client.md.
 */
import type { Session } from "@shopify/shopify-api";

import { logger } from "../config/logger";
import { shopify } from "./index";

const restLogger = logger.child({ module: "shopify-rest" });

export interface RestRequestArgs {
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  query?: Record<string, string | number>;
  body?: unknown;
}

export interface RestResponseLike<T> {
  statusCode: number;
  body: T;
  headers?: Record<string, string>;
}

export interface RestClientLike {
  get<T>(args: { path: string; query?: Record<string, string | number> }): Promise<RestResponseLike<T>>;
  post<T>(args: { path: string; data?: unknown; query?: Record<string, string | number> }): Promise<RestResponseLike<T>>;
  put<T>(args: { path: string; data?: unknown; query?: Record<string, string | number> }): Promise<RestResponseLike<T>>;
  delete<T>(args: { path: string; query?: Record<string, string | number> }): Promise<RestResponseLike<T>>;
}

export interface RestOptions {
  clientFactory?: (session: Session) => RestClientLike;
  sleepMs?: number;
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export async function shopifyRest<T>(
  session: Session,
  args: RestRequestArgs,
  opts: RestOptions = {},
): Promise<T> {
  const factory: (s: Session) => RestClientLike =
    opts.clientFactory ??
    ((s) =>
      new shopify.api.clients.Rest({ session: s }) as unknown as RestClientLike);
  const client = factory(session);
  const sleepMs = opts.sleepMs ?? 1000;

  const call = async (): Promise<RestResponseLike<T>> => {
    switch (args.method) {
      case "GET":
        return client.get<T>({ path: args.path, query: args.query });
      case "POST":
        return client.post<T>({ path: args.path, data: args.body, query: args.query });
      case "PUT":
        return client.put<T>({ path: args.path, data: args.body, query: args.query });
      case "DELETE":
        return client.delete<T>({ path: args.path, query: args.query });
    }
  };

  let resp: RestResponseLike<T>;
  try {
    resp = await call();
  } catch (err) {
    // SDK throws on 4xx/5xx in some configurations; bubble up.
    throw err;
  }
  if (resp.statusCode === 429) {
    restLogger.warn({ shop: session.shop, path: args.path }, "REST 429; retrying once");
    await sleep(sleepMs);
    resp = await call();
  }
  if (resp.statusCode >= 400) {
    throw new Error(`Shopify REST ${args.method} ${args.path} → ${resp.statusCode}`);
  }
  return resp.body;
}
