import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Set `root` explicitly so the build can be invoked from either the repo
// root (`vite build -c frontend/vite.config.ts`) or from frontend/.
export default defineConfig({
  root: __dirname,
  plugins: [react()],
  server: { port: 5173 },
  build: {
    outDir: path.resolve(__dirname, "..", "dist", "frontend"),
    emptyOutDir: true,
    // Sourcemaps enabled while we're debugging the embedded admin so
    // production stack traces map back to source files. Re-evaluate
    // before public launch — exposes source structure under /assets/.
    sourcemap: true,
  },
});
