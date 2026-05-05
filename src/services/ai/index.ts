/**
 * AI service client (M-126).
 *
 * Calls the Python microservice (ai-service/) over HTTP. The URL +
 * API key are optional in env (env.AI_SERVICE_URL/AI_SERVICE_API_KEY);
 * `enabled()` reports whether the client should be used at all so
 * callers can degrade gracefully when AI isn't configured.
 */
import { env } from "../../config/env";
import { logger } from "../../config/logger";

const aiLogger = logger.child({ module: "ai" });

export interface Recommendation {
  product_id: string;
  support: number;
  confidence: number;
  lift: number;
}

export interface RecommendInput {
  baskets: string[][];
  target: string;
  topN?: number;
}

export type FetchLike = (
  input: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string },
) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;

export interface AiServiceOptions {
  url?: string;
  apiKey?: string;
  fetcher?: FetchLike;
  timeoutMs?: number;
}

function resolveOptions(opts: AiServiceOptions): {
  url: string;
  apiKey: string;
  fetcher: FetchLike;
  timeoutMs: number;
} {
  const url = opts.url ?? env.AI_SERVICE_URL ?? "";
  const apiKey = opts.apiKey ?? env.AI_SERVICE_API_KEY ?? "";
  return {
    url,
    apiKey,
    fetcher: opts.fetcher ?? (fetch as unknown as FetchLike),
    timeoutMs: opts.timeoutMs ?? 5000,
  };
}

export function enabled(opts: AiServiceOptions = {}): boolean {
  const { url, apiKey } = resolveOptions(opts);
  return Boolean(url && apiKey);
}

export async function recommend(
  input: RecommendInput,
  opts: AiServiceOptions = {},
): Promise<Recommendation[]> {
  const { url, apiKey, fetcher, timeoutMs } = resolveOptions(opts);
  if (!url || !apiKey) {
    aiLogger.debug("AI service disabled — returning empty recommendations");
    return [];
  }
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetcher(`${url.replace(/\/$/, "")}/recommendations`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        baskets: input.baskets,
        target: input.target,
        top_n: input.topN ?? 5,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      aiLogger.warn(
        { status: res.status, body, target: input.target },
        "AI /recommendations non-2xx",
      );
      return [];
    }
    const text = await res.text();
    const parsed = JSON.parse(text) as { recommendations?: Recommendation[] };
    return parsed.recommendations ?? [];
  } catch (err) {
    aiLogger.warn({ err }, "AI /recommendations call failed");
    return [];
  } finally {
    clearTimeout(t);
  }
}

export class AiService {
  enabled = (): boolean => enabled();
  recommend = (input: RecommendInput): Promise<Recommendation[]> =>
    recommend(input);
}
