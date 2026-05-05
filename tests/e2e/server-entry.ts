/**
 * Entry point for the Playwright webServer. Calls startServer()
 * unconditionally — the auto-listen at the bottom of
 * src/server/index.ts is gated on NODE_ENV !== "test", but our suite
 * deliberately runs with NODE_ENV=test so it gets MemorySessionStorage
 * for free.
 */
import { startServer } from "../../src/server";

void startServer();
