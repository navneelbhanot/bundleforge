import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    exclude: ["node_modules", "dist", "extensions"],
    // Each test file gets a fresh module registry so the lazy env Proxy
    // cache does not leak between files.
    isolate: true,
  },
});
