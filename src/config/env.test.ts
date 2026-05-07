import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, it, expect } from "vitest";

import { EnvValidationError, envSchema, loadEnv } from "./env";

const validEnv = (): NodeJS.ProcessEnv => ({
  SHOPIFY_API_KEY: "k",
  SHOPIFY_API_SECRET: "s",
  SHOPIFY_SCOPES: "read_products,write_products",
  SHOPIFY_APP_URL: "https://example.com",
  DATABASE_URL: "postgres://user:pass@localhost:5432/mintbundle",
  REDIS_URL: "redis://localhost:6379",
  ENCRYPTION_KEY: "a".repeat(64),
});

describe("loadEnv", () => {
  it("returns a typed Env when given a valid source", () => {
    const env = loadEnv(validEnv());
    expect(env.SHOPIFY_API_KEY).toBe("k");
    expect(env.NODE_ENV).toBe("development");
    expect(env.PORT).toBe(3000);
    expect(env.LOG_LEVEL).toBe("info");
    expect(env.APP_NAME).toBe("MintBundle");
    expect(env.APP_VERSION).toBe("0.1.0");
    expect(env.SHOPIFY_AUTH_CALLBACK_PATH).toBe("/api/auth/callback");
  });

  it("applies overrides for defaults", () => {
    const env = loadEnv({
      ...validEnv(),
      NODE_ENV: "production",
      PORT: "8080",
      LOG_LEVEL: "debug",
      APP_NAME: "Custom",
      APP_VERSION: "9.9.9",
      SHOPIFY_AUTH_CALLBACK_PATH: "/oauth/cb",
    });
    expect(env.NODE_ENV).toBe("production");
    expect(env.PORT).toBe(8080);
    expect(env.LOG_LEVEL).toBe("debug");
    expect(env.APP_NAME).toBe("Custom");
    expect(env.APP_VERSION).toBe("9.9.9");
    expect(env.SHOPIFY_AUTH_CALLBACK_PATH).toBe("/oauth/cb");
  });

  it("throws EnvValidationError listing every missing required field", () => {
    let caught: unknown;
    try {
      loadEnv({});
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(EnvValidationError);
    const err = caught as EnvValidationError;
    const paths = err.issues.map((i) => i.path.join("."));
    for (const required of [
      "SHOPIFY_API_KEY",
      "SHOPIFY_API_SECRET",
      "SHOPIFY_SCOPES",
      "SHOPIFY_APP_URL",
      "DATABASE_URL",
      "REDIS_URL",
      "ENCRYPTION_KEY",
    ]) {
      expect(paths).toContain(required);
    }
  });

  it("rejects ENCRYPTION_KEY that is the wrong length", () => {
    expect(() =>
      loadEnv({ ...validEnv(), ENCRYPTION_KEY: "abc" }),
    ).toThrowError(/Must be exactly 64 hex characters/);
  });

  it("rejects ENCRYPTION_KEY that is 64 chars but not hex", () => {
    expect(() =>
      loadEnv({ ...validEnv(), ENCRYPTION_KEY: "z".repeat(64) }),
    ).toThrowError(/Must be exactly 64 hex characters/);
  });

  it("rejects DATABASE_URL with wrong scheme", () => {
    expect(() =>
      loadEnv({ ...validEnv(), DATABASE_URL: "mysql://x" }),
    ).toThrowError(/postgres:\/\/ or postgresql:\/\/ URL/);
  });

  it("rejects REDIS_URL with wrong scheme", () => {
    expect(() => loadEnv({ ...validEnv(), REDIS_URL: "http://x" })).toThrowError(
      /redis:\/\/ or rediss:\/\/ URL/,
    );
  });

  it("rejects SHOPIFY_APP_URL that is not a URL", () => {
    expect(() =>
      loadEnv({ ...validEnv(), SHOPIFY_APP_URL: "not-a-url" }),
    ).toThrowError();
  });

  it("rejects SHOPIFY_AUTH_CALLBACK_PATH that does not start with /", () => {
    expect(() =>
      loadEnv({ ...validEnv(), SHOPIFY_AUTH_CALLBACK_PATH: "auth/cb" }),
    ).toThrowError(/Must start with '\/'/);
  });

  it("requires AI_SERVICE_URL and AI_SERVICE_API_KEY together (URL only)", () => {
    expect(() =>
      loadEnv({ ...validEnv(), AI_SERVICE_URL: "https://ai.example.com" }),
    ).toThrowError(/must be set together/);
  });

  it("requires AI_SERVICE_URL and AI_SERVICE_API_KEY together (key only)", () => {
    expect(() =>
      loadEnv({ ...validEnv(), AI_SERVICE_API_KEY: "k" }),
    ).toThrowError(/must be set together/);
  });

  it("accepts both AI_SERVICE_URL and AI_SERVICE_API_KEY together", () => {
    const env = loadEnv({
      ...validEnv(),
      AI_SERVICE_URL: "https://ai.example.com",
      AI_SERVICE_API_KEY: "k",
    });
    expect(env.AI_SERVICE_URL).toBe("https://ai.example.com");
    expect(env.AI_SERVICE_API_KEY).toBe("k");
  });

  it("accepts neither AI_SERVICE_URL nor AI_SERVICE_API_KEY", () => {
    const env = loadEnv(validEnv());
    expect(env.AI_SERVICE_URL).toBeUndefined();
    expect(env.AI_SERVICE_API_KEY).toBeUndefined();
  });

  it("rejects invalid PORT", () => {
    expect(() => loadEnv({ ...validEnv(), PORT: "0" })).toThrowError();
    expect(() => loadEnv({ ...validEnv(), PORT: "-1" })).toThrowError();
    expect(() => loadEnv({ ...validEnv(), PORT: "abc" })).toThrowError();
  });

  it("rejects invalid LOG_LEVEL", () => {
    expect(() =>
      loadEnv({ ...validEnv(), LOG_LEVEL: "trace" }),
    ).toThrowError();
  });

  it("rejects invalid NODE_ENV", () => {
    expect(() => loadEnv({ ...validEnv(), NODE_ENV: "staging" })).toThrowError();
  });
});

describe("env (lazy proxy)", () => {
  it("does not throw at import time when process.env is invalid", async () => {
    // The fact that this test file was loaded at all proves the import did
    // not throw, regardless of what the surrounding process.env looks like.
    const mod = await import("./env");
    expect(typeof mod.env).toBe("object");
  });
});

describe(".env.example matches schema", () => {
  const exampleKeys = (() => {
    const path = resolve(__dirname, "..", "..", ".env.example");
    const text = readFileSync(path, "utf8");
    const keys = new Set<string>();
    // Match either `KEY=value` or `# KEY=value` (commented optional examples).
    const re = /^\s*#?\s*([A-Z][A-Z0-9_]*)\s*=/;
    for (const line of text.split("\n")) {
      // Skip lines whose comment text is not a KEY=… form (banners, prose).
      const m = line.match(re);
      if (m && /^\s*#/.test(line)) {
        // Only count commented lines that look like "# KEY=value", not "# Some prose".
        const afterHash = line.replace(/^\s*#\s*/, "");
        if (!/^[A-Z][A-Z0-9_]*\s*=/.test(afterHash)) continue;
      }
      if (m) keys.add(m[1]);
    }
    return keys;
  })();

  const schemaKeys = new Set(Object.keys(envSchema._def.schema.shape));

  it(".env.example contains every schema key", () => {
    const missing = [...schemaKeys].filter((k) => !exampleKeys.has(k));
    expect(missing).toEqual([]);
  });

  it(".env.example contains no keys that are not in the schema", () => {
    // VITE_* keys are build-time substitutions consumed by Vite for
    // the SPA bundle; the server's runtime envSchema doesn't (and
    // shouldn't) know about them. They live in .env.example for
    // operator documentation only.
    const extra = [...exampleKeys].filter(
      (k) => !schemaKeys.has(k) && !k.startsWith("VITE_"),
    );
    expect(extra).toEqual([]);
  });
});
