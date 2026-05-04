import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    exclude: ["node_modules", "dist", "extensions"],
    // Run setup before every test file's imports resolve. This is required
    // because src/config/logger and src/config/database read env at module
    // load time.
    setupFiles: ["./tests/setup.ts"],
    // Each test file gets a fresh module registry so the lazy env Proxy
    // cache does not leak between files.
    isolate: true,
  },
});
