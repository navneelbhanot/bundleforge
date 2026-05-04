/**
 * Vitest setup file. Runs before every test file's imports are resolved.
 *
 * Many src/* modules touch the env Proxy at module load (logger,
 * database). Populating a valid env here prevents those imports from
 * triggering EnvValidationError before tests can override anything.
 */
process.env.SHOPIFY_API_KEY ??= "test-key";
process.env.SHOPIFY_API_SECRET ??= "test-secret";
process.env.SHOPIFY_SCOPES ??= "read_products,write_products";
process.env.SHOPIFY_APP_URL ??= "https://test.example.com";
process.env.DATABASE_URL ??= "postgres://test:test@localhost:5432/test";
process.env.REDIS_URL ??= "redis://localhost:6379";
process.env.ENCRYPTION_KEY ??= "a".repeat(64);
process.env.NODE_ENV ??= "test";
