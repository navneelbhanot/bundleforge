import { describe, it, expect, beforeEach } from "vitest";

import {
  _resetSentryForTesting,
  captureException,
  initSentry,
} from "./sentry";

describe("Sentry config", () => {
  beforeEach(() => {
    _resetSentryForTesting();
    delete process.env.SENTRY_DSN;
  });

  it("initSentry returns false when SENTRY_DSN is unset", () => {
    expect(initSentry()).toBe(false);
  });

  it("captureException is a no-op when not initialized", () => {
    // Just asserts no throw. The real Sentry SDK is not loaded.
    expect(() => captureException(new Error("test"))).not.toThrow();
  });

  it("captureException is a no-op even with context when not initialized", () => {
    expect(() =>
      captureException(new Error("test"), { reqId: "abc" }),
    ).not.toThrow();
  });
});
