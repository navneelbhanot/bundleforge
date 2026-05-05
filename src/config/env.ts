/**
 * Environment configuration — single source of truth for process env.
 *
 * Validation is lazy: importing this module does not call validate().
 * The first read of `env.<key>` triggers loadEnv(); on failure it throws
 * EnvValidationError. The Express entry point catches and exits cleanly.
 *
 * See docs/specs/M-001-env-bootstrap.md for the contract.
 */
import "dotenv/config";

import { z } from "zod";

const HEX_64 = /^[0-9a-fA-F]{64}$/;

export const envSchema = z
  .object({
    SHOPIFY_API_KEY: z.string().min(1),
    SHOPIFY_API_SECRET: z.string().min(1),
    SHOPIFY_SCOPES: z.string().min(1),
    SHOPIFY_APP_URL: z.string().url(),
    SHOPIFY_AUTH_CALLBACK_PATH: z
      .string()
      .startsWith("/", "Must start with '/'")
      .default("/api/auth/callback"),

    DATABASE_URL: z
      .string()
      .min(1)
      .refine(
        (v) => v.startsWith("postgres://") || v.startsWith("postgresql://"),
        { message: "Must be a postgres:// or postgresql:// URL" },
      ),
    REDIS_URL: z
      .string()
      .min(1)
      .refine((v) => v.startsWith("redis://") || v.startsWith("rediss://"), {
        message: "Must be a redis:// or rediss:// URL",
      }),

    ENCRYPTION_KEY: z
      .string()
      .regex(
        HEX_64,
        "Must be exactly 64 hex characters (32 bytes). Generate with: openssl rand -hex 32",
      ),

    AI_SERVICE_URL: z.string().url().optional(),
    AI_SERVICE_API_KEY: z.string().min(1).optional(),

    SENTRY_DSN: z.string().min(1).optional(),

    // Optional Crisp live-chat website ID. When set, the embedded admin
    // injects the Crisp widget so merchants can talk to support without
    // leaving the app. Provision at https://app.crisp.chat -> Settings
    // -> Website ID. Free tier is fine for the smoke-test stage.
    CRISP_WEBSITE_ID: z.string().min(1).optional(),

    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
    PORT: z.coerce.number().int().positive().default(3000),
    LOG_LEVEL: z.enum(["error", "warn", "info", "debug"]).default("info"),
    APP_NAME: z.string().min(1).default("BundleForge"),
    APP_VERSION: z.string().min(1).default("0.1.0"),
  })
  .superRefine((data, ctx) => {
    const aiUrlSet = data.AI_SERVICE_URL !== undefined;
    const aiKeySet = data.AI_SERVICE_API_KEY !== undefined;
    if (aiUrlSet !== aiKeySet) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [aiUrlSet ? "AI_SERVICE_API_KEY" : "AI_SERVICE_URL"],
        message:
          "AI_SERVICE_URL and AI_SERVICE_API_KEY must be set together (both or neither)",
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

export class EnvValidationError extends Error {
  public readonly issues: z.ZodIssue[];

  constructor(issues: z.ZodIssue[]) {
    const lines = issues.map(
      (i) => `  ${i.path.join(".") || "(root)"}: ${i.message}`,
    );
    super(`Invalid environment configuration:\n${lines.join("\n")}`);
    this.name = "EnvValidationError";
    this.issues = issues;
  }
}

/**
 * Validate the given env source (defaults to process.env) and return a typed
 * Env object. Throws EnvValidationError on any schema failure.
 */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    throw new EnvValidationError(result.error.issues);
  }
  return result.data;
}

let cached: Env | undefined;

function getEnv(): Env {
  if (cached === undefined) {
    cached = loadEnv();
  }
  return cached;
}

/**
 * Test-only: clear the lazy cache so the next access re-runs validation.
 * Not part of the production contract.
 */
export function _resetEnvForTesting(): void {
  cached = undefined;
}

/**
 * The validated env object. First property access triggers validation.
 * Implemented as a Proxy so that importing this module never throws.
 */
export const env: Env = new Proxy({} as Env, {
  get(_target, key: string | symbol): unknown {
    return Reflect.get(getEnv(), key);
  },
  has(_target, key: string | symbol): boolean {
    return Reflect.has(getEnv(), key);
  },
  ownKeys(): ArrayLike<string | symbol> {
    return Reflect.ownKeys(getEnv());
  },
  getOwnPropertyDescriptor(
    _target,
    key: string | symbol,
  ): PropertyDescriptor | undefined {
    return Reflect.getOwnPropertyDescriptor(getEnv(), key);
  },
});
